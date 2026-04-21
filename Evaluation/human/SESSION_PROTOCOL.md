# Facilitator Protocol

## Pre-session setup

- [ ] Latest `evaluation/llm-trial-<date>` tag checked out.
- [ ] `docker compose up` on each CTF the participant will attempt;
      health-check endpoints green.
- [ ] Pre-provisioned user accounts for this participant's CTFs (one
      username per CTF).
- [ ] Screen recorder armed. Audio check.
- [ ] Info sheet, consent form, pre-survey ready.

## Framing (verbatim)

"You'll attempt three challenges. Please think aloud --- say what
you're trying, what you're seeing, what you expect. There are no
wrong questions. I may give you a hint if you're stuck for a few
minutes. You can stop at any time."

## Think-aloud prompts (use if silent > 30 s)

- "What are you looking at?"
- "What would you try next?"
- "What do you expect to see?"

## Hint ladder (per CTF)

Do not volunteer hints. Offer only at these timestamps, only if the
participant is visibly stuck:

| Minute | Level | Wording |
|--------|-------|---------|
| 6:00  | Direction | "Have you looked at [category] yet?" |
| 10:00 | Mechanism | "You'll probably want to modify a [component] in the request." |
| 14:00 | Specific  | "Try changing [field] to [payload family]." |
| 17:30 | Full | State the vulnerability and exploit family. |

At 18:00, advance regardless. Record outcome as partial / timeout.
Log every hint offered in the session spreadsheet.

## Observation rubric (fill as they work)

| Axis | What to note |
|------|--------------|
| Reconnaissance | View source? Dev tools? Docs? |
| Hypothesis | Which category do they land on first? How fast? |
| Iteration | On failure, retry same or pivot? |
| Tool use | Browser only / curl / Burp / scripts? |
| Breadcrumb trigger | Which artefact moved them forward? Verbatim if possible. |

## End of session

- [ ] Stop recording.
- [ ] Hand over post-survey.
- [ ] Answer questions.
- [ ] Snacks / thanks.
- [ ] Write up field notes while fresh.

## Scoring

Per participant x CTF:

- `solved_unaided` = flag submitted, no hints taken.
- `solved_assisted` = flag submitted after >= 1 hint.
- `partial` = vulnerability identified, no flag.
- `timeout` = 18:00 reached with no identification.

Derived: 1.0 unaided / 0.75 after L1--L2 / 0.5 after L3 / 0.25
partial / 0.0 timeout. Raw outcome is authoritative; derived score
is for aggregated summaries only.
