# CTF 4 — IntraDesk (Corporate Helpdesk)

A stored XSS / admin bot challenge featuring a corporate knowledge base and helpdesk system.

**Stack:** Node.js + TypeScript API, React + Vite frontend, PostgreSQL 15, Redis 7, Playwright bot

---

## Challenge Overview

You are an employee using IntraDesk KB, an internal corporate knowledge base. The security team reviews reported KB article links via an automated admin bot.

**Your goal:** Get the admin bot to visit a page containing your XSS payload, steal the admin's session cookie, and use it to retrieve the flag.

---

## Quick Start (Docker — recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/). No Node.js installation needed.

```bash
cd CTFs/CTF_4_corporate_helpdesk
cp .env.example .env
# Edit .env — set strong values for JWT_SECRET and SESSION_SECRET before deploying
docker compose up --build
```

Docker starts 5 services:
1. **PostgreSQL** — database (schema auto-seeded from `infra/init.sql`)
2. **Redis** — session store and job queue
3. **API** — Express backend
4. **Web** — React frontend (Vite)
5. **Bot** — Playwright worker that visits submitted URLs as the admin

- Frontend: http://localhost:5176
- API: http://localhost:4001
- PostgreSQL: localhost:5433 (for debugging)
- Redis: localhost:6380 (for debugging)

To stop: `docker compose down`
To reset to a clean state (wipes database + Redis): `docker compose down -v && docker compose up --build`

### Running without Docker (development)

Requires Node.js 18+.

```bash
cd CTFs/CTF_4_corporate_helpdesk
npm install
cd apps/web && npm install
cd apps/api && npm install
cd apps/bot && npm install

# Run each service in a separate terminal
npm run dev:api
npm run dev:web
npm run dev:bot
```

---

## Project Structure

```
apps/
  web/    — React + Vite frontend
  api/    — Node.js + Express backend
  bot/    — Playwright admin bot worker
infra/
  init.sql — Database schema and seed data
```

---

## Environment Variables

Copy `.env.example` to `.env` and set:

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret for signing JWTs — change before deployment |
| `SESSION_SECRET` | Secret for sessions — change before deployment |
| `ADMIN_EMAIL` | Admin bot login email |
| `ADMIN_PASSWORD` | Admin bot login password |

See `.env.example` for all variables and their defaults.

---

## CTF Integration

Each user gets a unique flag assigned automatically via the challenge-generation system.

---

## References

- PortSwigger DOM XSS: https://portswigger.net/web-security/cross-site-scripting/dom-based
- PortSwigger XSS cheat sheet: https://portswigger.net/web-security/cross-site-scripting/cheat-sheet
- Solution walkthrough: `SOLUTION.md` (instructors/markers only)
