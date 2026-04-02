# CTF 6 -- Veridian Secure Internal Portal

Multi-stage CTF covering Server-Side Request Forgery (SSRF), from cloud metadata exfiltration through to session replay via internal service pivoting.

**Stack:** Rust (Actix-web 4), Python (Flask), Redis 7, SQLite

---

## Quick Start (Docker -- recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/). No Rust toolchain or Python needed on the host.

**Step 1: Generate player credentials and flags**

```bash
cd CTFs/challenge-generation
node chgen_ctf6.js abcd12 efgh34 ijkl56
```

This writes `flags.json` and `credentials.json` into `CTFs/CTF_6_veridian/`.

**Step 2: Start the challenge**

```bash
cd CTFs/CTF_6_veridian
docker compose up --build
```

Docker will:
1. Build the Rust/Actix-web application container
2. Build the Python Flask metadata mock server
3. Start Redis 7 and seed it with challenge data
4. Initialise the SQLite database and seed user accounts

- Application: http://localhost:5180
- Health check: http://localhost:5180/health

To stop: `docker compose down`
To reset to a clean state: `docker compose down -v && docker compose up --build`

---

## Login Credentials (Seeded)

| Username | Password     | Role    |
|----------|--------------|---------|
| abcd12   | *(see credentials.json)* | analyst |
| efgh34   | *(see credentials.json)* | analyst |
| ijkl56   | *(see credentials.json)* | analyst |

---

## CTF Flags

**4 flags total.** Flag format: `durham-vsec-flagN{...}` where N = 1-4.

| Flag | Technique | Difficulty |
|------|-----------|------------|
| 1 | SSRF to cloud metadata -- IAM credential exfiltration | Intermediate |
| 2 | Metadata enumeration -- user-data bootstrap script leak | Intermediate |
| 3 | SSRF via dict:// scheme -- Redis data exfiltration | Advanced |
| 4 | Session token replay -- admin panel access | Advanced |

See [SOLUTIONS.md](SOLUTIONS.md) for the complete walkthrough (instructors/markers only).

---

## Vulnerabilities

- Unvalidated server-side URL fetch in the Link Previewer (SSRF)
- Cloud metadata service accessible from the application tier (IMDSv1, no token requirement)
- No URL scheme restriction (dict:// and other non-HTTP schemes accepted)
- Unauthenticated Redis instance on the internal network
- Admin route protected only by a static session token header (no session binding)
- Sensitive configuration data in cloud user-data bootstrap script

---

## Tech Stack

**Backend:** Rust 2021 edition, Actix-web 4, reqwest (async), rusqlite
**Database:** SQLite (embedded, no external DB service)
**Metadata Mock:** Python 3.11, Flask 3.x (simulates AWS IMDSv1)
**Cache:** Redis 7 (alpine, no authentication)
**Infrastructure:** Docker Compose (3 containers: app, metadata, redis)

---

## CTF Integration

Per-player flags are generated via `CTFs/challenge-generation/chgen_ctf6.js` and stored in `flags.json`. Flag format: `durham-vsec-flagN{<hash>_<username>}` where N is the flag number (1-4). Each player's flags are loaded at startup and served dynamically via placeholder replacement.

---

## References

- OWASP SSRF: https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/
- PortSwigger SSRF Academy: https://portswigger.net/web-security/ssrf
- HackTricks SSRF: https://book.hacktricks.xyz/pentesting-web/ssrf-server-side-request-forgery
- AWS IMDSv1 Documentation: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instancedata-data-retrieval.html
- PayloadsAllTheThings SSRF: https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Server%20Side%20Request%20Forgery
