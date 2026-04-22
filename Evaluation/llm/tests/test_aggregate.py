"""Aggregation smoke tests.

Fixture `synth_runs_dir` creates three fake run directories with
usage.json + flag_verdicts.json. The aggregator walks them, writes
results.csv + flag_results.csv + tables.md, and we assert on counts
plus Clopper-Pearson / Cohen's-kappa numerical behaviour.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

import pytest

from aggregate import (
    clopper_pearson,
    cmd_build,
    cohens_kappa,
    cost_usd,
    enrich_flag_rows,
    primary_table_md,
)


def _write_run(
    root: Path, run_id: str, usage: dict, verdicts: list[dict]
) -> None:
    d = root / run_id
    d.mkdir()
    (d / "usage.json").write_text(json.dumps(usage))
    (d / "flag_verdicts.json").write_text(json.dumps(verdicts))
    (d / "transcript.jsonl").write_text("{}\n")


@pytest.fixture
def synth_runs_dir(tmp_path: Path) -> Path:
    d = tmp_path / "runs"
    d.mkdir()
    _write_run(
        d, "primary_ctf01_agentic_sonnet_20260421_aaa",
        usage={
            "run_id": "primary_ctf01_agentic_sonnet_20260421_aaa",
            "model_id": "claude-sonnet-4-6",
            "condition": "agentic", "ctf": 1, "test_user": "llmu01",
            "tool_calls": 5, "wall_clock_sec": 10.2,
            "final_state": "submitted", "submitted_flag": "basicflag1{abc}",
            "submit_accepted": True,
            "tokens_input": 1000, "tokens_output": 500,
            "cache_hit_tokens": 300,
        },
        verdicts=[
            {"flag_index": "1", "pass": True, "sub_code_hint": None},
        ],
    )
    _write_run(
        d, "primary_ctf01_passive_sonnet_20260421_bbb",
        usage={
            "run_id": "primary_ctf01_passive_sonnet_20260421_bbb",
            "model_id": "claude-sonnet-4-6",
            "condition": "passive", "ctf": 1, "test_user": "llmu01",
            "tool_calls": 0, "wall_clock_sec": 5.0,
            "final_state": "gave_up", "submitted_flag": None,
            "submit_accepted": None,
            "tokens_input": 500, "tokens_output": 200, "cache_hit_tokens": 0,
        },
        verdicts=[
            {
                "flag_index": "1", "pass": False,
                "sub_code_hint": "methodology-correct, flag-absent",
            },
        ],
    )
    _write_run(
        d, "primary_ctf02_agentic_gpt5mini_20260421_ccc",
        usage={
            "run_id": "primary_ctf02_agentic_gpt5mini_20260421_ccc",
            "model_id": "gpt-5-mini",
            "condition": "agentic", "ctf": 2, "test_user": "llmu02",
            "tool_calls": 20, "wall_clock_sec": 30.0,
            "final_state": "truncated", "submitted_flag": None,
            "submit_accepted": None,
            "tokens_input": 2000, "tokens_output": 800, "cache_hit_tokens": 0,
        },
        verdicts=[
            {"flag_index": "1", "pass": False, "sub_code_hint": "truncated"},
        ],
    )
    return d


class TestClopperPearson:
    def test_zero_successes(self):
        lo, hi = clopper_pearson(0, 10)
        assert lo == 0.0
        assert 0.25 < hi < 0.35  # ~0.308

    def test_all_successes(self):
        lo, hi = clopper_pearson(10, 10)
        assert 0.65 < lo < 0.75
        assert hi == 1.0

    def test_half_successes(self):
        lo, hi = clopper_pearson(5, 10)
        assert lo < 0.5 < hi

    def test_empty(self):
        assert clopper_pearson(0, 0) == (0.0, 0.0)


class TestCost:
    def test_known_model(self):
        c = cost_usd("claude-sonnet-4-6", 1_000_000, 1_000_000)
        # 1M*3 + 1M*15 = 18.0
        assert c == 18.0

    def test_unknown_model_zero(self):
        assert cost_usd("not-a-model", 1000, 500) == 0.0


class TestBuild:
    def test_produces_csvs_and_table(self, synth_runs_dir, tmp_path):
        import argparse

        out_dir = tmp_path / "reports"
        args = argparse.Namespace(
            runs_dir=str(synth_runs_dir), out_dir=str(out_dir)
        )
        rc = cmd_build(args)
        assert rc == 0

        results = list(csv.DictReader(open(out_dir / "results.csv")))
        assert len(results) == 3
        primary = [r for r in results if r["ctf"] == "1"]
        assert len(primary) == 2

        flag_rows = list(csv.DictReader(open(out_dir / "flag_results.csv")))
        assert len(flag_rows) == 3
        pass_count = sum(1 for r in flag_rows if r["pass"] == "True")
        assert pass_count == 1

        table = (out_dir / "tables.md").read_text()
        assert "Primary pass-rate table" in table
        assert "Passive" in table and "Agentic" in table
        assert "claude-sonnet-4-6" in table

    def test_empty_runs_dir_returns_nonzero(self, tmp_path):
        import argparse

        empty = tmp_path / "empty"
        empty.mkdir()
        out = tmp_path / "out"
        args = argparse.Namespace(
            runs_dir=str(empty), out_dir=str(out)
        )
        rc = cmd_build(args)
        assert rc == 1


class TestKappa:
    def test_perfect_agreement_is_one(self):
        pairs = [("a", "a"), ("b", "b"), ("c", "c"), ("a", "a")]
        assert cohens_kappa(pairs) == 1.0

    def test_zero_agreement_below_chance_negative(self):
        pairs = [("a", "b"), ("b", "a"), ("a", "b"), ("b", "a")]
        assert cohens_kappa(pairs) < 0

    def test_mixed(self):
        pairs = [("a", "a"), ("a", "b"), ("b", "a"), ("b", "b")]
        k = cohens_kappa(pairs)
        assert -1 <= k <= 1
