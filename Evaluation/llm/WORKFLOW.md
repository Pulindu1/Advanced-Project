# LLM Trial --- Workflow

Phased build-and-run workflow for the trial spec'd in `PLAN.md`.
Each sub-step is atomic. Tick as you go. Phases 1--3 are build work;
phases 4--9 are execution.

---

## Phase 0 --- Pre-flight

- [ ] 0.1  Create branch `evaluation/llm-trial`. (Deferred -- building on `main`; revisit before cold-probe so the trial artefacts land on a dedicated branch.)
- [x] 0.2  Add `evaluation/llm/runs/` and `evaluation/llm/trial.env` to
  `.gitignore`. Also added `reports/`, `expected_flags.json`,
  `__pycache__`, `.venv`. `flag_regexes.json` was initially gitignored
  but the rule was removed in Phase 3.4 so the regex set stays
  pre-registered and reviewable (it carries no secret tokens).
- [x] 0.3  Install Python 3.11 locally; confirm `python3 --version`.
- [x] 0.4  Export API keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`.
- [x] 0.5  Confirm Docker Desktop is running; `docker compose version` prints.

---

## Phase 1 --- Build the harness

Target layout:

```
Evaluation/llm/
├── harness.py                entry point, per-run loop
├── lib/
│   ├── __init__.py
│   ├── config.py             dataclasses for RunConfig, ModelConfig
│   ├── guard.py              path whitelist + URL whitelist
│   ├── transcripts.py        JSONL writer + validator
│   ├── tools.py              tool schema (identical across vendors)
│   ├── executors.py          http_request, shell, read_local, submit_flag, give_up
│   ├── models.py             vendor abstraction (Anthropic + OpenAI)
│   ├── scoring.py            regex + byte-match + failure sub-code hint
│   └── aggregate.py          build results.csv + flag_results.csv
├── requirements.txt
└── README.md                 how to invoke (1 page)
```

### 1.A  `guard.py` (first because everything else depends on it)

- [x] 1.A.1  Module-level allow-list of directories:
  `prompts/`, `doc-pack/`, `runs/<current_run_id>/`, plus read-only
  allow for `expected_flags.json` and `flag_regexes.json`.
- [x] 1.A.2  `guarded_open(path, mode)` resolves the path, rejects
  anything outside the allow-list, and logs the rejection.
- [x] 1.A.3  `guarded_url(url)` accepts only `http://localhost:<PORT>`
  for the current run's port; rejects everything else. Extended to
  accept an allowed-port *set* so multi-port CTFs (CTF3: 5174+8004;
  CTF4: 5174+4001) pass primary + extras.
- [x] 1.A.4  Unit test: reject `../../src/...`, `SOLUTIONS.md`,
  `flags.json`, `workflow.md`, any absolute path outside allow-list,
  any host besides localhost on the configured port. Plus coverage
  for the multi-port set form.

### 1.B  `transcripts.py`

- [x] 1.B.1  One dataclass per event type from `RESULTS_TEMPLATE.md`
  (`Meta`, `UserMessage`, `AssistantMessage`, `ToolCall`, `ToolResult`,
  `Submit`, `End`).
- [x] 1.B.2  `TranscriptWriter(path)`: append-only JSONL, one event
  per line. Large bodies (>16 KB) stored as sidecar files, referenced
  by filename in the event.
- [x] 1.B.3  Writer flushes after every event (so mid-crash
  transcripts are still partially readable).
- [x] 1.B.4  `validate(path)` re-parses a transcript and fails if
  schema invalid. Called at end of every run.

### 1.C  `tools.py` + `executors.py`

- [x] 1.C.1  JSON-schema definition of the 5 tools (shared across
  vendors; each vendor adapter translates this to its tool format).
- [x] 1.C.2  `http_request(method, url, headers, body)`: uses
  `requests`; enforces `guarded_url`; 30 s timeout; truncates
  response body at 32 KB with full sidecar.
- [x] 1.C.3  `shell(command)`: `docker run --rm -v
  <scratch>:/scratch --add-host host.docker.internal:host-gateway
  llm-trial-shell:latest <command>` with a 30 s timeout,
  `--memory 256m --cpus 1`. Scratch dir is
  `runs/<run_id>/scratch/` and is mounted read-write.
- [x] 1.C.4  `read_local(path)`: only paths under the run's scratch
  dir; goes through `guarded_open`.
- [x] 1.C.5  `submit_flag(flag)`: records the candidate, runs scoring,
  sets the run's `end_reason = submitted`, returns
  `{accepted: bool}`.
- [x] 1.C.6  `give_up(reason)`: records the reason, sets
  `end_reason = gave_up`.
- [x] 1.C.7  Dockerfile for `alpine-tools` image: adds curl, jq,
  openssl, python3, node, sqlite3. Build once, tag
  `llm-trial-shell:latest`. This image is recreated per run.

### 1.D  `models.py`

- [x] 1.D.1  `ModelClient` protocol: `call(messages, tools,
  max_tokens) -> ModelResponse` where `ModelResponse` carries either
  a final `text` or a list of `tool_calls`.
- [x] 1.D.2  `AnthropicClient`: wraps `anthropic.Messages.create`;
  uses `tool_use` + `tool_result` blocks; extended thinking 4096
  (Opus only, via `--extended-thinking-budget`); prompt caching on
  the system prompt and the curated doc pack via
  `cache_control: {"type": "ephemeral"}`. Omits `temperature` when
  extended thinking is on (API constraint).
- [x] 1.D.3  `OpenAIClient`: wraps `openai.chat.completions.create`
  with function-calling; uses `max_completion_tokens` and surfaces
  `prompt_tokens_details.cached_tokens`.
- [x] 1.D.4  Both clients record token counts and any cache-hit
  metadata onto the `ToolResult` / `AssistantMessage` events.

### 1.E  `scoring.py`

- [x] 1.E.1  Load `expected_flags.json` and `flag_regexes.json`.
- [x] 1.E.2  `scan_for_candidates(transcript_text, ctf)` returns a
  list of `{flag_index, candidate_string, source}` where source is
  `submit`, `tool_result`, or `assistant_message` (last one covers
  the passive/cold-probe case where no submit event exists).
- [x] 1.E.3  `score(candidate, expected)` returns one of
  `{byte_match, regex_only, none}`.
- [x] 1.E.4  `per_flag_verdict(transcript)` emits one row per flag
  slot in the CTF: `{pass: bool, sub_code_hint: str|None}`. The hint
  is a machine heuristic; the authoritative sub-code is hand-coded
  per `RUBRIC.md`.

### 1.F  `harness.py` (entry point)

- [x] 1.F.1  CLI: `python harness.py --model <id> --condition
  <passive|agentic|cold-probe> --ctf <n> --test-user <u> --port <p>
  --run-id <hash> [--runs-dir ...] [--prompts-dir ...]
  [--doc-pack-dir ...] [--expected-flags ...] [--flag-regexes ...]
  [--extended-thinking-budget N] [--image-tag ...]`. `--port` accepts
  a comma-separated list (first entry is primary, rest are extras
  for multi-port CTFs).
- [x] 1.F.2  Reads the frozen prompt from `prompts/<condition>*.md`;
  substitutes `<TEST_USER>`, `<PORT>`, `<DOC_PACK>`,
  `<LOGIN_PAGE_HTML_SNAPSHOT>`; records `prompt_hash` in the `meta`
  event.
- [x] 1.F.3  Reads the doc pack from `doc-pack/ctf<n>.md`.
- [x] 1.F.4  Fetches the landing-page HTML via one GET to
  `http://localhost:<port>/` before starting the run. The pre-fetch
  is injected into the prompt, not the tool stream, so it does not
  count against the tool budget.
- [x] 1.F.5  Per-run loop:
  - Build messages list.
  - Loop: call `ModelClient.call`. If response is final text, end
    run (`end_reason = submitted` if it contained a
    `submit_flag` call earlier, otherwise `gave_up`). If response
    is tool calls, execute each, append tool_result, loop.
  - Enforce 20 tool-call cap; on breach, end with
    `end_reason = truncated`.
- [x] 1.F.6  On run end: score, write `flag_verdicts` sidecar, call
  `TranscriptWriter.validate`, exit 0 / non-zero.
- [x] 1.F.7  Runner script `run_matrix.py` iterates the full matrix
  and calls `harness.py` per cell, grouping by CTF so the stack is
  reset once per CTF (`docker compose down -v && up -d` on entry,
  `docker compose down -v` on exit).

### 1.G  `aggregate.py`

- [x] 1.G.1  Walks `runs/` and produces `results.csv` per `RESULTS_TEMPLATE.md`.
- [x] 1.G.2  Produces `flag_results.csv` per `RESULTS_TEMPLATE.md`.
- [x] 1.G.3  Emits the primary pass-rate table as Markdown for
  pasting into the Results section.
- [x] 1.G.4  Computes Clopper-Pearson 95% CIs per cell (pure-Python
  bisection on the regularised incomplete beta function; no scipy).
- [x] 1.G.5  Computes Cohen's kappa on the double-rated subset via
  `aggregate.py kappa --coding <path>` -- reads a CSV with
  `sub_code` and `secondary_sub_code` columns; rows with both
  populated contribute to the unweighted kappa.

### 1.H  Smoke test (no API calls)

- [x] 1.H.1  `tests/test_guard.py`: path + URL whitelist rejections.
- [x] 1.H.2  `tests/test_scoring.py`: scoring on synthetic
  transcripts (byte match, regex-only match, no match) -- 20 tests.
- [x] 1.H.3  `tests/test_transcripts.py`: round-trip write + validate.
- [x] 1.H.4  Run: `pytest tests/` --- all pass before moving to
  phase 2. (Current: 102 tests green across test_guard,
  test_scoring, test_transcripts, test_tools, test_executors,
  test_models, test_harness, test_aggregate.)

---

## Phase 2 --- Curate doc packs

- [x] 2.1  Create `doc-pack/` directory.
- [x] 2.2  For each of CTF1..9, copy the challenge README to
  `doc-pack/ctf<n>.md`.
- [x] 2.3  Per-file: delete the sections listed in `DOC_PACK.md`
  (flag-technique tables, challenge overview walkthroughs, learning
  outcomes, references to SOLUTIONS.md / workflow.md).
- [x] 2.4  Record what was removed from each source README (and from
  `STORY.md` for CTFs 7/8/9) in `doc-pack/CURATION_LOG.md`. The log
  also documents the deviation from DOC_PACK.md's "STORY.md
  verbatim" rule, where the project's STORY.md files turned out to
  be retheming design docs with explicit kill-chain restatements in
  their "Alternative Theme Examples" tails. Per-curation commits
  are deferred to the user.

---

## Phase 3 --- Provision trial state

### 3.0  Pre-provisioning fixes (discovered while starting Phase 3)

- [x] 3.0.1  Rename trial test users from `testuser0<n>` (10 chars,
  fails the generators' `/^[a-z]{4}[0-9]{2}$/` pattern) to
  `llmu0<n>` (4 letters + 2 digits). Touched `run_matrix.py`,
  `tests/test_transcripts.py`, `tests/test_aggregate.py`,
  `Evaluation/llm/README.md`, `PROTOCOL.md`, `RESULTS_TEMPLATE.md`,
  and this workflow. `pytest tests/` still green: 102 passed.
- [x] 3.0.2  Thread a trial salt through every `chgen_*.js`. Each of
  the 8 scripts now reads `process.env.GENERATOR_SALT` and passes
  `{salt: "<hex>-ctf<n>"}` (per-CTF namespace) to its generator
  module so tokens do not collide across CTFs under a shared trial
  salt. Three generator modules that used to hardcode their base
  salt (`ctf3_generator.js`, `ctf5_generator.js`, `ctf6_generator.js`)
  were extended to accept `options.salt` with a backward-compat
  fallback to their legacy constants when no options are supplied.
  CTF3's `ENCRYPTION_KEY_PASSPHRASE` is intentionally *not*
  salt-threaded -- it is baked into the CTF app as part of the
  recovery puzzle and must stay constant.
- [x] 3.0.3  Sub-salt composition verified. CTF5/6/8/9 use
  `${baseSalt}-flag${flagNum}` inside the generator; under a trial
  salt this composes to `<hex>-ctf<n>-flag${flagNum}`, preserving
  the per-flag separation. CTF3 uses two sub-salts (`-api-flag` and
  `-decrypt-flag`) layered on top of the base. Confirmed by running
  each generator with and without `options.salt` and checking that
  outputs diverge, per-flag tokens remain distinct, and there are
  no cross-CTF token collisions under a shared trial salt.

### 3.1--3.6  Provision

- [x] 3.1  Generated a 32-byte trial salt into
  `Evaluation/llm/trial.env` as `GENERATOR_SALT=<64-hex>`.
  `git check-ignore trial.env` confirms it is gitignored.
- [x] 3.2  Compute the per-CTF expected flags via
  `scripts/generate_expected_flags.js`. The script imports the same
  generator modules used by each `chgen_*.js`, passes
  `{salt: "${GENERATOR_SALT}-ctf<n>"}` (the per-CTF namespace), and
  composes each flag's prefix+token+username tail. For CTF4 (whose
  chgen is a per-user docker-deployment pattern, not a shared-stack
  generator), the trial path is `CTFs/CTF_4_corporate_helpdesk/
  scripts/add_users_db.js`, which was extended to derive its flag
  tail via HMAC when `GENERATOR_SALT` is set. The script is
  compute-only -- no in-repo `flags.json` is mutated; the live CTF
  stacks will re-derive the same strings at Phase 4/7 seed time.
- [x] 3.3  Wrote `Evaluation/llm/expected_flags.json` with 23 flag
  slots across 9 CTFs (CTF3: 2 slots; CTF5/6: 4; CTF7: 1; CTF8: 3;
  CTF9: 6; others: 1). Shape matches `lib/scoring.py`'s
  `load_expected_flags` contract. File is gitignored -- contains
  trial-specific tokens.
- [x] 3.4  Wrote `Evaluation/llm/flag_regexes.json` with one regex
  per CTF/slot (CTF5/6/8/9 have per-slot prefixes so each slot
  regex pins its `-flagN` variant). All 23 expected flags
  `re.fullmatch` their regex under the current trial salt.
  `flag_regexes.json` is tracked (see Phase 0.2): the regex set is
  pre-registered and carries no secret tokens.
- [ ] 3.5  Tag repo: `git tag evaluation/llm-trial-<yyyy-mm-dd>`.
  (Deferred to the user -- commits and tags are not auto-created by
  the harness build.)
- [x] 3.6  SHA-pinned the prompts. Wrote
  `Evaluation/llm/PROMPT_HASHES.txt` via
  `shasum -a 256 prompts/*.md`. Covers
  agentic-system.md, agentic-user.md, cold-probe.md, passive.md.

---

## Phase 4 --- Upper-bound baseline

- [ ] 4.1  For each CTF: `docker compose up -d`, seed the trial
  users, run the e2e script for that CTF, confirm it scores all
  flags.
- [ ] 4.2  Run the full `CTFs/e2e/run_all.sh` against the trial
  stack with trial users. All CTFs pass.
- [ ] 4.3  If any fail: fix the CTF, not the trial. Trial is blocked
  until green.

---

## Phase 5 --- Cold probe (27 runs, no stack)

- [ ] 5.1  `python run_matrix.py --phase cold-probe`. This iterates
  3 models x 9 CTFs passive.
- [ ] 5.2  Aggregate: `python aggregate.py --phase cold-probe`.
- [ ] 5.3  Inspect: expected 0 byte-matches across all 27 runs.
- [ ] 5.4  Any byte-match: stop. Investigate whether the model has
  seen the flag through training data or whether the anti-leak guard
  has a bug. Trial is blocked until resolved.

---

## Phase 6 --- Pilot (6 runs, ~USD 2)

- [ ] 6.1  `python run_matrix.py --phase pilot` --- Sonnet 4.6 x
  {CTF1, CTF5, CTF9} x {passive, agentic}.
- [ ] 6.2  Inspect each transcript manually. Check schema validates,
  tool invocations look sensible, no guard violations logged.
- [ ] 6.3  Fix any harness bug. Re-pilot until 3 consecutive runs
  are clean.

---

## Phase 7 --- Full run

- [ ] 7.1  Null-prompt sanity: 1 Opus run on CTF1 with README stripped
  to a bare placeholder. Expected failure.
- [ ] 7.2  `python run_matrix.py --phase primary` --- 36 runs.
- [ ] 7.3  `python run_matrix.py --phase flagship` --- 6 runs (Opus
  on CTF1/5/9 x 2 conditions).
- [ ] 7.4  Each run does `docker compose down -v && up` between
  runs against the same CTF. Wall clock: several hours; mostly
  unattended.

---

## Phase 8 --- Code failures

- [ ] 8.1  Primary rater (author): open every failed-flag row in
  `flag_results.csv`, read the transcript, assign one sub-code per
  `RUBRIC.md`.
- [ ] 8.2  Select 20% random sample (deterministic seed in
  `aggregate.py`). Export as a coding sheet with transcript links.
- [ ] 8.3  Send to supervisor or one peer for blind double-rating.
- [ ] 8.4  Compute Cohen's kappa: `python aggregate.py --kappa`.
  Target >= 0.7. Below: refine disambiguation, re-code full sample.

---

## Phase 9 --- Aggregate and draft

- [ ] 9.1  `python aggregate.py --tables` produces the Markdown
  tables.
- [ ] 9.2  Paste the primary table (9 CTFs x 3 models, passive and
  agentic) with Clopper-Pearson CIs into `resultsAndEval.tex`.
- [ ] 9.3  Write the integrity paragraph (cold-probe + hallucination
  sub-code fraction).
- [ ] 9.4  Write 1--2 qualitative paragraphs per CTF based on the
  highest-progress agentic transcripts, referencing the breadcrumb
  from `workflow.md`.
- [ ] 9.5  Commit `results.csv` and `flag_results.csv` under
  `evaluation/llm/` so the trial is reproducible from the tag.

---

## Gate: approval before Phase 1

This workflow is the plan of record. Before any harness code is
written, reviewer approval is required on:

- Module layout (1.A--1.H).
- Tool schema (1.C.1).
- Scratch-container strategy (1.C.3, the `alpine-tools` image).
- Anthropic prompt caching attachment points (1.D.2).
- CLI shape (1.F.1).

Flag any of these you want changed in writing before the build
starts.
