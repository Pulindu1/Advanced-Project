# Advanced Computer Science Project — Pulindu Fonseka

MEng dissertation, Durham University. The repo contains four things that fit together:

1. **A 9-CTF web-exploitation corpus** (`CTFs/`) — every challenge dockerised, with unit, integration, and end-to-end exploit tests.
2. **A challenge generator** — the `chgen` library (`challenge-generation/`) plus per-CTF generator scripts (`CTFs/challenge-generation/`) used to produce per-player variants of each CTF.
3. **An LLM evaluation harness** (`Evaluation/llm/`) — completed trial; 5-model panel × 9 CTFs × {passive, agentic} with sandboxed tool use.
4. **A human study** (`Evaluation/human/`) — post-CTF participation forms and collected responses.

The LaTeX dissertation lives in `report/`. The single-file drafting source for the Evaluation chapter is `Evaluation/Writeup.md`.

## Repository layout

```
Advanced-Project/
├── CTFs/                       9 dockerised CTFs + cross-stack runner + e2e suite
│   ├── Basic_1_Nodejs/         (CTF1)  Node/Express                 port 3000
│   ├── CTF_2_pswd_manager/     (CTF2)  Node + React                 ports 4000, 5173
│   ├── CTF_3_HR-system/        (CTF3)  Laravel + React + Postgres   ports 8004, 5174
│   ├── CTF_4_corporate_helpdesk/ (CTF4) Express + React + Postgres + Redis  ports 4001, 5176
│   ├── CTF_5_internal_blog/    (CTF5)  Flask                        port 5175
│   ├── CTF_6_veridian/         (CTF6)  Rust/Actix + Redis           port 5180
│   ├── CTF_7_notes_app/        (CTF7)  Node/Express                 port 3001
│   ├── CTF_8_gazette/          (CTF8)  Go/Gin + SQLite              port 3002
│   ├── CTF_9_dunholm/          (CTF9)  Spring Boot + Postgres + Redis  port 3003
│   ├── e2e/                    pytest exploit-chain harness (58 tests over 23 flags)
│   ├── challenge-generation/   per-CTF generator scripts (chgen_ctf<n>.js + generators/)
│   ├── run-all-tests.sh        cross-CTF unit + integration runner
│   └── SOURCES.md              per-CTF design citations
├── Evaluation/
│   ├── README.md               three-track index
│   ├── Writeup.md              consolidated drafting source for the Evaluation chapter
│   ├── llm/                    LLM trial harness, prompts, runs, reports, coding outputs
│   └── human/                  post-CTF participation form + collected responses
├── challenge-generation/       chgen library (chgen.js, examples/, deploy/)
├── report/                     LaTeX dissertation (main.tex, sections/, references/, figures/)
├── CHANGELOG.md                dated narrative of project milestones
├── CTF_REPO_ANALYSIS.md        cross-CTF design + threat-model audit
└── .github/workflows/tests.yml CI: 9 parallel jobs, one per CTF
```

## The CTF corpus

| CTF | Title | Stack | Flags | Primary OWASP | Port(s) |
|-----|-------|-------|------:|---------------|---------|
| 1 | Basic Node.js | Node + EJS | 1 | A01 broken access | 3000 |
| 2 | Password Manager | Node + React | 1 | A02 crypto / A07 auth | 4000, 5173 |
| 3 | HR System | Laravel + React + Postgres | 2 | A01, A03, A05 | 8004, 5174 |
| 4 | Corporate Helpdesk | Express + React + Postgres + Redis | 1 | A03 XSS | 4001, 5176 |
| 5 | Internal Blog | Flask | 4 | A03 SSTI / RCE | 5175 |
| 6 | Veridian Portal | Rust/Actix + Redis | 4 | A10 SSRF | 5180 |
| 7 | Notes App | Node/Express | 1 | A08 deserialisation (CVE-2017-5941) | 3001 |
| 8 | Gazette | Go/Gin + SQLite | 3 | A01 IDOR / A03 cmd-injection | 3002 |
| 9 | Dunholm TrialVault | Spring Boot + Postgres + Redis | 6 | A01, A02, A03, A05, A07, A09 | 3003 |

Total: **23 flag slots** across 9 CTFs.

Every CTF ships with: the application source, `Dockerfile` / `docker-compose.yml`, generated player credentials in `credentials.json` (or per-CTF equivalent), the per-player flags in `flags.json`, a `SOLUTIONS.md` write-up of the intended exploit chain, and a test suite (unit + integration). Flags follow the per-CTF prefix forms `durham{...}`, `durham-pm{...}`, `durham-hr{...}`, `CTF{...}`, `durham-cms-flagN{...}`, `durham-vsec-flagN{...}`, `durham-ds{...}`, `durham-gzflagN{...}`, and `durham-drflagN{...}` so they are unambiguous to grade.

## Running a CTF

Each CTF is self-contained and ships with `docker compose`. From the repo root:

```bash
cd CTFs/<CTF_dir> && docker compose up -d --build
# e.g.
cd CTFs/CTF_5_internal_blog && docker compose up -d --build
# CTF1 also ships docker compose; npm dev mode is the alt:
cd CTFs/Basic_1_Nodejs && npm install && npm run dev
```

Tear down with `docker compose down -v` (the `-v` matters — it drops the per-CTF database / Redis volumes so the next boot reseeds with fresh per-player flags).

## Testing

The repo holds three layers of tests, each with a single-command entry point.

### 1. Unit + integration (per-CTF native suites)

```bash
bash CTFs/run-all-tests.sh           # all 9 CTFs, ~30-60 s warm
bash CTFs/run-all-tests.sh --quick   # skip CTF6 (Rust) and CTF9 (Spring) cold builds
```

Per-CTF commands the runner uses (also runnable directly):

```bash
cd CTFs/Basic_1_Nodejs           && npm test
cd CTFs/CTF_2_pswd_manager       && npm test
cd CTFs/CTF_3_HR-system/backend  && ./vendor/bin/phpunit
cd CTFs/CTF_4_corporate_helpdesk && npm test --workspaces --if-present
cd CTFs/CTF_5_internal_blog      && pytest -m unit          # or `-m integration`
cd CTFs/CTF_6_veridian           && cargo test --bins
cd CTFs/CTF_7_notes_app          && npm test
cd CTFs/CTF_8_gazette            && go test ./...
cd CTFs/CTF_9_dunholm            && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn test
```

CTF9 needs JDK 21; Mockito 5 (bundled with Spring Boot 3.2.5) cannot instrument Java 25 bytecode.

### 2. End-to-end exploit chains

These walk every flag in every CTF as a black-box exploit, asserting the per-player flag string is recovered. The CTF stacks must be running.

```bash
cd CTFs/e2e
pip3 install -r requirements.txt   # one-time
./run_all.sh                        # all 9 CTFs, 58 tests across 23 flags
python3 -m pytest ctf<N>_exploit.py -v   # single CTF
```

See `CTFs/e2e/README.md` for the per-CTF port matrix and troubleshooting table.

### 3. Continuous integration

`.github/workflows/tests.yml` runs the per-CTF native suites in 9 parallel jobs on every push and PR to `main`.

```bash
gh workflow view tests.yml
gh run list --workflow tests.yml
```

## LLM evaluation (Track 3, complete)

`Evaluation/llm/` is the LLM solvability trial. Per-run, per-phase, with append-only JSONL transcripts, a fail-closed sandbox (`Guard`: filesystem allow-list + `localhost`-only HTTP), an Alpine scratch container for the `shell` tool, and a 15-turn cap per agentic run.

Trial executed: **127 paid runs / 332 flag-slot observations / USD 5.25 spend** across cold-probe (45), pilot (6), null-prompt (1), primary (72) — `claude-sonnet-4-6`, `claude-haiku-4-5` (cold-probe only), `gpt-5-mini`, `gemini-2.5-pro`, `gemini-2.5-flash`. Cold probe produced **0 byte-matches** across 121 rows; coded sub-codes show **0 hallucinated flags** out of 325 failed flags (Cohen's κ = 0.959 on the 20 % double-rated sample, with the same-author IRR caveat declared in `Evaluation/Writeup.md` §5.2).

Headline commands:

```bash
cd Evaluation/llm
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python3 -m pytest tests/                        # 113 harness tests, no API calls
python3 harness.py --model claude-sonnet-4-6 --condition agentic --ctf 1 ...
python3 run_matrix.py --phase pilot             # cold-probe / pilot / primary / null-prompt / spot-check
python3 aggregate.py build                      # runs/* -> reports/{results,flag_results}.csv + tables.md
python3 aggregate.py kappa --coding coding/coded.csv
```

Outputs of record: `Evaluation/llm/runs/`, `Evaluation/llm/reports/{results,flag_results}.csv`, `Evaluation/llm/reports/tables.md`, `Evaluation/llm/coding/{coded.csv,summaries.jsonl}`. Full design + methodology + results consolidated in `Evaluation/Writeup.md`. Operational notes in `Evaluation/llm/README.md`.

## Human study (Track 2)

`Evaluation/human/` holds the participant-facing form (`post-ctf-participationform.md`) and the four collected responses under `responses/`. The data feeds the joint LLM-vs-human comparison in `Evaluation/Writeup.md` §11.

## Challenge generation

Two halves:

- `challenge-generation/` (root) — the **chgen library** (`chgen.js`) plus shared `examples/` and a `deploy/` Alpine deployment helper. See `challenge-generation/README.md`.
- `CTFs/challenge-generation/` — per-CTF generator scripts (`chgen_ctf<n>.js`) calling into shared modules under `CTFs/challenge-generation/generators/` (one `<ctf>_generator.js` per challenge), plus `generate_credentials.js`. These hydrate each CTF's `template/` against a `server_config.json` describing players, producing per-player flag values, credentials, and (where relevant) per-player encrypted artefacts.

## Dissertation report

`report/main.tex` is the LaTeX root; sections are split under `report/sections/` (`introduction.tex`, `relatedWork.tex`, `methodology.tex`, `resultsAndEval.tex`, `conclusion.tex`). Bibliography in `report/references/`, generated figures in `report/figures/`. The literature survey draft lives under `report/Literature Survey/`.

## Conventions

- **Per-player flags.** All CTFs are templated per-player so the same exploit chain produces a flag string unique to the test account; this is what the e2e suite asserts on. The LLM trial uses the seeded demo accounts (`abcd12`, except CTF5 which uses `test12`).
- **Demo credentials.** Each CTF's `credentials.json` (or `data/users.json` equivalent) is a generated artefact, not a secret. Rotate or harden before any non-research deployment.
- **Documentation.** Per-CTF intended-solution write-ups live in `<CTF>/SOLUTIONS.md` (CTF4 uses `SOLUTION.md`). Cross-cutting design citations live in `CTFs/SOURCES.md`.
- **Branch hygiene.** `main` is the default branch. CI (`tests.yml`) gates pushes and PRs.

## Stale top-level files

- `LLM_EVALUATION_PLAN.md` is an early draft of what became `Evaluation/llm/PLAN.md` (since folded into `Evaluation/Writeup.md`). Retained in-tree for history; not load-bearing.
- `CTF_REPO_ANALYSIS.md` is the cross-CTF audit notes used to drive the corpus design; consulted, not generated from.
- `reportreview.md` is the supervisor / self-review notes on the dissertation drafts.
