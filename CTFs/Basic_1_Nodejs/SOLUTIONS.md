# CTF 1 -- Solutions

> **Instructors/markers only.** Do not distribute to participants.

---

## Credentials

- See `credentials.json` for generated per-user passwords.
- Usernames follow the `abcd12` format (4 letters + 2 digits).
- Generate credentials with: `cd CTFs/challenge-generation && node chgen_basic1.js abcd12 efgh34`

---

## Flag Location

Each user's flag is stored in `flags.json` keyed by username. When a user sets their cookie role to `admin`, the `/flag` endpoint looks up their username in `flags.json` and returns their per-user flag.

Flag format: `durham{<token>_<username>}`

---

## Overview

The Node.js CTF application includes:

- A login page (`/`)
- A home page (`/home`)
- An admin-only `/flag` page
- A deliberately insecure Base64 session cookie

To solve the CTF, students must escalate privileges from a normal user to admin by tampering with the session cookie, then retrieve the flag.

---

## Vulnerability: Insecure Base64 Session Cookie

The application stores session data in a cookie named `session`:

- The cookie contains JSON: `{"username": "abcd12", "role": "user"}`
- It is Base64-encoded with no signature, encryption, or protection
- The server fully trusts this cookie
- `httpOnly` is set to `false` so students can edit it in DevTools

Because of this, a user can decode, modify, and re-encode the cookie to escalate their role to `admin`.

---

## Exploitation Steps

### Step 1 -- Log in as a normal user

1. Go to `http://localhost:3000/`
2. Log in with a username and password from `credentials.json`
3. You will be redirected to `/home`

### Step 2 -- Attempt to access the admin area

Visit `http://localhost:3000/flag`

You will see "Admins only" with a hint suggesting you investigate how the site remembers your role.

### Step 3 -- Inspect the session cookie

1. Open Developer Tools
2. Go to Application (Chrome) or Storage (Firefox) > Cookies > `http://localhost:3000`
3. Locate the cookie named `session` and note its Base64 value

### Step 4 -- Decode the cookie

In the browser console:

```js
atob('<base64_cookie_value>')
```

You should see JSON like:

```json
{"username":"abcd12","role":"user"}
```

### Step 5 -- Modify the role

Change the JSON to set `"role": "admin"` (keep the same username):

```json
{"username":"abcd12","role":"admin"}
```

Re-encode to Base64:

```js
btoa('{"username":"abcd12","role":"admin"}')
```

### Step 6 -- Overwrite the cookie

1. Return to the browser's cookie editor
2. Replace the `session` value with the Base64 string you generated
3. Press Enter to save

### Step 7 -- Refresh /flag

Go back to `http://localhost:3000/flag`

The server now believes you are an admin, and your per-user flag will be displayed.

**Flag:** `durham{..._abcd12}` *(per-user, see flags.json)*

---

## Vulnerabilities Exploited

| Vulnerability | Location | Description |
|---------------|----------|-------------|
| Insecure session management | `authCookie.js` | Session stored in unsigned, unencrypted Base64 cookie |
| Privilege escalation | `flagController.js` | Role checked from client-controlled cookie data |
| Cookie trust | `publicController.js` | Cookie set with `httpOnly: false`, no signing |

---

## Reset

```bash
docker compose down && docker compose up --build
```

This reseeds users from the mounted `credentials.json`.

---

## Post-Design Audit

### Vulnerability Summary

- **Flag (cookie tampering → admin role).** The single flag is gated on a role attribute that is read directly from a Base64-encoded, unsigned `session` cookie. The cookie middleware at `src/middleware/authCookie.js` decodes Base64 → JSON → trusts the `role` field; the route guard at `src/routes/flag.js` (delegating to `src/controllers/flagController.js`) compares that attribute with the literal string `"admin"` to release the flag. The primitive the player needs is therefore not a network exploit but a client-side DevTools mutation: rewrite the cookie payload, re-encode, refresh `/flag`. The flag retrieved is then keyed on the original `username` field (which the player leaves intact), so the per-user flag mapping in `src/services/flagService.js` returns the correct value for the logged-in attacker.

### OWASP Top 10 Classification

| Flag | OWASP 2021 | CWE | One-line justification |
|------|-----------|-----|------------------------|
| 1 | A01 — Broken Access Control | CWE-639 | Authorisation derived from a client-controlled identifier (the `role` attribute of an unsigned cookie). |
| 1 | A07 — Identification & Authentication Failures | CWE-565 | Server relies on cookie data without integrity verification; no signing, no encryption, `httpOnly: false`. |

### Defence Recommendations

- **Sign the session cookie.** Replace the bare-Base64 scheme in `authCookie.js` with an HMAC or AEAD-protected token (`jsonwebtoken` with a server-only secret, or `cookie-session` with `keys`). Reject cookies whose signature does not validate; never trust the `role` field on the client.
- **Move `role` server-side.** Persist `role` in `users.json` (or a session store keyed by an opaque session id) and look it up by username; the cookie becomes an opaque session id, not a self-contained role claim. The current `verifyUser` flow already returns role at login — wire it through the session, not the cookie body.
- **Set cookie hardening flags.** `httpOnly: true`, `secure: true` in production, `sameSite: 'lax'`. The deliberate `httpOnly: false` in `publicController.js` exists only to make DevTools inspection trivial for players; production flips this.
- **Rotate session secrets on logout / password change** to invalidate any cookie copies still in the wild.

### Unintended Solutions to Watch For

- **Re-using another player's tampered cookie.** Because the cookie carries `username`, a player who forges `{"username":"efgh34","role":"admin"}` retrieves *efgh34's* flag — verifying the per-user fan-out from `flagService.js`. The exploit is still in scope (the same primitive — cookie forgery), and the `e2e/ctf1_exploit.py` test only checks `durham{` prefix, so it accepts this path. Acceptable.
- **Editing the cookie via Burp/curl rather than DevTools.** Same primitive, different surface. Accepted.
- **Brute-forcing the admin password directly.** Blocked: `seedUsers()` in `src/server.js` swaps the `SYSTEM_INTERNAL` sentinel for `crypto.randomBytes(24).toString('hex')` at boot, so no one can authenticate as `admin` directly. This is the intentional gate forcing the cookie path.

### Skill Level & Realism Notes

- Target skill level: **intro**. First exposure to client-side trust failures.
- Real-world analogue: legacy PHP/Express apps that store role in a cookie or `localStorage` and read it back without a signature; OWASP Juice Shop's "Login Admin" challenge hits the same class. Public CVE examples include various WordPress plugin auth-bypass patterns where role attributes were trusted from request payloads.

### Lessons Learned (Design Retrospective)

- **`SYSTEM_INTERNAL` sentinel pattern.** Originally `admin` shipped with a known password; this turned out to be a more attractive path for players than the intended cookie tamper. The Phase-0 swap to a random per-boot password (alongside CTFs 5/8/9) closed the bypass without changing the public credential surface.
- **`afterAll` cleanup discipline in `test/app.test.js`.** The contract tests overwrite `src/data/users.json` to seed deterministic accounts; without an `afterAll` restoring the original contents, repeat `npm test` runs would leak the test fixture into the next docker rebuild. Adding the restore was a coverage-credibility win, not a logic change.
- **Volume cleanup matters for re-seeding.** `docker compose down` (without `-v`) preserves the `users.json` from a prior boot; `down -v` is the only path that re-runs the seeder against a fresh `credentials.json`. This bit the integration testing of CTF5 first, but the fix landed here too.
- **Next time:** ship a `--debug-token` query knob on `/flag` (gated behind a build flag) so contract tests can assert the role-check branch without forging cookies; cookies remain the player path, but the server-side exercise gets cheaper.
