"""JSONL transcript writer + validator.

Event schema (one JSON object per line):

- meta (first):   run_id, model_id, prompt_hash, temperature,
                  image_tag, timestamp, condition, ctf, test_user
- user_message / assistant_message: role, content, [reasoning]
- tool_call:      call_id, name, arguments
- tool_result:    call_id, elapsed_ms, content, [sidecar]
- submit:         flag, accepted
- end (last):     reason
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SIDECAR_THRESHOLD_BYTES = 16 * 1024


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class TranscriptWriter:
    def __init__(self, path: Path | str, run_dir: Path | str) -> None:
        self.path = Path(path)
        self.run_dir = Path(run_dir)
        self.sidecars_dir = self.run_dir / "sidecars"
        self.sidecars_dir.mkdir(parents=True, exist_ok=True)
        self._counter = 0
        self._f = open(self.path, "w", encoding="utf-8")

    def meta(self, **fields: Any) -> None:
        self._write({"event": "meta", "timestamp": utc_now_iso(), **fields})

    def user_message(self, content: str) -> None:
        self._write({"event": "user_message", "role": "user", "content": content})

    def assistant_message(
        self, content: str, reasoning: str | None = None
    ) -> None:
        ev: dict[str, Any] = {
            "event": "assistant_message",
            "role": "assistant",
            "content": content,
        }
        if reasoning:
            ev["reasoning"] = reasoning
        self._write(ev)

    def tool_call(
        self, call_id: str, name: str, arguments: dict[str, Any]
    ) -> None:
        self._write(
            {
                "event": "tool_call",
                "call_id": call_id,
                "name": name,
                "arguments": arguments,
            }
        )

    def tool_result(
        self, call_id: str, elapsed_ms: int, content: str
    ) -> None:
        self._write(
            {
                "event": "tool_result",
                "call_id": call_id,
                "elapsed_ms": elapsed_ms,
                "content": content,
            }
        )

    def submit(self, flag: str, accepted: bool) -> None:
        self._write({"event": "submit", "flag": flag, "accepted": accepted})

    def end(self, reason: str) -> None:
        self._write({"event": "end", "reason": reason})
        self.close()

    def close(self) -> None:
        if not self._f.closed:
            self._f.close()

    def __enter__(self) -> "TranscriptWriter":
        return self

    def __exit__(self, *_exc_info: Any) -> None:
        self.close()

    def _write(self, event: dict[str, Any]) -> None:
        event = self._maybe_sidecar(event)
        self._f.write(json.dumps(event, ensure_ascii=False) + "\n")
        self._f.flush()

    def _maybe_sidecar(self, event: dict[str, Any]) -> dict[str, Any]:
        content = event.get("content")
        if (
            isinstance(content, str)
            and len(content.encode("utf-8")) > SIDECAR_THRESHOLD_BYTES
        ):
            self._counter += 1
            name = f"sidecar_{self._counter:04d}.txt"
            (self.sidecars_dir / name).write_text(content, encoding="utf-8")
            truncated = (
                content[:1024]
                + f"... [truncated; full in sidecars/{name}]"
            )
            return {**event, "content": truncated, "sidecar": name}
        return event


def validate(path: Path | str) -> None:
    """Re-parse a transcript end-to-end; raise if structure invalid."""
    events: list[str] = []
    with open(path, "r", encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            s = line.strip()
            if not s:
                continue
            try:
                obj = json.loads(s)
            except json.JSONDecodeError as e:
                raise ValueError(f"line {i}: invalid JSON: {e}") from e
            ev = obj.get("event")
            if not ev:
                raise ValueError(f"line {i}: missing 'event' field")
            events.append(ev)
    if not events:
        raise ValueError("empty transcript")
    if events[0] != "meta":
        raise ValueError(f"first event must be 'meta', got '{events[0]}'")
    if events[-1] != "end":
        raise ValueError(f"last event must be 'end', got '{events[-1]}'")
