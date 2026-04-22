import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from lib.executors import ExecutorContext, run_tool
from lib.guard import Guard


@pytest.fixture
def scratch_dir(tmp_path: Path) -> Path:
    d = tmp_path / "scratch"
    d.mkdir()
    return d


@pytest.fixture
def ctx(scratch_dir: Path) -> ExecutorContext:
    return ExecutorContext(
        guard=Guard(),
        port=3001,
        scratch_host_dir=scratch_dir,
        expected_flags_for_ctf={"1": "basicflag1{abc_user}"},
    )


class TestHttpRequest:
    def test_happy_path(self, ctx):
        fake = MagicMock(
            status_code=200,
            headers={"Content-Type": "text/html"},
            text="<html>hi</html>",
        )
        with patch("lib.executors.requests.request", return_value=fake) as m:
            out = run_tool(
                "http_request",
                {
                    "method": "get",
                    "url": "http://localhost:3001/",
                    "headers": {"X": "1"},
                    "body": "",
                },
                ctx,
            )
        assert not out.ended_run
        body = json.loads(out.content)
        assert body["status"] == 200
        assert body["body"] == "<html>hi</html>"
        m.assert_called_once()
        kwargs = m.call_args.kwargs
        assert kwargs["method"] == "GET"
        assert kwargs["allow_redirects"] is False
        assert kwargs["timeout"] == 30

    def test_rejects_non_localhost(self, ctx):
        out = run_tool(
            "http_request",
            {"method": "GET", "url": "http://evil.example.com:3001/"},
            ctx,
        )
        assert "guard" in out.content.lower()

    def test_rejects_wrong_port(self, ctx):
        out = run_tool(
            "http_request",
            {"method": "GET", "url": "http://localhost:9999/"},
            ctx,
        )
        assert "guard" in out.content.lower()

    def test_rejects_https(self, ctx):
        out = run_tool(
            "http_request",
            {"method": "GET", "url": "https://localhost:3001/"},
            ctx,
        )
        assert "guard" in out.content.lower()

    def test_truncates_large_body(self, ctx):
        big = "A" * (40 * 1024)
        fake = MagicMock(status_code=200, headers={}, text=big)
        with patch("lib.executors.requests.request", return_value=fake):
            out = run_tool(
                "http_request",
                {"method": "GET", "url": "http://localhost:3001/"},
                ctx,
            )
        body = json.loads(out.content)
        assert len(body["body"]) < len(big)
        assert "truncated" in body["body"]


class TestReadLocal:
    def test_reads_relative_path(self, ctx, scratch_dir):
        (scratch_dir / "note.txt").write_text("hello")
        out = run_tool("read_local", {"path": "note.txt"}, ctx)
        body = json.loads(out.content)
        assert body["content"] == "hello"

    def test_strips_scratch_prefix(self, ctx, scratch_dir):
        (scratch_dir / "note.txt").write_text("hi")
        out = run_tool("read_local", {"path": "/scratch/note.txt"}, ctx)
        body = json.loads(out.content)
        assert body["content"] == "hi"

    def test_rejects_traversal(self, ctx, scratch_dir):
        (scratch_dir.parent / "outside.txt").write_text("nope")
        out = run_tool("read_local", {"path": "../outside.txt"}, ctx)
        assert "guard" in out.content.lower()

    def test_missing_file(self, ctx):
        out = run_tool("read_local", {"path": "nope.txt"}, ctx)
        body = json.loads(out.content)
        assert body["error"] == "not found"

    def test_nested_subdir(self, ctx, scratch_dir):
        (scratch_dir / "sub").mkdir()
        (scratch_dir / "sub" / "x.txt").write_text("deep")
        out = run_tool("read_local", {"path": "sub/x.txt"}, ctx)
        body = json.loads(out.content)
        assert body["content"] == "deep"


class TestSubmitFlag:
    def test_accepts_match(self, ctx):
        out = run_tool(
            "submit_flag", {"flag": "basicflag1{abc_user}"}, ctx
        )
        body = json.loads(out.content)
        assert body["accepted"] is True
        assert out.ended_run
        assert out.end_reason == "submitted"
        assert out.submitted_flag == "basicflag1{abc_user}"
        assert out.submit_accepted is True

    def test_rejects_mismatch(self, ctx):
        out = run_tool("submit_flag", {"flag": "basicflag1{WRONG}"}, ctx)
        body = json.loads(out.content)
        assert body["accepted"] is False
        assert out.ended_run
        assert out.submit_accepted is False


class TestGiveUp:
    def test_ends_run(self, ctx):
        out = run_tool("give_up", {"reason": "stuck"}, ctx)
        assert out.ended_run
        assert out.end_reason == "gave_up"
        body = json.loads(out.content)
        assert body["ok"] is True


class TestUnknownTool:
    def test_errors_gracefully(self, ctx):
        out = run_tool("does_not_exist", {}, ctx)
        assert "error" in out.content.lower()
