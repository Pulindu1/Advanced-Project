# CTF 6 -- Veridian Secure Internal Portal

Multi-stage CTF built on an internal analyst portal with a link preview feature.

**Stack:** Rust (Actix-web 4), Python (Flask), Redis 7, SQLite

---

## Quick Start (Docker)

```bash
cd CTFs/CTF_6_veridian
docker compose up --build
```

- Application: http://localhost:5180
- Health check: http://localhost:5180/health

---

## Login Credentials (Seeded)

| Username | Password     | Role    |
|----------|--------------|---------|
| abcd12   | *(see credentials.json)* | analyst |
| efgh34   | *(see credentials.json)* | analyst |
| ijkl56   | *(see credentials.json)* | analyst |

---

## Flag format

`durham-vsec-flagN{<hash>_<username>}` where N is the flag number (1-4).

Four flags per user.

---

## Tech Stack

**Backend:** Rust 2021 edition, Actix-web 4, reqwest (async), rusqlite
**Database:** SQLite (embedded, no external DB service)
**Frontend:** Server-side rendered (Askama / Tera templates via Actix-web)
**Infrastructure:** Docker Compose

---

## References

- OWASP Top 10 (2021) -- https://owasp.org/Top10/
