# Basic Node.js Web CTF Challenge

This repository contains a beginner-friendly web security Capture The Flag challenge built using Node.js and Express. The site is designed to teach common web-security mistakes such as broken authentication, insecure client-side session storage and privilege escalation.

The challenge is browser-first — participants should be able to complete it using only a web browser and its developer tools.

---

## Quick start

1. Install dependencies

```bash
cd CTFs/Basic_1_Nodejs
npm install
```

2. Start the server (development)

```bash
npm run dev
```

If port 3000 is in use you can start on a different port:

```bash
PORT=3001 npm run dev
```

Open the site at http://localhost:3000 (or the port you chose).

---

## What the app provides

- Login page `/` (login form)
- Home page `/home` (for any logged-in user)
- Admin-only page `/flag` (contains the challenge flag)
- Insecure session cookie (intentionally unsigned/unencrypted)
- An example rate-limiter middleware to prevent brute-force by IP

Notes about developer/testing mode

- The application supports a development compatibility mode for testing tolerant username lookups and synthesized flags. Start the server with the environment variable `CTF_DEV=1` to enable fuzzy matching and dev flag generation:

```bash
CTF_DEV=1 npm run dev
```

In normal mode (default), flag lookup requires an exact username match in `src/data/flags.json`.

This repository is intentionally vulnerable in limited, well-documented ways as part of a learning exercise. The `SOLUTIONS.md` file contains hints and the full walkthrough for instructors/markers.

---

## Challenge-generation and per‑student flags

This repo includes a small challenge-generation area intended to produce per-student flags. The generator scripts live in `CTFs/challenge-generation/`.

- To generate per-player artifacts (full templated CTFs) the chgen tooling expects a `template/` folder inside an example directory and is driven by scripts such as `chgen_basic1.js`.
- For flags-only generation (the common case for marking), you can run the generator in `challenge-generation` to produce a JSON mapping of student IDs to flags. Example (from the `challenge-generation` folder):

```bash
# flags-only generator (writes flags.json used by the running CTF)
node chgen_basic1.js basic1_server_config.json

# If you want to generate per-player copies from a template the full chgen flow
# requires a `template/` folder inside an example directory and a different
# generator script; see `CTFs/challenge-generation/` for examples.
```

The generated flags mapping is written to `CTFs/Basic_1_Nodejs/src/data/flags.json` (or to another central file depending on the generator). Use this mapping to verify submissions: markers compare the student-submitted flag string against the generated entry for the student's ID.

---

## Notes about templates & presentation

- The app uses EJS templates (server-side) located in `src/views/` and shared partials under `src/views/partials/`.
- Static assets (CSS) are served from `src/public/`.
- The login, home, flag and lockout pages are implemented with Bootstrap (CDN) and a small `custom.css` file for branding.

---

## Security/behaviour notes

- The session cookie is intentionally insecure for the exercise (students should discover and exploit this). Do not use this code in production.
- Rate limiting is implemented per-IP in `src/middleware/loginRateLimiter.js`. This is an in-memory implementation suitable for single-instance teaching setups. For production or clustered deployments use a shared store such as Redis.
- Error handling: server errors are intentionally not leaked to players; the app returns a generic JSON error for server-side exceptions.

---

## Developer tips

- To add or update per-student flags, edit the `CTFs/challenge-generation/basic1_server_config.json` players list (add `username` and `token`) and run the generator.
- After running the generator, confirm the mapping is written to `CTFs/Basic_1_Nodejs/src/data/flags.json`.
- The session cookie format is intentionally simple for the exercise: it is a Base64 encoding of a JSON object `{ "username": "<id>", "role": "<role>" }`. Use the browser devtools to inspect and edit this cookie during the challenge (the UI exposes a `/whoami` endpoint for quick inspection during development).
- To change branding, edit `src/public/css/custom.css` (colors are defined as `--ctf-primary` and `--ctf-secondary`).
- To convert more pages to templates, add EJS files under `src/views/` and call `res.render()` from controllers.

---

## References

External sources and libraries used by this project:

- Bootstrap CSS / JS (CDN) — styling and components
  - https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css
  - https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js
- jsDelivr CDN — CDN provider for Bootstrap
  - https://www.jsdelivr.com/
- EJS — embedded JavaScript templates
  - https://ejs.co/
- Express — web framework for Node.js
  - https://expressjs.com/
- Node.js — runtime environment
  - https://nodejs.org/
- Navigator.clipboard (MDN) — used for copy-to-clipboard feature
  - https://developer.mozilla.org/en-US/docs/Web/API/Navigator/clipboard

Local/in-repo references

- Challenge-generation documentation and examples: `CTFs/challenge-generation/README.md`
- Solution walkthrough: `SOLUTIONS.md`

If you need additional attribution added (paper references, lecture slides, or other libraries), tell me which sources to include and I'll append them.
