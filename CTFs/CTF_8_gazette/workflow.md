# CTF 8 Greystone Gazette -- Workflow Document

This document is the complete design and implementation reference for CTF8. It contains the narrative text, exploit walkthroughs, infrastructure specification, flag system, breadcrumb design, unintended-vulnerability audit, and testing procedures. It is the authoritative spec -- application code should be written against this document.

---

## 1. Challenge Overview

Greystone Gazette: PressRoom Editorial System is a three-flag, intermediate-difficulty jeopardy CTF built around Broken Access Control and Injection. The primary categories are OWASP A01:2021 (Flags 1 and 2) and OWASP A03:2021 (Flag 3).

Players encounter a local newspaper's in-house editorial platform ("PressRoom") running after its sole developer was made redundant. They chain three bugs in sequence:

1. **Flag 1 (IDOR)** -- sequential integer article IDs with no ownership check on `GET /api/articles/:id`. The editor-in-chief's draft (article 3) carries a per-user flag placeholder that is substituted server-side using the viewer's session.
2. **Flag 2 (missing server-side auth)** -- the admin dashboard enforces role only in client-side JavaScript. Calling `/api/admin/dashboard` directly bypasses the guard and returns the flag, the user directory, and breadcrumbs for Flag 3.
3. **Flag 3 (command injection bypass)** -- the admin "Network Diagnostics" endpoint runs `sh -c "ping -c 1 -W 2 <host>"` after filtering `; | & \n \r`. Command substitution `$(...)` is not filtered. The payload `$(cat /app/flags/flag3-<user>.txt)` expands inline, and ping reports the flag in its "Name does not resolve" error.

**Difficulty:** Intermediate
**Vulnerability classes:** Broken Access Control (OWASP A01:2021) x2, Injection (OWASP A03:2021)
**Flag count:** 3 (one per OWASP finding)
**Flag format:** `durham-gzflag{1,2,3}{<16-hex-token>_<username>}`
**Tech stack:** Go 1.21, Gin v1.10, modernc.org/sqlite, gin-contrib/sessions cookie store, html/template, bcrypt
**Port:** 3002 (host) mapped to 3002 (container)

### Learning Objectives

- Recognise sequential integer IDs as an IDOR signal and enumerate foreign resources.
- Distinguish client-side access controls from server-side authorisation by comparing browser behaviour to raw API calls.
- Understand why deny-list input validation is brittle and identify common bypass primitives (`$(...)`, backticks).
- Compose a multi-flag exploit chain where each stage's output contains the breadcrumb for the next.
- Map findings to OWASP A01:2021 and A03:2021.

---

## 2. Narrative Script

See [STORY.md](STORY.md) for the complete narrative design and named cast.

Key constraints that must not change during retheming:

- `pressroom_session` cookie name.
- Route paths: `/login`, `/dashboard`, `/articles/:id`, `/admin`, `/api/articles/:id`, `/api/admin/dashboard`, `/api/admin/health`, `/api/me`.
- The `{{PLAYER_FLAG1}}` placeholder in article 3's body.
- Article 3 must be authored by a non-player (default: sarah.lin, id=1). Player accounts must not own article 3, so IDOR is required to read it.
- Article 9 (Marcus's network-diagnostics note) must name the `/admin` panel and the ping endpoint.
- The `/api/admin/dashboard` response must include `flag`, `maintenance_tools` (with the ping entry), and the full user directory including `marcus.webb`.
- The `/api/admin/health` block list must filter `; | & \n \r` and no more.
- The flag3 file must contain only the flag token (single whitespace-delimited word).

Everything else -- page titles, article content, staff names, colours -- is safe to rewrite.

---

## 3. Exploit Walkthrough

See [SOLUTIONS.md](SOLUTIONS.md) for the full walkthrough. This section is a structural outline.

### Flag 1 (IDOR)

1. Log in as player `abcd12`.
2. Dashboard shows only the player's own articles. HTML source contains the TODO comment breadcrumb.
3. Enumerate `/api/articles/1` through `/api/articles/9`. Article 3 is Sarah's draft, authored by user id 1 (sarah.lin).
4. The response body contains `durham-gzflag1{<token>_abcd12}` because the server substitutes `{{PLAYER_FLAG1}}` using the current session.

### Flag 2 (Missing Server-Side Auth)

1. The article 3 body breadcrumbs `/admin`.
2. Browsing `/admin` as a contributor redirects to `/dashboard?error=admin_required` after a fetch to `/api/me` returns `role=contributor`.
3. The redirect is driven by `static/js/admin.js`, not the server.
4. Calling `GET /api/admin/dashboard` directly (curl or DevTools Network tab) returns 200 with the flag, user directory, and maintenance tools.

### Flag 3 (Command Substitution Bypass)

1. The admin dashboard `maintenance_tools[]` lists the "Network Diagnostics" tool with endpoint `/api/admin/health`, method POST, body `{"host": "example.com"}`.
2. `POST /api/admin/health` with `{"host":"127.0.0.1"}` returns ping output.
3. `{"host":"127.0.0.1;ls"}` returns 400 "forbidden characters detected" -- the block list is visible.
4. `{"host":"$(echo test)"}` returns `ping: test: Name does not resolve` -- bypass confirmed.
5. The admin dashboard's `system.notes` mentions `/app/flags/`. Filenames follow the pattern `flag3-<username>.txt`.
6. `{"host":"$(cat /app/flags/flag3-abcd12.txt)"}` yields `ping: durham-gzflag3{...}: Name does not resolve`.

---

## 4. Infrastructure Diagram

```
+-----------------------+         +-----------------------+
|   Browser / curl      | <-----> |  Gin (port 3002)      |
+-----------------------+         |  - session middleware |
                                  |  - html/template      |
                                  |  - static fs          |
                                  +----------+------------+
                                             |
                        +--------------------+--------------------+
                        |                    |                    |
                 +------v------+      +------v------+      +------v------+
                 | SQLite      |      | FlagStore   |      | PingHost    |
                 | (in-memory) |      | (flags.json)|      | sh -c ping  |
                 +-------------+      +-------------+      +-------------+
                                             |
                                   +---------v---------+
                                   | /app/flags/       |
                                   |   flag3-<u>.txt   |
                                   +-------------------+
```

- SQLite uses the `file::memory:?cache=shared` DSN; schema is created at startup and seeded from `users.json` + `articles.json`.
- The FlagStore reads `flags.json` into memory and copies `flag3-*.txt` files from the data directory into `$FLAGS_DIR` (default `/app/flags`) at startup.
- All container paths are fixed by Dockerfile ENV: `DATA_DIR=/app/src/data`, `FLAGS_DIR=/app/flags`.

---

## 5. Route Specification

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET  | `/`                        | none  | Redirect to `/login` or `/dashboard` |
| GET  | `/login`                   | none  | Login form |
| POST | `/login`                   | none (rate-limited) | Session login, sets cookie, 302 to `/dashboard` |
| POST | `/logout`                  | session | Clears session, 302 to `/login` |
| GET  | `/dashboard`               | session | HTML dashboard page |
| GET  | `/articles/:id`            | session | HTML article page (intended) |
| GET  | `/admin`                   | session | HTML admin shell (JS does the role check) |
| GET  | `/static/*filepath`        | none  | Served from `static/` |
| GET  | `/api/me`                  | session | JSON: username, role, display_name |
| GET  | `/api/articles/:id`        | session | **IDOR** -- no ownership check |
| GET  | `/api/admin/dashboard`     | session | **Missing role check** -- returns flag2 + directory |
| POST | `/api/admin/health`        | session | **Command injection** -- ping with deny-list filter |

Note: the admin API routes live under `/api/admin/*` deliberately without `RequireRole` middleware.

---

## 6. Vulnerability Design Notes

### Flag 1: IDOR

The route handler `ArticleDeps.APIGetArticle` (see `internal/handlers/articles.go`) selects `SELECT * FROM articles WHERE id = ?` and returns the row. There is no `AND author_id = ?` clause and no session-based filter. The article body is passed through `substituteTokens(body, username, flagStore)` which replaces `{{PLAYER_FLAG1}}` with the requesting user's flag1 from `FlagStore.Get(username).Flag1`.

The consequence is that each player who IDORs article 3 receives their OWN flag1, not Sarah's. This is a small but important design decision: it means the flag is tied to the exploit action (reading a foreign article) rather than to the static article contents, which in turn means cross-player flag theft via `/api/articles/3` is not possible (each viewer gets their own flag). The unintended solution in V5 is about `/api/admin/health` reading another player's flag file, not about the articles endpoint.

### Flag 2: Missing Server-Side Auth

`AdminDeps.APIDashboard` applies only `middleware.RequireSession(true)`. The handler looks up the session's username in the FlagStore and embeds `flags.Flag2` in the response, along with the user directory from `users.json` (including `marcus.webb`) and the maintenance tools list. The `static/js/admin.js` file calls `/api/me` and redirects non-admins, but this is visibly a client-side control when the response is inspected.

### Flag 3: Command Substitution Bypass

`services.PingHost` in `internal/services/health.go` filters the host string against `[]string{";", "|", "&", "\n", "\r"}` and otherwise passes it to `sh -c "ping -c 1 -W 2 <host>"`. The intended bypass is `$(cat /app/flags/flag3-<user>.txt)`. The flag file contains only the flag token, so after word-splitting it becomes ping's single host argument. Ping fails to resolve the token as a hostname and prints `ping: <token>: Name does not resolve`, which the handler captures via `cmd.CombinedOutput()` and returns in the JSON response.

Backticks (`` `cat ...` ``) are also unblocked and work identically. IFS-based bypasses (`${IFS}`) also work.

---

## 7. Breadcrumb Design

Breadcrumbs cascade so that each flag's output contains the hint for the next.

### To Flag 1

- Dashboard HTML comment: `<!-- TODO: enforce per-user article filtering in API -->`
- Dashboard copy: "Showing articles 7 to 10 (yours)" -- implies lower IDs exist and aren't yours.
- `/api/me` returns a user id but no article filter, reinforcing that the API is ID-keyed.

### Flag 1 -> Flag 2

- Article 3 body explicitly says: *"I have asked Marcus's replacement to lock down the admin panel at /admin, but I suspect the API endpoints are still wide open."*
- Browsing `/admin` visibly redirects via client-side JS (observable in DevTools Network tab).

### Flag 2 -> Flag 3

- `/api/admin/dashboard` response includes `maintenance_tools[0]`:
  ```json
  {
    "name": "Network Diagnostics",
    "endpoint": "/api/admin/health",
    "method": "POST",
    "body": "{\"host\": \"example.com\"}",
    "note": "Quick ping utility for checking if upstream services are reachable. Added a filter after the incident in March. -- M.W.",
    "added_by": "marcus.webb"
  }
  ```
  The "added a filter after the incident in March" line signals that a filter exists but implies it's incomplete. Attributing the tool to Marcus ties it to the redundancy subplot.
- `system.notes` references `/app/flags/` path conventions.
- Article 9 (Marcus's note) reinforces the ping endpoint in an in-story voice.

---

## 8. Unintended Vulnerability Audit

This section enumerates candidates for unintended vulnerabilities and how each is mitigated. The goal is that the three intended paths are the only viable paths to the three flags.

### V1: SQL Injection on Login or Article Lookup

**Risk:** If the login query or article query concatenates user input into SQL, the player can bypass authentication or dump the articles table.
**Mitigation:** All database access uses parameterised queries via `database/sql` (`db.QueryRow("... WHERE id = ?", id)`). User-controlled values are never interpolated into SQL. Login uses bcrypt comparison after looking up the user row by username parameter.

### V2: Path Traversal on Static Files or Template Rendering

**Risk:** A misconfigured static file server could expose `src/data/users.json`, `src/data/flags.json`, or `src/data/flag-files/*` directly over HTTP, shortcutting every flag.
**Mitigation:** Gin's `Static` handler serves only the `static/` directory. The `src/data/` directory is not mapped to any URL prefix. The `flag-files/` directory is only accessible via the ping command-injection path (as intended for Flag 3). Verified by checking `GET /src/data/users.json` returns 404.

### V3: Brute-Force Login

**Risk:** Without rate limiting, an attacker could brute-force the random hex passwords (10-12 chars from hex alphabet -- guessable with enough attempts).
**Mitigation:** `middleware.NewLoginRateLimiter` limits login attempts to 5 per 2-minute sliding window per IP. After exceeding the limit, subsequent requests return 429 until the window expires.

### V4: Session Fixation

**Risk:** If the session ID is assigned before login and not rotated on successful authentication, an attacker could plant a cookie and wait for the victim to sign in.
**Mitigation:** The login handler calls `sess.Clear()` followed by `sess.Save()` before writing new session keys, which issues a fresh cookie value. Additionally, the session store is cookie-based with the session data itself held entirely in the signed cookie, so there is no server-side session ID to fixate -- the concept largely does not apply.

### V5: Cross-User Flag 3 Read via Path Manipulation

**Risk:** The Flag 3 exploit takes an arbitrary file path inside the container. A player could read another player's flag file by swapping the username in the payload: `$(cat /app/flags/flag3-efgh34.txt)`.
**Discussion:**
  - Each player must still craft the command-substitution bypass to succeed; the learning objective (understanding why deny-lists fail) is preserved.
  - Full mitigation would require binding the flag file path to the session, which moves the exploit primitive into a different shape and obscures the intended learning.
  - In a classroom / controlled lab, each player is assigned a single username and typically does not know others' usernames.
**Status:** Accepted risk. Documented in SOLUTIONS.md as an expected unintended-solution path; markers should verify the returned flag matches the submitting player's username.

### V6: Information Disclosure via `users.json` Read

**Risk:** The Flag 3 payload's `$(cat ...)` primitive permits reading any readable file in the container, including `/app/src/data/users.json` (bcrypt hashes) and `/app/src/data/flags.json` (all players' flags in plaintext).
**Mitigation:**
  - Passwords are stored as bcrypt hashes with a cost factor of 10; recovery is computationally infeasible for random hex passwords.
  - `flags.json` being readable is a design compromise: it shortcuts flag 1 and flag 2 for anyone who gets the command-injection RCE first. However, the intended order is Flag 1 -> Flag 2 -> Flag 3, so a player reaching Flag 3 has already solved Flag 1 and Flag 2 via the intended paths.
**Status:** Accepted risk. The intended flag ordering naturally prevents this from being a shortcut.

### V7: Reflected XSS in Article Body

**Risk:** If article bodies are rendered without escaping, the `{{PLAYER_FLAG1}}` substitution or a crafted article could inject script tags into the dashboard.
**Mitigation:** `html/template` is the response renderer, and all content is rendered through context-aware `{{ .Article.Body }}` expressions which HTML-escape automatically. The `paragraphs` template FuncMap helper returns a `[]string` of plain strings (not `template.HTML`), so the output is also escaped. Article bodies contain only newsroom prose with no HTML markup; the `{{PLAYER_FLAG1}}` substitution happens at the string level before the template renders, so the flag itself is also escaped (flag characters `{`, `}`, alphanumerics, underscore -- no escape-relevant characters).

### V8: Open Redirect on Login / Logout

**Risk:** A `?next=<url>` parameter on the login form that accepts arbitrary URLs is a common open-redirect footgun that can feed phishing chains and occasionally session-handling bugs.
**Mitigation:** The login handler redirects to a hard-coded `/dashboard` on success and the logout handler redirects to `/login`. No `next` / `returnTo` parameter is honoured.

### V9: Direct `/flag` Route

**Risk:** Players sometimes assume `/flag` is the flag endpoint (as in CTF1) and attempt to brute-force it.
**Mitigation:** There is no `/flag` route. A request returns Gin's default 404 via `router.NoRoute`, which renders the `error.html` template with no flag content.

### V10: Rate Limiter Exhaustion / Memory DoS

**Risk:** The login rate limiter keeps a per-IP sliding window in memory. An attacker could spam unique IPs via forged headers to grow the map unbounded.
**Mitigation:** The limiter uses the peer IP from `c.ClientIP()` (not `X-Forwarded-For`) and prunes entries older than the window at the start of each check. In a Docker-exposed port deployment, `ClientIP()` returns the actual connecting address. This is sufficient for a CTF context.

---

## 9. Flag System

### Generation

Flags are generated deterministically using HMAC-SHA256 with per-flag sub-salts.

**Generator:** `CTFs/challenge-generation/generators/ctf8_generator.js`

```js
function tokenFor(username, baseSalt, subSalt, tokenLength) {
  const key = `${baseSalt}-${subSalt}`;
  return crypto.createHmac('sha256', key).update(String(username)).digest('hex').slice(0, tokenLength);
}
module.exports = function ctf8Generator(username, options = {}) {
  const salt = options.salt || 'ctf8-gz-default-salt';
  const len  = options.tokenLength || 16;
  return {
    flag1: tokenFor(username, salt, 'flag1', len),
    flag2: tokenFor(username, salt, 'flag2', len),
    flag3: tokenFor(username, salt, 'flag3', len),
  };
};
```

The three sub-salts (`flag1`, `flag2`, `flag3`) produce distinct tokens for the same username.

**CLI:** `CTFs/challenge-generation/chgen_ctf8.js` accepts explicit usernames or `--count N` for random 4-letter-2-digit usernames.

### Output Files

- `CTFs/CTF_8_gazette/src/data/flags.json` -- `{ <username>: { flag1, flag2, flag3 } }`
- `CTFs/CTF_8_gazette/src/data/users.json` -- merged staff (`STAFF_ACCOUNTS`) + player entries; player passwords are random hex, staff are `SYSTEM_INTERNAL`
- `CTFs/CTF_8_gazette/src/data/flag-files/flag3-<username>.txt` -- single line containing just the flag token
- `CTFs/CTF_8_gazette/src/data/flag-files/memo.txt` -- shared narrative memo (not part of exploit)

### Runtime Loading

At container startup:
1. `database.Seed` reads `users.json` and `articles.json`, bcrypts passwords, and inserts into SQLite.
2. `services.NewFlagStore` reads `flags.json` into memory and copies `flag3-*.txt` (only; memo.txt is filtered) into `$FLAGS_DIR`.
3. Handlers look up flags via `FlagStore.Get(username)` on demand.

---

## 10. Challenge Generation Integration

`chgen_ctf8.js` follows the house pattern established by chgen_ctf7.js:

- Accepts either explicit usernames (`abcd12 efgh34 ijkl56`) or `--count N`.
- Validates usernames against `/^[a-z]{4}[0-9]{2}$/`.
- Merges freshly-generated player accounts into `users.json` without disturbing the hand-authored staff entries (sarah.lin, tom.ashworth, priya.kapoor, marcus.webb).
- Writes flag files with single-token bodies so command substitution expands cleanly into ping's hostname slot.
- Prints every flag and every player password to stdout for instructor verification.

The generator does not touch `articles.json` -- articles are hand-authored and stable across runs. Flag 1 substitution happens at request time using the `{{PLAYER_FLAG1}}` placeholder.

---

## 11. Implementation Details

### Module layout

- `cmd/server/main.go` -- Gin engine, middleware wiring, template glob, route registration, listener.
- `internal/database/*` -- schema DDL, connection management, seed logic.
- `internal/handlers/*` -- request handlers grouped by resource (auth, articles, admin).
- `internal/middleware/*` -- `RequireSession`, `RequireRole` (defined but only applied where intended), login rate limiter.
- `internal/services/*` -- FlagStore (flagsync.go), PingHost (health.go).
- `templates/*.html` -- layout + pages using `{{define "header"}}` / `{{define "footer"}}` pattern.
- `static/*` -- CSS and JS served via Gin's Static handler.

### Template inheritance pattern

`layout.html` defines two named blocks (`header`, `footer`). Each page template (e.g. `dashboard.html`) calls `{{template "header" .}}` at the top and `{{template "footer" .}}` at the bottom. Pages do not themselves use `{{define}}`, which avoids `html/template`'s "duplicate define" errors under `ParseGlob`.

### FuncMap

Two helpers are registered before template parsing:
- `paragraphs string -> []string` -- splits a body on newlines and returns non-empty lines for `<p>` rendering.
- `truncate string, n int -> string` -- truncates with trailing ellipsis for the dashboard card previews.

---

## 12. Docker Configuration

### Dockerfile

Multi-stage build:

1. `golang:1.21-alpine` builder: `go mod tidy` (generates `go.sum`), `go build` with `CGO_ENABLED=0 GOOS=linux -ldflags="-s -w"`.
2. `alpine:3.19` runtime: installs `iputils` (for ping), `ca-certificates`, and `tini` (as PID 1 to handle signals). Copies the built binary plus `templates/`, `static/`, `src/data/`. Creates `/app/flags` for runtime flag-file sync.

Environment variables:
- `PORT=3002`, `DATA_DIR=/app/src/data`, `TEMPLATES_DIR=/app/templates`, `STATIC_DIR=/app/static`, `FLAGS_DIR=/app/flags`, `GIN_MODE=release`.

### docker-compose.yml

Single service (`pressroom`) on port 3002. Mounts `flags.json`, `users.json`, `articles.json`, and `flag-files/` read-only so that regenerating flags on the host and running `docker compose restart` picks up changes without a full rebuild.

---

## 13. Test Specification

`test/integration_test.go` exercises the full Gin stack in-process without Docker, using `httptest` and an in-memory SQLite DB. Tests:

1. `TestUnauthenticatedArticleReturns401` -- negative auth control.
2. `TestAuthenticatedOwnArticleReturns200` -- session plumbing works.
3. `TestIDORForeignArticleReturns200` -- **Flag 1 vulnerability**: asserts the response body contains `durham-gzflag1{` and `_abcd12}`.
4. `TestAdminDashboardNoServerSideAuth` -- **Flag 2 vulnerability**: asserts `durham-gzflag2{` and `"marcus.webb"` in the JSON response.
5. `TestHealthLocalhostPingOrBlocked` -- `/api/admin/health` returns a structured response for `127.0.0.1`.
6. `TestHealthBlocklistRejectsSemicolon` -- `{"host":"127.0.0.1;ls"}` returns 400 with "forbidden characters".
7. `TestHealthCommandSubstitutionBypass` -- `{"host":"$(echo pressroom_bypass_marker)"}` places the marker into ping output.
8. `TestHealthFlag3Exfiltration` -- `{"host":"$(cat .../flag3-abcd12.txt)"}` returns `durham-gzflag3{` in ping output.

Tests assume the seeded password for `abcd12` is `e196163226`. When regenerating credentials via `chgen_ctf8.js`, update the test helper or re-seed with a deterministic seed.

Tests run via `go test ./test/...` inside the builder stage or on a host with Go 1.21. No ICMP capability is required -- ping may fail to send packets in CI, but tests only assert that the output field exists and/or contains specific tokens, both of which survive "network unreachable" style errors.

---

## 14. Deliverables Checklist

- [x] Go module + backend (`cmd/`, `internal/`)
- [x] Templates + static assets
- [x] `src/data/users.json`, `articles.json` (hand-authored staff + seeded players)
- [x] Flag generator + CLI
- [x] Dockerfile + docker-compose.yml
- [x] Integration tests (`test/integration_test.go`)
- [x] README.md
- [x] SOLUTIONS.md (this file is instructor-only)
- [x] STORY.md
- [x] workflow.md (this document)
- [x] ctf-config.json
- [x] Verified end-to-end exploit chain in Docker
- [x] Root CHANGELOG.md updated

---

## 15. Order of Work

1. Scaffold directory structure and `go.mod`.
2. Build flag generator (`ctf8_generator.js`, `chgen_ctf8.js`) so downstream seed data has real flags.
3. Hand-author `users.json` (staff accounts) and `articles.json` (including article 3 with `{{PLAYER_FLAG1}}` and article 9 with the ping breadcrumb).
4. Implement Go backend: database + seed, middleware, handlers, services (FlagStore, PingHost), main wiring.
5. Write templates and static assets (CSS + admin.js).
6. Write Dockerfile + docker-compose.yml; rely on in-container `go mod tidy` to generate go.sum.
7. Write integration tests.
8. Verify full three-flag exploit chain end-to-end inside Docker (curl-driven).
9. Write player-facing README, instructor SOLUTIONS, narrative STORY, design workflow, config, and CHANGELOG entry.

---

## 16. Questions Resolved Before Starting

- **SQLite driver choice:** `modernc.org/sqlite` (pure Go) over `mattn/go-sqlite3` (CGO). Easier Docker builds, no cross-compile concerns.
- **Article length:** 100-150 words each; short enough to keep the dashboard readable, long enough to carry narrative and breadcrumbs.
- **Theme colour:** Durham purple `#68246d` with cream backgrounds. No emojis, no em dashes in UI copy (project-wide convention).
- **Flag file format:** Single-token file so `$(cat ...)` expansion yields exactly one whitespace-delimited argument for ping. Narrative flavour lives in a sibling `memo.txt` that flagsync ignores.
- **Cross-user flag 3 read:** Accepted as documented risk (V5).
