# CTF 2 — Password Manager

A password manager web application where the goal is to exploit JWT vulnerabilities to steal another user's stored credentials and retrieve the flag.

**Stack:** Node.js (Express) backend, React + Vite frontend

---

## Quick Start (Docker — recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/). No Node.js installation needed.

```bash
cd CTFs/CTF_2_pswd_manager
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:5173
- API: http://localhost:4000

To stop: `docker compose down`
To reset to a clean state (wipes all users/vaults): `docker compose down -v && docker compose up --build`

### Running without Docker (development)

Requires Node.js 16+.

```bash
cd CTFs/CTF_2_pswd_manager
npm install

# Terminal 1 — backend API
node server/index.js

# Terminal 2 — frontend (Vite dev server)
npm run dev
```

Frontend is usually at http://localhost:5173 or :5174.

---

## Features

- **User Authentication** — Register and login (username format: 4 letters + 2 digits, e.g. `abcd12`)
- **My Vault** — Store and manage credentials with password masking
- **Team Members** — View all registered users
- **2-Stage CTF Challenge** — Exploit a weak JWT secret to access another user's vault

---

## Notes

- Flags are generated into `server/data/flags.json` by the challenge generator and mirrored into `server/data/vaults.json` on first access.
- The PoW difficulty is set for interactive solving — the console helper on the challenge page handles the computation.
- This CTF intentionally exposes weaknesses (plaintext passwords, weak JWT secret) for learning purposes.

---

## References

- PortSwigger JWT guide — https://portswigger.net/web-security/jwt
- Intigriti November CTF (JWT exploitation) — https://www.intigriti.com/researchers/blog/hacking-tools/november-ctf-challenge-exploiting-jwt-vulnerabilities
- Solution walkthrough and test credentials: `SOLUTIONS.md` (instructors/markers only)
