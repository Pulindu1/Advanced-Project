# Results Schemas

## Transcript (`runs/<ctf>_<model>_<condition>_<runid>.jsonl`)

One event per line.

| Event | Fields |
|-------|--------|
| `meta` (first) | run_id, model_id, prompt_hash, temperature, image_tag, timestamp, condition, ctf, test_user |
| `user_message` | role, content |
| `assistant_message` | role, content, reasoning (optional) |
| `tool_call` | call_id, name, arguments |
| `tool_result` | call_id, elapsed_ms, content (>16 KB truncated, full sidecar) |
| `submit` | flag, accepted |
| `end` (last) | reason: submitted / gave_up / truncated / error |

## `results.csv` (per run)

| Column | Type | Notes |
|--------|------|-------|
| run_id | str | matches transcript filename |
| model_id | str | pinned vendor ID |
| condition | enum | passive / agentic |
| ctf | int | 1..9 |
| test_user | str | testuser01..09 |
| tool_calls | int | 0 for passive |
| wall_clock_sec | float | |
| final_state | enum | submitted / gave_up / truncated / error |
| candidate_flag | str | submitted or last regex-matched string |
| candidate_flag_matches | enum | byte_match / regex_only / none |
| tokens_input | int | |
| tokens_output | int | |
| cache_hit_tokens | int | Anthropic cache reads |
| cost_usd | float | |

## `flag_results.csv` (per flag)

| Column | Type | Notes |
|--------|------|-------|
| run_id | str | FK to results.csv |
| ctf | int | |
| flag_index | int | 1..6 |
| pass | bool | per `PLAN.md` Section 5 |
| sub_code | enum | null if pass; else one from `RUBRIC.md` |
| first_tool_call_index | int | null if passive or fail |
| enabling_artefact | str | hand-coded for passes |
| double_rated | bool | in the 20% sample |
| secondary_sub_code | enum | if double_rated |

## Aggregate tables (Results section)

- **Primary:** 9 CTFs x 3 models, passive and agentic side by side.
  Cell = flag pass rate + Clopper-Pearson 95% CI.
- **Delta heatmap:** agentic - passive per (model, CTF).
- **Per-tier:** Basic / Intermediate / Advanced averages across
  models.
- **Integrity row:** cold-probe byte-match rate + hallucination
  sub-code fraction.
- **Joint 2x2 vs human:** per CTF (needs Track 2).
