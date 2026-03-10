# CTF_4 — Issue Improvement Workflow

Three UX/documentation issues were identified. This document records root-cause analysis and exact changes required per file.

---

## Issue 1 — Captures Page Subtitle Is Too Vague

### Problem

The current subtitle on `My Captures` reads:

> *"View data captured from your submitted reports"*

This tells the player nothing useful. Players who stumble onto the page before completing the challenge have no idea what "captures" actually are or why this page matters to their goal.

### Goal

Rewrite the subtitle to:
- Hint that this page is where **results of successful scripts land**
- Imply that something with access to privileged data could *send* data here
- Not reveal that the data is a flag, or that the mechanism is XSS + bot

### File

`apps/web/src/pages/Captures.tsx`

### Change

**Current (line 46–48):**
```tsx
<h1>My Captures</h1>
<p style={{ color: '#666', marginBottom: '2rem' }}>
  View data captured from your submitted reports
</p>
```

**New:**
```tsx
<h1>My Captures</h1>
<p style={{ color: '#666', marginBottom: '2rem' }}>
  If a script running elsewhere on this system sends data to the capture
  endpoint, it will appear here. Think of it as your personal drop box —
  anything posted here under your session is yours to read.
</p>
```

**Why this works without spoiling:**  
The player now understands the *purpose* of the page (a drop box for in-session script output) without being told what to send or how to trigger it. The phrase "a script running elsewhere" nudges them toward the bot mechanic without naming it.

---

## Issue 2 — Remove Inaccurate `<b>BOLD</b>` Test from SOLUTION.md

### Problem

The SOLUTION.md (and previously workflow.md) included this test as "Phase 2a":

```
http://localhost:5174/kb?search=<b>BOLD</b>
```

This **does not work**. The React router / search input sanitises or re-encodes the value before it reaches `innerHTML`. The heading simply shows the literal text `<b>BOLD</b>` rather than rendering bold text. Confirming this test would mislead a solver into thinking innerHTML injection is non-functional.

### Goal

Remove this test entirely. The `callback` parameter (`eval()`) is the intended path and is confirmed by `alert(1)` in Step 1. There is no need for a separate innerHTML test.

The alternative payloads section also has:
```
http://localhost:5174/kb?search=<img+src=x+onerror=alert(1)>
```
This should also be removed or marked clearly as non-functional, as the same issue applies.

### File

`SOLUTION.md`

### Change

Remove the entire "innerHTML-based XSS (search parameter)" entry from the Alternative Payloads section.

Also verify Step 4 in SOLUTION.md — it currently contains messy duplicate URL entries (see Issue 3 below).

---

## Issue 3 — All API URLs Must Use Port 5174 (Vite Proxy)

### Problem

SOLUTION.md Step 4 shows players this URL:

```
http://localhost:4001/api/admin/flag?reportId=1
```

Port 4001 is the **internal Docker API port**, not the player-facing URL. Asking players to use port 4001 breaks the illusion of a real site and requires them to know an internal port number.

### Root Cause

The Vite dev server (`apps/web/vite.config.ts`) already has a proxy configured:

```typescript
proxy: {
  '/api': {
    target: 'http://api:4001',
    changeOrigin: true,
  }
}
```

This means **any request to `http://localhost:5174/api/...` is transparently forwarded to the API**. Port 4001 never needs to be exposed to the player.

The fix is documentation-only — no code changes required.

### File

`SOLUTION.md`

### Changes Required

1. **Step 4** — replace the messy multi-URL block with a single clean URL on port 5174:

Old:
```
http://localhost:4001/api/admin/flag?reportId=1

(http://localhost:4001/api/admin/flag also works)

(http://localhost:5174/api/admin/flag also works)
```

New:
```
http://localhost:5174/api/admin/flag?reportId=1
```

2. **Step 4 rationale** — update any mention of "port 4001" to reference the main app URL.

3. **Step 2 (bot confirmation test)** — the exfil fetch payload in the URL uses `/api/exfil/capture` as a relative path. This is already correct — relative paths go through the Vite proxy automatically. No change needed there.

4. **Quick reference / Any other 4001 references** — replace all remaining `localhost:4001` with `localhost:5174` wherever they appear in SOLUTION.md.

---

## Full File Change List

| File | Change | Issue |
|---|---|---|
| `apps/web/src/pages/Captures.tsx` | Rewrite page subtitle | 1 |
| `SOLUTION.md` | Remove `<b>BOLD</b>` and `<img onerror>` alternative payload entries | 2 |
| `SOLUTION.md` | Replace all `localhost:4001` with `localhost:5174`; clean up Step 4 URL block | 3 |

No backend or Vite config changes required — the proxy is already in place.

---

## Validation After Changes

- [ ] Visit `http://localhost:5174/captures` while logged in — subtitle now reads the new hint text
- [ ] Visit `http://localhost:5174/api/admin/flag?reportId=1` — returns the `403` JSON (confirms proxy works)
- [ ] Visit `http://localhost:5174/api/routes` — returns the route listing JSON
- [ ] SOLUTION.md Step 4 shows only one URL on port 5174
- [ ] SOLUTION.md Alternative Payloads no longer contains the broken innerHTML tests
