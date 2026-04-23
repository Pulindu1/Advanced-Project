# CTF 5 — Challenge-Generation Alignment: Fix Plan

Bring CTF 5 in line with the challenge-generation pattern used by
CTFs 2, 3, 6, 7, 8, 9: `[a-z]{4}[0-9]{2}` player usernames with
generated random passwords, and per-user deterministic HMAC flags —
one set per player, not a single shared set.

## 1. Problem summary

Three things are wrong, all on the application side. The generator
itself is already correct.

1. `credentials.json` and `flags.json` contain a hand-authored
   `testuser` + `testpass123` stub instead of being fully regenerated
   from `chgen_ctf5.js` output.
2. At runtime the app collapses flag3 and flag4 to a *single, shared*
   value picked from the **first** user in `flags.json`:
   - `app/seed.py:47–55` writes only the first user's flag4 to
     `/app/secret/flag.txt`.
   - `app/__init__.py:50–55` sets only the first user's flag3 as
     `WAF_FLAG3` in the process environment.
   So only one player in the roster can ever score flag3 / flag4.
3. A hardcoded `admin` user with the literal password
   `NovaCMS_Adm1n!2024` is baked into `app/seed.py:26`, not driven
   from `credentials.json`.

The pytest suite pins `testuser` / `testpass123` in
`tests/conftest.py:17–36`, so the tests will break the moment the
generator overwrites `credentials.json`.

## 2. Current-state map

| File | Lines | What it does | Status |
|---|---|---|---|
| `challenge-generation/chgen_ctf5.js` | all | Generates per-user `flags.json` + `credentials.json` with `[a-z]{4}[0-9]{2}` usernames, HMAC flags, random passwords. | **OK — keep** |
| `challenge-generation/generators/ctf5_generator.js` | 18–26 | `generateFlag(username, flagNum)` — HMAC-SHA256 with `novacms-ctf5-2026-flag<N>` subsalt, deterministic. | **OK — keep** |
| `CTF_5_internal_blog/credentials.json` | — | Hand-edited; contains `testuser`. | Regenerate |
| `CTF_5_internal_blog/flags.json` | — | Hand-edited; contains `testuser` flags. | Regenerate |
| `app/seed.py` | 26–29 | Hardcoded admin user with literal password. | Refactor |
| `app/seed.py` | 47–55 | Writes first user's flag4 to `/app/secret/flag.txt`. | Refactor to per-user fan-out |
| `app/__init__.py` | 50–55 | Writes first user's flag3 to `os.environ['WAF_FLAG3']`. | Refactor to per-user fan-out |
| `app/routes/preview.py` | (to audit) | SSTI sink that reads `os.environ['WAF_FLAG3']`. | Audit: must resolve the current player's var |
| `app/routes/blog.py` or similar | (to audit) | LFI sink that reads under `/app/secret/`. | Audit: must resolve current player's file |
| `tests/conftest.py` | 17–36 | Hardcodes `testuser` / `testpass123`. | Rewrite as `credentials.json`-driven fixture |
| `tests/test_*.py` | — | References `testuser`. | Swap to fixture |
| `docker-compose.yml` | 12–13 | RO-mounts `flags.json` + `credentials.json`. | Keep — but regeneration is now a pre-step |

## 3. Design

Follow CTF 8's "generate per-user artefacts; scoring is byte-exact
against the logged-in player's own flag" model:

- **Flag 1 / Flag 2**: already per-user via the `Flag` table rows.
  No runtime change needed once the JSON files are regenerated.
- **Flag 3 (SSTI → `os.environ`)**: replace the single
  `WAF_FLAG3` with one `WAF_FLAG3_<USERNAME_UPPER>` per player.
  The SSTI payload constructed against the logged-in player's own
  username resolves their own flag; a player who reads another
  user's var only gets credit if the submitted flag happens to
  match their own username.
- **Flag 4 (LFI → `/app/secret/`)**: write one
  `/app/secret/flag_<username>.txt` per player. Same scoring
  principle.
- **Admin user**: model on CTF 8's `STAFF_ACCOUNTS`. Moved into
  `chgen_ctf5.js`, role `admin`, password `SYSTEM_INTERNAL`
  sentinel that will not authenticate through the normal login.
- **Tests**: `conftest.py` loads `credentials.json` and picks a
  deterministic player entry (first alphabetical, or a fixed
  player the generator always emits for test stability — see
  open question 3 below).

The exploit *mechanics* (SSTI with WAF v2 bypass for flag3, LFI
for flag4) are unchanged. Only the names / paths vary by user.

## 4. Implementation workflow

Done in this order; each phase is self-contained and should leave
the repo in a runnable state.

### Phase 1 — staff accounts in the generator

**Files:** `challenge-generation/chgen_ctf5.js`

- Add a `STAFF_ACCOUNTS` constant mirroring CTF 8's block with a
  single entry: `admin`, role `admin`, password `SYSTEM_INTERNAL`,
  `active: true`, description "NovaCMS administrator — seeded for
  realism; not a player account".
- In `main()`, merge `STAFF_ACCOUNTS` into the `credentials.json`
  output alongside the generated player entries.
- Do **not** add flag entries for staff — they are not players.

### Phase 2 — seed.py refactor

**Files:** `app/seed.py`

- Delete the inline admin block (`seed.py:26–29`).
- In the `creds_data` loop (currently `seed.py:33–37`), branch on
  role: for `admin`, store the bcrypt hash of `SYSTEM_INTERNAL` —
  the login route's credential check remains unchanged, so the
  sentinel simply never matches a real supplied password.
- Replace the "first flag4 → single file" block
  (`seed.py:47–55`) with a loop that, for every user with a
  `flag4` entry in `flags_data`, writes
  `/app/secret/flag_<username>.txt` containing that user's flag4
  token. Keep the `secret_dir` creation.
- Optional: remove the legacy `/app/secret/flag.txt` path
  altogether (no longer referenced).

### Phase 3 — app init refactor

**Files:** `app/__init__.py`

- Replace the single-env block (`__init__.py:50–55`) with a loop
  that sets `WAF_FLAG3_<USERNAME.upper()>` for every user that has
  a `flag3` in `flags.json`. Keep the `setdefault` semantics so
  existing process-env values from a prior run are not clobbered
  on reload.
- Decide on uppercase vs lowercase in the env-var suffix before
  coding — the SSTI payload the player must construct depends on
  this. Match whichever form Phase 4 settles on.

### Phase 4 — exploit-path audit and plumbing

**Files:** `app/routes/preview.py`, any WAF filter module, any
route that exposes `/app/secret` via LFI.

- Read `preview.py` and confirm the SSTI payload can reach
  `os.environ['WAF_FLAG3_<player>']` from within the template
  context. Confirm the WAF v2 filter does not newly blacklist the
  expanded name (underscore, username characters).
- Read the LFI sink and confirm a player authenticated as
  `abcd12` can construct a path that resolves to
  `/app/secret/flag_abcd12.txt`. If the sink was implicitly
  coded for a single `flag.txt`, add the per-user path
  construction.
- If either exploit breaks, record the change needed and surface
  it as a pre-coding decision — do not silently paper over it.

### Phase 5 — tests

**Files:** `tests/conftest.py`, `tests/test_auth.py`, any other
test that names `testuser` or `testpass123`.

- Introduce a `player` fixture in `conftest.py` that loads
  `credentials.json`, filters to `role == 'editor'`, picks the
  lexicographically-first entry, and yields
  `(username, password)`. Exposed as a pytest fixture consumed
  by every test that previously hardcoded `testuser`.
- Add a sibling `player_flags` fixture that loads `flags.json`
  for the chosen player and yields their flag1–flag4 values, so
  flag-assertion tests can compare against the regenerated
  values.
- Grep for `testuser` / `testpass123` across `tests/` and delete
  every remaining hardcode.

### Phase 6 — regeneration + smoke-run

**Commands (not to run until phases 1–5 are approved):**

```bash
# wipe stale seed data
rm CTFs/CTF_5_internal_blog/credentials.json
rm CTFs/CTF_5_internal_blog/flags.json
rm -f CTFs/CTF_5_internal_blog/secret/flag*.txt

# regenerate
cd CTFs/challenge-generation
node chgen_ctf5.js abcd12 efgh34 ijkl56

# rebuild + run
cd ../CTF_5_internal_blog
docker compose down
docker compose up --build
```

Then, logged in as `abcd12`, `efgh34`, and `ijkl56` in turn,
hand-solve each of flag1–flag4 and confirm the submitted flag
is byte-identical to `flags.json[username][flagN]`.

### Phase 7 — doc sweep

**Files:** `CTFs/CTF_5_internal_blog/README.md`,
`Evaluation/llm/doc-pack/ctf5.md`,
`Evaluation/llm/manual/ctf5.md`.

- Remove any reference to `testuser` / `testpass123` /
  `NovaCMS_Adm1n!2024` as player credentials (keep the admin
  sentinel mention if the story requires it).
- Update the "seeded users" tables to the `[a-z]{4}[0-9]{2}`
  placeholder pattern with "see `credentials.json`" for the
  password.
- If the doc-pack / manual prompts quoted the old flag format or
  first-user-only assumption, refresh them.

## 5. Verification

- `pytest` green.
- Determinism: running `chgen_ctf5.js abcd12 efgh34 ijkl56` twice
  produces byte-identical `flags.json`.
- For every player: flag1 (recon) + flag2 (SSTI v1) + flag3
  (SSTI v2 with env bypass) + flag4 (LFI / RCE to
  `/app/secret/flag_<username>.txt`) all solvable, all
  byte-exact to the regenerated JSON.
- Admin account cannot authenticate through `/login`.

## 6. Risks / open questions to resolve before coding

1. **SSTI payload shape.** The new env-var name is
   `WAF_FLAG3_<USERNAME>` (case TBD). If the WAF v2 blocklist
   forbids `_` in payload bodies, or the Jinja sandbox already in
   use rejects `getattr`-style key construction, the intended
   exploit breaks. Audit `preview.py` before Phase 3 settles the
   casing.
2. **Admin role surface.** Does anywhere in the app grant
   `role == 'admin'` special access that a player could reach?
   The sentinel password blocks `/login`, but if an admin-only
   route exists and is reachable another way, it becomes a new
   attack surface. Audit during Phase 2.
3. **Test player selection.** Two options: (a) pick the
   first-alphabetical player from `credentials.json`, (b) have
   the generator emit a fixed dev-test player (e.g. always
   include `test12`) alongside whatever the CLI asked for. Option
   (a) is simpler; option (b) gives stable CI. Decide before
   Phase 5.
4. **Stale `/app/secret/flag.txt`.** If any legacy code still
   reads the literal path, removing it breaks those paths. Grep
   for the string before Phase 2 finishes.

## 7. Not in scope

- Changes to flag1 / flag2 mechanics — they are already per-user.
- Changes to the generator's HMAC salts or token length — they
  are consistent with the other CTFs.
- Any UX work from the existing `workflow.md` (that doc covers a
  separate onboarding / progression refresh).
