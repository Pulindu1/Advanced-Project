# Run Protocol

Pre-registered. Any deviation during execution is recorded in the
transcript and reported in the Limitations subsection.

## 0. Freeze

- [ ] All prompts SHA-256-pinned.
- [ ] Doc packs committed under `evaluation/llm/doc-pack/`.
- [ ] Model IDs recorded.
- [ ] Docker images tagged `evaluation/llm-trial-<date>`.
- [ ] Analysis script skeleton committed (no data yet).

## 1. Provision test users

- [ ] No per-trial provisioning. Each CTF ships a demo account; the
      trial uses `abcd12` (or `test12` for CTF5).
- [ ] Build `expected_flags.json` from the in-repo `flags.json`
      files: `python3 Evaluation/llm/scripts/build_expected_flags.py`.
- [ ] Write flag regexes to `flag_regexes.json` (one-time;
      pre-registered).

## 2. Upper-bound baseline

- [ ] `CTFs/e2e/run_all.sh` against trial stack + trial users. All
      pass.
- [ ] If any fail: fix. LLM trial blocked until green.

## 3. Cold probe (27 runs, ~USD 1, no stack)

- [ ] Sonnet 4.6 x 9 CTFs passive.
- [ ] GPT-5-mini x 9 CTFs passive.
- [ ] Opus 4.7 x 9 CTFs passive.
- [ ] Expected 0 byte-matches. Any match: investigate. Trial blocked.

## 4. Pilot (6 runs, ~USD 2)

- [ ] Sonnet 4.6 x {CTF1, CTF5, CTF9} x {passive, agentic}.
- Exit criteria:
  - [ ] No harness error in the last 3 pilot runs.
  - [ ] Transcript schema validates.
  - [ ] Cold probe clean on these CTFs (step 3).
  - [ ] Upper-bound baseline passes on these CTFs (step 2).

## 5. Null-prompt sanity (1 run)

- [ ] Opus 4.7 x CTF1 passive, README replaced by a generic
      placeholder. Expected near zero.

## 6. Full run

- [ ] Primary matrix: Sonnet 4.6 + GPT-5-mini x 9 CTFs x 2 conditions
      = 36 runs.
- [ ] Flagship spot check: Opus 4.7 x {CTF1, CTF5, CTF9} x 2
      conditions = 6 runs.
- [ ] Every run: fresh `docker compose down -v && up`; scratch
      container recreated.

## 7. Sub-coding

- [ ] Primary rater codes every failed flag outcome per `RUBRIC.md`.
- [ ] Random 20% sample (deterministic seed) given to secondary
      rater blind to primary codes.
- [ ] Cohen's kappa computed. Target >= 0.7.

## 8. Aggregation

- [ ] `results.csv` (per run) + `flag_results.csv` (per flag).
- [ ] Produce primary tables, heatmap, integrity paragraph per
      `PLAN.md` Section 9.

## Abort criteria

Pause and discuss with supervisor if any of:

- Cold probe produces a byte-match.
- Upper-bound baseline fails mid-trial.
- A model ID is deprecated / unreachable.
- Budget ceiling (USD 30) would be crossed.
