# CTF 5 -- NovaCMS Internal Editorial Platform

Multi-stage CTF covering Server-Side Template Injection (SSTI) via Jinja2, from information disclosure through to Remote Code Execution.

**Stack:** Python 3.11, Flask 3.x, Jinja2, SQLite

---

## Quick Start (Docker -- recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/). No Python or pip needed.

```bash
cd CTFs/CTF_5_internal_blog
cp .env.example .env
docker compose up --build
```

Docker will:
1. Build the Flask application container
2. Initialise the SQLite database
3. Seed users, posts, and flags from `flags.json` + `credentials.json`

- Application: http://localhost:5175
- Health check: http://localhost:5175/health

To stop: `docker compose down`
To reset to a clean state (wipes the database): `docker compose down -v && docker compose up --build`

### Running without Docker (development)

Requires Python 3.11+ and pip.

```bash
cd CTFs/CTF_5_internal_blog

python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

pip install -r requirements.txt
cp .env.example .env

flask run --host=127.0.0.1 --port=5000
# http://localhost:5000
```

---

## Login Credentials (Seeded)

| Username | Password     | Role   |
|----------|--------------|--------|
| abcd12   | *(see credentials.json)* | editor |
| efgh34   | *(see credentials.json)* | editor |
| ijkl56   | *(see credentials.json)* | editor |

Admin account: `admin` / `NovaCMS_Adm1n!2024` (not intended for player use)

---

## CTF Flags

**4 flags total:**

| Flag | Technique | Difficulty |
|------|-----------|------------|
| 1 | Information disclosure via hidden API endpoint | Beginner |
| 2 | Basic SSTI -- Flask config leak (SECRET_KEY) | Intermediate |
| 3 | SSTI with WAF bypass using Jinja2 filters | Advanced Intermediate |
| 4 | Remote Code Execution via MRO chain | Advanced |

See [SOLUTIONS.md](SOLUTIONS.md) for the complete walkthrough (instructors/markers only).

---

## Vulnerabilities

- Debug/health endpoint leaking application metadata
- Hidden API route protected only by a header token
- Server-Side Template Injection via `render_template_string()` in the live preview feature
- Hardcoded SECRET_KEY in Flask configuration
- Naive WAF using keyword blocklist (bypassable via hex encoding and Jinja2 `|attr()` filter)
- Full RCE achievable through Python MRO traversal

---

## Tech Stack

**Backend:** Python 3.11, Flask 3.x, Jinja2, Flask-Login, Flask-SQLAlchemy
**Database:** SQLite (no external DB service required)
**Frontend:** Server-side rendered HTML via Jinja2 templates (no React/Vite)
**Infrastructure:** Docker Compose (single container)

---

## CTF Integration

Per-player flags are generated via `CTFs/challenge-generation/chgen_ctf5.js` and stored in `flags.json`. Each player's flags are seeded into the database at startup. The RCE flag (Flag 4) is also written to `/app/secret/flag.txt` inside the container.

---

## References

- PortSwigger SSTI Academy: https://portswigger.net/web-security/server-side-template-injection
- PayloadsAllTheThings -- Jinja2 SSTI: https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Server%20Side%20Template%20Injection
- HackTricks -- Jinja2 SSTI: https://book.hacktricks.xyz/pentesting-web/ssti-server-side-template-injection/jinja2-ssti
- OWASP WSTG-INPV-18: https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/07-Input_Validation_Testing/18-Testing_for_Server-side_Template_Injection
