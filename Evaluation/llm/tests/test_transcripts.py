import json
from pathlib import Path

import pytest

from lib.transcripts import SIDECAR_THRESHOLD_BYTES, TranscriptWriter, validate


@pytest.fixture
def run_dir(tmp_path: Path) -> Path:
    d = tmp_path / "runs" / "test_run"
    d.mkdir(parents=True)
    return d


class TestWriterHappyPath:
    def test_well_formed_transcript_validates(self, run_dir):
        path = run_dir / "transcript.jsonl"
        with TranscriptWriter(path, run_dir) as w:
            w.meta(
                run_id="r1",
                model_id="claude-sonnet-4-6",
                prompt_hash="deadbeef",
                temperature=0.0,
                image_tag="trial-2026-04-21",
                condition="agentic",
                ctf=1,
                test_user="abcd12",
            )
            w.user_message("hello")
            w.assistant_message("thinking", reasoning="chain")
            w.tool_call("c1", "http_request", {"url": "http://localhost:3001/"})
            w.tool_result("c1", 42, "OK 200")
            w.submit("basicflag1{abc_abcd12}", accepted=True)
            w.end("submitted")

        validate(path)

        events = [json.loads(line) for line in path.read_text().splitlines()]
        assert events[0]["event"] == "meta"
        assert events[-1]["event"] == "end"
        assert events[-1]["reason"] == "submitted"


class TestValidate:
    def test_rejects_empty(self, run_dir):
        path = run_dir / "empty.jsonl"
        path.write_text("")
        with pytest.raises(ValueError, match="empty"):
            validate(path)

    def test_rejects_missing_meta_first(self, run_dir):
        path = run_dir / "bad.jsonl"
        path.write_text(
            json.dumps({"event": "user_message", "role": "user", "content": "x"})
            + "\n"
            + json.dumps({"event": "end", "reason": "x"})
            + "\n"
        )
        with pytest.raises(ValueError, match="first event"):
            validate(path)

    def test_rejects_missing_end_last(self, run_dir):
        path = run_dir / "bad.jsonl"
        path.write_text(
            json.dumps({"event": "meta", "timestamp": "t"}) + "\n"
            + json.dumps(
                {"event": "user_message", "role": "user", "content": "x"}
            )
            + "\n"
        )
        with pytest.raises(ValueError, match="last event"):
            validate(path)

    def test_rejects_missing_event_field(self, run_dir):
        path = run_dir / "bad.jsonl"
        path.write_text(json.dumps({"role": "user"}) + "\n")
        with pytest.raises(ValueError, match="missing 'event'"):
            validate(path)

    def test_rejects_invalid_json(self, run_dir):
        path = run_dir / "bad.jsonl"
        path.write_text("not json\n")
        with pytest.raises(ValueError, match="invalid JSON"):
            validate(path)


class TestSidecar:
    def test_large_content_split_off(self, run_dir):
        path = run_dir / "transcript.jsonl"
        big = "x" * (SIDECAR_THRESHOLD_BYTES + 100)
        with TranscriptWriter(path, run_dir) as w:
            w.meta(run_id="r1")
            w.tool_result("c1", 1, big)
            w.end("submitted")

        events = [json.loads(line) for line in path.read_text().splitlines()]
        tr = events[1]
        assert tr["event"] == "tool_result"
        assert len(tr["content"]) < len(big)
        assert "sidecar" in tr
        sidecar = run_dir / "sidecars" / tr["sidecar"]
        assert sidecar.read_text() == big

    def test_small_content_inline(self, run_dir):
        path = run_dir / "transcript.jsonl"
        with TranscriptWriter(path, run_dir) as w:
            w.meta(run_id="r1")
            w.tool_result("c1", 1, "tiny")
            w.end("submitted")
        events = [json.loads(line) for line in path.read_text().splitlines()]
        assert events[1]["content"] == "tiny"
        assert "sidecar" not in events[1]
