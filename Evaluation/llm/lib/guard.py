"""Path and URL whitelist for the LLM trial harness.

Every filesystem open and every outbound HTTP goes through a Guard
instance. A Guard is constructed once per run with the set of
directories, files, denied names, and allowed URL target. Tests
inject their own Guard; the harness uses default_guard().
"""

from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse


class GuardViolation(Exception):
    """Raised when a path or URL falls outside the allow-list."""


class Guard:
    def __init__(
        self,
        allowed_files: set[Path] | None = None,
        allowed_dirs: set[Path] | None = None,
        deny_names: set[str] | None = None,
    ) -> None:
        self.allowed_files = {Path(p).resolve() for p in (allowed_files or set())}
        self.allowed_dirs = {Path(p).resolve() for p in (allowed_dirs or set())}
        self.deny_names = set(deny_names or set())

    def check_path(self, path: Path | str, run_dir: Path | None = None) -> Path:
        p = Path(path).resolve()
        if p.name in self.deny_names:
            raise GuardViolation(f"denied filename: {p.name}")
        if p in self.allowed_files:
            return p
        for d in self.allowed_dirs:
            if _within(p, d):
                return p
        if run_dir is not None and _within(p, Path(run_dir).resolve()):
            return p
        raise GuardViolation(f"path outside allow-list: {p}")

    def guarded_open(
        self,
        path: Path | str,
        mode: str = "r",
        run_dir: Path | None = None,
    ):
        p = self.check_path(path, run_dir=run_dir)
        if _is_write_mode(mode):
            if run_dir is None or not _within(p, Path(run_dir).resolve()):
                raise GuardViolation(f"write must be inside run_dir: {p}")
        return open(p, mode, encoding="utf-8")

    def check_url(self, url: str, allowed_port: int | set[int]) -> str:
        u = urlparse(url)
        if u.scheme != "http":
            raise GuardViolation(f"only http allowed, got scheme '{u.scheme}'")
        if u.hostname not in ("localhost", "127.0.0.1"):
            raise GuardViolation(f"only localhost allowed, got host '{u.hostname}'")
        allowed = (
            {allowed_port} if isinstance(allowed_port, int) else set(allowed_port)
        )
        if u.port not in allowed:
            raise GuardViolation(
                f"port not allowed: got '{u.port}', allowed {sorted(allowed)}"
            )
        return url


def _within(child: Path, parent: Path) -> bool:
    try:
        child.relative_to(parent)
        return True
    except ValueError:
        return False


def _is_write_mode(mode: str) -> bool:
    return any(ch in mode for ch in ("w", "a", "x")) or "+" in mode


def default_guard() -> Guard:
    """Guard the production harness uses. Rooted at Evaluation/llm/."""
    here = Path(__file__).resolve().parent.parent
    return Guard(
        allowed_files={
            here / "expected_flags.json",
            here / "flag_regexes.json",
            here / "PROMPT_HASHES.txt",
        },
        allowed_dirs={
            here / "prompts",
            here / "doc-pack",
        },
        deny_names={"SOLUTIONS.md", "workflow.md", "flags.json", "users.json"},
    )
