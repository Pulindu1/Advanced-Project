# CTF 7 -- NorthSide Notes

A nostalgic self-hosted note-taking app, built in 2017, still going strong.

**Stack:** Node.js 18 (Express 4), EJS

---

## Quick Start (Docker)

```bash
cd CTFs/CTF_7_notes_app
docker compose up --build
```

- Application: http://localhost:3001

Log in with any username and password seeded in `src/data/users.json`.

---

## Login Credentials (Seeded)

| Username | Password | Role |
|----------|----------|------|
| abcd12 | *(see src/data/users.json)* | user |
| efgh34 | *(see src/data/users.json)* | user |
| ijkl56 | *(see src/data/users.json)* | user |

---

## Flag format

`durham-ds{<16-hex-token>_<username>}`

One flag per user. Flags are deterministic (HMAC-SHA256 based).

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 18 |
| Framework | Express 4 |
| Templates | EJS |
| Container | Docker (single service) |
| Port | 3001 |

---

## References

- [OWASP A08:2021](https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/)

---

## Story

NorthSide Notes is a self-hosted note-taking app, originally released in 2017
and still running on legacy infrastructure. The app has not been maintained
for several years; its changelog and about page describe a solo developer who
stopped updating it and a dependency audit that was ignored.

### Application pages

- **Login (`/`).** Page heading: "NorthSide Notes". Tagline: "A nostalgic
  self-hosted note-taking app, built in 2017, still going strong." Prompt:
  "Log in to access your notes." Error message: "Invalid username or
  password."
- **Home (`/home`).** Greeting: "Welcome back, <username>". Section heading:
  "Your Notes". Renders note cards from the seeded notes store.
- **About (`/about`).** "About NorthSide Notes". "Version: 1.0.0 (released
  2017)". "Built with Express and EJS." "Last updated: never. If it works,
  do not touch it." A short paragraph about the solo developer.
- **Flag page (`/flag`).** "Nothing here yet." "This page is under
  construction. Check back later."
- **Lockout page.** "Too Many Attempts" plus a countdown.
- **Forbidden page.** "Access Denied" plus a default message.

### Seeded notes

Three seeded notes on first login:

1. "Welcome to NorthSide Notes" -- introduction to the app.
2. "Maintenance Log" -- dates and a dependency audit note.
3. "Internal Reminder" -- describes how the app handles session profile data.

### Footer links

- "NorthSide Notes v1.0.0"
- "About" link
- "Changelog" link (subtle, greyed-out; points to `/CHANGELOG.md`)
- "Internal Tools" link (subtle, greyed-out; points to `/debug`)

### Changelog file

Served as a static file at `/CHANGELOG.md`, linked from the footer. Contains
version history and maintenance notes that reflect the "abandoned since 2017"
theme of the application.
