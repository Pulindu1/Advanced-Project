# Evaluation

Three evaluation tracks for the CTF suite.

| Track | Status | Folder |
|-------|--------|--------|
| 1. Unit / CI tests | Complete (see root `WORKFLOW.md`) | --- |
| 2. Human participants | Planned | `human/` |
| 3. LLM solvability trial | Planned | `llm/` |

## Layout

```
Evaluation/
├── README.md            this file
├── llm/
│   ├── PLAN.md          trial design (authoritative)
│   ├── DOC_PACK.md      doc curation per CTF
│   ├── RUBRIC.md        failure sub-coding rubric
│   ├── PROTOCOL.md      pilot + full run checklist
│   ├── RESULTS_TEMPLATE.md  output schemas
│   └── prompts/
│       ├── passive.md
│       ├── agentic-system.md
│       ├── agentic-user.md
│       └── cold-probe.md
└── human/
    ├── PLAN.md
    ├── INFORMATION_SHEET.md
    ├── CONSENT_FORM.md
    ├── PRE_SURVEY.md
    ├── POST_SURVEY.md
    ├── SESSION_PROTOCOL.md
    └── RECRUITMENT.md
```

## Cross-track

- Track 1 (CI e2e) provides the upper-bound baseline for Track 3.
- Track 2 outcomes feed Track 3's joint LLM-vs-human 2x2 (LLM `PLAN.md` Section 9).

## Note

The root `LLM_EVALUATION_PLAN.md` duplicates `llm/PLAN.md`; the copy
here is the authoritative version going forward and the root one can
be retired.
