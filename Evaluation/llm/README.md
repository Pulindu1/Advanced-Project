# LLM trial --- harness

Per-run and matrix runner for the LLM solvability study defined in
`PLAN.md`. All design lives there; this file is just "how to drive it."

## Layout

```
Evaluation/llm/
├── harness.py             per-run entry point (1 model x 1 CTF x 1 condition)
├── run_matrix.py          phase orchestrator (cold-probe / pilot / primary / ...)
├── aggregate.py           runs/ -> results.csv + flag_results.csv + tables.md
├── lib/
│   ├── guard.py           path + URL whitelist (fail-closed)
│   ├── transcripts.py     append-only JSONL writer + validator
│   ├── tools.py           cross-vendor tool schema (5 tools)
│   ├── executors.py       http_request / shell / read_local / submit_flag / give_up
│   ├── models.py          AnthropicClient + OpenAIClient (stateful)
│   └── scoring.py         byte-match / regex / sub-code hint
├── prompts/               SHA-pinned passive, agentic, cold-probe templates
├── doc-pack/              curated per-CTF docs the model is allowed to see
├── runs/                  one subdir per run (transcript.jsonl + sidecars + usage.json)
├── reports/               aggregation outputs (generated)
├── alpine-tools.Dockerfile  image for the shell tool
├── requirements.txt
└── tests/                 102 tests; no API calls
```

## First-time setup

```
cd Evaluation/llm
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

export ANTHROPIC_API_KEY=...
export OPENAI_API_KEY=...

docker build -f alpine-tools.Dockerfile -t llm-trial-shell:latest .
```

Drop `expected_flags.json` + `flag_regexes.json` at this root
(generated per `PROTOCOL.md` step 1). Neither file is committed.

## Verify the harness (no API calls)

```
python3 -m pytest tests/
```

Expect 102 passed.

## Run one cell

```
python3 harness.py \
  --model claude-sonnet-4-6 \
  --condition agentic \
  --ctf 1 \
  --test-user llmu01 \
  --port 3000 \
  --run-id sonnet-ctf1-agentic-$(date +%s)
```

Produces `runs/<run_id>/{transcript.jsonl, flag_verdicts.json,
usage.json, scratch/, sidecars/}`. Exit 0 iff the transcript
validates.

For CTFs with multiple ports (3 and 4), pass them comma-separated
(first is primary):

```
--port 5174,8004
```

## Run a phase

```
python3 run_matrix.py --phase cold-probe    # 27 cells, no stack
python3 run_matrix.py --phase pilot         # 6 cells
python3 run_matrix.py --phase primary       # 36 cells
python3 run_matrix.py --phase flagship      # 6 cells
python3 run_matrix.py --phase null-prompt   # 1 cell
```

Add `--dry-run` to enumerate cells without spending money. Add
`--only-ctf N` to restrict. The orchestrator groups by CTF and does
`docker compose down -v && up -d` once per CTF, running all cells
for that CTF before tearing down.

## Aggregate after runs complete

```
python3 aggregate.py build
```

Writes `reports/results.csv`, `reports/flag_results.csv`, and
`reports/tables.md`. For the 20% double-rating step:

```
python3 aggregate.py kappa --coding <path/to/coded.csv>
```

The CSV must have `sub_code` and `secondary_sub_code` columns; pairs
with both filled contribute to the unweighted kappa.

## Safety invariants

- Every filesystem read routes through `Guard`. The deny list includes
  `SOLUTIONS.md`, `workflow.md`, `flags.json`, `users.json`. Writes
  are restricted to the current run's directory.
- Every outbound HTTP routes through `Guard.check_url`. Only
  `http://localhost` on ports declared for the current CTF pass.
- The scratch `shell` tool runs in an ephemeral Alpine container with
  `--memory 256m --cpus 1`, read-write mount at `/scratch`, and
  `host.docker.internal` mapped to the host gateway so containers on
  all platforms reach the target.
- 15-turn cap per run (one turn = one assistant-message round,
  which may issue multiple parallel tool calls; enforced in
  `harness.run_agentic_loop`).
- Transcripts are append-only and flushed per event; mid-crash runs
  are partially readable.

## Adding a new CTF

1. Add a `CtfSpec(...)` entry to `CTF_SPECS` in `run_matrix.py`.
2. Add an expected-flag block to `expected_flags.json`.
3. Add a regex block to `flag_regexes.json`.
4. Add a curated doc pack to `doc-pack/ctfN.md` per `DOC_PACK.md`.

## Budget

Per `PLAN.md` section 11: ~USD 10--15 typical, USD 20--30 ceiling at
2x contingency. The `cost_usd` column in `results.csv` is estimated
from `PRICING` in `aggregate.py` --- diagnostic only.
