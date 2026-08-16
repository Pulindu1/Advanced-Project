# Evaluation

Three evaluation tracks for the CTF suite.

| Track | Status | Folder |
|-------|--------|--------|
| 1. Unit / CI tests | Complete | `CTFs/*/e2e/` (per-CTF) |
| 2. Human participants | Responses collected | `human/` |
| 3. LLM solvability trial | Complete (127 paid runs, 332 flag observations, USD 5.25 spend) | `llm/` |

The full design, methodology, and results write-up is in the submitted dissertation.

## Layout

```
Evaluation/
├── README.md              this file
├── llm/
│   ├── README.md          how to drive the harness
│   ├── harness.py         per-run entry point
│   ├── run_matrix.py      phase orchestrator
│   ├── aggregate.py       runs/ -> results.csv + flag_results.csv + tables.md
│   ├── lib/               guard, transcripts, tools, executors, models, scoring
│   ├── scripts/           build_expected_flags, summarize_transcripts, code_failures, double_rate, phase4_baseline
│   ├── tests/             113 unit tests
│   ├── prompts/           SHA-pinned passive / agentic / cold-probe templates
│   ├── doc-pack/          curated per-CTF docs (+ CURATION_LOG.md)
│   ├── manual/            exploratory human-in-the-loop pass (GPT-5.3, Sonnet-4.6)
│   ├── runs/              per-run transcripts + sidecars (checked in as trial output-of-record)
│   ├── reports/           results.csv, flag_results.csv, tables.md
│   ├── coding/            coded.csv, summaries.jsonl
│   ├── expected_flags.json, flag_regexes.json, PROMPT_HASHES.txt
│   ├── alpine-tools.Dockerfile, requirements.txt, pytest.ini
└── human/
    ├── post-ctf-participationform.md   form template
    └── responses/                       response{1..4}.md
```

## Cross-track

- Track 1 e2e baselines provide the upper-bound capability check for
  Track 3 (9/9 PASS).
- Track 2 outcomes feed Track 3's joint LLM-vs-human 2 × 2 per CTF.

## Reproducibility

See `llm/README.md` and `llm/RUNS_SCHEMA.md` for the harness commands and on-disk schema; the dissertation's Evaluation chapter has the full end-to-end procedure.
