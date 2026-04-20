# CTF9 Dunholm Research, TrialVault, Implementation Workflow

This is the living implementation plan for CTF9. Phases are executed sequentially with a human-in-the-loop checkpoint at the end of each phase. Design decisions that came out of the pre-build Q&A with the user on 2026-04-19 are recorded at the top so they are canonical from here on.

---

## 1. Confirmed design decisions

| ID | Decision |
|----|---------|
| Q1 | Split into Phase A (skeleton), Phase B (flag implementations + narrative), Phase C (tests, docs, polish). Checkpoint between each phase. |
| Q2 | Flag 5 uses hybrid encryption: RSA-512 wraps an AES-256-GCM key. The composite key derived from Flag 1 material (`DR_API_KEY_PART1`, visible in `/actuator/env`) + Flag 4 material (`encryption_key_part2`, extracted via blind SQLi) IS the AES key. The RSA-encrypted payload carries the AES key back to the player as confirmation material. |
| Q3 | Flag 6 is gated by a Spring Security form-login session, NOT by JWT. Player must authenticate as `amir.patel` with the plaintext password harvested from `/actuator/logfile`. The JWT forgery path from Flag 3 does not bypass Flag 6. |
| Q4 | Filesystem layout inside the web container: `/data/uploads/` (seeded documents, traversal base), `/data/vault/classified-trial-results.enc`, `/app/config/application.properties` (copy with Flag 2 in a comment), `/app/keys/public.pem` (copy, readable), `/app/logs/trialvault.log`. The private key is loaded from an environment variable, not from disk, so traversal cannot reach it. |
| Q5 | External Docker port 3003. Spring Boot binds 8080 internally. |
| D1 | Flag 1 delivery via a custom `InfoContributor`: unauthenticated Actuator access returns a generic prompt; authenticated requests return the viewer's per-user Flag 1 in `build.flag`. |
| D2 | Player passwords are random per-player and emitted by `chgen_ctf9.js` (consistent with CTF3/5/6/7/8). |
| D3 | Staff account passwords: `amir.patel` gets the plaintext `DunholmCTO2024!` (intentionally logged). Helen, Rachel, James, and Sophie get long random bcrypt hashes and are not used for login. Helen is active; Rachel, James, Sophie are active; Amir is active (required for form login during Flag 6). |
| D4 | Public key as HMAC secret for Flag 3: server reads `/app/keys/public.pem` as raw bytes (PEM envelope included) and passes those bytes straight into `SecretKeySpec(..., "HmacSHA256")`. Python forger does `open('public.pem','rb').read()` and HMACs the same bytes. |
| D5 | No JWKS endpoint. The public key is reachable via Flag 2's traversal. |
| D6 | `DR_API_KEY_PART1` lives under the property name `app.config.dunholm-handoff-a`. This name does not match Spring's default sanitiser regex (`password|secret|key|token|credentials|vcap_services|sun.java.command`), so the raw value is surfaced in `/actuator/env`. |
| D7 | Login rate limiting: 5 failed attempts per 2-minute sliding window per IP. Matches CTF1/CTF8. |
| D8 | Methodology update (`report/sections/methodology.tex`) is deferred until CTF9 is fully built. Single pass will cover all nine CTFs uniformly. |
| D9 | Flag 4 structure: the `secrets` table holds two rows per player. `(key='encryption_key_part2', value=<same AES half for all players>)` and `(key='flag4_<username>', value=<per-user Flag 4>)`. Blind SQLi is needed to extract either. The per-user row is Flag 4; the shared row feeds Flag 5. |

### Notes on the traversal filter

The brief lists three traversal bypasses (`%2e%2e%2f`, `....//`, `..%2f`). Against a filter written as `filename.replace("../", "")` applied to a Spring-decoded `@RequestParam`, only `....//` reliably bypasses. Spring auto-decodes `%2e%2e%2f` to `../` before the filter sees it, which the filter then strips. SOLUTIONS.md will therefore use `....//` as the canonical payload and note the URL-encoded variants do not work under this specific filter. `..%2f` likewise decodes to `../` and is blocked.

### Notes on factoring N

RSA-512 decryption for Flag 5 relies on the player factoring a 155-digit N. factordb.com has a large pre-factored cache; fresh random moduli may not be present. We will generate one fixed `(n, e)` pair for document encryption (same across all users, only the plaintext varies) and pre-submit n to factordb.com during development, and document both msieve and pycryptodome fallbacks in SOLUTIONS.md.

---

## 2. Flag chain summary

| Flag | Technique | OWASP | Breadcrumb FROM | Breadcrumb TO |
|------|-----------|-------|-----------------|---------------|
| 1 | Spring Boot Actuator exposure; `/actuator/info` personalised via `InfoContributor` | A05 | Login-page footer comment `TrialVault v3.4.1 / Powered by Spring Boot`; initial reconnaissance | `/actuator/env` leaks `file.storage.base-path`, `jwt.public-key-location`, and `app.config.dunholm-handoff-a` which carries `DR_API_KEY_PART1` |
| 2 | Directory traversal with `....//` bypass | A01 | `/actuator/env` gives `file.storage.base-path=/data/uploads` | Comment inside the leaked `application.properties` names `com.dunholm.model.Secret` and `jwt.verification.trust-algorithm-header=true`; also leaks `public.pem` |
| 3 | JWT algorithm confusion (RS256 to HS256, public key as HMAC secret) | A02, A07 | Application properties leak from Flag 2 names the `trust-algorithm-header` flag; public key from Flag 2 used as HMAC secret | Admin dashboard carries Flag 3, Rachel's memo (names RSA-512, raw SQL), the recent-queries log showing `SELECT * FROM secrets WHERE key = 'encryption_key_part2'`, and Amir's note pointing at `/api/research/search` |
| 4 | Blind boolean SQL injection | A03 | Admin dashboard's recent-queries log names the `secrets.key` column; Rachel's memo warns about raw SQL on the search endpoint | Extracted `encryption_key_part2` feeds Flag 5; extracted `flag4_<username>` is Flag 4; Rachel's memo and the admin dashboard both reference the `classified-trial-results.enc` file and that RSA-512 is in use |
| 5 | RSA-512 factoring + AES-256-GCM hybrid decryption | A02 | `.enc` file header names RSA-512; Rachel's memo names CWI 1999 factoring; composite AES key requires both `DR_API_KEY_PART1` (Flag 1 material) and `encryption_key_part2` (Flag 4 material) | Decrypted plaintext contains Flag 5, the stolen Phase 2 trial narrative, and the line "Coordination via TrialVault internal messaging. See system logs for access timeline" pointing at the log file |
| 6 | `/actuator/logfile` password leak + form-login as `amir.patel` | A09 | Flag 5 plaintext references the logs; Actuator exposure (Flag 1) means `/actuator/logfile` is already reachable | `/incident-report` renders the board's summary naming Amir as the insider, carrying Flag 6 |

Every flag surfaces something the next flag needs. No flag requires knowledge not explicitly surfaced by a previous flag or by the initial reconnaissance of a login-page comment.

---

## 3. Phase A, Skeleton

End state: container stack boots cleanly, three services (web, postgres, redis) running, empty controllers respond 200/404, generator integrated into challenge-generation and produces `flags.json`. No flag logic yet.

### A1, Directory layout
Create the full source tree under `CTFs/CTF_9_dunholm/` matching the brief's layout. Empty placeholder files where content lands later.

### A2, Maven project file
Write `pom.xml`. Spring Boot 3.2.x parent, Java 17, dependencies: spring-boot-starter-web, spring-boot-starter-security, spring-boot-starter-data-jpa, spring-boot-starter-thymeleaf, spring-boot-starter-actuator, spring-boot-starter-data-redis, postgresql driver, jjwt-api/jjwt-impl/jjwt-jackson, bcrypt via spring-security-crypto (inherited), bucket4j for rate limiting (or a hand-rolled sliding window, same pattern as CTF8), spring-boot-starter-test.

### A3, Dockerfile
Multi-stage. Stage 1 `maven:3.9-eclipse-temurin-17` runs `mvn -B -DskipTests package`. Stage 2 `eclipse-temurin:17-jre-alpine` copies the jar, the keys directory to `/app/keys/`, the application.properties to `/app/config/application.properties`, seeded uploads to `/data/uploads/`, the encrypted vault file to `/data/vault/`, and creates `/app/logs/`. Entrypoint `java -jar /app/trialvault.jar`.

### A4, docker-compose.yml
Three services: `web` (built from Dockerfile), `postgres:16`, `redis:7-alpine`. Web depends on both. External port mapping `3003:8080`. Internal network.

### A5, Ignore files
`.dockerignore`, `.gitignore` modelled on CTF8.

### A6, application.properties
Actuator exposure `management.endpoints.web.exposure.include=*`, `management.endpoint.env.show-values=always`, log file name `/app/logs/trialvault.log`, DEBUG level on `com.dunholm.service.AuthService`, JDBC URL via env var, `jwt.verification.trust-algorithm-header=true`, `file.storage.base-path=/data/uploads`, `jwt.public-key-location=classpath:keys/public.pem`, `app.config.dunholm-handoff-a=<DR_API_KEY_PART1 value>`, hidden comment carrying Flag 2.

### A7, Application entrypoint
`com.dunholm.DunholmApplication` with `@SpringBootApplication`.

### A8, Security configuration stub
`SecurityConfig` permits `/actuator/**`, `/login`, `/static/**`, `/error`; requires authentication on `/dashboard`, `/documents`, `/incident-report`; form login with a custom success handler that issues a JWT cookie; JWT filter for `/api/**`.

### A9, Database schema and seed
`schema.sql` defines `users`, `trials`, `secrets`, `documents`, `user_flags` (per-user flag storage populated from `flags.json` at boot). `seed-data.sql` inserts staff users and trial metadata; per-user rows inserted by a startup `CommandLineRunner` that reads `data/flags.json` and `data/users.json`.

### A10, JPA entities
`User`, `Trial`, `Secret`, `Document`, `UserFlag` with conventional mappings.

### A11, Repositories
`UserRepository`, `TrialRepository`, `SecretRepository`, `DocumentRepository`, `UserFlagRepository`. Spring Data JPA interfaces.

### A12, Empty controllers
`AuthController`, `DashboardController`, `FileController`, `AdminController`, `ResearchController`, `IncidentController` returning placeholders.

### A13, JWT scaffolding
`JwtConfig`, `JwtService` (legitimate RS256 signing + deliberately vulnerable verification that honours the `alg` header), `JwtAuthFilter`.

### A14, Generator integration
`CTFs/challenge-generation/generators/ctf9_generator.js` exporting a multi-flag function that returns `{flag1..flag6}` using the shared `ctf9-dr-default-salt` base with per-flag sub-salts. `CTFs/challenge-generation/chgen_ctf9.js` CLI consistent with `chgen_ctf8.js` conventions. npm script `generate-flags-ctf9` added to `package.json`. `challenge-generation/README.md` updated with the CTF9 row.

### A15, RSA key material
Pre-generated at development time and committed to the repo: one RSA-2048 key pair for JWT signing at `src/main/resources/keys/{public.pem,private.pem}`, and one RSA-512 key pair for document encryption at `src/main/resources/keys/doc-{public.pem,private.pem}`. The private keys are loaded from environment variables in the running container (fed in via Docker Compose), so the repo files are for developer reference only and the container does not expose them on the filesystem.

### A16, Boot verification
`docker compose up --build` yields three healthy services, `/actuator` lists the Actuator endpoints, `/login` renders an empty Thymeleaf page, generator runs cleanly against three sample usernames.

### A17, Phase A checkpoint
Send user a short summary and ask for approval before moving on.

---

## 4. Phase B, Flag implementations and narrative

End state: all six flags retrievable end-to-end via the intended chain, verified against a live container. Full narrative present in all templates and seed data.

### B1, Authentication and legitimate JWT signing
`AuthController` handles `GET /login`, `POST /login`, `GET /logout`. On successful login `AuthService` issues an RS256 JWT with `{sub, username, role, iat, exp}` signed with the JWT private key, dropped as an `HttpOnly` cookie. Player passwords verified against bcrypt hashes in `users` table. Rate limiter per D7. Request body logging at DEBUG intentionally includes the raw JSON, which is how Amir's plaintext password reaches the log.

### B2, Dashboard with narrative
`DashboardController` renders `dashboard.html`. Welcome panel, recent trial summaries sidebar, research highlights. Role-gated nav: `Documents`, `Admin` (visible to all, bounces non-admins), `Log out`. No exploit hints in copy.

### B3, Flag 1, Actuator + InfoContributor
`DunholmInfoContributor` bean reads the authenticated principal from `SecurityContextHolder` (if present) and adds `build.flag = <per-user Flag 1>` to the info map. Unauthenticated fetch returns a polite prompt. `/actuator/env` surfaces `app.config.dunholm-handoff-a` (D6), `file.storage.base-path`, and `jwt.public-key-location`.

### B4, Seeded narrative documents
Six to eight Markdown or plain text files written into `src/main/resources/data/uploads/` at build time and copied to `/data/uploads/` in the Docker image:
- `trial-summary-2024-q2.txt` (James's public summary)
- `regulatory-draft-v3.txt` (submission draft)
- `board-minutes-2024-09.txt` (Helen mentions the competitor leak)
- `rachel-security-memo.txt` (full memo; the admin dashboard pins an excerpt)
- `staff-handbook.txt` (Durham flavour, character bios)
- `access-policy.txt` (what TrialVault staff should not do, ignored)
- `welcome-note.txt` (Sophie's draft).

The seeded catalogue is listed on `/documents` and each entry links to `/api/files/download?name=<file>`.

### B5, Flag 2, FileController with traversal
`FileController` implements `GET /api/files/download?name=<filename>` with the brief's vulnerable filter. Dockerfile copies `application.properties` to `/app/config/application.properties` and `public.pem` to `/app/keys/public.pem`. Flag 2 sits in a comment inside the copied application.properties.

### B6, Flag 3, JWT algorithm confusion
`JwtService.verifyToken` branches on the `alg` header as in the brief. `AdminController` admin dashboard renders:
- Admin overview stats
- Full user directory (amir.patel, role `cto_admin`)
- Rachel's pinned memo excerpt (names RSA-512 and raw SQL on the search endpoint)
- "Recent SQL queries" panel showing `SELECT * FROM secrets WHERE key = 'encryption_key_part2'` and similar
- Amir's note about `/api/research/search`
- Flag 3

### B7, Flag 4, Blind SQL injection
`ResearchController` `GET /api/research/search?q=<query>` delegates to `ResearchService.search` (the brief's raw-concatenation snippet). Response shape `{"found": boolean, "count": integer}`. Secrets table seeded per D9.

### B8, RSA-512 + AES-256-GCM encrypted document
At build time we run a small script that:
1. Generates the 512-bit RSA document key pair.
2. Derives the AES-256 key as SHA-256(`DR_API_KEY_PART1` + `encryption_key_part2`).
3. Per-user: builds a narrative plaintext carrying the user's Flag 5 and the log hint.
4. AES-256-GCM encrypts the plaintext with a fresh random IV.
5. RSA-512 encrypts the AES key with the document public key.
6. Emits `classified-trial-results-<username>.enc` with the header format from the brief, extended to carry the RSA-wrapped AES key and the AES IV and tag.

Per-user variants are placed in `/data/vault/` and served by name via the same directory traversal payload the player already knows.

### B9, Flag 5, Decryption
No server-side decryption logic; the decryption happens on the player's machine. SOLUTIONS.md will carry the reference Python script. The encrypted file header documents the algorithm and prompts the player to factor n.

### B10, Flag 6, Logfile + form login + incident report
`AuthService` logs the raw JSON login body at DEBUG (brief's snippet). Seeded logs in `/app/logs/trialvault.log` contain 40 hand-crafted lines of realistic application log spanning several days, including Amir's login with password. `/actuator/logfile` serves the file verbatim. `IncidentController` `GET /incident-report` is mapped inside the Spring Security authenticated area and checks `Authentication.getName() == "amir.patel"` using the session (not the JWT), returning the board's incident summary with Flag 6.

### B11, Templates
`login.html`, `dashboard.html`, `admin.html`, `documents.html`, `incident-report.html`, `error.html`, plus `fragments/header.html` and `fragments/footer.html`. All written with full narrative content per the brief. No exploit hints in player-visible copy except where the brief specifies a breadcrumb.

### B12, Stylesheet
Clinical/corporate palette: deep medical blues, whites, pale greys. Inter or system UI font. Modelled on the Gazette's stylesheet structure but retuned.

### B13, Error page
Themed error page per the brief.

### B14, End-to-end chain verification
Live walk-through against a running container capturing each of the six flags. Document the exact commands used.

### B15, Phase B checkpoint
Send user the verification transcript plus a short list of any deviations from the brief. Await approval before Phase C.

---

## 5. Phase C, Tests, documentation, polish

### C1, Integration tests
JUnit 5 + Spring Boot Test, exercising all seven assertions listed in the brief plus an archive-style test confirming the JWT forgery does not bypass Flag 6 (reinforcing Q3's decision).

### C2, README.md
Player-facing setup, difficulty, OWASP mapping, credentials, flag format, regeneration instructions, references list per the brief. No spoilers.

### C3, SOLUTIONS.md
Instructor-only walkthrough matching the depth of CTF5 and CTF6 SOLUTIONS:
- Credentials + flag locations table
- Per-flag section with Discovery path, Exploit steps, full commands and Python scripts where applicable
- Flag 3 Python forger
- Flag 4 blind SQLi character-extraction script
- Flag 5 factoring + decryption script (factordb link, Alpertron link, msieve fallback, pycryptodome)
- Flag 6 log inspection and form-login steps
- Defence recommendations per flag
- OWASP classification table
- Skill-level summary
- Unintended-solutions section

### C4, STORY.md
Character bios, narrative arc diagram, narrative-strings inventory by file, retheming guide, references.

### C5, workflow.md final audit
Unintended-vulnerability audit V1 to V8 per the brief, each with Risk and Mitigation subsections matching CTF6's `### Vn -- Name` format. Section appended to this file at Phase C.

### C6, ctf-config.json
Machine-readable metadata per the brief's schema.

### C7, CHANGELOG.md at repo root
Append a CTF9 entry.

### C8, Regression sweep
Re-run the Phase B verification commands one final time, regenerate flags for a fresh trio, confirm the chain still holds.

### C9, Delivery
Summary of what was built, deviations from the brief, exact verification commands, the RSA-512 keypair values (n, e, p, q) so the user can sanity-check factoring, and a list of narrative passages worth highlighting.

---

## 6. Unintended vulnerability audit

Following the format established in CTF4 and reused by CTF6.

### V1 -- Thymeleaf Template Injection / XSS

**Risk:** Narrative strings derived from seeded data are rendered into `dashboard.html`, `documents.html`, `admin.html`, and `incident-report.html`. If any binding used `th:utext` or a raw concatenation into server-rendered HTML, a player could inject script via a secret value or a document filename and use the Thymeleaf surface to pivot to a stored XSS that leaks other players' JWT cookies.

**Mitigation:** Every binding in the templates is `th:text` / `${}`, which auto-escapes by default in Thymeleaf 3. No `th:utext` or `[(...)]` unescaped inline is used anywhere. The admin dashboard is rendered client-side via `textContent` / `createElement` in `admin.html`, never `innerHTML`. Verify with `grep -R 'th:utext\|innerHTML' src/main/resources/templates/` returning empty.

### V2 -- SQL Injection on Login

**Risk:** The Flag 4 vector establishes that `entityManager.createNativeQuery` with string concatenation is present in the codebase. If `AuthService.login` were to reuse that pattern against the `users` table, a player could bypass authentication with `' OR '1'='1` and skip Flags 1 through 3 entirely.

**Mitigation:** `AuthService.login` uses `userRepository.findByUsername(String)`, a Spring Data JPA derived query that Spring binds as a prepared statement with a single `?1` positional parameter. BCrypt verification happens in Java after the lookup. The native-query surface is deliberately confined to `ResearchService.search`. Verify with `grep -R createNativeQuery src/main/java/` returning only `ResearchService`.

### V3 -- Login Brute Force

**Risk:** Player passwords are random six-character lowercase strings. Without rate limiting, a determined player could brute-force another player's account in the three-player deployment, skipping the audit chain and reading the target's Flag 1 through 5 directly.

**Mitigation:** Bucket4j enforces the D7 rate limiter: 5 failed attempts per 2-minute sliding window per source IP on `POST /login` and `POST /staff-login`. Successful logins do not consume tokens. The limiter is per-IP; multi-source attacks are out of scope for a single-node CTF deployment. Verify by posting 6 bad passwords back-to-back and observing HTTP 429 on the sixth.

### V4 -- Direct HTTP Access to `/data/vault/`

**Risk:** The encrypted release envelopes live at `/data/vault/<username>.enc` inside the container. If Spring's static resource handler were mapped to `/data/**`, a player could fetch the `.enc` file at `http://host:3003/data/vault/<username>.enc` directly, skipping the directory-traversal step (Flag 2 vector).

**Mitigation:** `spring.mvc.static-path-pattern` is left at the default `/static/**`, which maps to `classpath:/static/` only. `/data/vault/` is outside the classpath and outside every configured resource handler. The `.enc` file is reachable only through the traversal payload on `/api/files/download`, which is itself gated by the JWT filter. Verify that `curl http://localhost:3003/data/vault/abcd12.enc` returns HTTP 404, not 200.

### V5 -- JWT `alg: none` Bypass

**Risk:** Flag 3 requires `JwtService.verifyToken` to honour the `alg` header for HS256 forgeries. A more liberal implementation might also honour `alg: none`, which would let a player mint unsigned tokens and skip the public-key traversal step.

**Mitigation:** `JwtService.verifyToken` has an explicit `if ("none".equalsIgnoreCase(alg)) { throw new JwtException("unsigned tokens rejected"); }` branch before the HS256 / RS256 dispatch. Verify with a forged token whose `alg` is `none`: the filter must return 401, not 200.

### V6 -- Private Key Read via Directory Traversal

**Risk:** Flag 2's traversal vector reads arbitrary filesystem paths. If the JWT private key lived at `/app/keys/private.pem`, the player could read it directly, forge RS256 tokens legitimately, and skip the algorithm-confusion technique that Flag 3 is designed to teach.

**Mitigation:** The Dockerfile copies only `public.pem` into the image. The private key is loaded at boot via `JWT_PRIVATE_KEY` environment variable, injected by `docker-compose.yml` (Q4). The traversal returns 404 for any path that attempts to reach a private key because the file is not present on the filesystem. Verify with `docker exec trialvault-web ls /app/keys/` showing only `public.pem`.

### V7 -- Cross-User Flag 4 Extraction via SQLi

**Risk:** Flag 4's blind SQLi runs against a single shared endpoint. A player could extract another player's per-user flag by naming the other player's `secret_key` in the payload, bypassing attribution.

**Mitigation:** The per-user Flag 4 row is keyed `flag4_<username>`. Any extraction attempt must reference the target key by name, so the blind SQLi payload for another player's flag names that player's username explicitly and would be detectable in access logs if logs were being inspected. This mirrors the CTF7 per-user file-path attribution pattern. Legitimate attribution is not compromised because `/api/research/search` is itself gated by a valid JWT (not forgeable to another player's identity without also completing Flag 3 first), and the research log records the viewer identity. Verify the log format captures `viewer=<username>` on every search request.

### V8 -- SSRF via Actuator Gateway

**Risk:** Some Spring Boot Actuator configurations expose a `/actuator/gateway/routes` endpoint that, combined with Spring Cloud Gateway filters, can be abused for SSRF to internal services (Redis, Postgres).

**Mitigation:** Spring Cloud Gateway is not on the classpath. `pom.xml` includes only `spring-boot-starter-actuator` plus web/security/data-jpa/thymeleaf/data-redis starters. The Actuator endpoints actually exposed are the ones in `application.properties`: `info`, `env`, `health`, `logfile`, `mappings`, `beans`, `configprops`. None of these provide a request-forwarding surface. Verify with `curl http://localhost:3003/actuator | jq '._links | keys'` and confirm `gateway` is absent.

---

---

## 7. Verification checklist (to be executed end of Phase B and Phase C)

Hand-typed curl recipe for the marker, parameterised on `USER` and `PASS`:

1. `curl http://localhost:3003/actuator/info` -- Flag 1 prompt (unauthenticated) and Flag 1 (after login + cookie).
2. `curl http://localhost:3003/actuator/env | grep dunholm-handoff-a` -- leaks DR_API_KEY_PART1.
3. `curl "http://localhost:3003/api/files/download?name=....//....//app/config/application.properties"` -- Flag 2.
4. `curl "http://localhost:3003/api/files/download?name=....//....//app/keys/public.pem" -o public.pem` -- acquire HMAC material.
5. Python forge HS256 JWT with `{role:"admin"}` using public.pem bytes, call `/api/admin/dashboard` -- Flag 3 + breadcrumbs.
6. Blind SQLi against `/api/research/search` to extract `flag4_<user>` and `encryption_key_part2` -- Flag 4 + AES material.
7. Download `/data/vault/classified-trial-results-<user>.enc` via traversal, factor n, derive AES key from Flag 1 + Flag 4 material, AES-GCM decrypt -- Flag 5.
8. `curl http://localhost:3003/actuator/logfile | grep amir.patel` -- harvests plaintext password.
9. Form-login as `amir.patel` with the harvested password, visit `/incident-report` -- Flag 6.

---

## 8. Revision log

| Date | Phase | Note |
|------|-------|------|
| 2026-04-19 | Plan | Initial workflow written; Q1--Q5 and D1--D9 captured at top. Awaiting Phase A start. |
| 2026-04-19 | Phase A | Skeleton built and verified. Switched base image to `eclipse-temurin:17-jre-jammy` because `17-jre-alpine` has no arm64 manifest. Stack boots cleanly on port 3003, `/actuator/info` returns the unauthenticated Flag 1 prompt, `/actuator/env` surfaces `app.config.dunholm-handoff-a` (placeholder value), `/login` returns 200, `/dashboard` redirects to login, generator produces six flags per player. Awaiting approval before Phase B. |
