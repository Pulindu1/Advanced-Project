# Human Participant Track --- Plan

## Purpose

Measure what real players do with the suite: time to flag, hints
needed, self-reported workload, perceived learning. Results feed the
joint LLM-vs-human 2x2 in the LLM track and the suitability-of-approach
subsection in Results.

## Participants

- **Target n:** 6--10 (dissertation-scale).
- **Inclusion:** university-level CS / cyber-adjacent background;
  consent; 90-minute availability.
- **Exclusion:** anyone who has seen the suite before; anyone with a
  supervisory or grading relationship to the author.
- **Recruitment:** Durham CS UG / MEng cohort via channels in
  `RECRUITMENT.md`. No financial incentive; snacks provided.

## Session structure (90 min)

| Time | Activity | Artefact |
|------|----------|----------|
| 0--5 | Welcome, info sheet, consent. | `INFORMATION_SHEET.md`, `CONSENT_FORM.md` |
| 5--15 | Pre-session survey. | `PRE_SURVEY.md` |
| 15--20 | Warm-up on a trivial example (outside the trial suite). | --- |
| 20--75 | Attempt assigned CTFs; think-aloud. | `SESSION_PROTOCOL.md` |
| 75--88 | Post-session survey. | `POST_SURVEY.md` |
| 88--90 | Debrief; thanks. | --- |

## CTF assignment

Each participant attempts **3 CTFs, one per tier**:

- Basic: CTF1 / 2 / 3.
- Intermediate: CTF4 / 5 / 6.
- Advanced: CTF7 / 8 / 9.

Order counterbalanced across participants (Latin square). Time per
CTF capped at 18 minutes. Timed hints per `SESSION_PROTOCOL.md`.

## Recording

- Screen recording (local only).
- Think-aloud audio.
- Facilitator field notes against observation rubric.
- Per-session spreadsheet with timestamps.

## Ethics

- Durham CS low-risk ethics form; submit before first session.
- Info sheet + written consent.
- Data pseudonymised at collection (P01..P10). Consent form held
  separately.
- Right to withdraw up to 14 days post-session.
- Recordings on encrypted university storage; destroyed once the
  mark is returned.

## Pilot

One session before the main run. Iterate on warm-up clarity, hint
cadence, survey wording. Pilot data excluded from final analysis.

## Metrics per participant x CTF

| Metric | Source |
|--------|--------|
| Time to first flag (or timeout) | session sheet |
| Hints taken (count + level) | facilitator |
| Hints-scaled score (0..1, rules below) | derived |
| Distinct techniques attempted | observation rubric |
| NASA-TLX (6 items) | `POST_SURVEY.md` |
| Perceived learning (Likert) | `POST_SURVEY.md` |
| Free text: "helped / blocked" | `POST_SURVEY.md` |

**Hints-scaled score:** 1.0 unaided; 0.75 after L1 or L2 hint; 0.5
after L3; 0.25 partial (vulnerability identified, no flag); 0.0
timeout.

## Outputs

- `evaluation/human/results.csv` (per participant x CTF).
- Median time per tier; hint frequency per CTF; NASA-TLX means.
- 2x2 joint table vs LLM per CTF (see LLM `PLAN.md` Section 9).

## Time budget

- Ethics + pilot: 1 week elapsed.
- Recruitment: 1--2 weeks (parallel with pilot).
- Main sessions: up to 10 x 90 min over 2 weeks.
- Coding + analysis: 1 week.

Total ~4 weeks elapsed, ~5 active days.
