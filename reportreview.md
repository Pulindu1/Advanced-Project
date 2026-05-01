# Report accuracy audit — 2026-04-30

Audit of `report/` against the implementation in `CTFs/`, `Evaluation/`, and `.github/workflows/`. Five high-severity items (factual contradictions between report text and code/data), four medium-severity, three low-severity.

---

## High-severity issues (factually wrong, contradicts repo, or breaks a numerical claim)

### H1. HMAC worked example does not match the actual flag the generator produces
- **File:** `report/sections/methodology.tex:211`
- **Quoted text:** `with prefix \texttt{durham}, salt \texttt{basic1-default-salt}, and username \texttt{abcd12}, the generator produces \texttt{durham\{3a1f9c2b4e7d8a0f\_abcd12\}}`
- **What's wrong:** computing `HMAC-SHA256(key=b"basic1-default-salt", msg=b"abcd12")` and taking the first 16 hex chars yields `9c417649bb29fd94`. `CTFs/Basic_1_Nodejs/flags.json:2` records `"abcd12": "durham{9c417649bb29fd94_abcd12}"`, confirming the actual generator output. The example token `3a1f9c2b4e7d8a0f` does not appear anywhere else in the repo (grep returns the single hit on this line), so it is invented.
- **Fix:** replace `3a1f9c2b4e7d8a0f` with `9c417649bb29fd94`. This is the report's only worked HMAC example and currently miscommunicates the very mechanism it is meant to demonstrate.

### H2. Table 7 caption misattributes the denominator
- **File:** `report/sections/resultsAndEval.tex` lines 343–345 (caption) and 351–355 (cells)
- **Quoted text:** `Sub-code distribution, primary-phase failed-flag rows ($n=204$)` with cells `truncated 75`, `methodology-correct, flag-absent 61`, `methodology-wrong 43`, `methodology-partial 25`.
- **What's wrong:** primary-phase failed rows alone are `n=182` with cells `truncated 65 / mc-flag-absent 55 / methodology-wrong 40 / methodology-partial 22` (computed directly from `Evaluation/llm/reports/flag_results.csv`). The table's actual numbers (75/61/43/25, n=204) match `primary + pilot + null` failed rows. So the cell counts are real but the caption attributes them to the wrong slice.
- **Fix:** either (a) change the caption to "all-phase failed-flag rows, primary + pilot + null" (n=204), or (b) keep "primary-phase" in the caption and replace the cell numbers with the primary-only figures (75 → 65, 61 → 55, 43 → 40, 25 → 22, n=204 → n=182, percentages recomputed).

### H3. Prose denominator "75 of 90 agentic flag-slots failed" is wrong
- **File:** `report/sections/resultsAndEval.tex:318–319`
- **Quoted text:** `75 of 90 agentic flag-slots failed, all 75 by hitting the 15-turn cap`
- **What's wrong:** there are 103 agentic flag-slot rows in `flag_results.csv` (`mode = agentic`, across pilot+primary), of which 96 failed and 7 passed; of the 96 failures, 75 carry `sub_code = truncated`. The "90" denominator does not appear anywhere in the data.
- **Fix:** "75 of 96 failed agentic flag-slots (of 103 total) hit the 15-turn cap"; or equivalently "all 75 truncations occurred in the agentic mode; 7 of 103 agentic slots passed". The CTF5/CTF9 truncation breakdown (16 and 18) immediately following is correct.

### H4. CTF3 endpoint name in methodology does not match the implemented route
- **File:** `report/sections/methodology.tex:357`
- **Quoted text:** `and a parallel endpoint \texttt{/api/debug/user-config}`
- **What's wrong:** `CTFs/CTF_3_HR-system/backend/routes/api.php:82` registers the debug endpoint as `/config`, mounted under the `/api/debug` group prefix; the actual path is `/api/debug/config`, not `/api/debug/user-config`.
- **Fix:** replace `user-config` with `config`.

### H5. CTF6 SSRF handler does not implement the gopher:// scheme that is claimed
- **File:** `report/sections/methodology.tex:433–435`
- **Quoted text:** `The same handler supports \texttt{dict://} and \texttt{gopher://}, enabling the Redis pivot documented by PortSwigger~\cite{BurpSSRFRedis}`
- **What's wrong:** `CTFs/CTF_6_veridian/src/preview.rs` only branches on `dict://` (and otherwise falls through to a `reqwest`-based HTTP fetch). There is no `gopher://` parser, no raw-socket handler, and no Redis-protocol composer. The Redis pivot (full RCE) is therefore not actually wired in the implementation.
- **Fix:** drop the `gopher://` claim and the Redis-pivot framing, or rewrite to describe only the `dict://` capability that is actually present (the `dict://` URL scheme plus the `169.254.169.254 → metadata` rewrite still teach the IMDS lesson without overstating what ships). Note this also has knock-on effects on `relatedWork.tex:205` where the recent v3 edit added a `gopher://` parenthetical claiming the handler exposes it — that parenthetical also needs to be dropped.

---

## Medium-severity issues (misleading framing, weak attribution, internal inconsistency that doesn't change the argument)

### M1. PHP version stated in methodology does not match CI
- **File:** `report/sections/methodology.tex:743`
- **Quoted text:** `Laravel 11 on PHP 8.2 (CTF3)`
- **What's wrong:** `.github/workflows/tests.yml:56` specifies `php-version: "8.4"` for the `ctf_3_hr_system` job. The shipped runtime is PHP 8.4.
- **Fix:** "Laravel 11 on PHP 8.4 (CTF3)".

### M2. Manual GPT-5.3 calibration table records CTF9 as 0 turns; underlying file says 30 (cap)
- **File:** `report/sections/resultsAndEval.tex` (manual GPT-5.3 calibration table, `tab:manual-gpt53`)
- **What's wrong:** the row for CTF9 records 0 turns. `Evaluation/llm/manual/GPT-5.3/ctf9-results.md` records `Turns: 30 (terminated)` / `30+ attempts`. The conclusion does refer to this elsewhere as "thirty-plus times", but the table cell itself misreads the failure as a zero-turn no-attempt.
- **Fix:** record CTF9 as `30 (cap)` or `30+ (terminated)` to match the source file and remove the implication that the model never tried. (Outcome column already reads `refused (safety)` which can stay; just fix the turns column.)

### M3. Bib partition between `relatedWork.bib` and `methodology.bib` is inconsistent
- **Files:** `report/references/relatedWork.bib`, `report/references/methodology.bib`, `report/references/main.bib` (empty, 1 line)
- **What's wrong:** Conclusion-cited keys `secgen2017`, `chothia2015`, `Cohen1960`, `HMACNIST`, `BurpSSRFRedis`, `hake1998`, `HartStaveland1988` all live in `methodology.bib`, not `relatedWork.bib`, despite being cited from outside the methodology chapter. All resolve correctly (verified by grep), so this is not a build failure — only a maintenance hazard.
- **Fix:** optional — consolidate into a single `references.bib`, or document the partition policy in a header comment in each `.bib` file.

### M4. "Eight of the ten 2021 OWASP categories" — claim is plausible but not enumerated in this pass
- **File:** `report/sections/conclusion.tex:8–10` ("a nine-challenge suite spanning eight of the ten 2021 OWASP categories"), with A04 and A06 explicitly excluded at line 134
- **What's wrong:** the union of OWASP classes across all nine `CTFs/CTF_*/ctf-config.json` files was not enumerated in this pass.
- **Fix:** verify by listing the union of `owasp` fields across the nine config files; if A04 and A06 are the only gaps, the "eight of ten" line is correct. (No edit recommended without that verification.)

---

## Low-severity issues (typos, formatting, minor citation polish)

### L1. Conclusion conflates the cold-probe and agentic empirical regimes
- **File:** `report/sections/conclusion.tex:38, 47–51`
- **Quoted text:** `survives direct empirical falsification under agentic LLM attack` followed by `5-model cold-probe returned 0/121 byte-matches`
- **What's wrong:** the cold-probe is by design *not* agentic (no shell, no fetch). The 0/121 byte-matches and 0 hallucinated rows out of 325 figures come from cold-probe phase data, not from the agentic phase. The agentic phase actually produced 7/103 byte-correct flag-slots — a real but limited byte-match signal.
- **Fix:** consider rephrasing as "survives direct empirical falsification under cold-probe LLM guessing, and resists most agentic recovery (7/103 agentic flag-slots passed under the 15-turn cap)" so the two empirical regimes are not conflated.

### L2. Conclusion claims the HMAC layer makes LLM-generated flags "structurally invalid"
- **File:** `report/sections/conclusion.tex:11–14`
- **Quoted text:** `deterministic-HMAC personalisation layer that makes flag sharing attributable and makes LLM-generated flags structurally invalid`
- **What's wrong:** a guessed `durham{[16 hex]_abcd12}` string is structurally valid; it is byte-incorrect with overwhelming probability. The cold-probe data (0/121 byte-matches) supports the byte-incorrect framing; "structurally invalid" slightly overstates the mechanism.
- **Fix:** swap "structurally invalid" for "byte-incorrect with overwhelming probability" or "computationally infeasible to forge without the per-deployment salt".

### L3. Cross-reference orphan sweep not run
- **Files:** all `report/sections/*.tex` (182 label/ref/cite occurrences across the five files)
- **What's wrong:** an exhaustive enumeration of `\ref{fig:...} \ref{tab:...} \ref{lst:...} \ref{alg:...}` orphans was not done. The cross-refs touched while verifying H1–M4 (Algorithm `flag-gen`, Figure `ctf9-chain`, Table `llm-subcodes`, Tables 5/6/7) all resolve.
- **Fix:** none required without further evidence; recommend a build-log scan for `Warning: Reference ... undefined`.

---

## Items checked and verified

- **HMAC mechanics** (mathematics, salt-by-CTF, multi-flag salt concatenation) — `methodology.tex:200–234` against `CTFs/challenge-generation/chgen_basic1.js:53–56` and `CTFs/challenge-generation/generators/basic1_generator.js`. Computation reproduced.
- **Total observation count: 332 flag-slot rows** in `flag_results.csv`.
- **Phase split:** cold-probe 121, pilot 22, null 1, primary 188.
- **Mode split:** cold-probe 121, passive 108, agentic 103.
- **0/121 cold-probe byte-matches; 0 hallucinated flag rows out of 325 failures across all phases.** Verified — `methodology-correct, flag-hallucinated` count is zero in every phase split.
- **Cohen's κ = 0.959 with raw agreement 63/65 on a 20% double-rate (n=65 of 325).** Consistent with `Evaluation/llm/scripts/double_rate.py` output.
- **CTF5: 12-keyword WAF blocklist matches the in-app `BLOCKED` list and the public CHANGELOG.** `CTFs/CTF_5_internal_blog/app/waf.py` `BLOCKED` and `CTFs/CTF_5_internal_blog/app/static/CHANGELOG.md` both contain `__, config, os, class, subclasses, request, import, popen, system, eval, exec, builtins`.
- **CTF6: IMDS rewrite to the Compose service hostname `metadata`** — `CTFs/CTF_6_veridian/src/preview.rs` and `CTFs/CTF_6_veridian/docker-compose.yml` confirm the `veridian-internal` network and the `169.254.169.254 → metadata` rewrite.
- **CTF7: node-serialize@0.0.4 / CVE-2017-5941.** `CTFs/CTF_7_notes_app/package.json:15` pins `node-serialize: 0.0.4`; `src/middleware/profileDeserializer.js` consumes it; `src/routes/debug.js:18` names CVE-2017-5941. Matches methodology and `STORY.md`.
- **CTF8: 5-character ping blocklist `;|&\n\r`.** `CTFs/CTF_8_gazette/internal/services/health.go` confirms.
- **CTF9: SQL injection in `ResearchService.search`.** `CTFs/CTF_9_dunholm/src/main/java/com/dunholm/service/ResearchService.java` confirms a vulnerable string-concatenated query path.
- **9-job CI matrix on push and pull-request triggers.** `.github/workflows/tests.yml:1–8` and the nine job stanzas.
- **Run matrix totals: 124 design cells + 3 resubmits = 127 paid runs.** Resubmits: 1 cold-probe (CTF9 / gemini-flash) and 2 primary-passive (CTF7 / Sonnet, CTF8 / gpt-5-mini).
- **Manual GPT-5.3 turn counts (CTF1–CTF8): 5, 16, 30, 19, 27, 19, 13, 21.** Verified against `Evaluation/llm/manual/GPT-5.3/ctf{1..8}-results.md`. (CTF9 is the M2 issue.)
- **Cold-probe methodology-correct rate: 45/121 ≈ 37%.**
- **Multi-flag counts:** CTF8 = 3, CTF5 = 4, CTF6 = 4, CTF9 = 6 — match per-CTF `flags.json`.
- **Bib keys spot-checked all resolve** in `report/references/methodology.bib` (`Cohen1960`, `HMACNIST`, `BurpSSRFRedis`, `secgen2017`, `chothia2015`, `hake1998`, `HartStaveland1988`).
- **`figures/ctf_shared_infrastructure_architecture.png` exists** — the only figure file in `report/figures/`.

---

## Notes / things not verified in this pass

- **Full bib citation-vs-definition sweep.** Not every `\cite{...}` was crossed against the union of `relatedWork.bib` + `methodology.bib` + `main.bib` (the last is empty, 1 line). Recommend a `bibtex` log scan.
- **Full label/ref orphan sweep** (L3 above).
- **Per-CTF OWASP-class tally (M4).** Should be cross-checked against each `CTFs/CTF_*/ctf-config.json` `owasp` field.
- **Table 5 (passive) Clopper-Pearson cell-by-cell verification.** Earlier in the audit some denominators (e.g. CTF8 gpt-5-mini "0/3 [.00,.46]") imply n=6 not n=3. The known-good explanation is the duplicate primary_passive run for that cell, but a full column-by-column reproduction of the Wilson/Clopper-Pearson computation from `flag_results.csv` was not done.
- **CTF4 admin-bot polling interval.** Implementation timing parameter not re-verified against the methodology prose.
- **CTF9 chain stages other than the SQLi.** The headline SQLi was verified; the rest of the six-stage chain (`InfoContributor` bean, traversal-filter regex, PEM exposure path, HS256 forgery, RSA-512 factorisation parameter, AES-GCM mode) was not re-verified end-to-end.
- **CTF1 cookie-encoding variants.** Base64 path verified; any plaintext or URL-encoded fallbacks not checked.
- **Total cost USD 5.25.** Referenced consistently; per-run cost fields across all 127 paid runs not summed.
