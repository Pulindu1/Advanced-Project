# CTF_2 Password Manager

Minimal React + Vite password-manager skeleton used for CTF_2. The challenge is a two-stage attack: solve a small PoW to obtain the JWT signing secret, then forge a JWT for `flag12` and read their vault.

Quick start
-----------

Prerequisites: Node.js (v16+), npm

1. Install and run (from this folder):

```bash
cd CTFs/CTF_2_pswd_manager
npm install

# start backend (API)
node server/index.js

# start frontend (Vite) in a second terminal
npm run dev
```

Open the frontend URL printed by Vite (usually http://localhost:5173 or :5174).

How to solve (brief)
--------------------
1. Log in or register (usernames are 4 letters + 2 digits, e.g. `abcd12`).
2. Visit `/app/challenge` and fetch the PoW (`nonce` + `difficulty`). Use the console helper on that page (or a script) to find a `suffix` such that `sha256(nonce + suffix)` has the required leading hex zeros. Submit the suffix — the server will return the JWT secret.
3. Forge a JWT for `flag12` signed with the returned secret (use jwt.io or a quick script):

```js
// example (node)
const jwt = require('jsonwebtoken')
const token = jwt.sign({ sub: 'flag12' }, '<SECRET_FROM_STEP_2>', { expiresIn: '7d' })
console.log(token)
```

4. Replace the `session` cookie in your browser (DevTools → Application → Cookies) with the forged token, then open `/app/vault` — the `flag12` vault entry contains the flag.

Notes
-----
- Flags are generated into `server/data/flags.json` by the generator and are mirrored into `server/data/vaults.json` on access.
- The PoW difficulty is set for interactive solving; use the provided console helper for convenience.
- This CTF intentionally exposes weaknesses (plaintext passwords, weak secret) for learning.

References
----------
- November CTF: Exploiting JWT vulnerabilities — https://www.intigriti.com/researchers/blog/hacking-tools/november-ctf-challenge-exploiting-jwt-vulnerabilities
- PortSwigger JWT guide — https://portswigger.net/web-security/jwt


# CTF breakdown
======================

A password manager web application where the goal is to exploit JWT vulnerabilities to steal another user's stored credentials and retrieve the flag.

## Features

- **User Authentication** - Register and login with username/password
- **My Vault** - Store and manage login credentials (usernames/passwords) with password masking
- **Team Members** - View all registered users on the platform
- **2-Stage CTF Challenge** - Exploit weak JWT secrets to access another user's vault

## Quick Start
CTF_2 Password Manager
======================

Minimal React + Vite password-manager skeleton used for CTF_2. The challenge is a two-stage attack: solve a small PoW to obtain the JWT signing secret, then forge a JWT for `flag12` and read their vault.

Quick start
-----------

Prerequisites: Node.js (v16+), npm

1. Install and run (from this folder):

```bash
cd CTFs/CTF_2_pswd_manager
npm install

# start backend (API)
node server/index.js

# start frontend (Vite) in a second terminal
npm run dev
```

Open the frontend URL printed by Vite (usually http://localhost:5173 or :5174).

# How to solve (brief)
--------------------
1. Log in or register (usernames are 4 letters + 2 digits, e.g. `abcd12`).
2. Visit `/app/challenge` and fetch the PoW (`nonce` + `difficulty`). Use the console helper on that page (or a script) to find a `suffix` such that `sha256(nonce + suffix)` has the required leading hex zeros. Submit the suffix — the server will return the JWT secret.
3. Forge a JWT for `flag12` signed with the returned secret (use jwt.io or a quick script):

```js
// example (node)
const jwt = require('jsonwebtoken')
const token = jwt.sign({ sub: 'flag12' }, '<SECRET_FROM_STEP_2>', { expiresIn: '7d' })
console.log(token)
```

4. Replace the `session` cookie in your browser (DevTools → Application → Cookies) with the forged token, then open `/app/vault` — the `flag12` vault entry contains the flag.

Notes
-----
- Flags are generated into `server/data/flags.json` by the generator and are mirrored into `server/data/vaults.json` on access.
- The PoW difficulty is set for interactive solving; use the provided console helper for convenience.
- This CTF intentionally exposes weaknesses (plaintext passwords, weak secret) for learning.

That's it — good luck!
```json

