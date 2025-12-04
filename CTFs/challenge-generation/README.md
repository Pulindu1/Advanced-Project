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

Automation notes

- The generator does not (and should not) modify the running server process. After regenerating `CTFs/Basic_1_Nodejs/src/data/flags.json`, restart the Basic_1_Nodejs server so it loads the new file.
- If you want flags to be generated automatically whenever `users.json` changes, add a deploy/CI step or a local watcher that runs the generator after changes are committed.

Security notes

- Tokens are deterministic by design so they can be reproduced from username + salt. Keep salts secret if you need unpredictability.

