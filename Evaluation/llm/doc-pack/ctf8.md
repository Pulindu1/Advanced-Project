# CTF 8 -- Greystone Gazette: PressRoom Editorial System

A Durham-based local newspaper's in-house editorial system, still running
after the sole developer was made redundant.

**Stack:** Go 1.21 + Gin + SQLite + html/template, cookie sessions via
gin-contrib/sessions.

---

## Quick Start (Docker)

```bash
cd CTFs/CTF_8_gazette
docker compose up --build
```

- Application: http://localhost:3002

---

## Login Credentials (Seeded)

| Username | Password | Role |
|----------|----------|------|
| abcd12 | *(see src/data/users.json)* | contributor |
| efgh34 | *(see src/data/users.json)* | contributor |
| ijkl56 | *(see src/data/users.json)* | contributor |

Staff accounts (`sarah.lin`, `tom.ashworth`, `priya.kapoor`, `marcus.webb`)
are seeded for article attribution and dashboard realism. Their passwords are
set to `SYSTEM_INTERNAL` and will never authenticate.

---

## Flag format

```
durham-gzflag1{<16-hex-token>_<username>}
durham-gzflag2{<16-hex-token>_<username>}
durham-gzflag3{<16-hex-token>_<username>}
```

Three flags per user. Flags are deterministic (HMAC-SHA256 with per-flag
sub-salts).

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | Go 1.21 |
| Framework | Gin v1.10 |
| Sessions | gin-contrib/sessions (cookie store) |
| Database | modernc.org/sqlite |
| Templates | html/template (Go stdlib) |
| Password hashing | golang.org/x/crypto/bcrypt |
| Container | Docker (single service, multi-stage build) |
| Port | 3002 |

---

## References

- [OWASP A01:2021](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- [OWASP A03:2021](https://owasp.org/Top10/A03_2021-Injection/)

---

## Story

### Scenario

PressRoom is the in-house editorial management system of the Greystone
Gazette, a small Durham-based local newspaper. The Gazette's sole developer
(Marcus Webb) was made redundant last quarter after a round of cuts. His
replacement has not been hired. Sarah Lin, the editor-in-chief, has asked a
security audit team to review the system after unpublished drafts started
appearing in places they shouldn't.

The player is that audit. Contributor accounts (`abcd12`, `efgh34`, `ijkl56`)
are described in-story as "external security auditor" seats added for the
engagement.

### Named cast

| Name | Role | Status |
|------|------|--------|
| Sarah Lin | Editor-in-chief (admin) | Active |
| Tom Ashworth | Reporter, community beat | Active |
| Priya Kapoor | Reporter, council / planning beat | Active |
| Marcus Webb | Former sysadmin | Inactive |

### Application pages

- **Login page.** Heading: "PressRoom". Subtitle: "Greystone Gazette
  Editorial System". System notice referencing Marcus Webb's departure and
  the ongoing security review. Dev handover notice pointing at "archive APIs
  in an intermediate migration state" with "ownership enforcement landed on
  the frontend only". About PressRoom expandable block naming the version
  and tech stack flavour.
- **Dashboard.** Greeting with the logged-in user's display name. "Your
  articles" panel listing the signed-in user's own articles (always
  non-empty because each player is seeded with an onboarding draft).
  Newsroom sidebar with four fictional Durham-flavoured headlines. A "tips"
  panel with flavour about the Elvet Wynd office and the editorial channel.
- **Archive page (`/archive`).** Available to every signed-in user via the
  top nav. Lists articles where `status = 'published'` or `author_id =
  current user`. Columns: #id, Title, Byline, Desk, Status pill.
- **Article page.** Renders seeded article entries with author name, status
  badge, category, and body paragraphs.
- **Admin page (`/admin`).** Minimal shell with `<div id="admin-root">` and
  a script tag. Client-side JavaScript fetches `/api/me`, redirects non-
  admins, and if admin fetches `/api/admin/dashboard` and renders stats,
  user table, and maintenance tools.

### Articles

Nine articles across four states (published, draft, archived, review),
100-150 words each:

1. "Riverside bridge reopens after inspection" -- published by tom.ashworth
2. "Planning committee defers Elvet Wharf decision" -- published by priya.kapoor
3. "DRAFT: The tips that won't stop coming" -- draft by sarah.lin
4. "Student union debates library hours" -- published by tom.ashworth
5. "Funding shortfall at the Brandon community centre" -- published by priya.kapoor
6. "Viaduct repairs delayed to autumn" -- published by tom.ashworth
7-8. Filler contributor-authored stubs
9. "Internal note: network diagnostics" -- published note by marcus.webb

### Contributor onboarding articles

Each player is seeded with a contributor onboarding article (ID starting at
10) so the dashboard "Your articles" panel is non-empty on first login. Body
is narrative filler only.

### Flag 3 memo

`src/data/flag-files/memo.txt` contains narrative about the Riverside
Associates / Elvet Wharf / Councillor J. Holt corruption storyline. It
exists so the `flag-files/` directory reads like a realistic editorial drop
folder if the player enumerates it.

### Static assets

- Durham purple palette (`--gz-purple: #68246d`) with Playfair Display
  headings and Georgia body, newspaper grid layout.
