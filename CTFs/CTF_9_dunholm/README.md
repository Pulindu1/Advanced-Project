# CTF 9 -- Dunholm Research: TrialVault

A Durham-based clinical research startup's editorial and document management
platform, under external audit after a competitor published three paragraphs of
the NIMMOD-2 Phase 2 dossier verbatim.

**Stack:** Java 17 + Spring Boot 3.2.5 + Spring Security + Spring Data JPA +
Thymeleaf + jjwt 0.12 + Bucket4j, PostgreSQL 16, Redis 7.

---

## Quick Start (Docker -- recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/).
No Java toolchain needed on the host.

**Step 1: Generate player credentials and flags**

```bash
cd CTFs/challenge-generation
node chgen_ctf9.js abcd12 efgh34 ijkl56
```

This writes `flags.json` and `users.json` into `CTFs/CTF_9_dunholm/data/`.
Player passwords (random each run) are printed to the terminal.

**Step 2: Start the challenge**

```bash
cd CTFs/CTF_9_dunholm
docker compose up --build
```

- Application: http://localhost:3003
- Multi-stage Docker build: Maven 3.9 + Eclipse Temurin 17 to compile,
  Eclipse Temurin 17 JRE (jammy) for the runtime.
- `data/flags.json` and `data/users.json` mount read-only into `/app/seed/`;
  a `CommandLineRunner` seeds the Postgres `users`, `user_flags`, and
  `secrets` tables on boot and writes the per-user encrypted vault files and
  the historical log lines.

To stop: `docker compose down`
To reset state: `docker compose down -v && docker compose up --build`

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
| amir.patel | Amir Patel | cto_admin | intentionally leaked through the challenge |
| rachel.osei | Rachel Osei | security_lead | `SYSTEM_INTERNAL` |
| james.whitfield | Dr. James Whitfield | clinical_lead | `SYSTEM_INTERNAL` |
| sophie.chen | Sophie Chen | trial_coordinator | `SYSTEM_INTERNAL` |

---

## CTF Flags

**6 flags per user.** Flag formats:

| Flag | Format | Technique | OWASP |
|------|--------|-----------|-------|
| 1 | `durham-drflag1{...}` | Spring Boot Actuator exposure, personalised via a custom `InfoContributor` | A05:2021 |
| 2 | `durham-drflag2{...}` | Directory traversal on the file download endpoint | A01:2021 |
| 3 | `durham-drflag3{...}` | JWT algorithm confusion (RS256 to HS256, public key as HMAC secret) | A02:2021, A07:2021 |
| 4 | `durham-drflag4{...}` | Blind boolean SQL injection on the research search endpoint | A03:2021 |
| 5 | `durham-drflag5{...}` | RSA-512 factoring combined with AES-256-GCM hybrid decryption | A02:2021 |
| 6 | `durham-drflag6{...}` | Plaintext credential leak through DEBUG request-body logging | A09:2021 |

See [SOLUTIONS.md](SOLUTIONS.md) for the complete walkthrough (instructors
and markers only).

---

## Challenge Overview

- **Difficulty:** Advanced
- **OWASP Mapping:** A01, A02 (x2), A03, A05, A07, A09

Players are told they are an external auditor called in after a competitor
published material that should have been embargoed. The board has commissioned
a scoped audit of TrialVault covering access control, cryptographic handling,
and log integrity. Each flag the auditor recovers feeds material that the next
flag needs; no flag stands alone.

The chain begins from a single piece of reconnaissance on the login page (a
footer comment naming Spring Boot). From there:

1. The Actuator endpoints are reachable unauthenticated and leak configuration
   that names the file download endpoint, the JWT public key location, and a
   handover credential.
2. The download endpoint has a naive `../` strip that the `....//` payload
   defeats. The leaked `application.properties` carries a Flag 2 comment and
   names the JWT trust-algorithm-header flag.
3. The JWT verifier honours the token's own `alg` header, so an HS256 token
   signed with the PEM bytes of the public key passes verification. The
   forged administrator identity opens the admin dashboard.
4. The admin dashboard's pinned "recent SQL queries" panel names the
   `secrets.secret_key` column and the blind SQLi on the research endpoint
   recovers both a per-user Flag 4 and a shared AES key half.
5. The encrypted vault file is reachable via the same traversal. Its RSA-512
   wrap can be factored (factordb, msieve, Alpertron), and the AES-256-GCM
   key can alternatively be reconstructed from Flag 1 plus Flag 4 material
   with a single SHA-256. Either path recovers Flag 5.
6. Actuator exposes the application log, which contains a historical login
   with the CTO's plaintext password. Signing in as `amir.patel` through the
   staff login opens the incident console and yields Flag 6.

### Learning Outcomes

- Recognise unrestricted Spring Boot Actuator exposure as a production-grade
  misconfiguration and understand how `env`, `info`, and `logfile` differ in
  blast radius.
- Identify filter-strip traversal patterns that survive naive `replace("../",
  "")` sanitisation, and the interaction between Spring's URL decoding and
  the filter order.
- Understand why trusting the `alg` header of an incoming JWT is equivalent
  to leaking the signing key, and reproduce the public-key-as-HMAC-secret
  forgery.
- Walk a full boolean blind SQL injection end to end against a single
  count-returning endpoint, including extraction length and characterwise
  probing.
- Combine an asymmetric weakness (short RSA modulus) with a symmetric recovery
  path (shared-secret composition) and observe that each half alone is
  insufficient.
- Recognise that DEBUG request-body logging in production is not a
  privacy oversight; it is an A09 finding that yields credentials directly.

---

## Flag Format

```
durham-drflag1{<16-hex-token>_<username>}
durham-drflag2{<16-hex-token>_<username>}
durham-drflag3{<16-hex-token>_<username>}
durham-drflag4{<16-hex-token>_<username>}
durham-drflag5{<16-hex-token>_<username>}
durham-drflag6{<16-hex-token>_<username>}
```

Flags are deterministic: the same username always produces the same six
flags (HMAC-SHA256 with per-flag sub-salts).

---

## How to Regenerate Flags

```bash
cd CTFs/challenge-generation
node chgen_ctf9.js abcd12 efgh34 ijkl56
```

Or generate for N random users:

```bash
node chgen_ctf9.js --count 10
```

After regenerating, rebuild the Docker stack:

```bash
cd CTFs/CTF_9_dunholm
docker compose down -v && docker compose up --build
```

The `-v` on `down` drops the `trialvault-db` volume so the fresh flag set is
re-seeded.

---

## Directory Layout

```
CTFs/CTF_9_dunholm/
|-- README.md
|-- SOLUTIONS.md
|-- STORY.md
|-- workflow.md
|-- ctf-config.json
|-- pom.xml
|-- Dockerfile
|-- docker-compose.yml
|-- data/
|   |-- users.json                # mounted read-only to /app/seed/
|   |-- flags.json
|   |-- uploads/                  # placeholder; real uploads live in src/main/resources/data/uploads
|   |-- vault/                    # receives per-user .enc files at boot
|-- src/main/java/com/dunholm/
|   |-- DunholmApplication.java
|   |-- config/                   # SecurityConfig, JwtConfig
|   |-- controller/               # Auth, Dashboard, Documents, File, Admin, Research, Incident
|   |-- filter/                   # JwtAuthFilter
|   |-- info/                     # DunholmInfoContributor (Flag 1)
|   |-- model/                    # User, Trial, Secret, Document, UserFlag
|   |-- repository/               # Spring Data JPA interfaces
|   |-- service/                  # Auth, Jwt, Research, VaultEncryption, LogfileSeed, DataSeedRunner
|-- src/main/resources/
|   |-- application.properties
|   |-- db/{schema.sql, seed-data.sql}
|   |-- data/uploads/             # 7 seeded narrative documents
|   |-- keys/                     # RSA-2048 (JWT) and RSA-512 (docs), PEM
|   |-- static/css/style.css
|   |-- templates/                # login, dashboard, documents, admin,
|                                 # incident-report, staff-login, error, fragments/
```

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
| Container | Docker multi-stage (maven:3.9-eclipse-temurin-17 build, eclipse-temurin:17-jre-jammy runtime) |
| External port | 3003 |

---

## Running tests

- **Unit** (`src/test/java/...`, JUnit 5) covers JWT algorithm-confusion
  cases. Runs with the usual Maven command, no Docker needed:

  ```bash
  mvn test
  ```

- **End-to-end** lives in the shared suite at `CTFs/e2e/ctf9_exploit.py`
  and reproduces every flag chain against the dockerised stack on port
  3003:

  ```bash
  docker compose up -d
  cd ../e2e && pip install -r requirements.txt && python3 -m pytest ctf9_exploit.py -v
  ```

---

## References

- [OWASP A01:2021](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- [OWASP A02:2021](https://owasp.org/Top10/A02_2021-Cryptographic_Failures/)
- [OWASP A03:2021](https://owasp.org/Top10/A03_2021-Injection/)
- [OWASP A05:2021](https://owasp.org/Top10/A05_2021-Security_Misconfiguration/)
- [OWASP A07:2021](https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/)
- [OWASP A09:2021](https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/)
- [CWE-22: Path Traversal](https://cwe.mitre.org/data/definitions/22.html)
- [CWE-89: SQL Injection](https://cwe.mitre.org/data/definitions/89.html)
- [CWE-327: Use of a Broken or Risky Cryptographic Algorithm](https://cwe.mitre.org/data/definitions/327.html)
- [CWE-532: Insertion of Sensitive Information into Log File](https://cwe.mitre.org/data/definitions/532.html)
- [RFC 7519 JSON Web Token](https://www.rfc-editor.org/rfc/rfc7519)
- [factordb.com](http://factordb.com) and [Alpertron ECM applet](https://www.alpertron.com.ar/ECM.HTM) for RSA-512 factoring
