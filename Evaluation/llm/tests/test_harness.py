"""Smoke tests for harness.run_agentic_loop and harness.run_passive.

No real model/API: a FakeClient scripts responses turn-by-turn so the
loop's end conditions (submit, give-up, truncation) can be asserted.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from harness import (
    run_agentic_loop,
    run_passive,
    substitute,
)
from lib.executors import ExecutorContext
from lib.guard import Guard
from lib.models import ModelResponse, ToolResult
from lib.transcripts import TranscriptWriter, validate


class FakeClient:
    """Scripted ModelClient. Appends a message per call; returns next
    pre-set response on send()."""

    def __init__(self, responses: list[ModelResponse]) -> None:
        self._responses = list(responses)
        self.messages: list = []
        self.tool_results: list = []

    def set_user(self, text: str) -> None:
        self.messages.append(("user", text))

    def set_tool_results(self, results: list[ToolResult]) -> None:
        self.tool_results.append(results)

    def send(self) -> ModelResponse:
        if not self._responses:
            raise RuntimeError("FakeClient exhausted")
        return self._responses.pop(0)


def _r(text="", tool_uses=None, stop="end_turn") -> ModelResponse:
    return ModelResponse(
        text=text,
        reasoning=None,
        tool_uses=tool_uses or [],
        stop_reason=stop,
        tokens_input=10,
        tokens_output=5,
        cache_hit_tokens=0,
    )


@pytest.fixture
def run_dir(tmp_path: Path) -> Path:
    d = tmp_path / "run001"
    d.mkdir()
    return d


@pytest.fixture
def exec_ctx(run_dir: Path) -> ExecutorContext:
    scratch = run_dir / "scratch"
    scratch.mkdir()
    return ExecutorContext(
        guard=Guard(),
        port=3001,
        scratch_host_dir=scratch,
        expected_flags_for_ctf={"1": "basicflag1{abc_user}"},
    )


class TestPassive:
    def test_records_assistant_message(self, run_dir):
        client = FakeClient([_r(text="I would submit basicflag1{abc_user}")])
        path = run_dir / "transcript.jsonl"
        with TranscriptWriter(path, run_dir=run_dir) as w:
            w.meta(run_id="x", ctf="1")
            info = run_passive(client, w, "hello")
            w.end(reason=info.reason)
        validate(path)
        assert info.reason == "gave_up"
        lines = path.read_text().strip().splitlines()
        events = [json.loads(ln)["event"] for ln in lines]
        assert events == ["meta", "user_message", "assistant_message", "end"]


class TestAgenticLoop:
    def test_final_text_no_tools_ends_as_gave_up(self, run_dir, exec_ctx):
        client = FakeClient([_r(text="done")])
        path = run_dir / "transcript.jsonl"
        with TranscriptWriter(path, run_dir=run_dir) as w:
            w.meta(run_id="x", ctf="1")
            info = run_agentic_loop(client, w, exec_ctx, "go")
            w.end(reason=info.reason)
        validate(path)
        assert info.reason == "gave_up"
        assert info.tool_calls == 0

    def test_submit_flag_ends_submitted(self, run_dir, exec_ctx):
        client = FakeClient([
            _r(
                tool_uses=[{
                    "id": "tu1", "name": "submit_flag",
                    "arguments": {"flag": "basicflag1{abc_user}"},
                }],
                stop="tool_use",
            ),
        ])
        path = run_dir / "transcript.jsonl"
        with TranscriptWriter(path, run_dir=run_dir) as w:
            w.meta(run_id="x", ctf="1")
            info = run_agentic_loop(client, w, exec_ctx, "go")
            w.end(reason=info.reason)
        validate(path)
        assert info.reason == "submitted"
        assert info.submitted_flag == "basicflag1{abc_user}"
        assert info.submit_accepted is True

    def test_give_up_tool_ends_gave_up(self, run_dir, exec_ctx):
        client = FakeClient([
            _r(tool_uses=[{
                "id": "tu1", "name": "give_up",
                "arguments": {"reason": "stuck"},
            }], stop="tool_use"),
        ])
        path = run_dir / "transcript.jsonl"
        with TranscriptWriter(path, run_dir=run_dir) as w:
            w.meta(run_id="x", ctf="1")
            info = run_agentic_loop(client, w, exec_ctx, "go")
            w.end(reason=info.reason)
        validate(path)
        assert info.reason == "gave_up"

    def test_http_then_submit(self, run_dir, exec_ctx):
        client = FakeClient([
            _r(tool_uses=[{
                "id": "t1", "name": "http_request",
                "arguments": {"method": "GET", "url": "http://localhost:3001/"},
            }], stop="tool_use"),
            _r(tool_uses=[{
                "id": "t2", "name": "submit_flag",
                "arguments": {"flag": "basicflag1{abc_user}"},
            }], stop="tool_use"),
        ])
        fake_resp = MagicMock(status_code=200, headers={}, text="<html/>")
        path = run_dir / "transcript.jsonl"
        with patch("lib.executors.requests.request", return_value=fake_resp):
            with TranscriptWriter(path, run_dir=run_dir) as w:
                w.meta(run_id="x", ctf="1")
                info = run_agentic_loop(client, w, exec_ctx, "go")
                w.end(reason=info.reason)
        validate(path)
        assert info.reason == "submitted"
        assert info.tool_calls == 2

    def test_truncation_at_turn_cap(self, run_dir, exec_ctx):
        """Three responses, each with one tool call; cap = 2 turns.
        The loop executes turn 1 and turn 2 (issuing a tool call each),
        then refuses to enter turn 3 and returns truncated."""
        def tool(i):
            return {
                "id": f"t{i}", "name": "http_request",
                "arguments": {"method": "GET", "url": "http://localhost:3001/"},
            }
        client = FakeClient([
            _r(tool_uses=[tool(1)], stop="tool_use"),
            _r(tool_uses=[tool(2)], stop="tool_use"),
            _r(tool_uses=[tool(3)], stop="tool_use"),
        ])
        fake_resp = MagicMock(status_code=200, headers={}, text="ok")
        path = run_dir / "transcript.jsonl"
        with patch("lib.executors.requests.request", return_value=fake_resp):
            with TranscriptWriter(path, run_dir=run_dir) as w:
                w.meta(run_id="x", ctf="1")
                info = run_agentic_loop(
                    client, w, exec_ctx, "go", max_turns=2,
                )
                w.end(reason=info.reason)
        validate(path)
        assert info.reason == "truncated"
        assert info.turns == 2
        assert info.tool_calls == 2

    def test_truncation_counts_turns_not_tool_calls(self, run_dir, exec_ctx):
        """One turn that issues three parallel tool calls counts as ONE
        turn, not three. With `max_turns=1` the loop runs the turn in
        full then truncates before turn 2."""
        def tool(i):
            return {
                "id": f"t{i}", "name": "http_request",
                "arguments": {"method": "GET", "url": "http://localhost:3001/"},
            }
        client = FakeClient([
            _r(tool_uses=[tool(1), tool(2), tool(3)], stop="tool_use"),
            _r(text="would continue"),
        ])
        fake_resp = MagicMock(status_code=200, headers={}, text="ok")
        path = run_dir / "transcript.jsonl"
        with patch("lib.executors.requests.request", return_value=fake_resp):
            with TranscriptWriter(path, run_dir=run_dir) as w:
                w.meta(run_id="x", ctf="1")
                info = run_agentic_loop(
                    client, w, exec_ctx, "go", max_turns=1,
                )
                w.end(reason=info.reason)
        validate(path)
        assert info.reason == "truncated"
        assert info.turns == 1
        assert info.tool_calls == 3


class TestSubstitute:
    def test_replaces_all_placeholders(self):
        tmpl = "u=<TEST_USER> p=<PORT> doc=<DOC_PACK> l=<LOGIN_PAGE_HTML_SNAPSHOT>"
        out = substitute(
            tmpl,
            test_user="alice", port=3001,
            doc_pack="DOCS", landing_snapshot="LAND",
        )
        assert out == "u=alice p=3001 doc=DOCS l=LAND"
