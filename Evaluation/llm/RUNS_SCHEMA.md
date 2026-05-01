# Runs and coding schema

This is the on-disk contract produced by `harness.py` and consumed by
`aggregate.py` / `scripts/code_failures.py`. Anyone re-aggregating the
trial or extending the panel needs the layout below; the schema is
otherwise only implicit in the harness/aggregator source.

## Per-run layout

```
runs/<run_id>/
  transcript.jsonl       append-only event log (UTF-8, one JSON object per line)
  usage.json             single-object summary of the run
  flag_verdicts.json     list of per-flag verdict objects
  sidecars/              tool outputs > 16 KiB stored here, referenced by name
  scratch/               agent-only working dir (Alpine container mount, may be empty)
```

`<run_id>` format:
`<phase>_ctf<NN>_<condition>_<model_id>_s<seed>_<UTCYYYYMMDD-HHMMSS>_<6hex>`
Example: `primary_ctf09_agentic_gemini-2-5-flash_s1_20260428-205211_84310f`.

## `transcript.jsonl`

One event per line. First event is always `meta`; last is always `end`
(enforced by `lib/transcripts.validate`).

| event              | required fields                                                           |
| ------------------ | ------------------------------------------------------------------------- |
| `meta`             | run_id, model_id, prompt_hash, temperature, image_tag, timestamp, condition, ctf, test_user |
| `user_message`     | role="user", content                                                      |
| `assistant_message`| role="assistant", content, [reasoning]                                    |
| `tool_call`        | call_id, name, arguments                                                  |
| `tool_result`      | call_id, elapsed_ms, content, [sidecar]                                   |
| `submit`           | flag, accepted                                                            |
| `end`              | reason  (one of: `submitted`, `gave_up`, `truncated`, `error`)            |

If `content` exceeds 16 KiB UTF-8 bytes the writer extracts it to
`sidecars/sidecar_NNNN.txt`, truncates the inline copy to 1024 chars,
and adds a `sidecar` field naming the file. Aggregation never reads
sidecars.

## `usage.json`

Flat object, one row in `reports/results.csv`:

```
run_id, model_id, condition, ctf, test_user, seed,
turns, tool_calls, wall_clock_sec,
final_state            ("submitted" | "gave_up" | "truncated" | "error"),
submitted_flag         (string | null),
submit_accepted        (true | false | null),
tokens_input, tokens_output, cache_hit_tokens,
finished_at            (ISO-8601 UTC)
```

`condition` is one of `cold-probe`, `passive`, `agentic`,
`null-prompt`, `spot-check`. `seed` is `null` for cold-probe and
non-primary phases.

## `flag_verdicts.json`

List of objects, one per flag slot for the CTF. Each object has:

```
flag_index        ("1", "2", ...)
pass              (bool — byte-identical match against expected_flags.json)
sub_code_hint     (machine-generated seed for hand-coding; never authoritative)
```

These rows feed `reports/flag_results.csv` via `aggregate.py build`.

## `coding/coded.csv`

Hand-applied RUBRIC.md sub-codes, one row per failed flag attempt
(produced by `scripts/code_failures.py` and curated manually):

```
run_id, ctf, flag_index, model_id, condition,
sub_code               (one of: methodology-correct/flag-hallucinated,
                        methodology-correct/flag-absent, methodology-partial,
                        methodology-wrong, truncated, harness-error)
evidence               (short reason string)
double_rated           (true | false — 20% sample re-rated for IRR)
secondary_sub_code     (rater 2's verdict if double_rated, else "")
```

## `coding/summaries.jsonl`

One object per failed flag, written by `scripts/summarize_transcripts.py`
to seed the manual coding pass:

```
run_id, ctf, flag_index, model_id, condition,
n_assistant_msgs, n_tool_calls, tool_names,
submitted_flags        (list of strings)
assistant_text         (concatenated assistant messages, full text)
end_reason             (mirrors transcript end event)
```

## Reproducibility

`PROMPT_HASHES.txt` records the SHA-256 of every prompt template in
`prompts/` at trial-execution time. `lib/transcripts.meta` writes the
same hash into each run's first event so a transcript can be tied
back to the exact prompt that produced it. To reproduce a run end-to-end,
the harness needs (a) the prompt template at the recorded hash,
(b) the matching `expected_flags.json` row for the test user, and
(c) `alpine-tools.Dockerfile` rebuilt to the recorded `image_tag`.
