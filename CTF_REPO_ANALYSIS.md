# CTF_REPO_ANALYSIS.md

# CTF Repository: Comprehensive Technical Analysis

**Project:** Designing and Deploying Realistic Web Exploitation CTF Challenges
**Author:** Pulindufonseka (dissertation project)
**Repository:** `/Users/pulindufonseka/Documents/GitHub/Advanced-Project`
**Analysis Date:** 2025
**Document Purpose:** Evidence-based technical analysis of all CTF challenges for dissertation methodology

> **Methodology Note:** Every claim in this document is grounded in specific source files. Claims derived through inference (rather than direct source evidence) are explicitly labelled **[Inference]**. File paths are given relative to the repository root.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Challenge Inventory Table](#2-challenge-inventory-table)
3. [Per-Challenge Deep Analysis](#3-per-challenge-deep-analysis)
   - [3.1 CTF1 — Basic_1_Nodejs](#31-ctf1--basic_1_nodejs)
   - [3.2 CTF2 — CTF_2_pswd_manager](#32-ctf2--ctf_2_pswd_manager)
   - [3.3 CTF3 — CTF_3_HR-system](#33-ctf3--ctf_3_hr-system)
   - [3.4 CTF4 — CTF_4_corporate_helpdesk](#34-ctf4--ctf_4_corporate_helpdesk)
4. [Cross-Challenge Comparative Analysis](#4-cross-challenge-comparative-analysis)
5. [Methodology Evidence Extraction](#5-methodology-evidence-extraction)
6. [Gaps and Missing Evidence](#6-gaps-and-missing-evidence)
7. [Appendix: File Map](#7-appendix-file-map)

---

## 1. Project Overview

This repository contains a research project for a master's dissertation focused on the design and deployment of realistic web exploitation Capture-The-Flag (CTF) challenges. The project aims to investigate how to construct pedagogically effective, operationally realistic, and technically rigorous security challenges that mirror real-world vulnerability classes.

The repository is structured into four CTF challenges of increasing difficulty, plus a shared challenge-generation system and a legacy scaffolding module.

```
Advanced-Project/
├── CTFs/
│   ├── Basic_1_Nodejs/          # CTF1 — Insecure session cookie
│   ├── CTF_2_pswd_manager/      # CTF2 — JWT secret via Proof-of-Work
│   ├── CTF_3_HR-system/         # CTF3 — Multi-stage SQL injection + crypto
│   ├── CTF_4_corporate_helpdesk/ # CTF4 — DOM XSS + bot privilege escalation
│   └── challenge-generation/    # Shared flag + credential generation system
├── challenge-generation/        # Legacy/scaffolding generation framework
├── CHANGELOG.md
└── README.md
```

**Source evidence:** Repository root directory listing; `CTFs/challenge-generation/README.md`.

---

## 2. Challenge Inventory Table

| ID | Name | Difficulty | Primary Stack | Vulnerability Class | Entry Point | Flag Mechanism | Multi-Stage | Per-User Randomised Flags | Automated Tests |
|----|------|-----------|--------------|--------------------|-----------|--------------------|------------|--------------------------|-----------------|
| CTF1 | Basic_1_Nodejs | Easy | Node.js / Express / EJS | Insecure unsigned session cookie | `/` login page | `src/data/flags.json` keyed by username | No | Yes — HMAC-SHA256 (deterministic) | Yes — 4 Jest/supertest tests |
| CTF2 | CTF_2_pswd_manager | Intermediate | Node.js / React 18 / Vite / JWT | Weak JWT secret exposed via Proof-of-Work | `/app/challenge` PoW page | `server/data/flags.json` → vault auto-sync | Yes — 2 stages | Yes — HMAC-SHA256 (deterministic) | Partial — `check_pw.js` validation script only |
| CTF3 | CTF_3_HR-system | Intermediate/Advanced | Laravel 11 (PHP) / React / PostgreSQL 16 | SQL injection + info disclosure + AES decryption | Login → dashboard | `flags.json` + `FlagController::show()` per-user | Yes — 4 sequential flags | Yes — SHA256 + random bytes (non-deterministic) | No |
| CTF4 | CTF_4_corporate_helpdesk | Advanced | Node.js / React 18 / TypeScript / PostgreSQL / Redis / BullMQ / Playwright | DOM XSS + automated bot privilege escalation | `/kb` Knowledge Base page | PostgreSQL `users.flag` column per-user | Yes — chained (3+ steps) | Yes — hex token + username keyed | No |

**Source evidence:** `CTFs/Basic_1_Nodejs/ctf-config.json`; `CTFs/CTF_4_corporate_helpdesk/ctf-config.json` (md-format file); all four `README.md` files; challenge-generation generator modules.

---

## 3. Per-Challenge Deep Analysis

---

### 3.1 CTF1 — Basic_1_Nodejs

#### 3.1.1 Architecture

**Runtime stack:**
- Node.js + Express.js web framework
- EJS templating engine for server-side rendering
- No database — flat JSON file storage (`src/data/flags.json`, `src/data/users.json`)
- No external dependencies beyond Express, EJS, and development utilities

**Source evidence:** `CTFs/Basic_1_Nodejs/package.json`; `CTFs/Basic_1_Nodejs/src/app.js`.

**Application structure:**

```
src/
├── app.js              — Express app factory; mounts middleware and routes
├── server.js           — HTTP server; reads PORT from env (default 3000)
├── config/index.js     — Centralised configuration
├── routes/
│   ├── index.js        — GET / (login), POST /login
│   ├── public.js       — GET /home (post-login landing)
│   └── flag.js         — GET /flag (admin-only protected resource)
├── controllers/
│   ├── publicController.js  — Renders home.ejs with session data
│   └── flagController.js    — Validates role, looks up flag, renders flag.ejs
├── middleware/
│   ├── authCookie.js        — Cookie decoder (INTENDED VULNERABILITY)
│   ├── loginRateLimiter.js  — Per-IP in-memory rate limiter
│   ├── logger.js            — Morgan-style request logger
│   └── errorHandler.js      — Global error handler
├── services/
│   ├── flagService.js       — Flag lookup with fuzzy matching
│   ├── userServices.js      — User authentication against users.json
│   └── attemptTracker.js    — Per-session /flag access counter (for hints)
└── data/
    ├── flags.json           — Per-user flag store
    └── users.json           — User credential store
```

**Source evidence:** Direct file listing and reading of `CTFs/Basic_1_Nodejs/src/`.

#### 3.1.2 Vulnerability Design

**Vulnerability class:** Insecure client-side session token — Base64-encoded, unsigned, unencrypted JSON

**Location:** `CTFs/Basic_1_Nodejs/src/middleware/authCookie.js`

**Mechanism:** The server encodes session data as a JSON object `{"username": "abcd12", "role": "student"}` and Base64-encodes it into the `session` cookie. The cookie is set with `httpOnly: false` (making it readable from JavaScript) and no `secure`, `sameSite`, or `signed` options. On every request, `authCookie.js` decodes the cookie and trusts the decoded `role` field without any verification.

**Multi-strategy decoder** (source: `authCookie.js`):
1. Direct `Buffer.from(value, 'base64').toString('utf8')` → JSON parse
2. Raw JSON parse (no base64)
3. `decodeURIComponent(value)` → base64 decode → JSON parse
4. `decodeURIComponent(value)` → raw JSON parse

This deliberate multi-strategy approach ensures the vulnerability is exploitable regardless of minor encoding variations, lowering the barrier for beginners. **[Inference: the four-strategy design was a pedagogical choice to reduce frustrating edge cases for inexperienced players.]**

**OWASP Mapping:** A01:2021 — Broken Access Control; A02:2021 — Cryptographic Failures (no integrity protection on session token).

#### 3.1.3 Exploit Path

1. Navigate to `http://localhost:3000/` and log in with valid credentials (e.g. `abcd12` / `password`)
2. Open browser DevTools → Application → Cookies → copy `session` cookie value
3. Decode: `atob(cookieValue)` → `{"username":"abcd12","role":"student"}`
4. Modify: change `"role":"student"` to `"role":"admin"`
5. Re-encode: `btoa(JSON.stringify({"username":"abcd12","role":"admin"}))`
6. Replace cookie value in DevTools (or via `document.cookie` in console)
7. Navigate to `http://localhost:3000/flag` → flag is rendered in `flag.ejs`

**Flag format:** `durham{<16-char-hex-token>_<username>}` (e.g. `durham{3a1f9c2b4e7d8a0f_abcd12}`)

**Source evidence:** `CTFs/Basic_1_Nodejs/SOLUTIONS.md` lines 1–60; `CTFs/Basic_1_Nodejs/src/middleware/authCookie.js`; `CTFs/Basic_1_Nodejs/src/data/flags.json`.

#### 3.1.4 Flag System

**Storage:** `CTFs/Basic_1_Nodejs/src/data/flags.json` — plain JSON object mapping username strings to flag strings.

**Generation algorithm** (`CTFs/challenge-generation/generators/basic1_generator.js`):
```javascript
const salt = options.salt || 'basic1-default-salt';
const tokenLength = options.tokenLength || 16;
const h = crypto.createHmac('sha256', String(salt))
               .update(String(username))
               .digest('hex');
return h.slice(0, tokenLength);
// Final flag: `durham{${token}_${username}}`
```

**Properties:** Deterministic (same username + salt always yields same token), collision-resistant (HMAC-SHA256 truncated to 16 hex chars = 64-bit space), parameterisable via environment variables `GENERATOR_SALT` and `GENERATOR_TOKEN_LENGTH`.

**Flag lookup service** (`CTFs/Basic_1_Nodejs/src/services/flagService.js`):
- Strategy 1: Exact key match in `flags.json`
- Strategy 2: Alphanumeric-normalised key match
- Strategy 3: Levenshtein distance ≤ 1 fuzzy match (O(m × n) dynamic programming)
- Strategy 4: Dev synthesis — if `CTF_DEV=1`, synthesise flag on-the-fly without pre-seeded data

**Source evidence:** `CTFs/challenge-generation/generators/basic1_generator.js` (full file); `CTFs/Basic_1_Nodejs/src/services/flagService.js`.

#### 3.1.5 Access Controls and Rate Limiting

**Login rate limiting** (`CTFs/Basic_1_Nodejs/src/middleware/loginRateLimiter.js`):
- In-memory per-IP counter with sliding 2-minute window
- Threshold: 5 failed login attempts
- Lockout duration: 5 minutes
- Renders `lockout.ejs` with JavaScript countdown timer on lockout
- **Limitation:** In-memory storage; resets on server restart; trivially bypassed by IP rotation [Inference]

**Flag access attempt tracking** (`CTFs/Basic_1_Nodejs/src/services/attemptTracker.js`):
- Counts per-session visits to `/flag` (including 403 responses)
- After ≥ 4 failed attempts, `flagController.js` passes `showHint: true` to `forbidden.ejs`
- **Purpose:** Progressive hint disclosure to prevent player frustration

**Source evidence:** `CTFs/Basic_1_Nodejs/src/middleware/loginRateLimiter.js`; `CTFs/Basic_1_Nodejs/src/services/attemptTracker.js`; `CTFs/Basic_1_Nodejs/src/controllers/flagController.js`.

#### 3.1.6 Test Coverage

**Test file:** `CTFs/Basic_1_Nodejs/test/app.test.js`
**Framework:** Jest + supertest

**Test cases (4 total):**
1. `GET /flag` with no cookie → expect HTTP 403
2. `GET /flag` with a non-admin cookie (role: student) → expect HTTP 403
3. `GET /nonexistent` → expect HTTP 404
4. `POST /login` with wrong password → expect HTTP 401

**Coverage gaps:** No tests for the successful exploitation path (admin cookie → 200 + flag content), no tests for rate limiting logic, no tests for flag service fuzzy matching. **[Inference: tests were written to verify access control enforcement, not to validate the exploit path itself.]**

**Source evidence:** `CTFs/Basic_1_Nodejs/test/app.test.js`.

#### 3.1.7 Configuration and Metadata

**`ctf-config.json`:**
```json
{
  "id": "node-basic-insecure-middleware",
  "title": "Node.js – Insecure Admin Header",
  "category": "web",
  "difficulty": "easy",
  "flagFormat": "durham{.*}",
  "points": 100
}
```

**Views:** `src/views/` contains five EJS templates: `index.ejs` (login), `home.ejs`, `flag.ejs`, `forbidden.ejs`, `lockout.ejs`, plus `partials/header.ejs` and `partials/footer.ejs`. These provide a complete, styled UI for the challenge.

**Source evidence:** `CTFs/Basic_1_Nodejs/ctf-config.json`; directory listing of `CTFs/Basic_1_Nodejs/src/views/`.

---

### 3.2 CTF2 — CTF_2_pswd_manager

#### 3.2.1 Architecture

**Runtime stack:**
- **Frontend:** React 18 + Vite + TypeScript (dev server port 5173; `/api` proxied to backend)
- **Backend:** Node.js + Express (port 4000)
- **Storage:** Flat JSON files — `server/data/users.json`, `server/data/vaults.json`, `server/data/flags.json`, `server/data/login_attempts.json`, `server/data/deleted_flags.json`
- **Auth:** JSON Web Tokens (jsonwebtoken library), bcrypt password hashing (cost=12)

**Source evidence:** `CTFs/CTF_2_pswd_manager/package.json`; `CTFs/CTF_2_pswd_manager/vite.config.ts`; `CTFs/CTF_2_pswd_manager/server/index.js` lines 1–30.

**Vite proxy configuration** (`vite.config.ts`):
```typescript
server: {
  proxy: {
    '/api': { target: 'http://localhost:4000', changeOrigin: true }
  }
}
```

#### 3.2.2 Vulnerability Design

**Vulnerability class:** Weak JWT secret revealed through a cryptographic Proof-of-Work (PoW) side-channel, enabling JWT forgery and vault account takeover

**Primary attack surface:** Two-stage exploit chain requiring both cryptographic computation and JWT manipulation.

**Stage 1 — Proof-of-Work to leak JWT secret:**

Endpoint: `GET /api/challenge` → returns `{ nonce: <16-hex-char random>, difficulty: 4 }`

Nonce generation (`server/index.js`):
```javascript
const nonce = crypto.randomBytes(8).toString('hex');
```

PoW verification (`server/index.js`):
```javascript
function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}
// Player must find suffix s.t.:
sha256Hex(nonce + suffix).startsWith('0'.repeat(difficulty)) // difficulty = 4
```

On correct solution: `POST /api/challenge/solve` → server responds with `JWT_SECRET` in plaintext.

**Stage 2 — JWT forgery:**
With the leaked secret, player forges: `jwt.sign({ sub: 'flag12' }, JWT_SECRET)` → sets as `token` cookie → `GET /api/vault` → reads `flag12`'s vault entries, which contain the flag as a password field.

**OWASP Mapping:** A02:2021 — Cryptographic Failures (weak/exposed secret); A07:2021 — Identification and Authentication Failures (JWT forgery).

**Source evidence:** `CTFs/CTF_2_pswd_manager/server/index.js` lines 60–150 (PoW implementation); lines 200–280 (JWT auth + vault route).

#### 3.2.3 Exploit Path

1. Navigate to `/app/challenge` — the page displays: nonce value, difficulty=4, and a browser console helper snippet
2. Solve PoW: find suffix `s` such that `SHA-256(nonce + s)` begins with `"0000"` (4 hex zeros)
3. POST solution to `/api/challenge/solve` → receive `JWT_SECRET` in response body
4. Forge JWT: `jwt.sign({ sub: 'flag12' }, JWT_SECRET)` (e.g. using jwt.io or Node.js)
5. Set browser cookie `token` = forged JWT value
6. GET `/api/vault` → response contains vault entries for `flag12`
7. Locate entry with `site: 'CTF Flag'` → `password` field contains the flag

**Flag format:** `durham-pm{<20-char-hex-token>_<username>}` (e.g. `durham-pm{a3f9c2b4e7d8a0f1c2d3_flag12}`)

**Source evidence:** `CTFs/CTF_2_pswd_manager/server/index.js` (full, 449 lines); `CTFs/CTF_2_pswd_manager/src/features/challenge/pages/ChallengePage.tsx`.

#### 3.2.4 Flag System

**Flag storage:** `CTFs/CTF_2_pswd_manager/server/data/flags.json` — JSON object mapping username → flag string.

**Flag → Vault synchronisation** (`syncFlagsToVaults()` in `server/index.js`):
- Runs at server startup
- For each entry in `flags.json`, inserts a vault entry into `vaults.json` for the target user with:
  - `id`: `flag-<username>`
  - `site`: `"CTF Flag"`
  - `username`: `"flag"`
  - `password`: `<flag_string>`
- Tracks deleted vault entries in `deleted_flags.json` to prevent re-insertion after player deletes the vault entry

**Generation algorithm** (`CTFs/challenge-generation/generators/ctf2_generator.js`):
```javascript
const salt = options.salt || 'ctf2-default-salt';
const tokenLength = options.tokenLength || 20;
const h = crypto.createHmac('sha256', String(salt))
               .update(String(username))
               .digest('hex');
return h.slice(0, tokenLength);
// Final flag: `durham-pm{${token}_${username}}`
```

**Properties:** Deterministic; same algorithm as CTF1 but with 20-char token length and different prefix/salt.

**Source evidence:** `CTFs/challenge-generation/generators/ctf2_generator.js` (full); `CTFs/CTF_2_pswd_manager/server/index.js` `syncFlagsToVaults()` function.

#### 3.2.5 Access Controls and Rate Limiting

**Login rate limiting** (`server/index.js`):
- Per-username (not per-IP) counter, persisted to `server/data/login_attempts.json`
- Threshold: 4 consecutive failures
- Lockout duration: 45 seconds
- **Design note:** Persisted to disk — survives server restart, unlike CTF1's in-memory approach

**PoW endpoint rate limiting** (`server/index.js`):
- Per-IP, 200 requests per minute
- Prevents brute-forcing the PoW solution endpoint
- **[Inference: 200 req/min was chosen as a practical limit that blocks naive PoW verification spamming without impeding legitimate challenge/solve cycles.]**

**JWT authentication** (`server/index.js`):
- `httpOnly` cookie containing JWT
- Standard `jsonwebtoken` `verify()` call — intentionally uses a weak secret that can be leaked via PoW
- No token revocation or refresh mechanism

**Client-side cryptography** (`CTFs/CTF_2_pswd_manager/src/lib/crypto.ts`):
- PBKDF2 key derivation + AES-GCM encryption for vault entries in the browser
- **Present for application realism but NOT part of the exploit chain**
- Represents a real-world feature (end-to-end encrypted password manager) that increases scenario credibility **[Inference]**

**Source evidence:** `CTFs/CTF_2_pswd_manager/server/index.js` lines 80–120 (rate limiting); `CTFs/CTF_2_pswd_manager/src/lib/crypto.ts`.

#### 3.2.6 Test Coverage

**Formal test suite:** None found in the repository.

**Validation artefact:** `CTFs/CTF_2_pswd_manager/check_pw.js` — a standalone script that:
- Hard-codes 10 password candidates
- Compares each against the bcrypt hash for user `abcd12` (stored hash for `"abcd12"`)
- Confirms which candidate matches

**Purpose of `check_pw.js`:** Evidence of manual validation testing during development — confirms that bcrypt hashing is correctly configured and that known passwords work. **[Inference: written to validate the seeded user data rather than application behaviour.]**

**Source evidence:** `CTFs/CTF_2_pswd_manager/check_pw.js`.

#### 3.2.7 Configuration and Metadata

**No `ctf-config.json` found** in `CTFs/CTF_2_pswd_manager/`. The challenge metadata (difficulty, points) is documented only in `readme.md`.

**Users seeded** (`server/data/users.json`): `abcd12`, `test12`, `flag12` — the last being the target account whose vault contains the flag.

**Source evidence:** `CTFs/CTF_2_pswd_manager/server/data/users.json`; `CTFs/CTF_2_pswd_manager/readme.md`.

---

### 3.3 CTF3 — CTF_3_HR-system

#### 3.3.1 Architecture

**Runtime stack:**
- **Backend:** Laravel 11 (PHP 8.x), Composer-managed, Artisan CLI
- **Frontend:** React + Vite (TypeScript, port 5174)
- **Database:** PostgreSQL 16 (Docker-managed, host port 5434 → container port 5432)
- **Auth:** JWT (`auth.jwt` middleware); custom `FlagController`, `EmployeeController`, `DebugController`

**Containerisation:** Only the PostgreSQL database is containerised; backend and frontend run directly on the host system.

**Source evidence:** `CTFs/CTF_3_HR-system/docker-compose.yml`; `CTFs/CTF_3_HR-system/backend/composer.json`; `CTFs/CTF_3_HR-system/README.md`.

**Docker Compose (`docker-compose.yml`):**
```yaml
services:
  postgres:
    image: postgres:16
    ports:
      - "5434:5432"
    environment:
      POSTGRES_DB: hr_system
      POSTGRES_USER: hr_user
      POSTGRES_PASSWORD: hr_password
```

#### 3.3.2 Vulnerability Design — Four Sequential Flags

CTF3 is the most complex challenge, requiring four distinct vulnerability classes chained together.

**Flag 1 — Path Traversal Hint / Hidden Route Discovery:**
- An HTML comment in the dashboard page source reveals: `<!-- Debug: flag available at /flag -->`
- Players visit `GET /api/flag` (authenticated) → `FlagController::show()` → returns hardcoded flag: `durham-hr{w3lc0m3_t0_hr_syst3m}`
- **Technique:** Source code inspection / hidden endpoint discovery
- **OWASP:** A05:2021 — Security Misconfiguration (debug comment left in production code)

**Flag 2 — Client-Side Source Code Inspection:**
- `CTFs/CTF_3_HR-system/frontend/src/utils/legacyAuth.ts` contains a hardcoded secret key in a JavaScript comment: `// Legacy key: CTF_2026_SECRET_KEY_XJ9K2L`
- Players find this by inspecting the bundled/served JavaScript or the source file directly
- **Technique:** Client-side information disclosure
- **OWASP:** A02:2021 — Cryptographic Failures (secrets in client-side code)

**Flag 3 — SQL Injection (Filter Bypass):**

Vulnerable code in `CTFs/CTF_3_HR-system/backend/app/Http/Controllers/EmployeeController.php`:
```php
$query = "SELECT u.id, u.username, u.department, u.notes
          FROM users u
          WHERE u.username ILIKE '%{$search}%'
          AND u.username != 'flag12'";
```

Filter function `isBlocked()` uses regex patterns with mandatory surrounding whitespace:
```php
$patterns = ['/\s+select\s+/i', '/\s+union\s+/i', '/\s+or\s+/i', ...];
```

**Bypass:** The filter only blocks `or` when surrounded by whitespace. The payload `'OR 1=1--` (note: no space before `OR`) bypasses the filter. Additional bypasses: `'/**/OR/**/1=1--` (SQL comment-based). The `AND u.username != 'flag12'` clause is nullified by OR-based injection.

**Result:** The injected query returns all rows, including the FLAG012 / `flag12` employee whose `notes` field contains an AES-256-CBC encrypted string.

**OWASP:** A03:2021 — Injection (SQL injection via raw string concatenation).

**Flag 4 — AES-256-CBC Decryption:**
- `flag12`'s `notes` field (from Flag 3): `+DUi/1MfXD1MDdwdvzE2YA==:uj1q...` (IV:ciphertext in Base64)
- Decryption key: `SHA256("CTF_2026_SECRET_KEY_XJ9K2L")` (using the key from Flag 2)
- Result: `durham-hr{h1dd3n_3mpl0y33_4dv4nc3d_sql1_m4st3r}`
- **Technique:** Cryptographic reasoning — AES-256-CBC with known key and IV

**OWASP:** A02:2021 — Cryptographic Failures (key material exposed client-side, enabling decryption of server-side data).

**Additional attack surface — Debug endpoint** (`CTFs/CTF_3_HR-system/backend/app/Http/Controllers/DebugController.php`):
```php
// GET /api/debug/user-config?user=<username>
// TODO: REMOVE BEFORE PRODUCTION
public function getUserConfig(Request $request): JsonResponse {
    $user = $request->query('user', 'admin');
    // reads credentials.json and returns plaintext password for $user
    return response()->json([
        'user' => $user,
        'password' => $plaintext_password,
        'warning' => 'Debug endpoint - not for production use'
    ]);
}
```

This endpoint returns plaintext passwords from `credentials.json` for any username — used as an alternative path in the exploit chain (e.g. retrieve `flag12`'s password to log in as that user). The `// TODO: REMOVE BEFORE PRODUCTION` comment is an **intentional realism touch** simulating a common real-world mistake.

**Source evidence:** `CTFs/CTF_3_HR-system/backend/app/Http/Controllers/EmployeeController.php` lines 1–120; `CTFs/CTF_3_HR-system/backend/app/Http/Controllers/DebugController.php` lines 1–80; `CTFs/CTF_3_HR-system/CTF_SOLUTION.md` (full).

#### 3.3.3 Exploit Path

1. **Log in** with provided credentials (e.g. `abcd12` / `<from credentials.json>`)
2. **Flag 1:** View dashboard page HTML source → find comment → `GET /api/flag` while authenticated → receive `durham-hr{w3lc0m3_t0_hr_syst3m}`
3. **Flag 2:** Open browser DevTools → Sources → find `legacyAuth.ts` or bundled JS → locate `CTF_2026_SECRET_KEY_XJ9K2L`
4. **Flag 3:** Navigate to employee search page → submit search with payload `'OR 1=1--` → FLAG012 employee appears in results → note the encrypted `notes` field value
5. **Flag 4:** Decrypt the `notes` value:
   - Key = `SHA256("CTF_2026_SECRET_KEY_XJ9K2L")` (32 bytes)
   - Split `notes` on `:` → left = IV (Base64), right = ciphertext (Base64)
   - AES-256-CBC decrypt with PKCS7 unpadding → `durham-hr{h1dd3n_3mpl0y33_4dv4nc3d_sql1_m4st3r}`

**Alternative path (using debug endpoint):** `GET /api/debug/user-config?user=flag12` → retrieve `flag12`'s password → log in as `flag12` → access `/api/flag` directly for the per-user flag.

**Source evidence:** `CTFs/CTF_3_HR-system/CTF_SOLUTION.md`; `CTFs/CTF_3_HR-system/backend/routes/api.php`.

#### 3.3.4 Flag System

**Storage:** `CTFs/CTF_3_HR-system/flags.json` — JSON object mapping username → flag string.

**Generation algorithm** (`CTFs/challenge-generation/generators/ctf3_generator.js`):
```javascript
const timestamp = Date.now().toString(36);
const randomPart = crypto.randomBytes(8).toString('hex');
const hash = crypto.createHash('sha256')
  .update(`${normalizedUsername}:${timestamp}:${randomPart}`)
  .digest('hex')
  .substring(0, 20);
return `durham-hr{${hash}_${normalizedUsername}}`;
```

**Critical design difference from CTF1/CTF2:** This generator is **non-deterministic** — it includes both `Date.now()` and `crypto.randomBytes()`, so re-running the generator for the same username produces a different flag each time. This means flags must be generated once and stored; they cannot be regenerated to match existing data.

**Special case:** `flags.json` entry for `flag12` is `"HIDDEN_EMPLOYEE"` — a marker value indicating this user's flag is embedded in the encrypted employee notes rather than returned by the standard flag endpoint.

**Flag model** (`CTFs/CTF_3_HR-system/backend/app/Http/Controllers/FlagController.php`):
```php
public function show(Request $request): JsonResponse {
    $user = $request->user();
    $flag = Flag::getForUser($user->username);
    return response()->json(['flag' => $flag]);
}
```

Simple, authenticated, per-user lookup — delegates to the `Flag` Eloquent model.

**Source evidence:** `CTFs/CTF_3_HR-system/flags.json`; `CTFs/challenge-generation/generators/ctf3_generator.js`; `CTFs/CTF_3_HR-system/backend/app/Http/Controllers/FlagController.php`.

#### 3.3.5 Access Controls

**JWT authentication:** `auth.jwt` middleware applied to all sensitive routes (employee search, flag endpoint, debug endpoint) in `backend/routes/api.php`.

**SQL injection filter:** `isBlocked()` — regex-based keyword filter intended to block SQL injection payloads. **Design flaw (intentional):** patterns require whitespace on both sides of keywords, making them bypassable by removing leading whitespace (e.g. `'OR` → no space before `OR`).

**No rate limiting** found on any backend endpoint. **[Inference: omitted as an unintended gap rather than a deliberate design choice, given that CTF1 and CTF2 both have rate limiting.]**

**Source evidence:** `CTFs/CTF_3_HR-system/backend/routes/api.php`; `CTFs/CTF_3_HR-system/backend/app/Http/Controllers/EmployeeController.php` `isBlocked()` function.

#### 3.3.6 Test Coverage

No automated test suite found in `CTFs/CTF_3_HR-system/`. No `test/` directory, no PHPUnit configuration, no `phpunit.xml` or `tests/` directory contents identified.

**Source evidence:** Directory listing of `CTFs/CTF_3_HR-system/` and `CTFs/CTF_3_HR-system/backend/`; absence of test files confirmed.

#### 3.3.7 Configuration and Metadata

**`CTFs/CTF_3_HR-system/credentials.json`:** Per-player credential bundles (usernames and passwords for seeded players).

**`CTFs/CTF_3_HR-system/SETUP_CREDENTIALS.md`:** Setup instructions for deploying player-specific credentials.

**No formal `ctf-config.json`** file found. Difficulty and points are documented only in `README.md`.

**Source evidence:** `CTFs/CTF_3_HR-system/credentials.json`; `CTFs/CTF_3_HR-system/README.md`.

---

### 3.4 CTF4 — CTF_4_corporate_helpdesk

#### 3.4.1 Architecture

**Runtime stack:**
- **Frontend:** React 18 + Vite + TypeScript (port 5174)
- **Backend:** Node.js + Express + TypeScript (port 4001)
- **Database:** PostgreSQL 15 (Docker, host port 5433 → container port 5432)
- **Queue:** Redis 7 (Docker, host port 6380 → container port 6379) + BullMQ job queue
- **Bot worker:** Playwright headless Chromium (automated admin browser session)
- **All services containerised** via Docker Compose

**Source evidence:** `CTFs/CTF_4_corporate_helpdesk/docker-compose.yml`; `CTFs/CTF_4_corporate_helpdesk/README.md`; `CTFs/CTF_4_corporate_helpdesk/package.json`.

**Application modules (`apps/`):**
```
apps/
├── web/       — React frontend (KnowledgeBase.tsx, Report.tsx, Captures.tsx, ...)
├── api/       — Express backend (routes, middleware, db, services)
└── bot/       — BullMQ worker + Playwright bot
```

**Vite proxy:** `/api` → `http://api:4001` (Docker service name resolution).

#### 3.4.2 Vulnerability Design

**Vulnerability class:** DOM-based XSS via `eval()` and `innerHTML`, exploited through an automated admin bot (browser automation)

**Vulnerability location:** `CTFs/CTF_4_corporate_helpdesk/apps/web/src/pages/KnowledgeBase.tsx`

**Vulnerable code** (`headerCallbackRef` — a React callback ref on the page header `<h2>` element):
```tsx
const headerCallbackRef = useCallback((node: HTMLHeadingElement | null) => {
  if (node) {
    const urlParams = new URLSearchParams(window.location.search);
    const rawSearch = urlParams.get('search') || '';

    // Vector 1: innerHTML XSS
    node.innerHTML = 'Results for "' + rawSearch + '"';

    // Vector 2: eval() XSS — primary intended path
    const callback = urlParams.get('callback');
    if (callback) {
      eval(callback);
    }
  }
}, [searchTerm, selectedTag]);
```

**Two XSS vectors:**
1. **`innerHTML` injection** (via `search` parameter) — permits HTML/script injection
2. **`eval()` injection** (via `callback` parameter) — permits direct arbitrary JavaScript execution; this is the **intended solution path**

**OWASP Mapping:** A03:2021 — Injection (DOM-based XSS); A07:2021 — Identification and Authentication Failures (bot's admin session exploited).

**Source evidence:** `CTFs/CTF_4_corporate_helpdesk/apps/web/src/pages/KnowledgeBase.tsx` lines 1–60; `CTFs/CTF_4_corporate_helpdesk/SOLUTION.md` lines 1–80.

#### 3.4.3 Exploit Path

Full chain (5 actors: player → report system → bot → admin endpoint → exfil endpoint):

1. **Discover XSS:** Navigate to `/kb?callback=alert(1)` → alert fires, confirming `eval(callback)` execution
2. **Confirm bot:** Submit a test payload via `POST /api/report` that POSTs to `/api/exfil/capture` → check `/captures` to confirm bot executed it
3. **Discover `_reportId`:** After bot visit, the Report page card shows the "Bot visited URL" field including `&_reportId=X` appended by the bot
4. **Discover admin endpoint:** `GET /api/admin/flag?reportId=1` returns HTTP 403 with a hint message confirming the endpoint exists and accepts `reportId`
5. **Craft final payload:**

```javascript
fetch('/api/admin/flag?reportId='.concat(
  new URLSearchParams(location.search).get('_reportId')
)).then(function(r) {
  return r.json()
}).then(function(d) {
  fetch('/api/exfil/capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: d,
      reportId: new URLSearchParams(location.search).get('_reportId')
    })
  })
})
```

6. **Submit report** with URL: `http://localhost:5174/kb?callback=<encoded_payload>`
7. **Read captured flag** at `/captures` page

**Critical encoding constraint:** The `+` character in URL query strings decodes as a space (RFC 1866), breaking string concatenation. The payload **must use `.concat()` instead of `+`** for string operations. This is documented as a key learning objective.

**Flag format:** `CTF{user_<username>_<16-char-hex>}` (e.g. `CTF{user_abcd12_8bb73ad76fdd80e0}`)

**Source evidence:** `CTFs/CTF_4_corporate_helpdesk/SOLUTION.md` lines 80–200; `CTFs/CTF_4_corporate_helpdesk/flags.json`.

#### 3.4.4 Flag System

**Storage:** PostgreSQL `users` table, `flag` column — one row per player, flag stored at registration/seed time.

**Seed data** (`CTFs/CTF_4_corporate_helpdesk/flags.json`):
```json
{
  "admin": "CTF{admin_default_flag}",
  "abcd12": "CTF{user_abcd12_8bb73ad76fdd80e0}",
  "efgh34": "CTF{user_efgh34_80eb85d81b52e9ca}",
  "ijkl56": "CTF{user_ijkl56_1fb81908a0e8ba91}"
}
```

**Flag delivery mechanism:** `GET /api/admin/flag?reportId=X` (admin-only) → queries DB for the user who submitted report X → returns their `flag` field. The admin bot (Playwright, logged in as admin) calls this endpoint when the XSS payload fires, then the payload exfiltrates the flag to `/api/exfil/capture`.

**Flag format note:** CTF4 uses a different flag prefix (`CTF{...}`) compared to CTF1–3 (`durham{...}`, `durham-pm{...}`, `durham-hr{...}`). This is a metadata inconsistency discussed in Section 6.

**Source evidence:** `CTFs/CTF_4_corporate_helpdesk/flags.json`; `CTFs/CTF_4_corporate_helpdesk/SOLUTION.md`.

#### 3.4.5 Access Controls and Rate Limiting

**Bot URL validation** (`apps/api/src/routes/report.ts`):
```typescript
const urlObj = new URL(url, 'http://localhost:5173');
if (!urlObj.pathname.startsWith('/kb')) { ... }  // rejects non-/kb URLs
```

**Documented unintended vulnerabilities** (`CTFs/CTF_4_corporate_helpdesk/workflow.md`):

| ID | Issue | Location |
|----|-------|----------|
| V1 | No login rate limiting | `apps/api/src/routes/auth.ts` |
| V2 | Default JWT secret fallback (hardcoded in source) | `apps/api/src/middleware/auth.ts` |
| V3 | Internal bot update endpoint unauthenticated | `apps/api/src/routes/report.ts` |
| V4 | URL validation checks pathname only, not host (SSRF) | `apps/api/src/routes/report.ts` |
| V5 | Cross-user capture leakage via NULL `reportId` | `apps/api/src/routes/exfil.ts` |
| V6 | Undocumented public `/api/collect` endpoint | `apps/api/src/routes/collect.ts` |
| V7 | PostgreSQL port 5433 exposed to host with default creds | `docker-compose.yml` |
| V8 | Redis port 6380 exposed with no authentication | `docker-compose.yml` |
| V9 | No rate limiting on `POST /api/report` | `apps/api/src/routes/report.ts` |
| V10 | No rate limiting on `POST /api/exfil/capture` | `apps/api/src/routes/exfil.ts` |
| V11 | No input size limits on any endpoint | Multiple routes |

The `workflow.md` file documents all 11 unintended vulnerabilities with file locations and descriptions — demonstrating active vulnerability management practice.

**Source evidence:** `CTFs/CTF_4_corporate_helpdesk/workflow.md` lines 1–100.

#### 3.4.6 Bot Implementation

**Stack:** Playwright headless Chromium, BullMQ worker, `concurrency: 1`

**Bot behaviour sequence:**
1. Receives job from BullMQ queue (triggered by `POST /api/report`)
2. Launches Playwright browser in headless mode
3. Logs in with admin credentials → establishes authenticated session
4. Appends `_reportId=<report_id>` to the reported URL
5. Navigates to the modified URL
6. Captures all `console.*` output and stores in `bot_console_logs` on the report
7. Updates `visited_url` field on the report with the full URL visited (including `_reportId`)
8. Job completes; browser closes

**Design significance:** The bot simulates a real-world scenario where a security team member reviews reported links (e.g. a phishing/URL review workflow). This grounds the challenge in an authentic threat model (XSS-as-CSRF via automated admin action).

**Source evidence:** `CTFs/CTF_4_corporate_helpdesk/apps/bot/` (read in prior sessions); `CTFs/CTF_4_corporate_helpdesk/SOLUTION.md` Step 3 description.

#### 3.4.7 Test Coverage

No automated test suite found in `CTFs/CTF_4_corporate_helpdesk/`. No Jest, Playwright test, or Mocha configuration found.

**Source evidence:** Directory listing and file search across `CTFs/CTF_4_corporate_helpdesk/`.

#### 3.4.8 Configuration and Metadata

**`ctf-config.json`:** Markdown-format file (not parseable JSON) containing:
- Name: "IntraDesk Knowledge Base - DOM XSS"
- Type: Web Security / DOM-based XSS
- Difficulty: Medium
- 4 hints (search reflection, DevTools inspection, bot behaviour, cookie access)

**`docker-compose.yml`:** Multi-service definition for web (port 5174), api (port 4001), db (port 5433), redis (port 6380), bot worker.

**Source evidence:** `CTFs/CTF_4_corporate_helpdesk/ctf-config.json`; `CTFs/CTF_4_corporate_helpdesk/docker-compose.yml`.

---

## 4. Cross-Challenge Comparative Analysis

### 4.1 Difficulty Progression

| CTF | Difficulty | Stages | Attack Complexity | Infrastructure Complexity |
|-----|-----------|--------|------------------|--------------------------|
| CTF1 | Easy | 1 | Cookie decode + re-encode in browser DevTools | Single process, no database |
| CTF2 | Intermediate | 2 | SHA-256 PoW computation + JWT library usage | Two processes (frontend + backend), no database |
| CTF3 | Intermediate/Advanced | 4 | Multi-technique chain: source inspection → SQL injection → decryption | Three tiers: frontend + backend + PostgreSQL (Docker) |
| CTF4 | Advanced | 3+ | DOM XSS payload crafting + URL encoding constraints + asynchronous data flow | Full microservices: frontend + API + DB + Redis + bot (all Docker) |

The difficulty progression follows a structured escalation across four dimensions: (1) the number of exploitation stages, (2) the depth of technical knowledge required, (3) the complexity of the infrastructure, and (4) the subtlety of the vulnerability (cookie tampering → PoW + JWT → multi-class injection → DOM XSS).

### 4.2 Vulnerability Class Coverage

| CTF | Primary Vulnerability | OWASP Category | Real-World Analogue |
|-----|----------------------|----------------|---------------------|
| CTF1 | Unsigned session cookie | A01, A02 | Many legacy session management systems (PHP `$_SESSION`, unsigned cookies) |
| CTF2 | Weak secret exposure via PoW | A02, A07 | Weak JWT secrets, API key leakage via debug endpoints |
| CTF3 | SQL injection (filter bypass) | A03 | WAF bypass techniques in real penetration testing |
| CTF4 | DOM XSS + bot escalation | A03, A07 | Stored/reflected XSS in SPA frameworks, XSS-to-account-takeover via CSRF |

Together, the four CTFs cover OWASP Top 10 categories A01, A02, A03, A05, and A07 — providing broad coverage of the most prevalent web vulnerability classes.

### 4.3 Flag System Architecture Comparison

| CTF | Storage | Format | Prefix | Generation | Deterministic |
|-----|---------|--------|--------|-----------|--------------|
| CTF1 | Flat JSON file | `durham{<16-hex>_<user>}` | `durham` | HMAC-SHA256(salt, user)[:16] | Yes |
| CTF2 | Flat JSON file → vault sync | `durham-pm{<20-hex>_<user>}` | `durham-pm` | HMAC-SHA256(salt, user)[:20] | Yes |
| CTF3 | Flat JSON file → DB | `durham-hr{<20-hex>_<user>}` | `durham-hr` | SHA256(user:timestamp:random)[:20] | **No** |
| CTF4 | PostgreSQL (direct) | `CTF{user_<user>_<16-hex>}` | `CTF` | Pre-seeded hex tokens | N/A |

**Notable observations:**
1. CTF1–3 use a common `durham`-prefixed flag family with challenge-specific sub-prefixes; CTF4 uses the generic `CTF{...}` format — a consistency gap (see Section 6).
2. CTF3's non-deterministic generation (random bytes + timestamp) means flags cannot be regenerated from usernames alone; this requires careful credential management.
3. Token lengths increase from CTF1 (16 chars = 64-bit) to CTF2/3 (20 chars = 80-bit) — **[Inference: reflects increased concern about brute-forcing as challenge complexity increases.]**

### 4.4 Per-User Flag Personalisation

All four CTFs implement per-user flag personalisation: each player receives a unique flag tied to their username. This design decision:

1. **Prevents flag sharing:** Submitting another player's flag does not count as a valid solve for the sharing player
2. **Enables attribution:** Each submitted flag identifies its legitimate owner
3. **Increases realism:** Real-world targets often have user-specific secrets (session tokens, API keys, personal data)

### 4.5 Technology Stack Evolution

The technology stack complexity escalates deliberately:

- **CTF1:** Single-process Node.js + EJS — suitable for complete beginners; no build step required
- **CTF2:** Introduces a React/Vite SPA frontend + separate backend process — requires understanding of browser-to-API communication
- **CTF3:** Introduces a typed PHP/Laravel backend + PostgreSQL — requires understanding of server-side MVC architecture and relational databases
- **CTF4:** Full microservices with Docker Compose — introduces containerisation, message queues, browser automation, and multi-service debugging

### 4.6 Test Coverage Comparison

| CTF | Test Framework | Test Count | Coverage Level |
|-----|---------------|-----------|----------------|
| CTF1 | Jest + supertest | 4 tests | Basic access control smoke tests |
| CTF2 | None (validation script only) | 0 formal | `check_pw.js` manual bcrypt validation |
| CTF3 | None | 0 | Not tested |
| CTF4 | None | 0 | Not tested |

**Observation:** Test coverage drops sharply after CTF1. This may reflect increasing time constraints during development of more complex challenges. **[Inference: CTF1 received dedicated testing attention as the foundational challenge; later challenges were developed with less formal verification.]**

---

## 5. Methodology Evidence Extraction

This section maps challenge design features to explicit methodological decisions, providing evidence for dissertation methodology claims.

### 5.1 Realistic Application Contexts

Each CTF is embedded in a realistic application scenario rather than a naked vulnerability:

| CTF | Scenario | Realism Features |
|-----|----------|-----------------|
| CTF1 | University module access system | Login form, student/admin roles, grade-like protected content |
| CTF2 | Password manager SaaS | Vault UI, password masking, client-side AES-GCM encryption, bcrypt hashing |
| CTF3 | Corporate HR system | Employee directory, department structure, JWT auth, multi-tier architecture |
| CTF4 | Corporate helpdesk / knowledge base | Ticket reporting, bot review workflow, admin moderation, exfiltration tracking |

**Evidence:** README.md files for each challenge; application UI code; the presence of non-exploitable but realistic features (CTF2 vault crypto; CTF3 employee management).

### 5.2 Progressive Hint Disclosure

Two challenges implement explicit hint systems:

- **CTF1:** `attemptTracker.js` + `forbidden.ejs` — hint shown after ≥4 failed `/flag` attempts (evidence of player frustration mitigation)
- **CTF4:** `ctf-config.json` contains 4 graded hints (from vague "search pages reflect input" to specific "cookies accessible via JS"); `/captures` page shows a permanent endpoint hint box

**[Inference for CTF2/3:** No explicit in-application hint systems found; hints may have been delivered through external documentation or instructor guidance.]

**Source evidence:** `CTFs/Basic_1_Nodejs/src/services/attemptTracker.js`; `CTFs/CTF_4_corporate_helpdesk/ctf-config.json`.

### 5.3 Deliberate Vulnerability Scoping

The vulnerability surfaces are deliberately scoped to ensure the challenge is solvable through the intended exploit path without requiring overly deep technical knowledge:

- **CTF1:** The multi-strategy cookie decoder (`authCookie.js`) ensures the challenge works even if players encode the cookie slightly differently
- **CTF2:** Difficulty=4 PoW (4 leading hex zeros) is computationally feasible in a browser console (typically <1 second) — not a hard barrier
- **CTF3:** The SQL filter `isBlocked()` is deliberately naive; the bypass (`'OR 1=1--`) is one of the simplest possible SQL injection payloads
- **CTF4:** The `_reportId` is made discoverable through the Report UI (not requiring blind exfiltration), reducing the gap between "XSS fires" and "flag captured"

**Source evidence:** `CTFs/Basic_1_Nodejs/src/middleware/authCookie.js`; `CTFs/CTF_2_pswd_manager/server/index.js`; `CTFs/CTF_3_HR-system/backend/app/Http/Controllers/EmployeeController.php`; `CTFs/CTF_4_corporate_helpdesk/SOLUTION.md`.

### 5.4 Unintended Vulnerability Awareness

The repository demonstrates active awareness of unintended vulnerabilities:

- **CTF4 `workflow.md`:** Catalogues 11 unintended vulnerabilities (V1–V11) with file paths, technical descriptions, and a fix workflow section
- **CTF1 login rate limiting:** `loginRateLimiter.js` was explicitly added to prevent brute-force bypass of the intended cookie-tampering path
- **CTF2 login persistence:** Login attempts persisted to disk to survive server restarts (vs CTF1's in-memory approach)

This documents a methodology of **post-design vulnerability auditing** — writing challenges and then systematically reviewing for unintended solve paths.

**Source evidence:** `CTFs/CTF_4_corporate_helpdesk/workflow.md`; `CTFs/Basic_1_Nodejs/src/middleware/loginRateLimiter.js`.

### 5.5 Challenge Generation System — Evidence of Scalability Design

The shared `CTFs/challenge-generation/` system provides evidence of a design for multi-player deployment:

- `generate_credentials.js` — generates per-player usernames in the format `[A-Za-z]{4}[0-9]{2}` (6-char alphanumeric)
- Generator modules for CTF1, CTF2, CTF3 — all accept a `salt` parameter, allowing different deployments to use different flag spaces
- CTF1/CTF2 generators: deterministic (HMAC-SHA256) — flags can be regenerated from usernames if lost
- CTF3 generator: non-deterministic (random bytes + timestamp) — flags must be persisted after generation

**Source evidence:** `CTFs/challenge-generation/generate_credentials.js`; `CTFs/challenge-generation/generators/basic1_generator.js`; `CTFs/challenge-generation/generators/ctf2_generator.js`; `CTFs/challenge-generation/generators/ctf3_generator.js`.

### 5.6 Security Realism vs. Pedagogical Accessibility

The project balances two competing design goals:

**Realism features:** bcrypt hashing (CTF2), JWT with `httpOnly` cookies (CTF2/CTF3), PostgreSQL relational database (CTF3/CTF4), Docker microservices (CTF3/CTF4), client-side AES-GCM encryption (CTF2), Playwright headless browser automation (CTF4)

**Accessibility features:** Multi-strategy cookie decoder (CTF1), progressive hints (CTF1/CTF4), accessible PoW difficulty (CTF2), deliberately naive SQL filter (CTF3), discoverable `_reportId` mechanism (CTF4), detailed SOLUTION.md files for each challenge

The co-presence of both sets of features demonstrates a deliberate design philosophy: build environments that look and feel like real systems while ensuring the intended exploit path remains within reach of the target audience.

---

## 6. Gaps and Missing Evidence

This section identifies areas where the repository lacks documentation or evidence that would strengthen the dissertation methodology.

### 6.1 Design Decision Rationale

**Gap:** No document in the repository explains *why* specific vulnerabilities were chosen for each CTF, or what alternatives were considered and rejected.

**Example questions without answers in the repository:**
- Why was CTF2 designed around PoW+JWT rather than, e.g., a broken password reset flow?
- Why was CTF3 given four flags instead of two or three?
- What criteria determined the mapping from challenge number to difficulty level?

**Recommendation:** A `DESIGN_RATIONALE.md` per challenge documenting the pedagogical and technical motivation for each vulnerability choice would address this gap.

### 6.2 Pilot Testing / User Evaluation

**Gap:** No evidence of pilot testing with real participants. No solve-time data, player feedback forms, error logs from real runs, or post-challenge debrief results are present in the repository.

**Impact on dissertation:** Without empirical player data, methodology claims about "challenge solvability" and "appropriate difficulty" remain theoretical rather than evidenced.

**Recommendation:** Document any pilot testing sessions, including: participant background, solve rates, average solve times, common misconceptions observed, and changes made in response.

### 6.3 Ethical Safeguards Documentation

**Gap:** No formal ethics documentation — no consent forms, no data handling policies, no IRB/ethics committee approval records, no participant anonymisation procedures.

**Impact:** Any human participant testing requires institutional ethics approval for a master's dissertation.

### 6.4 Automated Test Coverage for CTF2–4

**Gap:** Formal automated tests exist only for CTF1 (4 Jest tests). CTF2–4 have no automated test suites.

**Impact:** Cannot verify that the intended exploit path continues to work after code changes without manually running through the full exploit chain.

**Recommendation:** At minimum, integration tests that verify: (a) the vulnerable route is reachable, (b) the protected route correctly rejects non-exploiting access, and (c) the flag is returned for a valid exploit.

### 6.5 Flag Format Inconsistency

**Gap:** CTF1–3 use `durham{...}` / `durham-pm{...}` / `durham-hr{...}` prefixes, but CTF4 uses the generic `CTF{...}` prefix.

**Evidence:** `CTFs/Basic_1_Nodejs/ctf-config.json` (`"flagFormat": "durham{.*}"`); `CTFs/CTF_4_corporate_helpdesk/flags.json` (`"CTF{user_abcd12_...}"`).

**Impact:** Inconsistency in flag format reduces the sense of a coherent challenge series and may confuse players or automated flag validators.

### 6.6 No `ctf-config.json` for CTF2

**Gap:** CTF2 (`CTF_2_pswd_manager`) lacks a `ctf-config.json` file, unlike CTF1 (has it) and CTF4 (has markdown variant). There is no machine-readable challenge metadata for CTF2.

### 6.7 CTF3 Non-Deterministic Flag Generation

**Gap:** The CTF3 generator (`ctf3_generator.js`) is non-deterministic (includes `Date.now()` and `crypto.randomBytes()`). This means:
- Flags cannot be reconstructed from username + salt alone
- If `flags.json` is lost or corrupted, flags cannot be regenerated
- There is no seed/salt parameter to make the output reproducible

**Contrast:** CTF1 and CTF2 generators are fully deterministic (HMAC-SHA256 with configurable salt), allowing flags to be regenerated at any time.

**Recommendation:** Add a `seed` parameter to `ctf3_generator.js` that replaces the random bytes component, enabling deterministic regeneration from a stored seed.

### 6.8 Discarded Alternative Approaches

**Gap:** No documentation of alternative vulnerability designs that were considered but rejected, e.g. CSRF attacks, SSRF-only challenges, deserialization vulnerabilities, or file upload vulnerabilities.

**Impact:** Without this, the dissertation cannot claim that the chosen vulnerability set was selected through a deliberate, principled process.

### 6.9 Deployment / Operational Documentation

**Gap:** CTF3 and CTF4 lack a unified "operator's guide" explaining how to deploy the challenge for a class of 20–100 students simultaneously, including how to distribute per-player credentials, reset state between runs, and monitor for cheating.

---

## 7. Appendix: File Map

This appendix lists all source files read and analysed in this document, organised by challenge.

### 7.1 CTF1 — Basic_1_Nodejs (`CTFs/Basic_1_Nodejs/`)

| File | Purpose |
|------|---------|
| `ctf-config.json` | Challenge metadata (id, difficulty, points, flagFormat) |
| `package.json` | Node.js dependencies and scripts |
| `README.md` | Challenge description and setup instructions |
| `SOLUTIONS.md` | Full walkthrough and vulnerability explanation |
| `src/app.js` | Express app factory; middleware and route mounting |
| `src/server.js` | HTTP server entry point |
| `src/config/index.js` | Centralised configuration |
| `src/routes/index.js` | Login routes (GET `/`, POST `/login`) |
| `src/routes/public.js` | Home page route (GET `/home`) |
| `src/routes/flag.js` | Protected flag route (GET `/flag`) |
| `src/controllers/publicController.js` | Home page renderer |
| `src/controllers/flagController.js` | Flag lookup and role check |
| `src/middleware/authCookie.js` | **VULNERABLE** cookie decoder (no signature verification) |
| `src/middleware/loginRateLimiter.js` | Per-IP login rate limiter |
| `src/middleware/logger.js` | Request logger |
| `src/middleware/errorHandler.js` | Global error handler |
| `src/services/flagService.js` | Flag lookup with fuzzy match |
| `src/services/userServices.js` | User authentication |
| `src/services/attemptTracker.js` | Per-session flag access counter |
| `src/data/flags.json` | Per-user flag store (3 users) |
| `src/data/users.json` | User credentials (3 users) |
| `src/views/index.ejs` | Login page template |
| `src/views/home.ejs` | Post-login home page |
| `src/views/flag.ejs` | Flag display page |
| `src/views/forbidden.ejs` | 403 page with progressive hint |
| `src/views/lockout.ejs` | Rate limit lockout page with countdown |
| `src/views/partials/header.ejs` | Shared header partial |
| `src/views/partials/footer.ejs` | Shared footer partial |
| `test/app.test.js` | Jest/supertest test suite (4 tests) |

### 7.2 CTF2 — CTF_2_pswd_manager (`CTFs/CTF_2_pswd_manager/`)

| File | Purpose |
|------|---------|
| `readme.md` | Challenge description |
| `package.json` | Workspace package definition |
| `vite.config.ts` | Vite dev server + proxy configuration |
| `index.html` | HTML entry point |
| `check_pw.js` | Manual bcrypt validation script |
| `server/index.js` | Express backend: auth, JWT, PoW, vault API (449 lines) |
| `server/data/users.json` | Seeded users (abcd12, test12, flag12) |
| `server/data/flags.json` | Per-user flags |
| `server/data/vaults.json` | Vault entries (including flag entries) |
| `server/data/deleted_flags.json` | Tracks deleted flag vault entries |
| `src/main.tsx` | React app entry point |
| `src/features/auth/pages/LoginPage.tsx` | Login UI |
| `src/features/challenge/pages/ChallengePage.tsx` | PoW challenge UI |
| `src/features/vault/pages/VaultPage.tsx` | Vault manager UI |
| `src/lib/crypto.ts` | Client-side PBKDF2 + AES-GCM vault encryption |

### 7.3 CTF3 — CTF_3_HR-system (`CTFs/CTF_3_HR-system/`)

| File | Purpose |
|------|---------|
| `README.md` | Challenge setup and description |
| `CTF_SOLUTION.md` | Full 4-flag walkthrough with decryption scripts |
| `SETUP_CREDENTIALS.md` | Credential deployment instructions |
| `docker-compose.yml` | PostgreSQL 16 container definition |
| `flags.json` | Per-user flags (+ `flag12` → `"HIDDEN_EMPLOYEE"` marker) |
| `credentials.json` | Per-player credential bundles |
| `backend/routes/api.php` | Laravel API route definitions |
| `backend/app/Http/Controllers/FlagController.php` | Per-user flag endpoint |
| `backend/app/Http/Controllers/DebugController.php` | **VULNERABLE** debug endpoint (credentials.json reader) |
| `backend/app/Http/Controllers/EmployeeController.php` | **VULNERABLE** employee search (SQL injection) |
| `frontend/src/utils/legacyAuth.ts` | **VULNERABLE** hardcoded secret key in comment |

### 7.4 CTF4 — CTF_4_corporate_helpdesk (`CTFs/CTF_4_corporate_helpdesk/`)

| File | Purpose |
|------|---------|
| `README.md` | Challenge setup and description |
| `SOLUTION.md` | Full step-by-step exploit walkthrough (341 lines) |
| `ctf-config.json` | Challenge metadata (markdown format) |
| `docker-compose.yml` | Multi-service container definition |
| `flags.json` | Seeded per-user flags (4 entries) |
| `credentials.json` | Player credentials |
| `workflow.md` | Unintended vulnerability audit (11 findings) |
| `apps/web/src/pages/KnowledgeBase.tsx` | **VULNERABLE** KB page (innerHTML + eval XSS) |
| `apps/web/src/pages/Report.tsx` | URL report submission UI |
| `apps/web/src/pages/Captures.tsx` | Exfiltrated data viewer |
| `apps/api/src/routes/report.ts` | Report submission API + URL validation |
| `apps/api/src/routes/exfil.ts` | Exfiltration capture endpoint |
| `apps/api/src/routes/collect.ts` | Undocumented collection endpoint (V6) |
| `apps/api/src/middleware/auth.ts` | JWT middleware (V2: default secret fallback) |
| `apps/bot/` | BullMQ worker + Playwright bot implementation |

### 7.5 Challenge Generation System (`CTFs/challenge-generation/`)

| File | Purpose |
|------|---------|
| `README.md` | Generation system documentation |
| `package.json` | npm scripts: `generate-flags`, `generate-flags-basic1`, etc. |
| `chgen_basic1.js` | Flag generator CLI for CTF1 |
| `chgen_ctf2.js` | Flag generator CLI for CTF2 |
| `chgen_ctf3.js` | Flag generator CLI for CTF3 |
| `generate_credentials.js` | Per-player credential bundle generator |
| `generators/basic1_generator.js` | HMAC-SHA256 token generator (16 chars, deterministic) |
| `generators/ctf2_generator.js` | HMAC-SHA256 token generator (20 chars, deterministic) |
| `generators/ctf3_generator.js` | SHA256 + random bytes token generator (20 chars, non-deterministic) |

---

*End of CTF_REPO_ANALYSIS.md*
