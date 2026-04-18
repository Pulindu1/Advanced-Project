# CTF 8 -- Greystone Gazette: PressRoom Editorial System

A Durham-based local newspaper's in-house editorial system, still running after the sole developer was made redundant.

**Stack:** Go 1.21 + Gin + SQLite (modernc.org/sqlite) + html/template, cookie sessions via gin-contrib/sessions.

---

## Quick Start (Docker -- recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/). No Go toolchain needed on the host.

**Step 1: Generate player credentials and flags**

```bash
cd CTFs/challenge-generation
node chgen_ctf8.js abcd12 efgh34 ijkl56
```

This writes `flags.json`, `users.json`, and per-user `flag-files/flag3-<username>.txt` into `CTFs/CTF_8_gazette/src/data/`. Player passwords (random each run) are printed to the terminal.

**Step 2: Start the challenge**

```bash
cd CTFs/CTF_8_gazette
docker compose up --build
```

- Application: http://localhost:3002
- The multi-stage build runs `go mod tidy` and `go build` inside the golang:1.21-alpine builder, then copies the binary into an alpine:3.19 runtime image with `iputils` for ping.
- Flag files mount read-only; a startup sync step copies them into `/app/flags/` for the command-injection path.

To stop: `docker compose down`
To reset: `docker compose down && docker compose up --build`

---

## Login Credentials (Seeded)

| Username | Password | Role |
|----------|----------|------|
| abcd12 | *(see src/data/users.json)* | contributor |
| efgh34 | *(see src/data/users.json)* | contributor |
| ijkl56 | *(see src/data/users.json)* | contributor |

Staff accounts (`sarah.lin`, `tom.ashworth`, `priya.kapoor`, `marcus.webb`) are seeded for article attribution and dashboard realism. Their passwords are set to `SYSTEM_INTERNAL` and will never authenticate.

---

## CTF Flags

**3 flags per user.** Flag formats:

| Flag | Format | Technique | OWASP |
|------|--------|-----------|-------|
| 1 | `durham-gzflag1{...}` | IDOR on `GET /api/articles/:id` | A01:2021 |
| 2 | `durham-gzflag2{...}` | Missing server-side auth on `/api/admin/dashboard` | A01:2021 |
| 3 | `durham-gzflag3{...}` | OS command injection via `$(...)` substitution on `/api/admin/health` | A03:2021 |

See [SOLUTIONS.md](SOLUTIONS.md) for the complete walkthrough (instructors/markers only).

---

## Challenge Overview

- **Difficulty:** Intermediate
- **OWASP Mapping:** A01:2021 (Broken Access Control) x2, A03:2021 (Injection)

Players step into an editorial newsroom audit. The developer who built PressRoom (Marcus Webb) has been let go, and the remaining staff are rushing to patch a system no one fully understands. Flag 1 comes from reading another journalist's draft via sequential article IDs. Flag 2 comes from hitting the admin dashboard API directly -- the client-side JavaScript redirects non-admins, but the server trusts any session. Flag 3 comes from abusing the admin "Network Diagnostics" ping tool: its blocklist rejects `; | & \n \r` but leaves command substitution `$(...)` untouched.

### Learning Outcomes

- Recognise sequential integer IDs as an IDOR signal and enumerate resources across user boundaries.
- Distinguish client-side role checks from server-side authorisation by comparing browser behaviour to raw API calls.
- Understand why blocklists are a weak defence against command injection, and identify bypass primitives (`$(...)`, backticks).
- Compose a multi-flag exploit chain where each breadcrumb leads to the next.
- Map findings to OWASP A01:2021 and A03:2021.

---

## Vulnerabilities

- `GET /api/articles/:id` has no ownership check; any authenticated user reads any article including drafts.
- `GET /api/admin/dashboard` is protected only by a client-side `role !== 'admin'` redirect in `static/js/admin.js`. The server grants the response to any session.
- `POST /api/admin/health` accepts a `host` field and builds `sh -c "ping -c 1 -W 2 <host>"` after filtering the literal characters `;`, `|`, `&`, `\n`, `\r`. Command substitution `$(cmd)` and backticks are not filtered.
- Article 3 (Sarah Lin's "DRAFT: The tips that won't stop coming") contains a `{{PLAYER_FLAG1}}` placeholder that is substituted with the reader's personal flag1 at response time, so IDOR delivers each player their own flag.

---

## Flag Format

```
durham-gzflag1{<16-hex-token>_<username>}
durham-gzflag2{<16-hex-token>_<username>}
durham-gzflag3{<16-hex-token>_<username>}
```

Flags are deterministic: the same username always produces the same three flags (HMAC-SHA256 with per-flag sub-salts).

---

## How to Regenerate Flags

```bash
cd CTFs/challenge-generation
node chgen_ctf8.js abcd12 efgh34 ijkl56
```

Or generate for N random users:

```bash
node chgen_ctf8.js --count 10
```

After regenerating, rebuild the Docker container:

```bash
cd CTFs/CTF_8_gazette
docker compose down && docker compose up --build
```

---

## Directory Layout

```
CTFs/CTF_8_gazette/
|-- README.md
|-- SOLUTIONS.md
|-- STORY.md
|-- workflow.md
|-- ctf-config.json
|-- go.mod
|-- Dockerfile
|-- docker-compose.yml
|-- cmd/
|   |-- server/           # main.go -- Gin wiring, sessions, routes
|-- internal/
|   |-- database/         # SQLite open + seed
|   |-- handlers/         # auth, articles, admin
|   |-- middleware/       # RequireSession, login rate limiter
|   |-- services/         # flagsync, health (ping)
|-- templates/            # html/template pages
|-- static/
|   |-- css/style.css     # Durham purple newspaper theme
|   |-- js/admin.js       # client-side admin guard (bypassable)
|-- src/data/
|   |-- users.json
|   |-- flags.json
|   |-- articles.json
|   |-- flag-files/       # flag3-<user>.txt + memo.txt
|-- test/
|   |-- integration_test.go
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | Go 1.21 |
| Framework | Gin v1.10 |
| Sessions | gin-contrib/sessions (cookie store) |
| Database | modernc.org/sqlite (pure Go, CGO_ENABLED=0) |
| Templates | html/template (Go stdlib) |
| Password hashing | golang.org/x/crypto/bcrypt |
| Container | Docker (single service, multi-stage build) |
| Port | 3002 |

---

## References

- [OWASP A01:2021](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- [OWASP A03:2021](https://owasp.org/Top10/A03_2021-Injection/)
- [CWE-639: Authorization Bypass Through User-Controlled Key (IDOR)](https://cwe.mitre.org/data/definitions/639.html)
- [CWE-78: OS Command Injection](https://cwe.mitre.org/data/definitions/78.html)
