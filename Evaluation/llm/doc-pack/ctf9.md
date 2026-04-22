# CTF 9 -- Dunholm Research: TrialVault

A Durham-based clinical research startup's editorial and document management
platform, under external audit after a competitor published three paragraphs
of the NIMMOD-2 Phase 2 dossier verbatim.

**Stack:** Java 17 + Spring Boot 3.2.5 + Spring Security + Spring Data JPA +
Thymeleaf + jjwt 0.12 + Bucket4j, PostgreSQL 16, Redis 7.

---

## Quick Start (Docker)

```bash
cd CTFs/CTF_9_dunholm
docker compose up --build
```

- Application: http://localhost:3003

---

## Login Credentials (Seeded)

| Username | Password | Role |
|----------|----------|------|
| abcd12 | *(see data/users.json)* | researcher |
| efgh34 | *(see data/users.json)* | researcher |
| ijkl56 | *(see data/users.json)* | researcher |

Staff accounts are seeded for attribution and realism:

| Username | Name | Role | Password |
|----------|------|------|----------|
| helen.cross | Dr. Helen Cross | research_lead | `SYSTEM_INTERNAL` (will not authenticate) |
| amir.patel | Amir Patel | cto_admin | `SYSTEM_INTERNAL` |
| rachel.osei | Rachel Osei | security_lead | `SYSTEM_INTERNAL` |
| james.whitfield | Dr. James Whitfield | clinical_lead | `SYSTEM_INTERNAL` |
| sophie.chen | Sophie Chen | trial_coordinator | `SYSTEM_INTERNAL` |

---

## Flag format

```
durham-drflag1{<16-hex-token>_<username>}
durham-drflag2{<16-hex-token>_<username>}
durham-drflag3{<16-hex-token>_<username>}
durham-drflag4{<16-hex-token>_<username>}
durham-drflag5{<16-hex-token>_<username>}
durham-drflag6{<16-hex-token>_<username>}
```

Six flags per user. Flags are deterministic (HMAC-SHA256 with per-flag
sub-salts).

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | Java 17 |
| Framework | Spring Boot 3.2.5 (Web, Security, Data JPA, Actuator, Thymeleaf, Data Redis) |
| JWT | io.jsonwebtoken 0.12.5 |
| Rate limiting | Bucket4j 8.10 |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Password hashing | BCrypt via spring-security-crypto |
| Container | Docker multi-stage |
| External port | 3003 |

---

## References

- [OWASP A01:2021](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- [OWASP A02:2021](https://owasp.org/Top10/A02_2021-Cryptographic_Failures/)
- [OWASP A03:2021](https://owasp.org/Top10/A03_2021-Injection/)
- [OWASP A05:2021](https://owasp.org/Top10/A05_2021-Security_Misconfiguration/)
- [OWASP A07:2021](https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/)
- [OWASP A09:2021](https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/)

---

## Story

Dunholm Research Ltd is a fictional clinical research startup. It is not
affiliated with Durham University, any Durham-based organisation, the MHRA,
or any real clinical trial. All trial codes, investigational products, and
named staff are invented.

### Scenario

TrialVault is the in-house editorial and document management platform of
Dunholm Research, a small Durham-based clinical research startup working on
neuroinflammation, cardiorenal safety, and oncology biomarker studies. On 8
September 2024, a competitor published a pre-print whose methods section
contained three paragraphs of the NIMMOD-2 Phase 2 dossier verbatim,
including the unredacted biomarker panel names and the draft sponsor
response. No pre-publication sharing with the competitor was authorised.

The board, chaired by Dr. Helen Cross, commissioned an external audit of
TrialVault scoped to access control, cryptographic handling, and log
integrity. The player is the auditor.

Player accounts (`abcd12`, `efgh34`, `ijkl56`) are described in-story as
external auditor seats created for the engagement, issued with
researcher-level access and recorded in the audit register per section 4 of
the Information Access Policy.

### Named cast

| Name | Role |
|------|------|
| Dr. Helen Cross | Managing Director, Research Lead. Chairs the board; commissioned the audit. |
| Amir Patel | Chief Technology Officer. Owns TrialVault; author of the handover note. |
| Rachel Osei | Security Lead. Author of the pre-audit security memo; requested an independent log review at the September board meeting. |
| Dr. James Whitfield | Clinical Lead, PI on DR-2024-017. Author of the Q2 operations summary. |
| Sophie Chen | Trial Coordinator. Minute taker at the September board; author of the Phase 2 welcome note draft. |

### Named artefacts

| Identifier | Meaning |
|------------|---------|
| DR-2024-017 | NIMMOD-2, Phase 2 open-label extension, neuroinflammation |
| DR-2024-018 | DRH-412 Phase 1b cardiorenal safety extension |
| DR-2024-019 | Phase 2 solid-tumour biomarker study |
| DR-2023-011 | NIMMOD baseline survey, referenced as the Phase 2 precursor |
| DR-2024-IR-001 | Incident report opened in the staff console |
| DR-POL-IT-004 | Information Access Policy reference |
| TrialVault v3.4.1 | Application build referenced in the login footer and logfile header |

### Application pages

- **Login (`/login`).** Heading: "TrialVault". Subtitle: "Dunholm Research,
  editorial and document management". System notice describing the external
  audit and the scoped engagement. Footer comment identifying the
  application build.
- **Staff login (`/staff-login`).** Heading: "TrialVault, technical owner
  console". Subtitle: restricted staff route; distinct from the player
  login. Sets `STAFF_USER` on the HTTP session on authentication.
- **Dashboard.** Greeting with the logged-in user's display name. "Open
  studies" table listing DR-2024-017 (NIMMOD-2), DR-2024-009 (cardiorenal
  safety), DR-2023-041 (oncology) with PIs and status. "Recent editorial
  activity" list naming Sophie, James, Rachel, and Helen's recent work.
  Quick links panel. Handover status panel (MFA rollout, Q3 vault key
  rotation, log retention review). Pinned notice describing the external
  audit and the 8 September competitor disclosure.
- **Documents page (`/documents`).** Lists seven documents with
  classification badges; each row has filename, summary, classification,
  and a download link:

  | Filename | Author | Classification |
  |----------|--------|----------------|
  | welcome-note.txt | Sophie Chen | INTERNAL |
  | access-policy.txt | (corporate) | INTERNAL |
  | staff-handbook.txt | Helen Cross | INTERNAL |
  | rachel-security-memo.txt | Rachel Osei | RESTRICTED |
  | board-minutes-2024-09.txt | Sophie Chen (mins) | RESTRICTED |
  | regulatory-draft-v3.txt | Helen Cross | RESTRICTED |
  | trial-summary-2024-q2.txt | James Whitfield | INTERNAL |

- **Admin page.** Client-side shell that fetches `/api/admin/dashboard` and
  renders: viewer identity, stats, a pinned memo, a sticky handover note,
  recent queries table, tool states, and the full user directory.
- **Incident console.** Reached via the staff login flow; renders the
  staff identity on the session and the player username, plus the
  DR-2024-IR-001 incident summary and the 8 September timeline.
- **Error page.** Themed error shell carrying status, error name, request
  path, and timestamp. "TrialVault, Dunholm Research" branding.

### Static assets

- Clinical palette: `--tv-blue #0f3b66`, `--tv-blue-dark #082748`,
  `--tv-teal #147a7a`, `--tv-grey #eef1f5`; sans-serif system stack, no
  imported web fonts.
