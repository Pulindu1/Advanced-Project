# CTF 7 -- NorthSide Notes (Insecure Deserialization)

A nostalgic self-hosted note-taking app, built in 2017, still going strong.

**Stack:** Node.js 18 (Express 4), EJS, node-serialize@0.0.4

---

## Quick Start (Docker -- recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/). No Node.js toolchain needed on the host.

**Step 1: Generate player credentials and flags**

```bash
cd CTFs/challenge-generation
node chgen_ctf7.js abcd12 efgh34 ijkl56
```

This writes `flags.json`, `users.json`, and per-user flag files into `CTFs/CTF_7_notes_app/src/data/`.

**Step 2: Start the challenge**

```bash
cd CTFs/CTF_7_notes_app
docker compose up --build
```

- Application: http://localhost:3001
- The flag sync service runs at container start, creating per-user flag files from `flags.json`.

To stop: `docker compose down`
To reset to a clean state: `docker compose down -v && docker compose up --build`

---

## Quick Start (Local Node.js)

Requires Node.js 18+.

```bash
cd CTFs/CTF_7_notes_app
npm install
npm start
```

Application will be available at http://localhost:3001.

---

## Login Credentials (Seeded)

| Username | Password | Role |
|----------|----------|------|
| abcd12 | *(see src/data/users.json)* | user |
| efgh34 | *(see src/data/users.json)* | user |
| ijkl56 | *(see src/data/users.json)* | user |

---

## CTF Flags

**1 flag per user.** Flag format: `durham-ds{...}`

| Flag | Technique | Difficulty |
|------|-----------|------------|
| 1 | Insecure deserialization via node-serialize (CVE-2017-5941) | Basic |

See [SOLUTIONS.md](SOLUTIONS.md) for the complete walkthrough (instructors/markers only).

---

## Challenge Overview

- **Difficulty:** Basic
- **OWASP Mapping:** A08:2021 (Software and Data Integrity Failures), with secondary relevance to A06:2021 (Vulnerable and Outdated Components)
- **CVE:** CVE-2017-5941

Players encounter an abandoned note-taking application running on legacy infrastructure. The application uses the `node-serialize` npm package (version 0.0.4) to parse a Base64-encoded profile cookie. This package contains a known deserialization vulnerability that allows arbitrary code execution via crafted IIFE payloads.

### Learning Outcomes

- Understand insecure deserialization and its impact on application security
- Identify vulnerable dependencies through exposed package metadata and debug endpoints
- Research known CVEs and translate advisory descriptions into working exploits
- Craft IIFE (Immediately Invoked Function Expression) payloads for the `_$$ND_FUNC$$_` deserialization trigger
- Recognise the security risks of abandoned, unmaintained software in production

---

## Vulnerabilities

- Profile cookie parsed by `node-serialize.unserialize()` with no integrity check
- `node-serialize@0.0.4` evaluates `_$$ND_FUNC$$_` prefixed strings via `eval()`
- Cookie set with `httpOnly: false` (editable in DevTools)
- `package.json` exposed as a static file, revealing dependency versions
- Debug endpoint discloses the serialization engine name and version

---

## Flag Format

```
durham-ds{<16-hex-token>_<username>}
```

Flags are deterministic: the same username always produces the same flag (HMAC-SHA256 based).

---

## How to Regenerate Flags

```bash
cd CTFs/challenge-generation
node chgen_ctf7.js abcd12 efgh34 ijkl56
```

Or generate for N random users:

```bash
node chgen_ctf7.js --count 10
```

After regenerating, rebuild the Docker container:

```bash
cd CTFs/CTF_7_notes_app
docker compose down -v && docker compose up --build
```

---

## Directory Layout

```
CTFs/CTF_7_notes_app/
|-- README.md
|-- SOLUTIONS.md
|-- STORY.md
|-- workflow.md
|-- ctf-config.json
|-- package.json
|-- Dockerfile
|-- docker-compose.yml
|-- src/
|   |-- app.js
|   |-- routes/
|   |-- middleware/
|   |-- services/
|   |-- views/
|   |-- data/
|       |-- users.json
|       |-- flags.json
|       |-- notes.json
|       |-- flag-files/
|-- public/
|-- test/
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 18 |
| Framework | Express 4 |
| Templates | EJS |
| Vulnerable package | node-serialize@0.0.4 |
| Container | Docker (single service) |
| Port | 3001 |

---

## References

- [CVE-2017-5941](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2017-5941)
- [node-serialize on npm](https://www.npmjs.com/package/node-serialize)
- [OWASP A08:2021](https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/)
