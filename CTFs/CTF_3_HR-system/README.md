# CTF 3 – HR System

Multi-stage CTF with SQL injection, API exploitation, and cryptography.

**Stack:** Laravel 11, React, PostgreSQL

## Quick Start

```bash
# 1. Start database
docker-compose up -d

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

## Login Credentials
- `abcd12` / `RVIFLBfM`
- `efgh34` / `bcgxO1ZkSle`
- `ijkl56` / `kH0g5imYtZ`

## CTF Flags

**4 Flags Total:**
1. Path traversal to `/flag` route
2. Encryption key in source code
3. SQL injection to find hidden employee
4. Decrypt encrypted flag

See [CTF_SOLUTION.md](CTF_SOLUTION.md) for complete walkthrough.

## Vulnerabilities

- SQL injection in employee search (bypassable filter)
- Debug API endpoint exposing credentials
- Hidden route discovery
- Encryption key in client-side code

## Ports
- Backend: `http://127.0.0.1:8004`
- Frontend: `http://localhost:5174`
- PostgreSQL: `localhost:5433`

## Tech Stack

**Backend:**
- Laravel 11 (PHP framework) - REST API with MVC architecture
- PostgreSQL 16 - Relational database
- JWT authentication - Token-based auth

**Frontend:**
- React 18 + Vite - SPA with hot reload
- TypeScript - Type-safe JavaScript
- Fetch API - HTTP requests to backend

**Infrastructure:**
- Docker Compose - Runs PostgreSQL in isolated container
- Artisan - Laravel CLI for migrations, seeding, dev server
- NPM - Frontend dependency management

**Setup Flow:**
1. Docker creates PostgreSQL container with persistent volume
2. Laravel migrations create database schema
3. Seeder populates tables from `credentials.json`
4. Artisan serves API on port 8004
5. Vite dev server proxies to backend, serves frontend on 5174

- ✓ JWT authentication with configurable expiry
- ✓ Input validation on all endpoints
- ✓ Rate limiting on auth endpoints
- ✓ Audit logging for sensitive actions

### Intentional Vulnerabilities (For CTF)
- ✗ **SQL Injection** - Login endpoint uses raw queries (Phase 3 - to be implemented)
- ✗ **Plaintext password storage** - `credentials` table stores passwords unencrypted
- ✗ **Information disclosure** - Error messages leak SQL structure

**Note:** The `users` table uses secure bcrypt passwords. The `credentials` table contains plaintext passwords specifically for the SQL injection challenge.

## CTF Integration

Player flags are generated via `CTFs/challenge-generation/chgen_ctf3.js` and stored in `flags.json`.
Each player's flag is stored in the database and accessible only to authorized users.

## Running the Application

**Ports:**
- Backend API: http://127.0.0.1:8004
- Frontend: http://localhost:5174
- PostgreSQL Database: localhost:5432

**Start Backend:**
```bash
cd backend
php artisan serve --host=127.0.0.1 --port=8004
```

**Start Frontend:**
```bash
cd frontend
npm run dev
```

**Note:** These ports differ from CTF_2_pswd_manager (which uses 4000/5173) to allow both CTFs to run simultaneously.

## Default Credentials (Seeded)

| Role    | Username    | Password   |
|---------|-------------|------------|
| Admin   | admin       | admin123   |
| HR      | hr.manager  | hr1234     |
| Employee| john.doe    | password   |

---

## References

**SQL Injection:**
- TryHackMe Advanced SQL Injection: https://tryhackme.com/room/advancedsqlinjection
- PortSwigger SQL Injection: https://portswigger.net/web-security/sql-injection

**Development:**
- Claude Sonnet 4.5 (Anthropic) - API exploitation and curl examples


