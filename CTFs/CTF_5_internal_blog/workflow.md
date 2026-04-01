# CTF5 NovaCMS -- UX & Progression Workflow

This document describes six design improvements to the NovaCMS CTF that address player onboarding, hint clarity, flag progression, and discoverability. Each issue contains the rationale, affected files, and step-by-step implementation instructions.

---

## Issue 1 -- Player Onboarding Modal

### Problem
Players land on the dashboard with no context about how many flags exist, what the flag format is, or what difficulty to expect. This wastes time and leads to missed flags.

### Solution
Add a one-time onboarding banner/modal that appears on the first visit to `/dashboard` within a session. It should:

- Display the total number of flags (4).
- Show the flag format: `durham-cms-flagN{...}` where N is 1-4.
- Describe the three difficulty tiers:
  - **Recon** (Flag 1) -- inspect the application surface.
  - **Exploit** (Flags 2 & 3) -- leverage template injection with increasing WAF difficulty.
  - **RCE** (Flag 4) -- achieve remote code execution on the server.
- Dismiss on click and not reappear for the rest of the session (use `session['onboarded'] = True`).

### Files to Change

| File | Change |
|------|--------|
| `app/routes/blog.py` | In the `dashboard()` view, set `show_onboarding = not session.get('onboarded')`. On POST (dismiss), set `session['onboarded'] = True`. Pass `show_onboarding` to the template. |
| `app/templates/dashboard.html` | Add a dismissible banner/modal gated on `{{ show_onboarding }}`. Content: flag count, format, difficulty tiers. Dismiss button sends POST to `/dashboard` or uses JS to hide + set a cookie. |
| `app/templates/base.html` | (Optional) Add minimal CSS for the modal overlay if not using inline styles. |

### Implementation Steps

1. In `blog.py`, modify the `dashboard` route to accept GET and POST. On GET, compute `show_onboarding`. On POST with `action=dismiss_onboarding`, set `session['onboarded'] = True` and redirect.
2. In `dashboard.html`, add a `{% if show_onboarding %}` block at the top of the content area containing:
   ```html
   <div class="onboarding-banner">
     <h2>Welcome to NovaCMS CTF</h2>
     <p>There are <strong>4 flags</strong> to find.</p>
     <p>Flag format: <code>durham-cms-flagN{...}</code></p>
     <ul>
       <li><strong>Recon</strong> (Flag 1) -- explore the app surface</li>
       <li><strong>Exploit</strong> (Flags 2 &amp; 3) -- template injection, WAF bypass</li>
       <li><strong>RCE</strong> (Flag 4) -- remote code execution</li>
     </ul>
     <form method="post"><button name="action" value="dismiss_onboarding">Got it</button></form>
   </div>
   ```
3. Style the banner with a distinct background colour and border so it stands out.
4. Verify: log in, see banner on first dashboard load, dismiss it, refresh -- banner should not reappear.

---

## Issue 2 -- Flag 1 HTML Comment Hints

### Problem
Flag 1 requires sending `X-Debug-Token: novacms-internal` to `/api/status`, but the only breadcrumb is a single HTML comment in `editor.html`. Players who don't inspect source on that exact page will miss it entirely.

### Solution
Place HTML comment hints across multiple templates so players discover them through normal source-view behaviour. Each comment should feel like a developer note, not an obvious CTF clue.

### Files to Change

| File | Hint to Add |
|------|-------------|
| `app/templates/base.html` | `<!-- NovaCMS v2.1.0-beta | internal API: /health -->` in the `<head>` |
| `app/templates/login.html` | `<!-- Auth endpoint hardened Q3 2024 -- see /health for service status -->` near the login form |
| `app/templates/dashboard.html` | `<!-- Dashboard v2 | debug endpoints still active (see /api/*) -->` near the top |
| `app/templates/editor.html` | Already has `<!-- Debug: /api/status with X-Debug-Token: novacms-internal -->` -- keep as-is |

### Implementation Steps

1. Open `base.html` and add the comment inside `<head>`, after `<title>`.
2. Open `login.html` and add the comment directly above or below the `<form>` tag.
3. Open `dashboard.html` and add the comment near the opening `{% block content %}`.
4. The progression should be: `base.html` hints at `/health` (which itself returns the debug token hint in its JSON response) -> `/health` response mentions `X-Debug-Token` -> player tries `/api/status` with the header -> Flag 1.
5. Verify: view page source on login, dashboard, and editor pages; confirm each comment is present and the hint chain is followable.

### Hint Chain Summary

```
base.html (/health mention)
    -> GET /health (returns JSON with debug_token_hint)
        -> GET /api/status + X-Debug-Token: novacms-internal
            -> Flag 1
```

---

## Issue 3 -- Flag 2 SECRET_KEY Clarity

### Problem
When a player types `{{config}}` on the v1 (unfiltered) preview endpoint, they see the full Flask config dump. The `SECRET_KEY` value (`novacms-dev-2024`) is visible, but there's no signal that this value IS Flag 2. Players may see it and move on without submitting it.

### Solution
Add an in-app signal that the `SECRET_KEY` is worth submitting as a flag. This should be subtle enough to reward attentive players.

### Files to Change

| File | Change |
|------|--------|
| `app/templates/editor.html` | Add an HTML comment: `<!-- Note: app SECRET_KEY is the CMS master credential -- flag2 -->` |
| `app/static/CHANGELOG.md` | Add a changelog entry: `- [SECURITY] Rotated SECRET_KEY. Old value was being used as internal auth token (flag2). Ensure new key is not committed.` |
| `app/routes/api.py` | In the `/health` JSON response, add a field: `"config_note": "SECRET_KEY rotation pending -- current key may be a flag"` |

### Implementation Steps

1. In `editor.html`, add the HTML comment near the preview section, making it look like a developer TODO.
2. In `CHANGELOG.md`, add the entry under a new `## v2.1.0-beta` heading so it looks like a recent change.
3. In `api.py`, add the `config_note` field to the `/health` response JSON.
4. Verify: inspect editor source and find the comment, read CHANGELOG.md (from `/static/CHANGELOG.md`), and check `/health` JSON.

---

## Issue 4 -- Flag 3 v2 Endpoint Motivation

### Problem
Players can get Flags 1 and 2 entirely on the v1 (unfiltered) preview endpoint. There's no narrative or mechanical reason for them to switch to v2 (WAF-filtered), which is required for Flag 3. Players may not realise v2 exists or why they'd use it.

### Solution
Create an in-app trigger that pushes players toward the v2 endpoint after they've explored v1. Two approaches, implement both:

**Approach A -- v1 Deprecation Notice:**
After the player uses v1 preview a certain number of times (e.g., 5), inject a deprecation notice into the preview response.

**Approach B -- Editor UI Nudge:**
The editor template should show the v1/v2 toggle prominently, with v2 labelled as "Production Preview (WAF-protected)" and v1 as "Legacy Preview (deprecated)".

### Files to Change

| File | Change |
|------|--------|
| `app/routes/preview.py` | Track v1 usage count in the session. After 5 uses, prepend a deprecation HTML banner to the rendered output: `<div class="deprecation">Warning: /preview (v1) is deprecated. Use /preview/v2 for production-safe rendering.</div>` |
| `app/templates/editor.html` | Restyle the v1/v2 toggle. Label v1 as "Legacy (deprecated)" with a strikethrough or muted style. Label v2 as "Production Preview". Add a tooltip or small text: "v2 includes WAF protection -- required for production posts." |
| `app/static/CHANGELOG.md` | Add entry: `- [DEPRECATION] /preview (v1) endpoint scheduled for removal. All new posts must use /preview/v2 with WAF validation.` |

### Implementation Steps

1. In `preview.py`, at the top of the v1 `/preview` route handler:
   ```python
   session['v1_count'] = session.get('v1_count', 0) + 1
   deprecation = ''
   if session['v1_count'] >= 5:
       deprecation = '<div class="deprecation-notice">&#9888; /preview (v1) is deprecated. Switch to /preview/v2.</div>'
   # ... render as before, prepend deprecation to output
   ```
2. In `editor.html`, update the version toggle buttons:
   - v1 button: `Legacy Preview (deprecated)` with `style="opacity:0.6; text-decoration: line-through"` or similar.
   - v2 button: `Production Preview` with normal styling.
   - Add small helper text below the toggle: "v2 applies WAF filtering required for production."
3. In `CHANGELOG.md`, add the deprecation notice entry.
4. Verify: use v1 preview 5+ times and see the deprecation banner appear; confirm v2 label is prominent in editor.

---

## Issue 5 -- CHANGELOG.md Discoverability

### Problem
`CHANGELOG.md` sits in `/static/` and contains critical breadcrumbs for Flag 3 (WAF blocked keywords list). But players have no reason to look for it unless they guess the URL.

### Solution
Add multiple in-app references that lead players to discover the CHANGELOG.

### Files to Change

| File | Hint to Add |
|------|-------------|
| `app/templates/base.html` | Add a footer link: `<a href="/static/CHANGELOG.md">Changelog</a>` styled as a subtle footer nav item |
| `app/templates/editor.html` | Add HTML comment: `<!-- See /static/CHANGELOG.md for WAF update notes -->` near the preview toggle |
| `app/routes/api.py` | In `/health` JSON, add: `"changelog": "/static/CHANGELOG.md"` |
| `app/templates/dashboard.html` | Add a small "v2.1.0-beta" version badge in the header/nav that links to the changelog |

### Implementation Steps

1. In `base.html`, add a `<footer>` section (if not present) with a link to `/static/CHANGELOG.md`. Style it to look like a normal CMS footer with version info.
2. In `editor.html`, add the HTML comment near the v1/v2 toggle.
3. In `api.py`, add the `changelog` key to the `/health` response.
4. In `dashboard.html`, add a version badge (e.g., `<span class="version-badge"><a href="/static/CHANGELOG.md">v2.1.0-beta</a></span>`) in the page header or navigation area.
5. Verify: the changelog is reachable from at least 3 discovery paths (footer link, `/health` JSON, page source comment).

### Discovery Paths Summary

```
Path A: Footer link on every page -> /static/CHANGELOG.md
Path B: /health JSON -> "changelog": "/static/CHANGELOG.md"
Path C: editor.html source -> HTML comment referencing CHANGELOG
Path D: Dashboard version badge -> links to CHANGELOG
```

---

## Issue 6 -- Flag 4 RCE Scaffolding

### Problem
Flag 4 requires a full RCE chain (`lipsum.__globals__.__builtins__.__import__('os').popen('cat /app/secret/flag.txt').read()`) with WAF bypass hex encoding. This is a massive jump from Flag 3 (which only required reading `os.environ`). Players who solve Flag 3 may not know how to escalate to file read/RCE.

### Solution
Build progressive scaffolding so that each flag teaches a skill needed for the next:

- **Flag 2** teaches: SSTI exists, `{{config}}` works, template expressions are evaluated.
- **Flag 3** teaches: WAF bypass with hex encoding (`\x5f\x5f` for `__`), `|attr()` filter, and accessing `os.environ` via `lipsum`.
- **Flag 4** needs: extending the Flag 3 chain to `__import__('os').popen('cat ...').read()`.

The bridge from Flag 3 -> Flag 4 needs explicit in-app hints.

### Files to Change

| File | Change |
|------|--------|
| `app/static/CHANGELOG.md` | Add entries that hint at file system access: `- [SECURITY] Removed direct file path references from error pages. Flag files relocated to /app/secret/` and `- [TODO] Audit popen/system calls in template sandbox` |
| `app/templates/editor.html` | Add HTML comment: `<!-- SECURITY: template sandbox does NOT prevent os.popen() -- see /app/secret/ for sensitive files -->` |
| `app/routes/preview.py` | When the WAF blocks a v2 request, include a hint in the error response: `"Blocked keywords: see CHANGELOG.md for the full list. Note: hex encoding (\x5f) may bypass checks."` |
| `app/seed.py` | In the "Security Audit Notes" blog post body, add a paragraph: `"Audit finding: Jinja2 sandbox does not restrict os.popen() or subprocess calls. Sensitive files under /app/secret/ must be protected at the OS level."` |

### Implementation Steps

1. In `CHANGELOG.md`, add the two new entries under the existing headings. The `/app/secret/` path hint tells players where to look. The `popen/system` mention tells them what tool to use.
2. In `editor.html`, add the HTML comment near the preview area.
3. In `preview.py`, modify the WAF block response in the v2 route:
   ```python
   if not waf.check_input(body):
       return jsonify({
           'error': 'Input blocked by WAF',
           'hint': 'Blocked keywords listed in /static/CHANGELOG.md. Hex encoding (\\x5f\\x5f) can represent blocked characters.'
       }), 403
   ```
4. In `seed.py`, update the "Security Audit Notes" post body to include the audit finding about `os.popen()` and `/app/secret/`.
5. Verify: trigger a WAF block on v2 and check the error response contains the hint; read the Security Audit Notes post and find the popen/secret reference; check CHANGELOG for the new entries.

### Progression Chain Summary

```
Flag 2: {{config}} on v1
  -> learns: SSTI works, expressions are evaluated

Flag 3: WAF bypass on v2 -> os.environ
  -> learns: hex encoding bypasses WAF, |attr() accesses attributes, lipsum.__globals__ reaches builtins
  -> CHANGELOG shows blocked keywords (tells them what to encode)

Flag 4: RCE on v2 -> cat /app/secret/flag.txt
  -> needs: extend Flag 3 chain with __import__('os').popen('cat /app/secret/flag.txt').read()
  -> hints from: CHANGELOG (popen/system audit, /app/secret/ path), editor comment, WAF error message, Security Audit blog post
```

---

## Implementation Priority

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 1 | Issue 1 (Onboarding) | Low | High -- prevents player confusion from the start |
| 2 | Issue 2 (Flag 1 Hints) | Low | High -- most common point where players get stuck |
| 3 | Issue 5 (CHANGELOG Discovery) | Low | High -- unlocks both Flag 3 and Flag 4 hint chains |
| 4 | Issue 4 (v2 Motivation) | Medium | High -- critical bridge between Flags 2 and 3 |
| 5 | Issue 3 (Flag 2 Clarity) | Low | Medium -- prevents players skipping over the flag value |
| 6 | Issue 6 (Flag 4 Scaffolding) | Medium | Medium -- helps advanced players complete the final flag |

---

## Testing Checklist

After implementing all issues, verify the following end-to-end player journey:

1. [ ] Log in -> onboarding banner appears with flag count, format, and difficulty tiers.
2. [ ] Dismiss banner -> it does not reappear on refresh.
3. [ ] View page source on login/dashboard/editor -> find HTML comments hinting at `/health`.
4. [ ] `GET /health` -> JSON contains debug token hint, config note, and changelog path.
5. [ ] `GET /api/status` with `X-Debug-Token: novacms-internal` -> **Flag 1**.
6. [ ] Type `{{config}}` in editor, preview with v1 -> see `SECRET_KEY`. Editor source and CHANGELOG confirm it's Flag 2 -> **Flag 2**.
7. [ ] After 5 v1 uses, deprecation notice appears. Editor labels push toward v2.
8. [ ] Visit `/static/CHANGELOG.md` (discoverable from footer, `/health`, editor source) -> see WAF blocked keywords + hex bypass hint.
9. [ ] Use WAF bypass payload on v2 to read `os.environ` -> **Flag 3**.
10. [ ] CHANGELOG mentions `popen`/`/app/secret/`. Security Audit post confirms. WAF error hints at hex encoding.
11. [ ] Use RCE payload on v2 to `cat /app/secret/flag.txt` -> **Flag 4**.
