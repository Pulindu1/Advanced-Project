# CTF3 Individualised Flags — Workflow

## Problem

CTF3 currently has 4 flags, but only 1 is per-user. The others are shared/static:

| Flag | Current State | Issue |
|------|--------------|-------|
| 1 (Path traversal → `/flag` page) | Hardcoded `durham-hr{w3lc0m3_t0_hr_syst3m}` in `FlagPage.tsx` | Same for all users |
| 2 (Source code → encryption key) | `CTF_2026_SECRET_KEY_XJ9K2L` in `legacyAuth.ts` | This is a **key**, not a flag — shared by design, but currently not a flag at all |
| 3 (SQL injection → hidden employee notes) | Single `flag12` user with one encrypted ciphertext in `credentials.json` | Same ciphertext for everyone → same decrypted flag |
| 4 (API `/flag` endpoint) | Already per-user via `flags.json` + `FlagController` | **Already done** |

## Design

### Per-user flag model

Each player should receive **their own flag values** for all flags. The flag format stays `durham-hr{<hash>_<username>}`.

#### Flag 1 — Path traversal page

**Current:** Hardcoded string in `FlagPage.tsx` React component.

**Change:** Instead of hardcoding the flag in the frontend bundle, the `/flag` page should fetch the flag from the backend API `/api/flag` (which already exists and already returns per-user flags). The page currently displays a static flag value — change it to call `flagApi.get(token)` and display the returned flag.

This preserves the "path traversal" discovery element (finding `/flag` in HTML comments) while making the actual flag per-user. The flag endpoint already requires JWT auth, so the user must be logged in — which matches the existing flow (the page already uses `useAuth()` context).

**Files to change:**
- `frontend/src/pages/FlagPage.tsx` — fetch from API instead of hardcoding

#### Flag 2 — Encryption key discovery

This is intentionally **not a flag itself** — it's a decryption key that enables Flag 3. The key `CTF_2026_SECRET_KEY_XJ9K2L` is shared infrastructure, like finding a password. **No change needed.** It remains the same AES key for all users.

However, currently the e2e tests call this "Flag 2" even though it doesn't produce a `durham-hr{...}` flag. We should clarify: CTF3 has **3 flags** (not 4), with the encryption key being a prerequisite step for Flag 3 (decryption), not a standalone flag.

#### Flag 3 — SQL injection + decryption

**Current:** A single `flag12` user has encrypted notes containing `durham-hr{c3f8a12b4d7e9056fa21_flag12}`. All players who complete the SQL injection + decryption chain get the same flag.

**Change:** Each player gets their own hidden "bot" employee (`<username>-bot`) whose notes contain their per-user encrypted flag. The challenge generator:
1. Creates a per-user encrypted flag using AES-256-CBC with the shared key
2. Stores the encrypted ciphertext in `credentials.json` under `<username>-bot`
3. The seeder creates a hidden employee for each player's bot user

The SQL injection still works the same way — `'OR 1=1--` bypasses the filter and reveals hidden employees — but now each player's bot employee has their own encrypted notes. Players must:
1. Find the encryption key in source code (existing step)
2. SQL inject to reveal their `<username>-bot` hidden employee (modified)
3. Use debug endpoint to get the encrypted data (existing step)
4. Decrypt with the key to get their per-user flag (existing step)

**Files to change:**
- `challenge-generation/generators/ctf3_generator.js` — generate per-user encrypted flags and bot credentials
- `challenge-generation/chgen_ctf3.js` — output updated credentials.json with bot entries
- `backend/database/seeders/DatabaseSeeder.php` — create per-user bot employees instead of single flag12
- `backend/app/Http/Controllers/EmployeeController.php` — update SQL filter to hide `*-bot` usernames instead of just `flag12`

### Updated flag count

After this change, CTF3 has **3 per-user flags**:

| Flag | Vulnerability | Per-user? |
|------|--------------|-----------|
| 1 | Path traversal → `/flag` page (now fetched from API) | Yes |
| 2 | SQL injection → encrypted notes → AES decryption | Yes |
| 3 | API `/flag` endpoint (already per-user) | Yes |

The encryption key discovery is a **prerequisite step** for Flag 2, not a standalone flag.

### Flag numbering note

The current SOLUTIONS.md and e2e tests use a 4-flag numbering. After this remodel:
- Old Flag 1 (path traversal) → **Flag 1** (now per-user via API)
- Old Flag 2 (key discovery) → **prerequisite step** (not a flag)
- Old Flag 3 (SQL injection) + Old Flag 4 (decryption) → **Flag 2** (combined, per-user)
- Old Flag 4 (API endpoint) → **Flag 3** (unchanged)

---

## Implementation Steps

### Step 1 — Update challenge generator

**File:** `CTFs/challenge-generation/generators/ctf3_generator.js`

- Add a new `generateEncryptedFlag(username)` function:
  - Generate a per-user flag: `durham-hr{<hmac_hash>_<username>}` (use HMAC-SHA256 with a fixed secret for determinism, matching other CTFs)
  - Encrypt it with AES-256-CBC using key = SHA256(`CTF_2026_SECRET_KEY_XJ9K2L`)
  - Random IV (16 bytes), prepend as base64
  - Return format: `<iv_base64>:<ciphertext_base64>`
- Update `generateFlags()` to return an object with structure:
  ```json
  {
    "abcd12": {
      "flag_api": "durham-hr{<hash1>_abcd12}",
      "flag_decrypt": "durham-hr{<hash2>_abcd12}"
    }
  }
  ```
  Two separate flag values per user: one for the API endpoint (Flag 1/3), one for the decryption chain (Flag 2).

**File:** `CTFs/challenge-generation/chgen_ctf3.js`

- Update to generate both `flags.json` and `credentials.json`
- `flags.json` structure:
  ```json
  {
    "abcd12": {
      "flag_api": "durham-hr{...}",
      "flag_decrypt": "durham-hr{...}"
    }
  }
  ```
- `credentials.json` structure:
  ```json
  {
    "abcd12": {
      "password": "<random>",
      "employee_id": "EMP001",
      "department": "Engineering",
      "position": "Software Engineer",
      "hire_date": "2025-03-15",
      "monthly_pay": 7500
    },
    "abcd12-bot": {
      "password": "SYSTEM_INTERNAL",
      "employee_id": "BOT001",
      "department": "Operations",
      "position": "System Account",
      "hire_date": "2024-01-01",
      "monthly_pay": 0,
      "notes": "AES-256-CBC encrypted data: <iv>:<ciphertext> (hint: check legacy code for the key)",
      "owner": "abcd12"
    }
  }
  ```
- Remove the single `flag12` entry pattern — replace with per-user `<username>-bot` entries

### Step 2 — Update database seeder

**File:** `CTFs/CTF_3_HR-system/backend/database/seeders/DatabaseSeeder.php`

- Change `flags.json` parsing to handle new nested structure (`flag_api` field for the flags table)
- Replace `flag12` special case with a generic bot-user pattern:
  - Detect bot entries by `-bot` suffix in username (or `owner` field in credentials)
  - For each bot entry: create inactive user, hidden employee with encrypted notes
- Store `flag_api` value in the `flags` table (for the `/api/flag` endpoint)
- The `flag_decrypt` value is embedded encrypted in the bot's employee notes (via credentials.json) — no separate DB storage needed

### Step 3 — Update employee controller SQL filter

**File:** `CTFs/CTF_3_HR-system/backend/app/Http/Controllers/EmployeeController.php`

- Change the SQL `WHERE` clause from `AND u.username != 'flag12'` to `AND u.username NOT LIKE '%-bot'`
- This hides all bot users from normal queries while still making them discoverable via SQL injection

### Step 4 — Update FlagPage to fetch from API

**File:** `CTFs/CTF_3_HR-system/frontend/src/pages/FlagPage.tsx`

- Remove the hardcoded `durham-hr{w3lc0m3_t0_hr_syst3m}` string
- Add a `useEffect` that calls `flagApi.get(token)` and displays the returned flag
- Show a loading state while fetching
- This makes Flag 1 per-user without changing the discovery mechanism

### Step 5 — Update e2e tests

**File:** `CTFs/e2e/ctf3_exploit.py`

- Update `conftest` usage: `load_flags("CTF_3_HR-system", username)` should return the nested flag object
- Flag 1 test: verify the frontend `/flag` page + API returns per-user `flag_api`
- Flag 2 (old 3+4 combined): SQL injection reveals `<username>-bot`, debug endpoint returns encrypted data, decrypt to verify per-user `flag_decrypt`
- Flag 3: API `/api/flag` returns per-user `flag_api`
- Remove old Flag 2 (encryption key) as a standalone "flag" test — keep it as a prerequisite assertion within the Flag 2 decryption test

### Step 6 — Update documentation

**Files:**
- `CTFs/CTF_3_HR-system/README.md` — update flag table, flag count, generation instructions
- `CTFs/CTF_3_HR-system/SOLUTIONS.md` — update exploit steps for new per-user model, bot employee pattern
- `CTFs/e2e/README.md` — update CTF3 row if flag count changed
