"""Aggregate runs/ into results.csv + flag_results.csv + tables.

Reads every `runs/<run_id>/` directory written by `harness.py`, cross-
references `usage.json` (per-run summary) and `flag_verdicts.json`
(per-flag pass + machine sub-code hint), and produces:

- `results.csv`          one row per run
- `flag_results.csv`     one row per flag slot (25 slots across 9 CTFs)
- `tables.md`            primary pass-rate table with 95% CIs

Hand-coded sub-codes (RUBRIC.md) overlay the machine hint via an
optional `--coding <path>` CSV on the `--kappa` subcommand.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


HERE = Path(__file__).resolve().parent


# Rough pricing snapshot. $ per million tokens (input / output).
# Used for the `cost_usd` column only; diagnostic, not accounting.
PRICING: dict[str, tuple[float, float]] = {
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-haiku-4-5": (1.0, 5.0),
    "claude-opus-4-7": (15.0, 75.0),
    "gpt-5-mini": (0.25, 2.0),
    "gpt-5": (1.25, 10.0),
    "gemini-2.5-pro": (1.25, 10.0),
    "gemini-2.5-flash": (0.30, 2.50),
}


RESULTS_COLS = [
    "run_id", "model_id", "condition", "ctf", "test_user",
    "tool_calls", "wall_clock_sec", "final_state",
    "candidate_flag", "candidate_flag_matches",
    "tokens_input", "tokens_output", "cache_hit_tokens", "cost_usd",
]

FLAG_RESULTS_COLS = [
    "run_id", "ctf", "flag_index", "pass",
    "sub_code", "first_tool_call_index", "enabling_artefact",
    "double_rated", "secondary_sub_code",
]


# --------------------------------------------------------------------
# Loading one run
# --------------------------------------------------------------------


@dataclass
class RunRecord:
    run_id: str
    usage: dict
    verdicts: list[dict]
    transcript_path: Path


def iter_runs(runs_dir: Path) -> Iterable[RunRecord]:
    if not runs_dir.exists():
        return
    for sub in sorted(runs_dir.iterdir()):
        if not sub.is_dir():
            continue
        usage_path = sub / "usage.json"
        verdict_path = sub / "flag_verdicts.json"
        if not usage_path.exists() or not verdict_path.exists():
            continue
        yield RunRecord(
            run_id=sub.name,
            usage=json.loads(usage_path.read_text()),
            verdicts=json.loads(verdict_path.read_text()),
            transcript_path=sub / "transcript.jsonl",
        )


def best_candidate(verdicts: list[dict], usage: dict) -> tuple[str, str]:
    """Return (candidate_flag_str, candidate_flag_matches) where
    matches is byte_match / regex_only / none. Uses submitted flag if
    present; otherwise reports aggregate over flag slots."""
    submitted = usage.get("submitted_flag")
    if any(v["pass"] for v in verdicts):
        match = "byte_match"
    elif submitted:
        match = "regex_only"  # submit itself implies regex (by design)
    else:
        match = "none"
    return submitted or "", match


def cost_usd(model_id: str, tokens_in: int, tokens_out: int) -> float:
    rates = PRICING.get(model_id)
    if rates is None:
        return 0.0
    in_rate, out_rate = rates
    return round(
        (tokens_in / 1_000_000) * in_rate
        + (tokens_out / 1_000_000) * out_rate,
        4,
    )


# --------------------------------------------------------------------
# CSV writers
# --------------------------------------------------------------------


def write_results_csv(runs: list[RunRecord], path: Path) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=RESULTS_COLS)
        w.writeheader()
        for r in runs:
            u = r.usage
            cand, match = best_candidate(r.verdicts, u)
            w.writerow(
                {
                    "run_id": r.run_id,
                    "model_id": u.get("model_id", ""),
                    "condition": u.get("condition", ""),
                    "ctf": u.get("ctf", ""),
                    "test_user": u.get("test_user", ""),
                    "tool_calls": u.get("tool_calls", 0),
                    "wall_clock_sec": u.get("wall_clock_sec", 0),
                    "final_state": u.get("final_state", ""),
                    "candidate_flag": cand,
                    "candidate_flag_matches": match,
                    "tokens_input": u.get("tokens_input", 0),
                    "tokens_output": u.get("tokens_output", 0),
                    "cache_hit_tokens": u.get("cache_hit_tokens", 0),
                    "cost_usd": cost_usd(
                        u.get("model_id", ""),
                        int(u.get("tokens_input", 0) or 0),
                        int(u.get("tokens_output", 0) or 0),
                    ),
                }
            )


def write_flag_results_csv(
    runs: list[RunRecord],
    path: Path,
    coding: dict[tuple[str, str], dict] | None = None,
) -> None:
    """One row per (run, flag_index). Machine hint seeds `sub_code`; if
    a hand-coded entry exists in `coding` for (run_id, flag_index), it
    overrides."""
    coding = coding or {}
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FLAG_RESULTS_COLS)
        w.writeheader()
        for r in runs:
            ctf = r.usage.get("ctf", "")
            for v in r.verdicts:
                key = (r.run_id, str(v["flag_index"]))
                override = coding.get(key, {})
                w.writerow(
                    {
                        "run_id": r.run_id,
                        "ctf": ctf,
                        "flag_index": v["flag_index"],
                        "pass": bool(v["pass"]),
                        "sub_code": (
                            None if v["pass"]
                            else override.get("sub_code", v.get("sub_code_hint"))
                        ),
                        "first_tool_call_index":
                            override.get("first_tool_call_index"),
                        "enabling_artefact":
                            override.get("enabling_artefact"),
                        "double_rated": override.get("double_rated", False),
                        "secondary_sub_code":
                            override.get("secondary_sub_code"),
                    }
                )


# --------------------------------------------------------------------
# Confidence intervals --- Clopper-Pearson
# --------------------------------------------------------------------


def clopper_pearson(k: int, n: int, alpha: float = 0.05) -> tuple[float, float]:
    """Exact 95% CI for a binomial proportion. Pure Python so we don't
    drag scipy in."""
    if n == 0:
        return (0.0, 0.0)
    lo = 0.0 if k == 0 else _beta_ppf(alpha / 2, k, n - k + 1)
    hi = 1.0 if k == n else _beta_ppf(1 - alpha / 2, k + 1, n - k)
    return (lo, hi)


def _beta_ppf(p: float, a: float, b: float) -> float:
    """Beta quantile via bisection on the regularised incomplete beta
    function. Good enough for CI bounds at 3--4 decimal places."""
    lo, hi = 0.0, 1.0
    for _ in range(80):
        mid = 0.5 * (lo + hi)
        if _betai(a, b, mid) < p:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


def _betai(a: float, b: float, x: float) -> float:
    """Regularised incomplete beta function I_x(a, b)."""
    if x <= 0.0:
        return 0.0
    if x >= 1.0:
        return 1.0
    bt = math.exp(
        math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b)
        + a * math.log(x) + b * math.log(1 - x)
    )
    if x < (a + 1) / (a + b + 2):
        return bt * _betacf(a, b, x) / a
    return 1.0 - bt * _betacf(b, a, 1 - x) / b


def _betacf(a: float, b: float, x: float) -> float:
    eps = 3e-7
    qab, qap, qam = a + b, a + 1.0, a - 1.0
    c, d = 1.0, 1.0 - qab * x / qap
    if abs(d) < 1e-30:
        d = 1e-30
    d = 1.0 / d
    h = d
    for m in range(1, 200):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d
        if abs(d) < 1e-30:
            d = 1e-30
        c = 1.0 + aa / c
        if abs(c) < 1e-30:
            c = 1e-30
        d = 1.0 / d
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d
        if abs(d) < 1e-30:
            d = 1e-30
        c = 1.0 + aa / c
        if abs(c) < 1e-30:
            c = 1e-30
        d = 1.0 / d
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < eps:
            break
    return h


# --------------------------------------------------------------------
# Primary table
# --------------------------------------------------------------------


def primary_table_md(flag_rows: list[dict]) -> str:
    """CTF x model table with pass rate + 95% CI, split passive/agentic."""
    cells: dict[tuple[int, str, str], list[bool]] = {}
    models_seen: set[str] = set()
    ctfs_seen: set[int] = set()
    for row in flag_rows:
        model = row.get("model_id", "")
        condition = row.get("condition", "")
        if condition not in ("passive", "agentic"):
            continue
        ctf = int(row["ctf"])
        key = (ctf, model, condition)
        cells.setdefault(key, []).append(bool(row["pass"]))
        models_seen.add(model)
        ctfs_seen.add(ctf)

    models = sorted(models_seen)
    ctfs = sorted(ctfs_seen)

    def cell_text(ctf: int, model: str, cond: str) -> str:
        arr = cells.get((ctf, model, cond))
        if not arr:
            return "---"
        k = sum(1 for x in arr if x)
        n = len(arr)
        lo, hi = clopper_pearson(k, n)
        return f"{k}/{n} [{lo:.2f}, {hi:.2f}]"

    lines: list[str] = []
    lines.append("# Primary pass-rate table")
    lines.append("")
    for cond in ("passive", "agentic"):
        lines.append(f"## {cond.title()}")
        lines.append("")
        header = ["CTF"] + models
        lines.append("| " + " | ".join(header) + " |")
        lines.append("|" + "|".join(["---"] * len(header)) + "|")
        for ctf in ctfs:
            row = [str(ctf)] + [cell_text(ctf, m, cond) for m in models]
            lines.append("| " + " | ".join(row) + " |")
        lines.append("")
    return "\n".join(lines)


# --------------------------------------------------------------------
# Cohen's kappa
# --------------------------------------------------------------------


def cohens_kappa(pairs: list[tuple[str, str]]) -> float:
    """pairs = [(primary_code, secondary_code), ...]. Unweighted."""
    if not pairs:
        return float("nan")
    categories = sorted({c for pair in pairs for c in pair})
    n = len(pairs)
    po = sum(1 for a, b in pairs if a == b) / n
    row = {c: 0 for c in categories}
    col = {c: 0 for c in categories}
    for a, b in pairs:
        row[a] += 1
        col[b] += 1
    pe = sum((row[c] / n) * (col[c] / n) for c in categories)
    if pe == 1.0:
        return 1.0
    return (po - pe) / (1 - pe)


# --------------------------------------------------------------------
# Helpers to merge flag_results rows with per-run context for tables
# --------------------------------------------------------------------


def enrich_flag_rows(runs: list[RunRecord], flag_results_path: Path) -> list[dict]:
    """Join flag_results.csv with usage.json fields (model, condition)."""
    by_run = {r.run_id: r.usage for r in runs}
    out: list[dict] = []
    with open(flag_results_path, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            u = by_run.get(row["run_id"], {})
            row_c = dict(row)
            row_c["model_id"] = u.get("model_id", "")
            row_c["condition"] = u.get("condition", "")
            row_c["pass"] = row["pass"] == "True"
            out.append(row_c)
    return out


# --------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------


def load_coding_overrides(path: Path) -> dict[tuple[str, str], dict]:
    """Load hand-coded sub-codes keyed by (run_id, flag_index)."""
    out: dict[tuple[str, str], dict] = {}
    with open(path, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            key = (row["run_id"], str(row["flag_index"]))
            out[key] = {
                "sub_code": row.get("sub_code") or None,
                "double_rated": (row.get("double_rated") or "").lower() == "true",
                "secondary_sub_code": row.get("secondary_sub_code") or None,
            }
    return out


def cmd_build(args: argparse.Namespace) -> int:
    runs_dir = Path(args.runs_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    runs = list(iter_runs(runs_dir))
    if not runs:
        print(f"no runs found under {runs_dir}", file=sys.stderr)
        return 1

    coding = None
    if args.coding:
        coding = load_coding_overrides(Path(args.coding))

    results_path = out_dir / "results.csv"
    flag_path = out_dir / "flag_results.csv"
    tables_path = out_dir / "tables.md"

    write_results_csv(runs, results_path)
    write_flag_results_csv(runs, flag_path, coding=coding)

    flag_rows = enrich_flag_rows(runs, flag_path)
    tables_path.write_text(primary_table_md(flag_rows))

    print(f"wrote {results_path}")
    print(f"wrote {flag_path}")
    print(f"wrote {tables_path}")
    print(f"runs: {len(runs)}")
    if coding:
        print(f"coding overrides: {len(coding)}")
    return 0


def cmd_kappa(args: argparse.Namespace) -> int:
    path = Path(args.coding)
    pairs: list[tuple[str, str]] = []
    with open(path, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            p = (row.get("sub_code") or "").strip()
            s = (row.get("secondary_sub_code") or "").strip()
            if p and s:
                pairs.append((p, s))
    if not pairs:
        print("no double-rated rows found", file=sys.stderr)
        return 1
    k = cohens_kappa(pairs)
    print(f"n_double_rated: {len(pairs)}")
    print(f"cohens_kappa: {k:.3f}")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_build = sub.add_parser("build", help="Emit CSVs + tables.md")
    p_build.add_argument("--runs-dir", default=str(HERE / "runs"))
    p_build.add_argument("--out-dir", default=str(HERE / "reports"))
    p_build.add_argument(
        "--coding", default=None,
        help="Optional path to coded.csv overlay (sub_code, double_rated, "
             "secondary_sub_code). When set, overrides the machine "
             "sub_code_hint per (run_id, flag_index).",
    )
    p_build.set_defaults(func=cmd_build)

    p_kappa = sub.add_parser("kappa", help="Compute Cohen's kappa")
    p_kappa.add_argument("--coding", required=True)
    p_kappa.set_defaults(func=cmd_kappa)

    args = ap.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
