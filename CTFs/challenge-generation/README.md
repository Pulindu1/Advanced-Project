# Challenge-generation

This folder contains the small, pluggable flags-only generator used by the Basic_1_Nodejs CTF.

What it does
- Reads usernames from `CTFs/Basic_1_Nodejs/src/data/users.json` by default (or accepts a JSON file path argument).
- For each username it produces a deterministic token and writes `CTFs/Basic_1_Nodejs/src/data/flags.json` containing mapping username -> flag.
- Tokens are generated either by a per-CTF generator module in `generators/<name>_generator.js` or by a deterministic HMAC fallback.

Quick usage

From the repository root:

```bash
# Use the default users.json (recommended):
node CTFs/challenge-generation/chgen_basic1.js

# Or pass an explicit JSON (legacy players.json or users.json):
node CTFs/challenge-generation/chgen_basic1.js CTFs/challenge-generation/<your-config>.json
```

NPM script

In this folder there's an npm script `generate-flags` for convenience. From the repo root you can run:

```bash
cd CTFs/challenge-generation
npm run generate-flags
```

Configuration

- You can control generator behavior with environment variables:
  - `GENERATOR_NAME` - generator module name in `generators/` (default: `basic1`).
  - `GENERATOR_SALT` - salt passed to the generator or HMAC fallback.
  - `GENERATOR_TOKEN_LENGTH` - number of hex characters to emit from the HMAC fallback (default: 16).

- Alternatively, pass a JSON file that contains a `players` array and optional `generator` and `generatorOptions` fields.

Pluggable generators

- Add a module `generators/<name>_generator.js` that exports a function `(username, options) => token`.
- Example: `generators/basic1_generator.js` implements a deterministic HMAC-SHA256-based token generator.

Per-CTF generators

| CTF | Script | Generator | Flag prefix | Output directory |
|-----|--------|-----------|-------------|------------------|
| Basic_1_Nodejs | `chgen_basic1.js` | `basic1_generator.js` | `durham` | `CTFs/Basic_1_Nodejs/` |
| CTF_2_pswd_manager | `chgen_ctf2.js` | `ctf2_generator.js` | `durham-pm` | `CTFs/CTF_2_pswd_manager/` |
| CTF_3_HR-system | `chgen_ctf3.js` | `ctf3_generator.js` | `durham-hr` | `CTFs/CTF_3_HR-system/` |
| CTF_5_internal_blog | `chgen_ctf5.js` | `ctf5_generator.js` | `durham-cms` | `CTFs/CTF_5_internal_blog/` |
| CTF_6_veridian | `chgen_ctf6.js` | `ctf6_generator.js` | `durham-vsec` | `CTFs/CTF_6_veridian/` |
| CTF_7_notes_app | `chgen_ctf7.js` | `ctf7_generator.js` | `durham-ds` | `CTFs/CTF_7_notes_app/` |
| CTF_8_gazette | `chgen_ctf8.js` | `ctf8_generator.js` | `durham-gzflag1`, `durham-gzflag2`, `durham-gzflag3` | `CTFs/CTF_8_gazette/` |

CTF7 (NorthSide Notes) generates:
- `src/data/flags.json` (username to flag mapping)
- `src/data/users.json` (username to credentials mapping)
- `src/data/flag-files/<username>.txt` (per-user flag files read by the exploit payload)

Usage: `node chgen_ctf7.js abcd12 efgh34 ijkl56` or `node chgen_ctf7.js --count 10`

CTF8 (Greystone Gazette) generates:
- `src/data/flags.json` (username to nested `{flag1, flag2, flag3}` object)
- `src/data/users.json` (players merged alongside seeded Gazette staff: Sarah Lin, Tom Ashworth, Priya Kapoor, Marcus Webb)
- `src/data/flag-files/flag3-<username>.txt` (per-user flag file containing the flag and the Riverside Associates memo fragment read by the command injection payload)

Three distinct tokens per player are produced by mixing a per-flag sub-salt (`-flag1`, `-flag2`, `-flag3`) into the base HMAC key.

Usage: `node chgen_ctf8.js abcd12 efgh34 ijkl56` or `node chgen_ctf8.js --count 10`

Automation notes

- The generator does not (and should not) modify the running server process. After regenerating `CTFs/Basic_1_Nodejs/src/data/flags.json`, restart the Basic_1_Nodejs server so it loads the new file.
- If you want flags to be generated automatically whenever `users.json` changes, add a deploy/CI step or a local watcher that runs the generator after changes are committed.

Security notes

- Tokens are deterministic by design so they can be reproduced from username + salt. Keep salts secret if you need unpredictability.

