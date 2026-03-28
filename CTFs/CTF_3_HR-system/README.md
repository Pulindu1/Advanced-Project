# CTF 3 — HR System

Multi-stage CTF covering SQL injection, API exploitation, and cryptography.

**Stack:** Laravel 11 (PHP 8.2), React + Vite, PostgreSQL 16

---

## Quick Start (Docker — recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/). No PHP, Composer, or Node.js needed.

```bash
cd CTFs/CTF_3_HR-system
cp .env.example .env
docker compose up --build
```

Docker will:
1. Start a PostgreSQL 16 database
2. Build and start the Laravel backend (runs migrations + seeders automatically)
3. Build and start the React frontend

- Frontend: http://localhost:5174
- Backend API: http://localhost:8004
- PostgreSQL: localhost:5434 (for debugging)

To stop: `docker compose down`
To reset to a clean state (wipes the database): `docker compose down -v && docker compose up --build`

### Running without Docker (development)

Requires PHP 8.2, Composer, Node.js 18+, and a running PostgreSQL instance.

```bash
# 1. Start database only
docker compose up -d db

# 2. Backend
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve --host=127.0.0.1 --port=8004

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev  # http://localhost:5174
```

---

## Login Credentials (Seeded)

| Username | Password     |
|----------|--------------|
| abcd12   | RVIFLBfM     |
| efgh34   | bcgxO1ZkSle  |
| ijkl56   | kH0g5imYtZ   |

---

## CTF Flags

**4 flags total:**
1. Path traversal to the `/flag` route
2. Encryption key exposed in client-side source code
3. SQL injection in employee search to find a hidden employee
4. Decrypt the encrypted flag using the discovered key

See [CTF_SOLUTION.md](CTF_SOLUTION.md) for the complete walkthrough (instructors/markers only).

---

## Vulnerabilities

- SQL injection in the employee search endpoint (bypassable filter)
- Debug API endpoint that leaks credentials
- Hidden route discoverable via path traversal
- Encryption key embedded in client-side code

**Note:** The `users` table uses secure bcrypt passwords. The `credentials` table stores plaintext passwords specifically for the SQL injection challenge.

---

## Tech Stack

**Backend:** Laravel 11, PostgreSQL 16, JWT authentication
**Frontend:** React 18, Vite, TypeScript
**Infrastructure:** Docker Compose (PostgreSQL + backend + frontend, all containerised)

---

## CTF Integration

Per-player flags are generated via `CTFs/challenge-generation/chgen_ctf3.js` and stored in `flags.json`. Each player's flag is seeded into the database at startup.

---

## References

- PortSwigger SQL Injection: https://portswigger.net/web-security/sql-injection
- TryHackMe Advanced SQL Injection: https://tryhackme.com/room/advancedsqlinjection
