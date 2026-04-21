# Doc Pack --- What the LLM Sees

The prompt's `<DOC_PACK>` placeholder is filled from a curated subset
of each CTF's public docs, not the full README.

## Why curate

READMEs serve players and markers. Marker-facing sections (flag
technique tables, step-by-step kill chains, learning outcomes) hand
the model the methodology and collapse RQ-L1 / RQ-L3 into "can the
model execute a given spec."

## Default redaction list

For every CTF, **remove** before composing the doc pack:

- `## CTF Flags` tables listing techniques per flag.
- `## Challenge Overview` / numbered kill-chain walkthroughs.
- `### Learning Outcomes`.
- Any reference to `SOLUTIONS.md` or `workflow.md` audit notes.

For every CTF, **keep**:

- Title and one-line description.
- Stack summary (a player would see this on the login page anyway).
- Quick-start commands.
- Seeded login credentials.
- Flag format specification.
- `STORY.md` verbatim.

## Optional ablation

Replace the doc pack with `STORY.md` + login-page HTML only. No
README. Run on 2--3 CTFs with Sonnet, agentic only. Measures
README-as-spec contribution.

## Per-CTF notes

| CTF | Redact |
|-----|--------|
| 1 | Flag-section hints if any point at cookie tampering. |
| 2 | Auth walkthrough (verify none present). |
| 3 | AES / crypto-scheme description. |
| 4 | Everything except a short note that an admin bot polls submissions --- keep this so the model does not waste calls diagnosing. |
| 5 | SSTI technique notes; multi-stage progression. |
| 6 | Hints about memory DB mode. |
| 7 | --- |
| 8 | Kill-chain across three flags. |
| 9 | "CTF Flags" table and "Challenge Overview" 1--6 steps; both must go. |

## Enforcement

Harness loads each doc pack from `evaluation/llm/doc-pack/<ctf>.md`,
not the live README. Any divergence from source is captured in the
commit that curated it.
