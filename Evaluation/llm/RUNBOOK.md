# LLM Trial --- Runbook

Operator-facing checklist for executing the paid phases of the LLM
solvability trial. `PLAN.md` is the authoritative design;
`WORKFLOW.md` tracks build phases (0--3 done, 4--9 are what this
runbook drives). Read both before spending money.

The trial is hard-capped at **GBP20** total spend, **GBP10
preferred** (PLAN.md section 15, revision 2026-04-27). This runbook
exists so that ceiling cannot be crossed accidentally.

---

## 0. Prerequisites (one-time)

Verify each before any paid phase. None of these spend money.

- [x] `expected_flags.json` exists at `Evaluation/llm/` with 23 flag
      slots across 9 CTFs. Rebuild with
      `python3 Evaluation/llm/scripts/build_expected_flags.py` if
      any in-repo `flags.json` changes.
- [x] `flag_regexes.json` present at `Evaluation/llm/`
      (pre-registered, tracked in git).
- [ ] Three API keys exported in the shell that will run the trial:
      `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`.
- [x] Docker Desktop running; `docker compose version` and
      `docker info` both succeed.
- [x] Python deps satisfied. System Python 3.12 already meets
      `requirements.txt`; a `.venv` is optional. To pin:
      `python3 -m venv .venv && source .venv/bin/activate &&
      pip install -r requirements.txt` from `Evaluation/llm/`.
- [x] `python3 -m pytest tests/` --- 113 tests green.
- [x] `docker build -f alpine-tools.Dockerfile
      -t llm-trial-shell:latest .` from `Evaluation/llm/`.
- [x] Phase 4 baseline passed: `bash
      Evaluation/llm/scripts/phase4_baseline.sh` ran clean for all
      9 CTFs; logs under `Evaluation/llm/runs/phase4/ctfN.log` end
      with `CTF<n> end: PASS`.

If any of these fail, fix before continuing. The trial does not
start until they are all green.

---

## 1. Phase order (paid)

Run phases strictly in this order. Aggregate and review spend
between every phase.

**Per-vendor staging (recommended).** Use `--only-model <key>` to run
one LLM at a time within each phase: do all of one vendor's cells,
check spend with `aggregate.py build`, move to the next. Suggested
order — Anthropic first (`sonnet`, `haiku`), then OpenAI
(`gpt5mini`), then Google (`gemini-pro`, `gemini-flash`); optional
`gpt5` last. This makes per-provider spend trivial to read off the
vendor dashboard and means a single bad API key only blocks one
provider's slice. Drop the flag to run the whole panel together.

| # | Phase | Cells | Worst-case GBP | Cumulative cap |
|---|-------|-------|----------------|----------------|
| 5 | `cold-probe` | 45 | ~0.50 | 0.50 |
| 6 | `pilot` | 6 | ~1.50 | 2.00 |
| 7a | `null-prompt` | 1 | ~0.10 | 2.10 |
| 7b | `primary` | 90 | ~6--7 | ~9 |
| 7c | `spot-check` (optional) | 2 | ~1.50 | ~10.5 |

Estimates assume Anthropic prompt caching reduces repeated input to
~10%. They are diagnostic, not authoritative; the live `cost_usd`
column from `aggregate.py build` is what gates the next phase.

### 1.1 Cold probe (Phase 5)

- [ ] `cd Evaluation/llm` (and `source .venv/bin/activate` if you
      created one in section 0).
- [ ] `python3 run_matrix.py --phase cold-probe` --- 45 cells,
      no stack.
- [ ] `python3 aggregate.py build` --- writes
      `reports/results.csv`.
- [ ] **Pass condition:** zero `byte_match` rows in
      `reports/results.csv` for `condition == "cold-probe"`. Trial
      is *blocked* on any byte-match: investigate training-data
      leakage or anti-leak guard bug before continuing.
- [ ] Sum the `cost_usd` column for cold-probe rows. Convert to
      GBP at the day's rate (~0.78x). Record in your notes.

### 1.2 Pilot (Phase 6)

- [ ] `python3 run_matrix.py --phase pilot` --- 6 cells.
- [ ] `python3 aggregate.py build`.
- [ ] Manually inspect 3 transcripts
      (`runs/pilot_*/transcript.jsonl`) for guard violations,
      schema validation, sensible tool use.
- [ ] If any harness bug: fix, re-pilot, *do not* skip ahead.
      Pilot is the last phase where a harness fix is cheap.
- [ ] Update cumulative spend before advancing.

### 1.3 Null-prompt + Primary (Phase 7)

- [ ] `python3 run_matrix.py --phase null-prompt` --- 1 cell.
- [ ] `python3 run_matrix.py --phase primary` --- 90 cells
      (5 models x 9 CTFs x 2 conditions x 1 seed per PLAN.md
      revision 2026-04-27). Several hours wall-clock, mostly
      unattended; `docker compose down -v && up -d` runs once per
      CTF inside the orchestrator.
- [ ] `python3 aggregate.py build`.
- [ ] If a single CTF fails, re-enter with
      `python3 run_matrix.py --phase primary --only-ctf N`. The
      orchestrator skips already-completed cells only at the CTF
      level, not the cell level --- individual cell re-runs are
      manual via `harness.py`.

### 1.4 Spot-check (Phase 7c, conditional)

- [ ] **Run only if** cumulative spend after Phase 7b is below
      GBP15 GBP at the cap test in section 2. Skip if not.
- [ ] `python3 run_matrix.py --phase spot-check` --- 2 cells
      (`gpt-5 x {CTF1, CTF5}` agentic). Adds the highest-cost
      vendor for one cross-vendor comparison row.
- [ ] `python3 aggregate.py build`.

---

## 2. Cap-enforcement protocol

The harness has no built-in spend gate. Enforcement is operator-
driven, between phases. After **every** phase:

- [ ] Run `python3 aggregate.py build`.
- [ ] Open `reports/results.csv`. Sum the `cost_usd` column across
      *all* rows (every phase to date).
- [ ] Convert USD->GBP using the day's spot rate (~0.78x is a safe
      conservative bound for the period 2026-04 onwards; check
      `xe.com` if uncertain).
- [ ] Compare against the hard cap:

      ```
      cumulative_gbp >= 18.00  -> STOP. Investigate. Do not start the
                                  next phase. Notify supervisor.
      cumulative_gbp >= 9.00   -> Pause. Re-forecast remaining phases
                                  worst-case. Continue only if
                                  worst-case + cumulative <= 18.
      cumulative_gbp <  9.00   -> Continue.
      ```

- [ ] Treat `cost_usd` as a lower bound, not a true accounting:
      `aggregate.py` PRICING is a snapshot and the trial may include
      cache misses or extended thinking that the diagnostic does not
      fully model. The headroom buffer (GBP18 vs. GBP20 cap) is
      intentional.

A worked example. Suppose after Phase 7b primary you see:

```
$ python3 -c "import csv, sys; r=csv.DictReader(open('reports/results.csv')); \
  print(round(sum(float(x.get('cost_usd') or 0) for x in r), 2))"
8.41
```

USD 8.41 -> ~GBP 6.6. Worst-case spot-check ~GBP 1.5. Total
forecast ~GBP 8.1 < 18 -> spot-check is admissible.

If instead it was USD 18.00 -> ~GBP 14: STOP. Spot-check would push
into hard-cap territory; defer or skip.

### 2.1 Cell-level kill switch

If a single agentic run blows past expected token volume (visible
in `runs/<run_id>/usage.json::tool_calls` or wall-clock), kill it
manually:

- [ ] `ps aux | grep harness.py` --- find the PID.
- [ ] `kill <pid>`. The orchestrator records the cell as a non-zero
      exit and continues.
- [ ] Manual re-run via `harness.py` is allowed if the cause was
      infrastructure (Docker flake), but *not* if the cause was the
      model's own behaviour --- that is data, not noise.

---

## 3. Abort criteria (mid-trial)

Stop and notify supervisor if any of:

- Cumulative `cost_usd` projects above the hard cap (section 2).
- Cold probe produces any `byte_match` row.
- Upper-bound baseline (Phase 4) breaks during a re-run.
- A model ID is deprecated / 4xx-rate-limited persistently.
- Repeated guard violations in `runs/<id>/transcript.jsonl::Guard`
  events --- treat as a harness escape and pause.

Resumption requires either a documented fix and a fresh `git diff`
review, or supervisor approval to amend PLAN.md (section 15).

---

## 4. After all phases

- [ ] `python3 aggregate.py build` --- one final pass.
- [ ] `reports/results.csv`, `reports/flag_results.csv`,
      `reports/tables.md` are now the canonical outputs. Commit them
      alongside the `runs/` transcripts so the trial reproduces from
      the tag.
- [ ] Sub-code every failed-flag row per `RUBRIC.md`.
- [ ] Double-rate the 20% sample;
      `python3 aggregate.py kappa --coding <coding.csv>`. Target
      Cohen's kappa >= 0.7.
- [ ] Draft Results section per PLAN.md section 13.

---

## 5. Cheat sheet

```bash
# All commands assume cwd = Evaluation/llm and venv active (if used).

python3 run_matrix.py --phase cold-probe   --dry-run    # preview
python3 run_matrix.py --phase cold-probe                # 45 cells
python3 run_matrix.py --phase pilot                     # 6 cells
python3 run_matrix.py --phase null-prompt               # 1 cell
python3 run_matrix.py --phase primary                   # 90 cells
python3 run_matrix.py --phase spot-check                # 2 cells (optional)

# Per-vendor staging (one LLM at a time):
python3 run_matrix.py --phase cold-probe --only-model sonnet     #  9 cells
python3 run_matrix.py --phase cold-probe --only-model haiku      #  9
python3 run_matrix.py --phase cold-probe --only-model gpt5mini   #  9
python3 run_matrix.py --phase cold-probe --only-model gemini-pro #  9
python3 run_matrix.py --phase cold-probe --only-model gemini-flash # 9
python3 run_matrix.py --phase primary    --only-model sonnet     # 18
python3 run_matrix.py --phase primary    --only-model haiku      # 18
# ...etc. Pilot/null-prompt are sonnet-only by design.

python3 aggregate.py build                              # always between phases
python3 aggregate.py kappa --coding coded.csv           # post-coding only

# Spend check (USD; multiply by ~0.78 for GBP):
python3 -c "import csv; r=csv.DictReader(open('reports/results.csv')); \
  print(round(sum(float(x.get('cost_usd') or 0) for x in r), 2))"

# Re-run one CTF only (any phase):
python3 run_matrix.py --phase primary --only-ctf 5

# Single cell, manual:
python3 harness.py --model claude-sonnet-4-6 --condition agentic \
  --ctf 1 --test-user abcd12 --port 3000 \
  --run-id manual-$(date +%s)
```
