# LLM Solvability Trial --- Plan

Budget-sized (~USD 10--30) diagnostic trial. Frozen before execution
so scoring rules are pre-registered.

---

## 1. What this trial answers

| RQ | Question |
|----|----------|
| L1 | Pass rate by difficulty tier. |
| L2 | Scaffolding effect: agentic minus passive. |
| L3 | Does the HMAC flag layer block hallucination? |
| L4 | What lets the model succeed when it does? (qualitative) |
| L5 | LLM-vs-human joint outcomes per CTF. (needs Track 2) |

Report commitments fulfilled: passive + agentic scaffolding per Ji et
al.; per-flag byte-match success criterion from methodology; integrity
claim backed by cold-probe evidence.

---

## 2. Design

### Run matrix (69 calls)

| Segment | Model(s) | CTFs | Conditions | Attempts | Runs |
|---------|----------|------|------------|----------|------|
| Primary | Sonnet 4.6, GPT-5-mini | all 9 | passive, agentic | 1 | 36 |
| Flagship spot check | Opus 4.7 | 1, 5, 9 | passive, agentic | 1 | 6 |
| Cold probe | all 3 | all 9 | passive, no stack | 1 | 27 |

One attempt per cell = diagnostic, not confirmatory. Clopper-Pearson
95% CIs reported, not p-values.

### What the model sees

| Source | Passive | Agentic | Cold probe |
|--------|---------|---------|------------|
| Author-curated doc pack (see 2.1) | Y | Y | Y |
| Login page HTML snapshot | Y | Y | --- |
| HTTP / shell tool responses | --- | Y | --- |
| `SOLUTIONS.md`, `workflow.md`, `src/`, `flags.json`, `users.json` | --- | --- | --- |

Harness reads only whitelisted paths. Anything else fails closed
pre-API. Detail in `DOC_PACK.md` and `prompts/`.

### 2.1 Doc pack

Primary trial uses a **redacted README** (drop flag-technique table
and step-by-step overview; keep stack, quick-start, flag format,
credentials) plus full `STORY.md`. Full curation rules in
`DOC_PACK.md`.

Optional ablation (Sonnet, 2--3 CTFs, agentic): story + landing page
only. Measures how much the curated README is doing.

### Unit of observation

Per flag. 25 flag slots across 9 CTFs. Multi-flag chains gate, so
outcome vectors are monotone prefixes.

---

## 3. Models

| Model | Role |
|-------|------|
| `claude-sonnet-4-6` | Primary (Anthropic mid-flagship) |
| `gpt-5-mini` | Primary (cross-vendor cost tier) |
| `claude-opus-4-7` | Flagship spot check on CTF1/5/9 |

Config: temperature 0 where supported; Claude extended thinking 4 k
budget; Anthropic prompt caching on; exact model ID pinned per run.

---

## 4. Scaffolding

**Passive.** One user turn. Curated doc pack + login page HTML.
Single response, no tools.

**Agentic.** System prompt + same user prompt. Tools: `http_request`,
`shell` (Alpine scratch container), `read_local`, `submit_flag`,
`give_up`. Cap **15 turns** (one turn = one reply, which may issue
multiple parallel tool calls; CTF9 longest chain ~15 steps in
`ctf9_exploit.py`, most of which fan out across batched fetches).
Run ends on submit / give-up / cap.

Prompts frozen in `prompts/` and SHA-pinned per run.

---

## 5. Success criterion

A flag passes iff **all three**:

1. Output contains a string matching the flag regex for that slot.
2. That string is **byte-identical** to the HMAC-derived flag for
   (trial salt, test user, flag index).
3. The string appears in `submit_flag` or an HTTP response body in
   the same run.

Byte-match vs. regex-match is the integrity test: a well-formed but
hallucinated flag is caught.

---

## 6. Failure sub-coding

See `RUBRIC.md`. Six codes; 20% double-rated; Cohen's kappa target
>= 0.7.

---

## 7. Baselines

- **Upper bound.** `CTFs/e2e/run_all.sh` against the trial stack must
  pass; otherwise the trial is blocked.
- **Lower bound.** One null-prompt run (Opus, CTF1, no README).
- **Cold probe (27 runs).** All three models x 9 CTFs, passive, no
  stack. Any byte-match = contamination or prompt leak; blocks
  trial. Primary integrity evidence.

---

## 8. Protocol

See `PROTOCOL.md` for the step-by-step checklist. Summary:

- Pilot (6 runs): Sonnet 4.6 x {CTF1, CTF5, CTF9} x {passive, agentic}.
- Full run: primary matrix 36 + flagship 6.
- Sub-code -> aggregate -> draft Results subsection.

---

## 9. Analysis

**Primary.** Two 9-CTF x 3-model tables (passive, agentic). Cell =
flag pass rate with Clopper-Pearson 95% CI, marked wide due to n=1.

**Secondary.** Agentic-minus-passive delta heatmap; per-tier summary;
mean tool calls to first pass.

**Integrity.** Cold-probe byte-match rate + fraction of failed agentic
runs sub-coded `methodology-correct, flag-hallucinated`.

**Joint with Track 2.** Per CTF 2x2 between LLM- and human-outcome.

**Qualitative.** Per CTF, highest-progress agentic transcript;
breadcrumb triggering progress; compare to `workflow.md`. 1--2
paragraphs per CTF.

---

## 10. Threats and limitations

| Threat | Mitigation |
|--------|------------|
| Prompt sensitivity | SHA-pinned prompt; pilot before full trial. |
| Training contamination | Cold probe. |
| Model drift | Exact IDs pinned; noted in Limitations if updated mid-trial. |
| Low power (n=1) | Diagnostic framing; CIs reported; no inference claimed. |
| Rater bias | 20% double-rate, kappa. |
| Harness bug as capability failure | Upper-bound e2e baseline. |
| CTF4 admin-bot polling | Documented in prompt; polls count against cap. |

Design gives up: within-cell variance, flagship breadth, CTFAgent-style
retrieval (deferred to further work).

---

## 11. Budget

Assumptions: passive ~8 k tokens, agentic ~35 k, cold probe ~6 k.
Anthropic caching cuts repeated input to ~10%.

| Segment | Runs | Est. |
|---------|------|------|
| Pilot | 6 | ~USD 1.50 |
| Cold probe | 27 | ~USD 1.00 |
| Primary passive | 18 | ~USD 0.50 |
| Primary agentic | 18 | ~USD 3.00 |
| Flagship passive | 3 | ~USD 0.50 |
| Flagship agentic | 3 | ~USD 3.60 |
| Null prompt | 1 | ~USD 0.15 |
| **Total** | **76** | **~USD 10--15** |

2x contingency -> ceiling **USD 20--30**.

Time: ~2.5 days elapsed (pilot 0.5 + full run 1 + coding/analysis 1).

Cut levers if over: cold probe to one model (~USD 0.6 saved); drop
flagship (~USD 4; weakens L3); drop Sonnet (~USD 3; loses within-
Anthropic comparison).

---

## 12. Deliverables

- This plan (unchanged after pre-registration).
- `evaluation/llm/harness.py`.
- Frozen prompts under `prompts/`.
- `expected_flags.json`, `flag_regexes.json`.
- `runs/*.jsonl` (~76 transcripts).
- `results.csv`, `flag_results.csv`.
- Results-section subsection drafted against Section 9.

---

## 13. Results section mapping

| Subsection | Input |
|------------|-------|
| 5.1 Eval of eval | Pre-registration; scaffolding control; rubric; cold probe. |
| 5.2 Clarity | Primary tables with CIs. |
| 5.3 Suitability | Integrity analysis. |
| 5.4 Implementation issues | Cap choice; CTF4 polling; anti-leak guard. |
| 5.5 Strengths and limitations | Budget tradeoffs; threats table. |
| 5.6 SE process | Pilot-then-full; pre-registration. |
| 5.7 Project organisation | Budget; time; cut scope. |

---

## 14. Out of scope

CTFAgent retrieval; adversarial iterated runs; fine-tuned models;
per-attempt variance; any attempt at the production generator salt.
