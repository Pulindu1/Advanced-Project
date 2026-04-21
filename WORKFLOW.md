# Unit / Contract Test Rollout --- Workflow

## 0. Purpose and scope

Track 1 of `To-Do.md` requires first-party unit tests for CTF2, CTF3,
CTF4, and CTF6 (the four challenges that currently rely on the
end-to-end exploit harness alone, per the VVT matrix in
`report/sections/methodology.tex`, Table `tab:vvt-matrix`). This
document plans the full rollout in three tracks:

1. **New suites** for CTF2, CTF3, CTF4, CTF6.
2. **Audit plus additions** for the existing suites in CTF1, CTF5,
   CTF7, CTF8, CTF9 (so they meet the same 6--10 contract-assertion
   bar).
3. **CI wiring**: a new `.github/workflows/tests.yml` that runs every
   suite on push, so the marker sees a single green tick.

This document does **not** touch `methodology.tex` or
`resultsAndEval.tex`; those are deferred to a separate post-track
commit.

---

## 1. Shared principles (apply to every CTF)

1. **Non-exploit contracts only.** The end-to-end scripts under
   `CTFs/e2e/ctf{N}_exploit.py` already certify that the exploit
   path yields a flag. The unit layer must certify that the
   surrounding application behaves like a real product when *not*
   under attack: authentication boundaries, rate limits, error
   handling, request validation, pure helpers. No test should assert
   a flag value, emit an exploit payload as its primary action, or
   duplicate a step already covered by the e2e script.
2. **No Docker at test time.** Each test file imports the production
   code path in-process using the stack's native runner. External
   services (Postgres, Redis) are replaced by in-memory or mocked
   substitutes.
3. **Native runner, native conventions.**
   - CTF2, CTF4, CTF1, CTF7 --- `npm test` via Jest + Supertest.
   - CTF3 --- `php artisan test` via PHPUnit 11.
   - CTF5 --- `pytest` (existing).
   - CTF6 --- `cargo test`.
   - CTF8 --- `go test ./test` (existing).
   - CTF9 --- `mvn test` (existing).
4. **6--10 tests per CTF.** Each test = one HTTP assertion or one
   pure-function check.
5. **Zero test bleed-over.** Fixtures use tempdirs / in-memory DBs /
   mocked Redis. `git status` after `<runner> test` must be clean.
6. **No e2e replay in unit tests.** Contract ≠ exploit.
7. **Atomicity.** Every step below is a single, verifiable action
   with a pass/fail criterion. Do one step, verify, only then do
   the next.

---

## 2. Resolved decisions (from OQ-1 through OQ-8)

| OQ | Topic | Decision |
|----|-------|----------|
| 1 | CTF2 `index.js` refactor | **Refactor.** Export `createApp()` and guard `listen()` with `require.main === module`. |
| 2 | CTF3 `DebugController` guard | **Assert current behaviour.** Do *not* add a prod-404 guard. Test records that `/api/debug/user-config` returns 200 with plaintext --- the A05 vulnerability is the point of the challenge. |
| 3 | CTF3 AES helper test | **Skip.** The helper lives in frontend TS, not PHP. Cap CTF3 at 6--7 backend tests. |
| 4 | CTF2 PBKDF2 helper test | **Skip.** Frontend-only; cap CTF2 at 8 backend tests. |
| 5 | CTF4 bot worker tests | **Skip.** `apps/bot/` Playwright path is out of scope. Cap CTF4 at 8 API-only tests. |
| 6 | CTF6 `Database` param | **Parameterise for `:memory:`.** One-line change to `Database::new()` that accepts a connection string; default stays a file path so the Docker runtime is unaffected. |
| 7 | Audit depth | **Audit + additions.** CTF1 / CTF5 / CTF7 / CTF8 / CTF9 audited; any contract gap becomes a small additions commit. |
| 8 | CI wiring | **Add `.github/workflows/tests.yml`** running each suite on push. |

---

## 3. Overall sequencing

Tracks run strictly in order. Each phase is self-contained; the
only cross-phase dependency is that Phase X validation must pass
before Phase X+1 starts.

```
Track 1  ──>  CTF2 (new)
         ──>  CTF4 (new)
         ──>  CTF3 (new)
         ──>  CTF6 (new)
Track 2  ──>  CTF1 audit + additions
         ──>  CTF5 audit + additions
         ──>  CTF7 audit + additions
         ──>  CTF8 audit + additions
         ──>  CTF9 audit + additions
Track 3  ──>  .github/workflows/tests.yml
Final    ──>  run every suite from a clean tree; git status clean
```

The Node CTFs come first (CTF2, CTF4) because they share a runner
the repo already uses for CTF1 and CTF7, so any gotcha discovered
in CTF2 is reusable. CTF3 (Laravel) and CTF6 (Rust) are net-new
runner configurations and are higher-risk, so they follow once the
Node pattern is proven.

---

## 4. Track 1, CTF 1: CTF2 (Password Manager)

### 4.A Preconditions (do not skip)

| Step | Action | Verify |
|------|--------|--------|
| 4.A.1 | Read `CTFs/CTF_2_pswd_manager/server/index.js` end-to-end. | Confirm file shape matches the plan: `createApp` is currently inlined, `app.listen()` is the last call. |
| 4.A.2 | Run `cd CTFs/CTF_2_pswd_manager && npm install` to ensure the working tree's `node_modules/` is current. | No errors. |
| 4.A.3 | Add `jest ^30.2.0`, `supertest ^7.1.4` to devDependencies in `package.json`. Add `"test": "jest"` to `scripts`. | `package.json` diff is the only change. |
| 4.A.4 | Run `npm install` again. | `node_modules/jest/` and `node_modules/supertest/` exist. |

### 4.B Refactor `server/index.js`

| Step | Action | Verify |
|------|--------|--------|
| 4.B.1 | Wrap the body of `server/index.js` (from `const app = express()` through the last route definition) inside `function createApp() { ... return app }`. Move the `DATA_DIR`, `USERS_FILE`, `VAULTS_FILE`, `LOGIN_ATTEMPTS_FILE`, `DELETED_FLAGS_FILE` constants inside `createApp()` and add an env override `DATA_DIR` (default `path.resolve(__dirname, 'data')`). | File still parses as valid JavaScript. |
| 4.B.2 | Replace the tail `seedFromFiles().then(() => { app.listen(...) })` with `if (require.main === module) { const app = createApp(); seedFromFiles().then(() => app.listen(PORT, ...)) }`. Add `module.exports = { createApp, seedFromFiles }`. | File tail matches the new pattern. |
| 4.B.3 | Run `node -e "require('./server/index.js')"` from `CTFs/CTF_2_pswd_manager/`. The process should exit immediately without binding a port. | Exit code 0; no server listening on 4000. |
| 4.B.4 | Run the CTF2 e2e script **locally** with `docker compose up --build -d` then `cd ../e2e && python3 -m pytest ctf2_exploit.py -v`. Bring the stack down when done: `docker compose down`. | e2e passes. This gates the refactor. |

### 4.C First smoke test (the canary)

| Step | Action | Verify |
|------|--------|--------|
| 4.C.1 | Create `CTFs/CTF_2_pswd_manager/server/__tests__/app.test.js` with one test: `GET /api/auth/whoami` without a cookie returns 401. | File created. |
| 4.C.2 | Inside the test file, `beforeAll` creates a tempdir with `users.json` (empty array), `vaults.json` (`{}`), `flags.json` (`{}`), `credentials.json` (`{}`). Sets `process.env.DATA_DIR`, `FLAGS_PATH`, `CREDS_PATH`, `JWT_SECRET`. Then `require('../index').createApp()`. | — |
| 4.C.3 | Run `npm test`. | 1 passed, 0 failed. |
| 4.C.4 | Run `git status`. | No files modified under `server/data/`. |

### 4.D Remaining tests

Add the remaining 7 in a single file. Names are sentences, no
interior logic beyond one HTTP call + one `expect`:

| # | Title | Route |
|---|-------|-------|
| T1 | `whoami without cookie returns 401` (from 4.C) | `GET /api/auth/whoami` |
| T2 | `login with wrong password returns 401` | `POST /api/auth/login` |
| T3 | `login with correct password returns 200 and sets a session cookie` | `POST /api/auth/login` |
| T4 | `vault without cookie returns 401` | `GET /api/vault` |
| T5 | `vault with a tampered cookie returns 401` | `GET /api/vault` |
| T6 | `challenge endpoint returns a nonce and difficulty 4` | `GET /api/challenge` |
| T7 | `challenge solve with a non-matching hash returns 400 and does not mark the challenge solved` | `POST /api/challenge/solve` |
| T8 | `after 4 failed logins for the same username, the 5th attempt returns 429 with lockedUntil in the future` | `POST /api/auth/login` |

**Fixture helpers** (same file):

```js
async function registerUser(app, username, password)  // POST /api/auth/register
async function login(app, username, password)         // returns { cookie }
function authedAgent(app, cookie)                     // returns supertest agent with cookie set
```

### 4.E Validation for CTF2

| Step | Action | Pass criterion |
|------|--------|---------------|
| 4.E.1 | `cd CTFs/CTF_2_pswd_manager && npm test` | 8 passed in under 5 s. |
| 4.E.2 | `git status` | Clean under `server/data/`. |
| 4.E.3 | `cd CTFs/CTF_2_pswd_manager && docker compose up --build -d && sleep 5 && curl -f http://localhost:4000/api/challenge && docker compose down` | `curl` returns 200 JSON. |
| 4.E.4 | `cd CTFs/e2e && python3 -m pytest ctf2_exploit.py -v` (against fresh `docker compose up`) | e2e still green. |

---

## 5. Track 1, CTF 2: CTF4 (Corporate Helpdesk)

### 5.A Preconditions

| Step | Action | Verify |
|------|--------|--------|
| 5.A.1 | Read `apps/api/src/index.ts`, `routes/admin.ts`, `routes/auth.ts`, `routes/kb.ts`, `routes/report.ts`, `routes/exfil.ts`, `middleware/auth.ts`, `db/index.ts` (or wherever `query` is defined). | Know which functions need mocking. |
| 5.A.2 | `cd CTFs/CTF_4_corporate_helpdesk/apps/api && npm install` | Deps install. |
| 5.A.3 | Add to `apps/api/package.json` devDependencies: `jest ^30.2.0`, `@types/jest`, `ts-jest ^29`, `supertest ^7.1.4`, `@types/supertest`, `pg-mem ^3`, `ioredis-mock ^8`. Add `"test": "jest"` to scripts. | `package.json` diff only. |
| 5.A.4 | `npm install` | `node_modules/pg-mem`, `node_modules/ioredis-mock` exist. |
| 5.A.5 | Create `apps/api/jest.config.js` with `preset: 'ts-jest'`, `testEnvironment: 'node'`. | File valid. |

### 5.B Refactor `index.ts`

| Step | Action | Verify |
|------|--------|--------|
| 5.B.1 | Guard the last line `start();` with `if (require.main === module) { start(); }`. `export default app;` stays. | `node -r ts-node/register -e "require('./src/index.ts')"` exits without binding. |

### 5.C Mock wiring

| Step | Action | Verify |
|------|--------|--------|
| 5.C.1 | Create `apps/api/src/__tests__/setup.ts`. Inside, use `pg-mem`'s `newDb().adapters.createPgPromise()` or `createPg()` to replace the `pg` `Pool` used by `src/db/`. Seed schema using the same DDL as `infra/init.sql` (read it, feed it to `db.public.none`). Seed one admin, one normal user, one report. | — |
| 5.C.2 | Inside the same setup, `jest.mock('ioredis', () => require('ioredis-mock'))`. The BullMQ queue will then use the mocked Redis transparently. | — |
| 5.C.3 | Add a smoke test: `GET /health` returns 200 with `{status: "ok"}`. Run `npm test`. | 1 passed. |

### 5.D Test list (target 8)

| # | Title | Route |
|---|-------|-------|
| T1 | `health endpoint returns 200` | `GET /health` |
| T2 | `admin flag without auth returns 401` | `GET /api/admin/flag` |
| T3 | `admin flag with non-admin user returns 403 with the discovery-hint JSON` | `GET /api/admin/flag` |
| T4 | `report without auth returns 401` | `POST /api/report` |
| T5 | `report with auth inserts a row in reports and returns 200` | `POST /api/report` |
| T6 | `exfil capture with a data field inserts a row and returns 200` | `POST /api/exfil/capture` |
| T7 | `exfil capture without a data field returns 400` | `POST /api/exfil/capture` |
| T8 | `kb articles without auth returns 401` | `GET /api/kb/articles` |

### 5.E Validation for CTF4

| Step | Action | Pass criterion |
|------|--------|---------------|
| 5.E.1 | `cd CTFs/CTF_4_corporate_helpdesk/apps/api && npm test` | 8 passed in under 10 s. |
| 5.E.2 | `git status` | Clean. |
| 5.E.3 | `cd CTFs/CTF_4_corporate_helpdesk && docker compose up --build -d && sleep 15 && curl -f http://localhost:4001/health && docker compose down` | 200. |
| 5.E.4 | `cd CTFs/e2e && python3 -m pytest ctf4_exploit.py -v` | Still green. |

---

## 6. Track 1, CTF 3: CTF3 (HR System)

### 6.A Preconditions

| Step | Action | Verify |
|------|--------|--------|
| 6.A.1 | Read `backend/routes/api.php`, `AuthController`, `FlagController`, `DebugController`, `JwtMiddleware`, `User` model, `config/jwt.php` (if present) or `config/app.php`. | Route signatures and middleware ordering known. |
| 6.A.2 | `cd CTFs/CTF_3_HR-system/backend && composer install` | Vendor directory installed. |
| 6.A.3 | Confirm `phpunit/phpunit ^11.0` is in `composer.json` require-dev. | Already present. |

### 6.B Scaffolding

| Step | Action | Verify |
|------|--------|--------|
| 6.B.1 | Create `backend/phpunit.xml` with: `<testsuites>` pointing at `tests/Feature` and `tests/Unit`; environment vars `APP_ENV=testing`, `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`, `CACHE_STORE=array`, `SESSION_DRIVER=array`, `QUEUE_CONNECTION=sync`, `JWT_SECRET=test-secret-for-unit-tests`. | File valid XML. |
| 6.B.2 | Create `backend/tests/TestCase.php` extending `Illuminate\Foundation\Testing\TestCase`, with a `createApplication()` that boots the Laravel kernel from `bootstrap/app.php`. | Class loads. |
| 6.B.3 | Create `backend/tests/CreatesApplication.php` trait (standard Laravel pattern). | — |
| 6.B.4 | Verify the `autoload-dev` PSR-4 map in `composer.json` (`"Tests\\": "tests/"`) resolves: `composer dump-autoload`. | No errors. |
| 6.B.5 | Write a canary test `tests/Unit/SanityTest.php` that asserts `true === true`. | `php artisan test` → 1 passed. |

### 6.C Schema for SQLite test DB

| Step | Action | Verify |
|------|--------|--------|
| 6.C.1 | Audit `database/migrations/` for Postgres-specific types (e.g. JSONB, generated columns). | List any offenders. |
| 6.C.2 | If migrations are SQLite-compatible, the `RefreshDatabase` trait is enough. Otherwise, create `tests/Feature/DatabaseSetup.php` that runs a minimal seed of `users`, `credentials`, `audit_logs`. | Migrations run under SQLite. |

### 6.D Test list (target 6)

| # | Title | File | Route / Unit |
|---|-------|------|------|
| T1 | `login with wrong password returns 401` | `tests/Feature/AuthTest.php` | `POST /api/auth/login` |
| T2 | `login with valid credentials returns a signed JWT and user payload` | `Feature/AuthTest.php` | `POST /api/auth/login` |
| T3 | `login returns 429 after 5 failed attempts for the same key` | `Feature/AuthTest.php` | `POST /api/auth/login` |
| T4 | `flag endpoint without auth returns 401` | `Feature/FlagTest.php` | `GET /api/flag` |
| T5 | `flag endpoint with a valid JWT returns the caller's flag (not another user's)` | `Feature/FlagTest.php` | `GET /api/flag` |
| T6 | `debug user-config endpoint returns 200 with plaintext passwords (documents the intentional A05 behaviour)` | `Feature/DebugTest.php` | `GET /api/debug/user-config` |

### 6.E Validation for CTF3

| Step | Action | Pass criterion |
|------|--------|---------------|
| 6.E.1 | `cd CTFs/CTF_3_HR-system/backend && php artisan test` | 6 passed. |
| 6.E.2 | `git status` | Clean. |
| 6.E.3 | `cd CTFs/CTF_3_HR-system && docker compose up --build -d && sleep 20 && curl -f http://localhost:8004/api/health || curl -f http://localhost:8004/ && docker compose down` | Backend responds. |
| 6.E.4 | `cd CTFs/e2e && python3 -m pytest ctf3_exploit.py -v` | Still green. |

---

## 7. Track 1, CTF 4: CTF6 (Veridian)

### 7.A Preconditions

| Step | Action | Verify |
|------|--------|--------|
| 7.A.1 | Read `src/main.rs`, `src/routes.rs`, `src/preview.rs`, `src/db.rs`, `src/models.rs`, `src/narrative.rs`. | Function signatures known. |
| 7.A.2 | `cd CTFs/CTF_6_veridian && cargo check` | Compiles clean. |

### 7.B Refactor `src/db.rs` for `:memory:`

| Step | Action | Verify |
|------|--------|--------|
| 7.B.1 | Change `Database::new()` (or equivalent constructor) to accept a `&str` connection string. Default the production call site (`main.rs`) to pass the same file path it uses today. | `cargo build` succeeds; prod behaviour unchanged. |
| 7.B.2 | `cd CTFs/CTF_6_veridian && docker compose up --build -d && sleep 10 && curl -f http://localhost:5180/health && docker compose down` | Runtime still works. |

### 7.C Inline unit tests in `src/preview.rs`

| Step | Action | Verify |
|------|--------|--------|
| 7.C.1 | Add `#[cfg(test)] mod tests { ... }` at the bottom of `preview.rs`. | File compiles. |
| 7.C.2 | Add test `file_scheme_is_rejected`: `assert!(fetch_url("file:///etc/passwd").await.is_err())`. Use `#[tokio::test]`. | — |
| 7.C.3 | Add test `metadata_ip_is_rewritten_to_hostname`: factor a small `rewrite_host(url: &str) -> String` helper out of `fetch_url`'s first `.replace()` call, test that directly. Keeps the test independent of network I/O. | — |
| 7.C.4 | Add test `dict_url_parser_extracts_host_port_command`: factor a small `parse_dict(url: &str) -> Result<(String, u16, String), String>` out of `fetch_dict`, test on three inputs (`dict://redis:6379/GET x`, `dict://host/CMD`, malformed). | — |
| 7.C.5 | `cargo test --lib` | 3 passed. |

### 7.D Integration tests in `tests/integration.rs`

| Step | Action | Verify |
|------|--------|--------|
| 7.D.1 | Create `CTFs/CTF_6_veridian/tests/integration.rs`. | — |
| 7.D.2 | Add a helper `fn test_app() -> actix_web::test::TestServer` (or use `actix_web::test::init_service`) that builds `AppState` with an in-memory `Database::new(":memory:")`, an empty `FlagsMap`, a Tera pointed at `templates/`. | — |
| 7.D.3 | Test `api_preview_without_session_returns_401`: `POST /api/preview` → 401. | — |
| 7.D.4 | Test `admin_without_token_header_returns_403`: `GET /admin` without `X-Session-Token` → 403. | — |
| 7.D.5 | Test `admin_with_token_but_no_session_returns_200_with_placeholder`: `GET /admin` with correct `X-Session-Token` but no login session returns 200 with body containing `FLAG_NOT_FOUND_NO_SESSION`. | — |
| 7.D.6 | Test `health_returns_service_payload`: `GET /health` returns 200 with `service`, `version`, `ssrf_note` fields present. | — |
| 7.D.7 | Test `login_submit_empty_rerenders_login_with_error`: `POST /login` with empty form → 200 containing error string. | — |
| 7.D.8 | `cargo test` (unit + integration) | 8 passed. |

### 7.E Validation for CTF6

| Step | Action | Pass criterion |
|------|--------|---------------|
| 7.E.1 | `cd CTFs/CTF_6_veridian && cargo test` | 8 passed. |
| 7.E.2 | `git status` | Clean. |
| 7.E.3 | `cd CTFs/CTF_6_veridian && docker compose up --build -d && sleep 10 && curl -f http://localhost:5180/health && docker compose down` | Runtime healthy. |
| 7.E.4 | `cd CTFs/e2e && python3 -m pytest ctf6_exploit.py -v` | Green. |

---

## 8. Track 2: Audits and additions for CTF1, CTF5, CTF7, CTF8, CTF9

Each CTF below starts with an **audit pass**: read each existing test
and classify as (a) non-exploit contract, (b) exploit replay, or (c)
infrastructure/bootstrap. Then add missing contract tests to reach
the 6--10 bar.

### 8.A CTF1 (Basic_1_Nodejs)

**Existing:** 4 tests in `test/app.test.js` — unauth `/flag` 403,
student `/flag` 403, unknown route 404, admin wrong password 401.

**Additions (target 4, reach 8 total):**

| # | Title | Route |
|---|-------|-------|
| A1 | `base64-encoded admin cookie grants access to /flag` | `GET /flag` with `session=<b64>` |
| A2 | `URL-encoded base64 admin cookie also grants access to /flag` (methodology claim, Section `sec:challenge-design`) | `GET /flag` |
| A3 | `malformed cookie is rejected and does not grant access` | `GET /flag` |
| A4 | `after N failed logins from the same IP, the next attempt returns 429` (sliding-window rate limiter, methodology audit) | `POST /login` |

Validation: `cd CTFs/Basic_1_Nodejs && npm test` → 8 passed.

### 8.B CTF5 (internal blog)

**Existing:** 3 files under `tests/` — `test_auth.py`,
`test_preview.py`, `test_waf_bypass.py`. Already broad.

**Audit action:** read each file; if any test asserts a flag value
or executes the SSTI→RCE chain at the unit layer, move that test to
a separate `test_exploit_replay.py` or leave a comment `# exploit
replay, duplicates e2e`. No new tests unless the audit uncovers a
missing non-exploit contract.

**Likely additions (target 0--2):**

| # | Candidate | Rationale |
|---|-----------|-----------|
| A1 | `/CHANGELOG.md is served and names the WAF blocklist words` | The breadcrumb that gates Flag 2 → Flag 3. |
| A2 | `X-Debug-Token header is required for the debug route; the correct token returns 200, the wrong token returns 404` | Flag 1 contract. |

Validation: `cd CTFs/CTF_5_internal_blog && pytest tests/ -v` → all
existing plus new pass.

### 8.C CTF7 (notes app)

**Existing:** 6 tests in `test/app.test.js`. One test ("IIFE exploit
cookie renders flag") is exploit replay.

**Audit action:** relocate the exploit-replay test to a separate
`describe('exploit-replay')` block so the contract count is visible
at a glance. Keep the assertion.

**Additions (target 2):**

| # | Title | Route |
|---|-------|-------|
| A1 | `/debug endpoint is reachable without auth and returns the documented breadcrumb body` | `GET /debug` |
| A2 | `/package.json is served as a static file under the web root (CTF breadcrumb)` | `GET /package.json` |

Validation: `cd CTFs/CTF_7_notes_app && npm test` → 8 passed
(including one labelled exploit replay).

### 8.D CTF8 (Gazette)

**Existing:** `test/integration_test.go` is one large file.

**Audit action:** read top-to-bottom. If contract assertions are ≥6
and exploit chain is clearly separated, leave alone. Otherwise
split into `contract_test.go` (non-exploit) and `exploit_test.go`
(IDOR → broken-auth → command-injection chain).

**Likely additions (target 2, only if audit finds gaps):**

| # | Candidate | Rationale |
|---|-----------|-----------|
| A1 | `anonymous request to /api/articles/:id returns 401` | Confirms session enforcement. |
| A2 | `admin health endpoint blocks the literal ; character in the host field` (the blocklist is documented in `methodology.tex`; tests the defensive half) | Defensive half of the Flag 3 vuln. |

Validation: `cd CTFs/CTF_8_gazette && go test ./test -v` → green.

### 8.E CTF9 (Dunholm TrialVault)

**Existing:** only `src/test/java/com/dunholm/service/JwtServiceTest.java`.

**Additions (target 5--6):** all under
`src/test/java/com/dunholm/`, use `@SpringBootTest(webEnvironment =
RANDOM_PORT)`.

| # | Title | File |
|---|-------|------|
| A1 | `traversal filter strips ../ but permits ....// (documents the Flag 2 bypass primitive)` | `controller/FileControllerTest.java` |
| A2 | `JWT HS256 forged with the public PEM bypasses JWT verification but does not reach the staff-session-gated /incident-report` | `controller/IncidentControllerTest.java` |
| A3 | `/actuator/env redacts DR_API_KEY_PART1 by default but exposes it due to the non-standard property name` | `controller/ActuatorTest.java` |
| A4 | `DunholmInfoContributor emits per-user token only for the authenticated username` | `info/DunholmInfoContributorTest.java` |
| A5 | `blind SQLi on /api/research/search returns count 1 for tautology and count 0 for contradiction (contract, not exploit)` | `controller/ResearchControllerTest.java` |

Validation: `cd CTFs/CTF_9_dunholm && mvn test` → all green.

---

## 9. Track 3: CI workflow

### 9.A New file

Create `.github/workflows/tests.yml` with one job per stack. Each
job runs on `ubuntu-latest` with an appropriate setup action:

| Job | Setup | Commands |
|-----|-------|----------|
| `ctf1-node` | `actions/setup-node@v4` (20.x) | `cd CTFs/Basic_1_Nodejs && npm ci && npm test` |
| `ctf2-node` | `actions/setup-node@v4` | `cd CTFs/CTF_2_pswd_manager && npm ci && npm test` |
| `ctf3-php` | `shivammathur/setup-php@v2` (8.2) | `cd CTFs/CTF_3_HR-system/backend && composer install --no-interaction && php artisan test` |
| `ctf4-node` | `actions/setup-node@v4` | `cd CTFs/CTF_4_corporate_helpdesk/apps/api && npm ci && npm test` |
| `ctf5-python` | `actions/setup-python@v5` (3.11) | `cd CTFs/CTF_5_internal_blog && pip install -r requirements.txt && pytest tests/ -v` |
| `ctf6-rust` | `dtolnay/rust-toolchain@stable` | `cd CTFs/CTF_6_veridian && cargo test` |
| `ctf7-node` | `actions/setup-node@v4` | `cd CTFs/CTF_7_notes_app && npm ci && npm test` |
| `ctf8-go` | `actions/setup-go@v5` (1.21) | `cd CTFs/CTF_8_gazette && go test ./test -v` |
| `ctf9-java` | `actions/setup-java@v4` (temurin 17) | `cd CTFs/CTF_9_dunholm && mvn test -B` |

Triggers: `on: [push, pull_request]`. No secrets, no deployment.

### 9.B Validation

| Step | Action | Pass criterion |
|------|--------|---------------|
| 9.B.1 | `git add .github/workflows/tests.yml && git commit` (message TBD) | File committed. |
| 9.B.2 | Push to a feature branch. | CI picks up. |
| 9.B.3 | Inspect GitHub Actions UI. | All 9 jobs green. |

(This step requires a push, so is explicitly confirmed with the user
before firing.)

---

## 10. Final cross-suite validation

After all tracks are green individually, run a single pass:

| Step | Action |
|------|--------|
| 10.1 | `git status` — clean. |
| 10.2 | For each CTF in CTF1..CTF9, run its native test command. |
| 10.3 | For each CTF, `docker compose up --build` then `docker compose down`. |
| 10.4 | Run every e2e in `CTFs/e2e/run_all.sh`. |
| 10.5 | Summarise: counts of tests per CTF, total time, any flaky runs. |

---

## 11. Fixtures and shared conventions

- **Tempdirs.** Use `fs.mkdtempSync(os.tmpdir() + path.sep + 'ctfN-')`
  in Node; `tempfile.mkdtemp()` in Python; `tempfile::tempdir()` in
  Rust; Laravel SQLite `:memory:` for PHP.
- **Env vars at test time.** Override in the test `beforeAll` /
  fixture, never edit the app's `.env`. Variables used:
  - CTF2: `DATA_DIR`, `FLAGS_PATH`, `CREDS_PATH`, `JWT_SECRET`.
  - CTF3: `APP_ENV=testing`, `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`, `JWT_SECRET`.
  - CTF4: `DATABASE_URL` (noop when pg-mem), `REDIS_URL` (noop when ioredis-mock), `JWT_SECRET`.
  - CTF6: in-memory sqlite; no env vars.
- **Naming.** Test files live next to the source under
  `__tests__/` (Node), `tests/Feature` or `tests/Unit` (Laravel),
  `tests/` at crate root (Rust). Test names are assertions
  (`"login with wrong password returns 401"`), not commands
  (`"it should reject wrong passwords"`).
- **No network calls in tests.** If a test needs HTTP, it hits the
  in-process app. No calls to real Redis, Postgres, or external
  URLs.

---

## 12. Rollback / guard-rails

- Every scaffolding commit (`package.json` changes, `phpunit.xml`,
  `jest.config.js`, `tests.yml`) is its own commit so it can be
  reverted independently.
- Every refactor (`createApp()` in CTF2, `Database::new()` param in
  CTF6, `if (require.main === module)` in CTF4) is its own commit,
  paired with a one-line e2e green-check run in the commit body.
- If a step fails validation, **stop**. Do not proceed to the next
  step.
- If a test is flaky, mark it with an explicit comment `// FLAKY:
  investigate` and skip via `test.skip(...)` or equivalent, rather
  than rewriting the production path to accommodate.

---

## 13. Order of operations — the execution checklist

Execute in this exact order. Each item is one step; stop after each
and verify before proceeding.

```
[ ] 4.A.1  Read CTF2 server/index.js
[ ] 4.A.2  npm install in CTF2
[ ] 4.A.3  Add jest+supertest to package.json
[ ] 4.A.4  npm install with new deps
[ ] 4.B.1  Refactor index.js: wrap in createApp()
[ ] 4.B.2  Guard listen() with require.main === module
[ ] 4.B.3  Verify require('./server/index.js') is non-blocking
[ ] 4.B.4  Verify e2e still passes
[ ] 4.C.1  Create __tests__/app.test.js with one test
[ ] 4.C.2  Wire tempdir fixture
[ ] 4.C.3  npm test → 1 pass
[ ] 4.C.4  git status clean
[ ] 4.D    Add tests T2–T8
[ ] 4.E.1  npm test → 8 passed
[ ] 4.E.2–4  CTF2 validation passes

[ ] 5.A.1  Read CTF4 apps/api/**
[ ] 5.A.2  npm install in apps/api
[ ] 5.A.3  Add devDeps to apps/api/package.json
[ ] 5.A.4  npm install
[ ] 5.A.5  Create jest.config.js
[ ] 5.B.1  Guard start() with require.main check
[ ] 5.C.1  Create setup.ts with pg-mem + schema
[ ] 5.C.2  Mock ioredis in setup
[ ] 5.C.3  Health smoke test → 1 pass
[ ] 5.D    Add tests T2–T8
[ ] 5.E    CTF4 validation

[ ] 6.A    CTF3 read + composer install
[ ] 6.B.1  Create phpunit.xml
[ ] 6.B.2  Create TestCase.php
[ ] 6.B.3  Create CreatesApplication trait
[ ] 6.B.4  composer dump-autoload
[ ] 6.B.5  SanityTest.php → 1 pass
[ ] 6.C    SQLite schema check
[ ] 6.D    Tests T1–T6
[ ] 6.E    CTF3 validation

[ ] 7.A    CTF6 read + cargo check
[ ] 7.B.1  Parameterise Database::new()
[ ] 7.B.2  Verify Docker runtime still works
[ ] 7.C.1–5  preview.rs inline tests → 3 pass
[ ] 7.D.1–8  tests/integration.rs → 5 more passes
[ ] 7.E    CTF6 validation

[ ] 8.A    CTF1 audit + additions
[ ] 8.B    CTF5 audit + additions
[ ] 8.C    CTF7 audit + additions
[ ] 8.D    CTF8 audit + additions
[ ] 8.E    CTF9 audit + additions

[ ] 9.A    Create .github/workflows/tests.yml
[ ] 9.B    CI validation (on push, with confirmation)

[ ] 10     Final cross-suite validation
```

End of plan.
