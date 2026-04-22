"""Orchestrator: iterate the run matrix phase-by-phase.

Each cell is a (model, ctf, condition) tuple realised by invoking
`harness.py` in a fresh subprocess. Between runs that share a CTF we
reset that CTF's docker stack (`docker compose down -v && up -d`).

Phases (from PLAN.md Section 2):

- `cold-probe`   --- 3 models x 9 CTFs passive, no stack  (27 runs)
- `pilot`        --- Sonnet x {1,5,9} x {passive, agentic}  (6)
- `primary`      --- {Sonnet, GPT-5-mini} x 9 x {passive, agentic}  (36)
- `flagship`     --- Opus x {1,5,9} x {passive, agentic}  (6)
- `null-prompt`  --- Opus x CTF1 passive, empty doc pack  (1)

Usage:
  python run_matrix.py --phase cold-probe
  python run_matrix.py --phase pilot --dry-run
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent                        # Advanced-Project/
CTFS_DIR = REPO / "CTFs"


# --- Matrix definitions -----------------------------------------------------


@dataclass(frozen=True)
class CtfSpec:
    ctf: int
    dir_name: str
    ports: tuple[int, ...]      # primary first; extras follow
    test_user: str


CTF_SPECS: dict[int, CtfSpec] = {
    1: CtfSpec(1, "Basic_1_Nodejs", (3000,), "llmu01"),
    2: CtfSpec(2, "CTF_2_pswd_manager", (4000,), "llmu02"),
    3: CtfSpec(3, "CTF_3_HR-system", (5174, 8004), "llmu03"),
    4: CtfSpec(4, "CTF_4_corporate_helpdesk", (5174, 4001), "llmu04"),
    5: CtfSpec(5, "CTF_5_internal_blog", (5175,), "llmu05"),
    6: CtfSpec(6, "CTF_6_veridian", (5180,), "llmu06"),
    7: CtfSpec(7, "CTF_7_notes_app", (3001,), "llmu07"),
    8: CtfSpec(8, "CTF_8_gazette", (3002,), "llmu08"),
    9: CtfSpec(9, "CTF_9_dunholm", (3003,), "llmu09"),
}


MODELS = {
    "sonnet": "claude-sonnet-4-6",
    "gpt5mini": "gpt-5-mini",
    "opus": "claude-opus-4-7",
}


FLAGSHIP_CTFS = (1, 5, 9)


# --- Phase enumeration ------------------------------------------------------


@dataclass(frozen=True)
class Cell:
    model_key: str
    ctf: int
    condition: str      # passive | agentic | cold-probe
    tag: str            # label for run_id
    needs_stack: bool


def phase_cells(phase: str) -> list[Cell]:
    cells: list[Cell] = []

    if phase == "cold-probe":
        for mk in MODELS:
            for ctf in range(1, 10):
                cells.append(Cell(mk, ctf, "cold-probe", "cold", False))

    elif phase == "pilot":
        for ctf in FLAGSHIP_CTFS:
            for cond in ("passive", "agentic"):
                cells.append(Cell("sonnet", ctf, cond, "pilot", True))

    elif phase == "primary":
        for mk in ("sonnet", "gpt5mini"):
            for ctf in range(1, 10):
                for cond in ("passive", "agentic"):
                    cells.append(Cell(mk, ctf, cond, "primary", True))

    elif phase == "flagship":
        for ctf in FLAGSHIP_CTFS:
            for cond in ("passive", "agentic"):
                cells.append(Cell("opus", ctf, cond, "flagship", True))

    elif phase == "null-prompt":
        cells.append(Cell("opus", 1, "passive", "null", True))

    else:
        raise ValueError(f"unknown phase: {phase}")

    return cells


# --- Stack lifecycle --------------------------------------------------------


def stack_reset(ctf: int, dry_run: bool = False) -> None:
    """docker compose down -v && up -d for the CTF's stack."""
    spec = CTF_SPECS[ctf]
    cwd = CTFS_DIR / spec.dir_name
    if not cwd.exists():
        raise FileNotFoundError(f"CTF dir missing: {cwd}")

    for cmd in (
        ["docker", "compose", "down", "-v"],
        ["docker", "compose", "up", "-d"],
    ):
        _log(f"[stack] {cwd.name}: {' '.join(cmd)}")
        if dry_run:
            continue
        subprocess.run(cmd, cwd=cwd, check=True)


def stack_down(ctf: int, dry_run: bool = False) -> None:
    spec = CTF_SPECS[ctf]
    cwd = CTFS_DIR / spec.dir_name
    cmd = ["docker", "compose", "down", "-v"]
    _log(f"[stack] {cwd.name}: {' '.join(cmd)}")
    if not dry_run:
        subprocess.run(cmd, cwd=cwd, check=False)


# --- Per-cell invocation ----------------------------------------------------


def run_cell(
    cell: Cell,
    *,
    runs_dir: Path,
    dry_run: bool,
    extended_thinking_budget: int | None,
) -> int:
    spec = CTF_SPECS[cell.ctf]
    model_id = MODELS[cell.model_key]
    run_id = _mint_run_id(cell, spec, model_id)

    ports_str = ",".join(str(p) for p in spec.ports)
    cmd = [
        sys.executable, str(HERE / "harness.py"),
        "--model", model_id,
        "--condition", cell.condition,
        "--ctf", str(cell.ctf),
        "--test-user", spec.test_user,
        "--port", ports_str,
        "--run-id", run_id,
        "--runs-dir", str(runs_dir),
    ]
    if cell.model_key == "opus" and extended_thinking_budget:
        cmd += ["--extended-thinking-budget", str(extended_thinking_budget)]

    _log(f"[cell] {run_id}")
    if dry_run:
        _log("  " + " ".join(cmd))
        return 0
    proc = subprocess.run(cmd)
    return proc.returncode


def _mint_run_id(cell: Cell, spec: CtfSpec, model_id: str) -> str:
    ts = time.strftime("%Y%m%d-%H%M%S")
    short = uuid.uuid4().hex[:6]
    safe_model = model_id.replace(".", "-")
    return (
        f"{cell.tag}_ctf{spec.ctf:02d}_{cell.condition}_{safe_model}_{ts}_{short}"
    )


# --- Driver -----------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--phase", required=True,
        choices=["cold-probe", "pilot", "primary", "flagship", "null-prompt"],
    )
    ap.add_argument("--runs-dir", default=str(HERE / "runs"))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--extended-thinking-budget", type=int, default=None,
        help="Pass-through for flagship Opus runs. Omit to disable.",
    )
    ap.add_argument(
        "--only-ctf", type=int, default=None,
        help="Restrict to a single CTF number.",
    )
    args = ap.parse_args(argv)

    cells = phase_cells(args.phase)
    if args.only_ctf is not None:
        cells = [c for c in cells if c.ctf == args.only_ctf]

    runs_dir = Path(args.runs_dir)
    runs_dir.mkdir(parents=True, exist_ok=True)

    _log(f"[phase] {args.phase} --- {len(cells)} cells")

    # Group by CTF so we bring the stack up once per CTF and run every
    # cell for that CTF before tearing down. Preserves the "fresh per
    # CTF" invariant without paying docker startup for every cell.
    by_ctf: dict[int, list[Cell]] = {}
    for c in cells:
        by_ctf.setdefault(c.ctf, []).append(c)

    failures: list[str] = []
    for ctf, ctf_cells in by_ctf.items():
        needs_stack = any(c.needs_stack for c in ctf_cells)
        if needs_stack:
            try:
                stack_reset(ctf, dry_run=args.dry_run)
            except Exception as e:
                _log(f"[stack] ctf{ctf}: reset failed: {e}")
                failures.extend(
                    _mint_run_id(c, CTF_SPECS[ctf], MODELS[c.model_key])
                    for c in ctf_cells
                )
                continue
        try:
            for c in ctf_cells:
                rc = run_cell(
                    c,
                    runs_dir=runs_dir,
                    dry_run=args.dry_run,
                    extended_thinking_budget=args.extended_thinking_budget,
                )
                if rc != 0:
                    failures.append(f"ctf{ctf}/{c.model_key}/{c.condition}")
        finally:
            if needs_stack:
                stack_down(ctf, dry_run=args.dry_run)

    _log(f"[phase] done. {len(cells) - len(failures)}/{len(cells)} cells ok.")
    if failures:
        _log("failures:")
        for f in failures:
            _log(f"  {f}")
        return 1
    return 0


def _log(msg: str) -> None:
    print(msg, flush=True)


if __name__ == "__main__":
    sys.exit(main())
