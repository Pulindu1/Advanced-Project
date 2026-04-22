# CTF 3 -- HR System

Multi-stage CTF with a staff directory and HR document surface.

**Stack:** Laravel 11 (PHP 8.4), React + Vite, PostgreSQL 16

---

## Quick Start (Docker)

```bash
cd CTFs/CTF_3_HR-system
docker compose up --build
```

- Frontend: http://localhost:5174
- Backend API: http://localhost:8004
- PostgreSQL: localhost:5434 (for debugging)

Log in with any username and password from `credentials.json`.

---

## Flag format

`durham-hr{<hash>_<username>}`

Three flags per user.

---

## Features

- **User Authentication** -- JWT-based login with per-user credentials
- **Employee Directory** -- Searchable list
- **Per-user Bot Employees** -- Each player has a hidden `<username>-bot` employee with encrypted notes

---

## References

- PortSwigger SQL Injection: https://portswigger.net/web-security/sql-injection
