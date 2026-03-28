# CTF_4 — Unintended Vulnerability Audit

---

## Findings

### V1 — No login rate limiting (brute force)
`POST /api/auth/login` has no rate limiting. Unlimited password guesses allowed per IP.
**File:** `apps/api/src/routes/auth.ts`

---

### V2 — Default JWT secret fallback
```ts
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
```
If `JWT_SECRET` is unset, the hardcoded default is public in the source. Anyone can forge a valid admin JWT.
**Files:** `apps/api/src/middleware/auth.ts`, `apps/api/src/routes/auth.ts`

---

### V3 — Internal bot update endpoint is unauthenticated
`PUT /api/report/internal/update/:reportId` has no auth. Any player can call it to:
- Mark any report as `visited`
- Inject arbitrary `visited_url` and `console_logs` into any report

The code itself notes: *"should ideally be behind internal network only or use a shared secret"*
**File:** `apps/api/src/routes/report.ts`

---

### V4 — URL validation checks pathname only, not host (SSRF)
```ts
const urlObj = new URL(url, 'http://localhost:5173');
if (!urlObj.pathname.startsWith('/kb')) { ... }
```
`http://evil.com/kb` passes validation. The bot visits the external URL as an authenticated admin — unintended SSRF.
**File:** `apps/api/src/routes/report.ts`

---

### V5 — Cross-user capture leakage via NULL reportId
```ts
WHERE (r.user_id = $1 OR e.report_id IS NULL)
```
Every exfil capture stored without a `reportId` is visible to every authenticated user.
**File:** `apps/api/src/routes/exfil.ts`

---

### V6 — Undocumented public `/api/collect` endpoint
`GET /api/collect?d=...` and `POST /api/collect` store arbitrary data to `exfil_logs` with no auth,
no rate limiting, and no `reportId`. All entries appear in every user's My Captures page (via V5).
Not listed in `/api/routes`.
**File:** `apps/api/src/routes/collect.ts`

---

### V7 — PostgreSQL port 5433 exposed to host
```yaml
ports:
  - "5433:5432"
```
Players can connect directly with the default credentials and read all flags and users. Completely bypasses the exploit chain.
**File:** `docker-compose.yml`

---

### V8 — Redis port 6380 exposed with no auth
```yaml
ports:
  - "6380:6379"
```
No `requirepass` set. Players can connect with `redis-cli -p 6380`, read the BullMQ job queue, inject jobs, or delete pending ones.
**File:** `docker-compose.yml`

---

### V9 — No rate limiting on `POST /api/report`
Unlimited report submissions per user. Can flood the BullMQ queue and block other players' jobs.
**File:** `apps/api/src/routes/report.ts`

---

### V10 — No rate limiting on `POST /api/exfil/capture`
Public endpoint with no limit. Can be spammed to fill the `exfil_logs` table.
**File:** `apps/api/src/routes/exfil.ts`

---

### V11 — No input size limits
No max-length enforced on:
- `url` in report submission
- `data` in exfil capture
- `d` query param in `/api/collect`
**Files:** `apps/api/src/routes/report.ts`, `apps/api/src/routes/exfil.ts`, `apps/api/src/routes/collect.ts`

---

## Fix Workflow

---

### Fix V1 — Login rate limiting

**Package:** `express-rate-limit` (install if not present in `apps/api/package.json`)
**File:** `apps/api/src/routes/auth.ts`

Add a limiter before the login handler:
```ts
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // 10 attempts per IP
  message: { error: 'Too many login attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, async (req, res) => { ... });
```

---

### Fix V2 — Enforce JWT secret at startup

**File:** `apps/api/src/index.ts`

Add a guard in `start()` before the server boots:
```ts
const INSECURE_DEFAULT = 'your-super-secret-jwt-key';

async function start() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === INSECURE_DEFAULT) {
    console.error('JWT_SECRET is not set or uses the insecure default. Exiting.');
    process.exit(1);
  }
  // ...
}
```

Then remove the `|| 'your-super-secret-jwt-key'` fallback in `middleware/auth.ts` and `routes/auth.ts`, replacing with `process.env.JWT_SECRET!`.

---

### Fix V3 — Shared secret on internal bot update endpoint

**Files:** `apps/api/src/routes/report.ts`, `apps/bot/src/index.ts`, `docker-compose.yml`, `.env.example`

1. Add `INTERNAL_SECRET=<random>` to `.env.example` and to the `bot` service environment in `docker-compose.yml`.
2. In `report.ts`, guard the `PUT /internal/update/:reportId` handler:
```ts
const secret = req.headers['x-internal-secret'];
if (!secret || secret !== process.env.INTERNAL_SECRET) {
  return res.status(403).json({ error: 'Forbidden' });
}
```
3. In `bot/src/index.ts`, add the header to both `axios.put` calls:
```ts
headers: { 'x-internal-secret': process.env.INTERNAL_SECRET }
```

---

### Fix V4 — Restrict report URL to localhost only

**File:** `apps/api/src/routes/report.ts`

Extend the existing validation to also check `hostname`:
```ts
const urlObj = new URL(url, 'http://localhost:5173');
const allowedHosts = ['localhost', '127.0.0.1'];
if (!allowedHosts.includes(urlObj.hostname)) {
  return res.status(400).json({ error: 'Only localhost KB URLs can be reported' });
}
if (!urlObj.pathname.startsWith('/kb')) {
  return res.status(400).json({ error: 'Only KB URLs can be reported' });
}
```

---

### Fix V5 — Remove cross-user NULL capture leakage

**File:** `apps/api/src/routes/exfil.ts` — `GET /my-captures`

Remove the `OR e.report_id IS NULL` clause:
```sql
-- Before
WHERE (r.user_id = $1 OR e.report_id IS NULL)

-- After
WHERE r.user_id = $1
```

---

### Fix V6 — Remove `/api/collect`

`/api/collect` duplicates `/api/exfil/capture` and is not part of the intended CTF flow.

**Preferred:** Delete `apps/api/src/routes/collect.ts` entirely. In `apps/api/src/index.ts`, remove:
- `import collectRoutes from './routes/collect';`
- `app.use('/api/collect', collectRoutes);`

---

### Fix V7 — Remove PostgreSQL external port

**File:** `docker-compose.yml`

Remove the `ports` block from the `db` service entirely. The API container reaches it
via internal Docker DNS (`db:5432`). Players on the host can no longer connect directly.

```yaml
# Remove this from the db service:
ports:
  - "5433:5432"
```

---

### Fix V8 — Remove Redis external port and add auth

**File:** `docker-compose.yml`, `.env.example`, `docker-compose.yml` bot/api environments

1. Remove `ports: - "6380:6379"` from the `redis` service.
2. Add password auth:
```yaml
redis:
  image: redis:7-alpine
  command: redis-server --requirepass ${REDIS_PASSWORD:-changeme}
```
3. Add `REDIS_PASSWORD=changeme` to `.env.example`.
4. Update `REDIS_URL` in the `api` and `bot` service environments:
```
redis://:${REDIS_PASSWORD}@redis:6379
```

---

### Fix V9 — Rate limit report submission

**File:** `apps/api/src/routes/report.ts`

```ts
const reportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many reports submitted. Slow down.' },
  keyGenerator: (req: any) => String(req.user?.id ?? req.ip),
});

router.post('/', authenticate, reportLimiter, async (req, res) => { ... });
```

Note: `authenticate` must run before `reportLimiter` so `req.user` is available for the key generator.

---

### Fix V10 — Rate limit exfil capture

**File:** `apps/api/src/routes/exfil.ts`

The bot also calls this endpoint, so the limit must be loose:
```ts
const captureRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,   // loose — bot may call multiple times per job
  message: { error: 'Rate limit exceeded' },
});

router.post('/capture', captureRateLimit, async (req, res) => { ... });
```

---

### Fix V11 — Input size limits

**File:** `apps/api/src/index.ts` (global) + per-route guards

Global: tighten the JSON body limit:
```ts
app.use(express.json({ limit: '16kb' }));
```

Per-route field checks:
- `report.ts`: `if (!url || url.length > 2048) return res.status(400).json({ error: 'URL too long' });`
- `exfil.ts`: `if (JSON.stringify(data).length > 8192) return res.status(400).json({ error: 'Data too large' });`

---

## Priority Order

| Priority | ID | Finding | Severity | Effort |
|---|---|---|---|---|
| 1 | V7 | DB port exposed | Critical | Remove 2 lines in docker-compose |
| 2 | V8 | Redis port + no auth | Critical | Remove port, add requirepass, update URLs |
| 3 | V3 | Unauthenticated internal endpoint | Critical | Add shared secret to bot + API |
| 4 | V6 | Undocumented /collect endpoint | High | Delete the file and import |
| 5 | V2 | Default JWT secret | High | Add startup guard, remove fallback |
| 6 | V4 | SSRF via URL validation | High | Add hostname check |
| 7 | V1 | Login brute force | High | Add rate limiter |
| 8 | V5 | Cross-user capture leakage | Medium | Remove IS NULL clause |
| 9 | V9 | Report submission flooding | Medium | Add rate limiter |
| 10 | V10 | Exfil capture flooding | Medium | Add rate limiter |
| 11 | V11 | No input size limits | Low | Add length checks + tighten body limit |
