# Post-CTF Participation Survey: Response 4

**Submitted:** 2026-04-22 17:49:38
**CTF Attempted:** CTF 9

---

## Participant Background

**Prior CTF Experience Level:** 7

**Number of Prior CTFs:** 10

**Consent:** Yes, I consent to the use of my responses.

## CTF Outcome

**Successfully Solved:** Yes, with the help of AI tools.

**Time Spent:** 1h 20m

**Confidence After Completion:** Significantly More Confident

**Enjoyment Rating:** 10 / 10

**Learning Rating:** 9 / 10

## Method / Steps Used

Flag 1 — durham-drflag1{71ef03daa17b99dd_abcd12}
Vuln: Unauthenticated Spring Boot Actuator exposure. /actuator/info returned build metadata including the per-user flag. Exactly as Rachel's security memo warned.
Flag 2 — durham-drflag2{8e780130f9a15b45_abcd12}
Vuln: Intended path was reading /app/config/application.properties via the insecure /api/files/download?name= endpoint (path traversal / no sanitisation). The config file contained # DR-HANDOFF-FLAG2: {{PLAYER_FLAG2}} — a per-user placeholder that was supposed to be substituted at runtime.
Issue: The placeholder {{PLAYER_FLAG2}} was never resolved — the raw template string was left in the file rather than the actual flag value. Confirmed as a challenge bug by the maker. Effective flag value confirmed via the flags.json shortcut.
Flag 3 — durham-drflag3{a8d75c8729cae0b4_abcd12}
Vuln: JWT algorithm confusion (RS256 → HS256). Config explicitly set jwt.verification.trust-algorithm-header=true. Fetched the RSA public key via the same file read bug, then forged an HS256-signed token using the public key as the HMAC secret, impersonating abcd12 with cto_admin role. /api/admin/dashboard returned the per-user flag.
Issue: alg:none was tested first and rejected — the intended exploit was specifically HS256 confusion, not the simpler none variant.
Flag 4 — durham-drflag4{}
Vuln: Blind SQL injection on /api/research/search. The query was SELECT COUNT(*) FROM trials WHERE title ILIKE '%<input>%'. Used boolean-based inference (EXISTS(...)) to confirm the user_flags table, enumerate the correct column name (flag_index, not flag_id — discovered via a Postgres error hint), and extract data character by character.
Issue: The flag_value for flag_index=4 was empty in the database — confirmed as a challenge bug. The exploit chain worked correctly but returned an empty flag durham-drflag4{}.
Flag 5 — Not reached.
Intended path: RSA-512 vault decryption chain — read /data/vault/classified-trial-results-2024-q2.enc, factor the weak 512-bit modulus (memo hinted at factordb.com), recover the wrapped AES key, combine dr-part1-3d7fa8c2b6e04915 and dr-part2-7f1a9c5e3b8d4a6f with encryption_key_part2 from the secrets table, then decrypt the vault file.
Issue: The vault file path returned "File not found" via the download endpoint, blocking progress. Likely a different access path was required.
Flag 6 — Not reached. Expected to be a full chain combining all previous vulns.

## Issues Encountered

Flag 2 (Technical bug)
The placeholder {{PLAYER_FLAG2}} in /app/config/application.properties was never substituted with the actual per-user flag value. The raw template string was served instead of the resolved flag, meaning the intended solve delivered no usable flag. This was confirmed directly with the challenge creator as a build-time substitution failure. Without that confirmation, the challenge appeared completable but silently broken.
Flag 4 (Technical bug)
The user_flags table row for flag_index=4 existed and was queryable, but the flag_value column was empty. The blind SQLi extraction chain worked correctly end-to-end and returned durham-drflag4{} — a valid format with no content. This was another silent data seeding failure that looked like a player error before the empty value was confirmed.
Flag 5 (Technical / accessibility)
The vault file /data/vault/classified-trial-results-2024-q2.enc was referenced in the seeded logs and was clearly a key part of the intended crypto challenge, but every attempt to access it via /api/files/download?name= returned "File not found." The JWT public key and config files were accessible via the same endpoint, so the issue appeared to be specific to that file — possibly a permissions issue, wrong base path, or the file not being emitted to the accessible directory. No error message was informative enough to distinguish between "wrong path" and "access denied by policy," which the seeded logs actually showed as a real event (download requested: /data/vault/... (denied by policy)). This made it ambiguous whether it was intentional or broken.
Column name guessing in SQLi (Clarity)
When probing the user_flags table schema, multiple plausible column names (flag_key, flag_id, flag_name) were tried before discovering the actual name was flag_index. The correct name was only found because PostgreSQL error messages included a hint: "Perhaps you meant to reference the column user_flags.flag_index." Without those hints being readable (which required the queries to actually reach the DB, i.e. not be URL-encoding errors), this would have required full schema enumeration via information_schema. The column name was unintuitive enough that it added unnecessary friction without adding meaningful difficulty.
Path traversal as a god-mode shortcut (Structural)
The /api/files/download?name= endpoint accepted absolute paths with no sanitisation, meaning /app/seed/flags.json dumped every flag for every player account in a single request. This completely bypassed every intended exploit chain. The file read bug was clearly intended to be part of the progression (used legitimately for the JWT public key and config file), but the lack of any path restriction meant a player who stumbled on it early could skip flags 2 through 6 entirely. A simple base-path restriction would have preserved the intended progression while still allowing the legitimate uses.

## Aspects That Went Well

What went well
The narrative framing was the strongest element of this CTF. Rachel's security memo was exceptional — it listed every vulnerability in plain English, mapped them to specific endpoints, and even explained the intended severity of each. This made the challenge feel like a realistic security handover rather than an artificial puzzle, and it meant the player always had a clear next target. The vulnerability chain was also well-sequenced conceptually: actuator exposure leads to credential disclosure, credentials lead to admin access, admin context exposes the JWT misconfiguration, and the JWT bug enables user impersonation. Each step fed the next. The JWT algorithm confusion bug was particularly well-implemented — the config explicitly set jwt.verification.trust-algorithm-header=true, the public key was retrievable via the same file read bug used earlier, and the admin API response was tied to the token's identity, making the payoff immediate and satisfying. The seeded log file with plaintext credentials was also a nice touch that felt authentic.

## Suggestions for Improvement

The two confirmed data bugs (empty flag4 value, unresolved flag2 placeholder) need fixing before the challenge is used again — silent failures that return valid-format but empty flags are very frustrating because they look like player error rather than infrastructure error. Adding a health-check or validation step at startup that verifies every expected flag value is non-empty would catch these before players hit them. The path traversal issue on /api/files/download needs a base-path restriction — the endpoint should resolve names relative to /data/uploads only, with explicit allowlisting for any other paths needed for the intended solve. This preserves the JWT public key retrieval and config file read as intended steps while preventing the flags.json shortcut. For flag 5, the vault file access should either work via the download endpoint with the correct path, or there should be a dedicated /api/vault/download endpoint that requires the forged JWT and the assembled decryption key — making the crypto challenge properly gated behind earlier flags. Finally, the flag_index column name should either be more intuitive or there should be a hint in the available documents pointing to the schema, since discovering it relied entirely on Postgres error messages rather than any intentional clue.