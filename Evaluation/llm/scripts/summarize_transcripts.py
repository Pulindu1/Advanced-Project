"""Compact every failed-flag-row transcript into a summary JSONL.

For each (run_id, flag_index) row in reports/flag_results.csv where
pass != True, emit one line in coding/summaries.jsonl with:

  {
    "run_id": ...,
    "ctf": ...,
    "flag_index": ...,
    "model_id": ...,
    "condition": ...,
    "end_reason": ...,
    "n_assistant_msgs": ...,
    "n_tool_calls": ...,
    "tool_names": [...],
    "submitted_flags": [...],
    "assistant_text": "...",   # joined assistant messages, truncated
  }

The assistant text is the substrate for the rubric coding decision.
Tool-call summary helps spot truncation / harness errors.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
LLM = HERE.parent
RUNS = LLM / "runs"
REPORTS = LLM / "reports"
OUT_DIR = LLM / "coding"
OUT_DIR.mkdir(exist_ok=True)


def load_results_index() -> dict[str, dict]:
    path = REPORTS / "results.csv"
    out: dict[str, dict] = {}
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            out[row["run_id"]] = row
    return out


def summarise(run_id: str) -> dict:
    transcript = RUNS / run_id / "transcript.jsonl"
    n_asst = 0
    n_tool = 0
    tool_names: list[str] = []
    submitted: list[str] = []
    asst_texts: list[str] = []
    end_reason = ""
    with open(transcript, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                ev = json.loads(line)
            except json.JSONDecodeError:
                continue
            kind = ev.get("event")
            if kind == "assistant_message":
                n_asst += 1
                txt = ev.get("content", "")
                if isinstance(txt, str):
                    asst_texts.append(txt)
            elif kind == "tool_call":
                n_tool += 1
                tn = ev.get("name") or ev.get("tool_name") or ""
                if tn:
                    tool_names.append(tn)
                if tn == "submit_flag":
                    args = ev.get("arguments") or ev.get("input") or {}
                    if isinstance(args, dict):
                        f_val = args.get("flag")
                        if f_val:
                            submitted.append(str(f_val))
            elif kind == "submit":
                f_val = ev.get("flag")
                if f_val:
                    submitted.append(str(f_val))
            elif kind == "end":
                end_reason = ev.get("reason", "") or end_reason
    asst_joined = "\n\n".join(asst_texts)
    if len(asst_joined) > 8000:
        asst_joined = asst_joined[:4000] + "\n... [truncated] ...\n" + asst_joined[-4000:]
    return {
        "n_assistant_msgs": n_asst,
        "n_tool_calls": n_tool,
        "tool_names": tool_names,
        "submitted_flags": submitted,
        "assistant_text": asst_joined,
        "end_reason": end_reason,
    }


def main() -> None:
    flag_path = REPORTS / "flag_results.csv"
    results = load_results_index()
    out_path = OUT_DIR / "summaries.jsonl"
    n_written = 0
    n_skipped = 0
    with open(flag_path, newline="", encoding="utf-8") as fin, \
         open(out_path, "w", encoding="utf-8") as fout:
        reader = csv.DictReader(fin)
        for row in reader:
            if row.get("pass") == "True":
                continue
            run_id = row["run_id"]
            res = results.get(run_id, {})
            tdir = RUNS / run_id
            if not (tdir / "transcript.jsonl").exists():
                n_skipped += 1
                continue
            try:
                summ = summarise(run_id)
            except Exception as e:
                summ = {
                    "n_assistant_msgs": 0,
                    "n_tool_calls": 0,
                    "tool_names": [],
                    "submitted_flags": [],
                    "assistant_text": f"[summarise error: {e}]",
                    "end_reason": "",
                }
            out_row = {
                "run_id": run_id,
                "ctf": row["ctf"],
                "flag_index": row["flag_index"],
                "model_id": res.get("model_id", ""),
                "condition": res.get("condition", ""),
                **summ,
            }
            fout.write(json.dumps(out_row) + "\n")
            n_written += 1
    print(f"wrote {out_path} ({n_written} rows, {n_skipped} skipped)")


if __name__ == "__main__":
    main()
