# Advanced Computer Science Project — Pulindu Fonseka

MEng dissertation, Durham University. The repo contains three things that fit together:

1. **A 9-CTF web-exploitation corpus** (`CTFs/`) — every challenge dockerised, with unit, integration, and end-to-end exploit tests.
2. **A challenge generator** (`challenge-generation/`) — the templating tool used to produce per-player variants of each CTF.
3. **An LLM evaluation harness** (`Evaluation/llm/`) and a parallel **human study protocol** (`Evaluation/human/`) — the two tracks that together answer the dissertation question: how do current frontier LLMs compare to undergraduate humans on these challenges?

The LaTeX dissertation itself lives in `report/`.

## Repository layout

```
Advanced-Project/
├── CTFs/                       9 dockerised CTFs + cross-stack test runner + e2e suite
│   ├── Basic_1_Nodejs/         (CTF1)  Node/Express   port 3000
│   ├── CTF_2_pswd_manager/     (CTF2)  Node + React   ports 4000, 5173
│   ├── CTF_3_HR-system/        (CTF3)  Laravel + React + Postgres
│   ├── CTF_4_corporate_helpdesk/ (CTF4) Express + React + Postgres + Redis
│   ├── CTF_5_internal_blog/    (CTF5)  Flask
│   ├── CTF_6_veridian/         (CTF6)  Rust/Actix + Redis + metadata svc
│   ├── CTF_7_notes_app/        (CTF7)  Node/Express
│   ├── CTF_8_gazette/          (CTF8)  Go/Gin + SQLite
│   ├── CTF_9_dunholm/          (CTF9)  Spring Boot + Postgres + Redis
│   ├── e2e/                    pytest exploit-chain harness (24 flags, 56 tests)
│   ├── run-all-tests.sh        cross-CTF unit + integration runner
│   └── SOURCES.md              per-CTF design citations
├── Evaluation/
│   ├── llm/                    LLM trial harness (PLAN.md is authoritative)
│   └── human/                  human-study protocol + ethics docs
├── challenge-generation/       chgen library for per-player CTF variants
├── report/                     LaTeX dissertation, figures, bibliography
├── CHANGELOG.md                dated narrative of project milestones
└── .github/workflows/tests.yml CI: nine parallel jobs, one per CTF
```

## The CTF corpus

| CTF | Title | Stack | Flags | Primary OWASP | Port(s) |
|-----|-------|-------|-------|---------------|---------|
| 1 | Basic Node.js | Node + EJS | 1 | A01 broken access | 3000 |
| 2 | Password Manager | Node + React | 1 | A02 crypto / A07 auth | 4000, 5173 |
| 3 | HR System | Laravel + React + Postgres | 3 | A01, A03, A05 | 8004, 5174 |
| 4 | Corporate Helpdesk | Express + React + Postgres + Redis | 1 | A03 XSS | 4001, 5176 |
| 5 | Internal Blog | Flask | 4 | A03 SSTI / RCE | 5175 |
| 6 | Veridian Portal | Rust/Actix + Redis | 4 | A10 SSRF | 5180 |
| 7 | Notes App | Node/Express | 1 | A08 deserialisation (CVE-2017-5941) | 3001 |
| 8 | Gazette | Go/Gin + SQLite | 3 | A01 IDOR / A03 cmd-injection | 3002 |
| 9 | Dunholm TrialVault | Spring Boot + Postgres + Redis | 6 | A01, A02, A03, A05, A07, A09 | 3003 |

Every CTF ships with: the application source, `Dockerfile`/`docker-compose.yml`, generated player credentials in `data/users.json` (per-CTF), a `SOLUTIONS.md` write-up of the intended exploit chain, and a test suite (unit + integration). All flags follow the form `durham-<ctfN>-flagM{<token>_<player>}` so they are unambiguous to grade.

## Running a CTF

Each CTF is self-contained and ships with `docker compose`. From the repo root:

```bash
cd CTFs/<CTF_dir> && docker compose up -d --build
# e.g.
cd CTFs/CTF_5_internal_blog && docker compose up -d --build
# CTF1 has no compose stack — run with npm directly:
cd CTFs/Basic_1_Nodejs && npm install && npm run dev
```

Tear down with `docker compose down -v` (the `-v` matters — it drops the per-CTF database/redis volumes so the next boot reseeds with fresh per-player flags).

## Testing

The repo holds three layers of tests, each with a single-command entry point.

### 1. Unit + integration (per-CTF native suites)

```bash
bash CTFs/run-all-tests.sh           # all 9 CTFs, ~30-60s warm
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

These walk every flag in every CTF as a black-box exploit, asserting the flag string is recovered. The CTF stacks must be running.

```bash
cd CTFs/e2e
pip3 install -r requirements.txt  # one-time
./run_all.sh                       # all 9 CTFs, 56 tests
python3 -m pytest ctf<N>_exploit.py -v   # single CTF
```

See `CTFs/e2e/README.md` for the per-CTF port matrix and troubleshooting table.

### 3. Continuous integration

`.github/workflows/tests.yml` runs the per-CTF native suites in nine parallel jobs on every push and PR to `main`.

```bash
gh workflow view tests.yml
gh run list --workflow tests.yml
```

## LLM evaluation harness

`Evaluation/llm/` is the LLM solvability trial: per-run, per-phase, with append-only JSONL transcripts and a fail-closed sandbox. `PLAN.md` is the authoritative design; `Evaluation/llm/README.md` covers operation. Headline commands:

```bash
cd Evaluation/llm
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python3 -m pytest tests/                     # 102 harness tests, no API calls
python3 harness.py --model claude-sonnet-4-6 --condition agentic --ctf 1 ...
python3 run_matrix.py --phase pilot          # cold-probe / pilot / primary / flagship / null-prompt
python3 aggregate.py build                   # runs/* -> reports/results.csv + tables.md
```

Sandbox invariants are documented at the bottom of `Evaluation/llm/README.md`: every filesystem access goes through `Guard`, every outbound HTTP is whitelisted to `localhost:<declared-ports>`, the shell tool runs in an ephemeral Alpine container, and runs cap at 15 turns.

## Human study

`Evaluation/human/` holds the participant-facing materials: `PLAN.md`, `INFORMATION_SHEET.md`, `CONSENT_FORM.md`, pre/post surveys, `SESSION_PROTOCOL.md`, recruitment notes. The data from this track feeds the joint LLM-vs-human comparison in the dissertation results chapter.

## Challenge generation

`challenge-generation/` contains `chgen`, the per-CTF templating tool. Each CTF has a generator script that hydrates a `template/` folder against a `server_config.json` describing players or tokens, producing per-player flag values, credentials, and (where relevant) per-player encrypted artefacts. See `challenge-generation/README.md`.

## Dissertation report

`report/main.tex` is the LaTeX root; sections are split under `report/sections/`. Bibliography in `report/references/`, generated figures in `report/figures/`. The literature survey draft lives under `report/Literature Survey/`.

## Conventions

- **Per-player flags.** All CTFs are templated per-player so the same exploit chain produces a flag string unique to the test account; this is what the e2e suite asserts on.
- **Demo credentials.** Each CTF's `data/users.json` (or equivalent) is a generated artefact, not a secret. Rotate or harden before any non-research deployment.
- **Documentation.** Per-CTF intended-solution write-ups live in `<CTF>/SOLUTIONS.md`. Cross-cutting design citations live in `CTFs/SOURCES.md`.
- **Branch hygiene.** `main` is the default branch. CI (`tests.yml`) gates pushes and PRs.
