# CTF 4 -- IntraDesk (Corporate Helpdesk)

A corporate knowledge-base and helpdesk system. You are an employee of the
organisation using IntraDesk KB.

**Stack:** Node.js + TypeScript API, React + Vite frontend, PostgreSQL 15, Redis 7, Playwright bot

**Admin bot note:** An automated admin session visits URLs that users submit
through the KB article report form. The bot polls submissions on a short
cadence and browses each URL as the admin role.

---

## Quick Start (Docker)

```bash
cd CTFs/CTF_4_corporate_helpdesk
cp .env.example .env
docker compose up --build
```

Docker starts 5 services: PostgreSQL, Redis, API, Web, Bot.

- Frontend: http://localhost:5176
- API: http://localhost:4001
- PostgreSQL: localhost:5433 (for debugging)
- Redis: localhost:6380 (for debugging)

Log in with any username and password from `credentials.json`.

---

## Environment Variables

Copy `.env.example` to `.env` and set:

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret for signing JWTs |
| `SESSION_SECRET` | Secret for sessions |
| `ADMIN_EMAIL` | Admin bot login email |
| `ADMIN_PASSWORD` | Admin bot login password |

---

## Flag format

Each user gets a unique flag assigned automatically via the challenge-generation system.

---

## References

- PortSwigger DOM XSS: https://portswigger.net/web-security/cross-site-scripting/dom-based
- PortSwigger XSS cheat sheet: https://portswigger.net/web-security/cross-site-scripting/cheat-sheet
