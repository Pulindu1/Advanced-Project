# Evaluation

Three evaluation tracks for the CTF suite.

| Track | Status | Folder |
|-------|--------|--------|
| 1. Unit / CI tests | Complete | `CTFs/*/e2e/` (per-CTF) |
| 2. Human participants | Responses collected | `human/` |
| 3. LLM solvability trial | Complete (127 paid runs, 332 flag observations, USD 5.25 spend) | `llm/` |

## Write-up source

[**Writeup.md**](Writeup.md) — single-file consolidation of design,
methodology, results, tables, kappa, integrity finding, qualitative
seeds, threats, and reproducibility steps. Drafting source for the
dissertation Evaluation chapter.

## Layout

```
Evaluation/
├── README.md              this file
├── Writeup.md             dissertation drafting source
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
│   ├── runs/              per-run transcripts + sidecars (gitignored)
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
  Track 3 (Phase 4 in `Writeup.md` §6.1; 9/9 PASS).
- Track 2 outcomes feed Track 3's joint LLM-vs-human 2 × 2 per CTF
  (`Writeup.md` §11).

## Reproducibility

See `Writeup.md` §15 for the end-to-end command sequence.
