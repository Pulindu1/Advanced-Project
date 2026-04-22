# CTF 2 -- Password Manager

A password manager web application. Recover the flag stored in another user's vault.

**Stack:** Node.js (Express) backend, React + Vite frontend

---

## Quick Start (Docker)

```bash
cd CTFs/CTF_2_pswd_manager
docker compose up --build
```

- Frontend: http://localhost:5173
- API: http://localhost:4000

Log in with any username and password from `credentials.json`.

---

## Flag format

`durham-pm{<hash>_<username>}`

One flag per user.

---

## Features

- **User Authentication** -- Register and login (username format: 4 letters + 2 digits, e.g. `abcd12`)
- **My Vault** -- Store and manage credentials with password masking
- **Team Members** -- View all registered users

Each user has a corresponding bot user (`<username>-vault`) whose vault contains the flag. The bot user cannot be logged into directly.

---

## Notes

- The PoW difficulty is set for interactive solving; the console helper on the challenge page handles the computation.

---

## References

- PortSwigger JWT guide -- https://portswigger.net/web-security/jwt
