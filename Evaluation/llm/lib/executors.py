"""Concrete tool implementations.

Each executor returns a ToolOutcome fed back to the model as a
tool_result. Large outputs are truncated at 32 KB inline; the
TranscriptWriter spills to a sidecar beyond 16 KB.
"""

from __future__ import annotations

import json
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import requests

from lib.guard import Guard, GuardViolation

RESPONSE_TRUNC_BYTES = 32 * 1024
DEFAULT_TIMEOUT_S = 30
SHELL_MEMORY_LIMIT = "256m"
SHELL_IMAGE = "llm-trial-shell:latest"


@dataclass
class ExecutorContext:
    guard: Guard
    port: int
    scratch_host_dir: Path
    expected_flags_for_ctf: dict[str, str] = field(default_factory=dict)
    extra_ports: set[int] = field(default_factory=set)

    @property
    def allowed_ports(self) -> set[int]:
        return {self.port, *self.extra_ports}


@dataclass
class ToolOutcome:
    content: str
    elapsed_ms: int
    ended_run: bool = False
    end_reason: str | None = None
    submitted_flag: str | None = None
    submit_accepted: bool | None = None


def run_tool(
    name: str,
    arguments: dict[str, Any],
    ctx: ExecutorContext,
) -> ToolOutcome:
    start = time.perf_counter()
    try:
        if name == "http_request":
            return _ok(_http_request(arguments, ctx), start)
        if name == "shell":
            return _ok(_shell(arguments, ctx), start)
        if name == "read_local":
            return _ok(_read_local(arguments, ctx), start)
        if name == "submit_flag":
            return _submit_flag(arguments, ctx, start)
        if name == "give_up":
            return _give_up(arguments, start)
        raise KeyError(f"unknown tool: {name}")
    except GuardViolation as e:
        return ToolOutcome(content=f"[guard] {e}", elapsed_ms=_ms(start))
    except Exception as e:
        return ToolOutcome(
            content=f"[error] {type(e).__name__}: {e}",
            elapsed_ms=_ms(start),
        )


def _ms(start: float) -> int:
    return int((time.perf_counter() - start) * 1000)


def _ok(content: str, start: float) -> ToolOutcome:
    return ToolOutcome(content=content, elapsed_ms=_ms(start))


def _truncate(text: str, label: str) -> str:
    if len(text.encode("utf-8")) > RESPONSE_TRUNC_BYTES:
        return text[:RESPONSE_TRUNC_BYTES] + f"\n... [{label} truncated]"
    return text


def _http_request(args: dict[str, Any], ctx: ExecutorContext) -> str:
    method = str(args.get("method", "GET")).upper()
    url = str(args["url"])
    ctx.guard.check_url(url, ctx.allowed_ports)
    headers = args.get("headers") or {}
    body = args.get("body")
    resp = requests.request(
        method=method,
        url=url,
        headers=headers,
        data=body,
        timeout=DEFAULT_TIMEOUT_S,
        allow_redirects=False,
    )
    return json.dumps(
        {
            "status": resp.status_code,
            "headers": dict(resp.headers),
            "body": _truncate(resp.text, "body"),
        }
    )


def _shell(args: dict[str, Any], ctx: ExecutorContext) -> str:
    command = str(args["command"])
    scratch = ctx.scratch_host_dir.resolve()
    proc = subprocess.run(
        [
            "docker", "run", "--rm",
            "--add-host=host.docker.internal:host-gateway",
            "--memory", SHELL_MEMORY_LIMIT,
            "--cpus", "1",
            "-v", f"{scratch}:/scratch",
            "-w", "/scratch",
            SHELL_IMAGE,
            "sh", "-c", command,
        ],
        capture_output=True,
        text=True,
        timeout=DEFAULT_TIMEOUT_S,
    )
    return json.dumps(
        {
            "stdout": _truncate(proc.stdout, "stdout"),
            "stderr": _truncate(proc.stderr, "stderr"),
            "exit_code": proc.returncode,
        }
    )


def _read_local(args: dict[str, Any], ctx: ExecutorContext) -> str:
    rel = str(args["path"]).lstrip("/")
    if rel.startswith("scratch/"):
        rel = rel[len("scratch/"):]
    elif rel == "scratch":
        rel = ""
    scratch = ctx.scratch_host_dir.resolve()
    target = (scratch / rel).resolve()
    try:
        target.relative_to(scratch)
    except ValueError:
        raise GuardViolation(f"read_local path outside scratch: {target}")
    if not target.exists():
        return json.dumps({"error": "not found"})
    if not target.is_file():
        return json.dumps({"error": "not a file"})
    data = target.read_bytes()
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return json.dumps({"error": "not utf-8", "bytes": len(data)})
    return json.dumps({"content": _truncate(text, "content")})


def _submit_flag(
    args: dict[str, Any],
    ctx: ExecutorContext,
    start: float,
) -> ToolOutcome:
    flag = str(args["flag"])
    accepted = flag in set(ctx.expected_flags_for_ctf.values())
    return ToolOutcome(
        content=json.dumps({"accepted": accepted}),
        elapsed_ms=_ms(start),
        ended_run=True,
        end_reason="submitted",
        submitted_flag=flag,
        submit_accepted=accepted,
    )


def _give_up(args: dict[str, Any], start: float) -> ToolOutcome:
    return ToolOutcome(
        content=json.dumps({"ok": True, "reason": str(args.get("reason", ""))}),
        elapsed_ms=_ms(start),
        ended_run=True,
        end_reason="gave_up",
    )
