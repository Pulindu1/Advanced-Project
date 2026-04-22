# CTF 5 -- NovaCMS Internal Editorial Platform

Multi-stage CTF built on an internal editorial CMS with a live-preview feature.

**Stack:** Python 3.11, Flask 3.x, Jinja2, SQLite

---

## Quick Start (Docker)

```bash
cd CTFs/CTF_5_internal_blog
cp .env.example .env
docker compose up --build
```

- Application: http://localhost:5175
- Health check: http://localhost:5175/health

---

## Login Credentials (Seeded)

| Username | Password     | Role   |
|----------|--------------|--------|
| abcd12   | *(see credentials.json)* | editor |
| efgh34   | *(see credentials.json)* | editor |
| ijkl56   | *(see credentials.json)* | editor |

Admin account: `admin` / `NovaCMS_Adm1n!2024` (not intended for player use)

---

## Flag format

`durham-cms-flagN{<hash>_<username>}` where N is the flag number (1-4).

Four flags per user.

---

## Tech Stack

**Backend:** Python 3.11, Flask 3.x, Jinja2, Flask-Login, Flask-SQLAlchemy
**Database:** SQLite (no external DB service required)
**Frontend:** Server-side rendered HTML via Jinja2 templates (no React/Vite)
**Infrastructure:** Docker Compose (single container)

---

## References

- PortSwigger SSTI Academy: https://portswigger.net/web-security/server-side-template-injection
- OWASP WSTG-INPV-18: https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/07-Input_Validation_Testing/18-Testing_for_Server-side_Template_Injection
