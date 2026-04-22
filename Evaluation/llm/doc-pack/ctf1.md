# CTF 1 -- Basic Node.js

A Node.js web application. Log in with a seeded user and find the flag.

**Stack:** Node.js (Express), EJS templates

---

## Quick Start (Docker)

```bash
cd CTFs/Basic_1_Nodejs
docker compose up --build
```

- Application: http://localhost:3000

Log in with any username and password from `credentials.json`.

---

## Flag format

`durham{<hash>_<username>}`

One flag per user.

---

## Features

- **User Authentication** -- Login with username/password (format: 4 letters + 2 digits, e.g. `abcd12`)
- **Home Page** -- Shows current user info from session cookie
- **Admin Flag Page** -- Requires admin role to access

---

## Notes

- Login rate limiting is enabled: 5 failed attempts triggers a temporary lockout.

---

## References

- OWASP Session Management Cheat Sheet -- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
