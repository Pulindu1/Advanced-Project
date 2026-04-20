# Dunholm Research TrialVault -- Narrative Design Document

This document lists the narrative strings used in the challenge and where they
live. The clinical-research theme can be rethemed by editing only the files
listed here, without touching any exploit logic.

Dunholm Research Ltd is a fictional clinical research startup. It is not
affiliated with Durham University, any Durham-based organisation, the MHRA, or
any real clinical trial. All trial codes (DR-2024-017, DR-2024-018,
DR-2024-019, DR-2023-011), investigational products (NIMMOD-2, DRH-412), and
named staff are invented.

---

## Scenario Premise

TrialVault is the in-house editorial and document management platform of
Dunholm Research, a small Durham-based clinical research startup working on
neuroinflammation, cardiorenal safety, and oncology biomarker studies. On 8
September 2024, a competitor published a pre-print whose methods section
contained three paragraphs of the NIMMOD-2 Phase 2 dossier verbatim, including
the unredacted biomarker panel names and the draft sponsor response. No
pre-publication sharing with the competitor was authorised.

The board, chaired by Dr. Helen Cross, commissioned an external audit of
TrialVault scoped to access control, cryptographic handling, and log
integrity. The player is the auditor. Each flag recovered feeds material that
the next flag needs; no flag stands alone.

---

## Named Cast

| Name | Role | Status | Purpose |
|------|------|--------|---------|
| Dr. Helen Cross | Managing Director, Research Lead | Active | Chairs the board; author of the regulatory draft v3; commissioned the audit |
| Amir Patel | Chief Technology Officer | Active | Owns TrialVault; author of the handover note that defends the vulnerable search endpoint; his production password is the Flag 6 leak |
| Rachel Osei | Security Lead | Active | Author of the pre-audit security memo that catalogues the five findings; requested an independent log review at the September board meeting |
| Dr. James Whitfield | Clinical Lead, PI on DR-2024-017 | Active | Author of the Q2 operations summary; clinical contact for the DSMB |
| Sophie Chen | Trial Coordinator | Active | Minute taker at the September board; author of the Phase 2 welcome note draft |

Player accounts (`abcd12`, `efgh34`, `ijkl56`) are described in-story as
external auditor seats created for the engagement, issued with
researcher-level access and recorded in the audit register per section 4 of
the Information Access Policy.

---

## Narrative Arc

1. **Competitor disclosure (2024-09-08).** Three paragraphs of the NIMMOD-2
   dossier appear in a competitor's pre-print. Referenced in
   `board-minutes-2024-09.txt` and the dashboard pinned notice.
2. **Internal investigation.** Rachel Osei requests the access-log review be
   run by security rather than by the CTO function to preserve independence.
   Board agrees. Rachel's pre-audit security memo catalogues five items: raw
   SQL on the research endpoint, RSA-512 for release envelopes, DEBUG
   request-body logging, JWT trust-algorithm-header, and unauthenticated
   Actuator exposure.
3. **External audit commissioned.** Helen drafts the terms of reference. The
   auditor (the player) is granted researcher-level access.
4. **Audit engagement.** The auditor works through the six findings in the
   order that the application exposes them. Each finding recovers material
   that unlocks the next.
5. **Incident console (post-chain).** After recovering Amir's leaked password
   via the application log, the auditor signs in through the staff console
   and files the DR-2024-IR-001 incident report.

---

## Named Artefacts

| Identifier | Meaning |
|------------|---------|
| DR-2024-017 | NIMMOD-2, Phase 2 open-label extension, neuroinflammation |
| DR-2024-018 | DRH-412 Phase 1b cardiorenal safety extension |
| DR-2024-019 | Phase 2 solid-tumour biomarker study |
| DR-2023-011 | NIMMOD baseline survey, referenced as the Phase 2 precursor |
| DR-2024-IR-001 | Incident report opened in the Flag 6 console |
| DR-POL-IT-004 | Information Access Policy reference |
| TrialVault v3.4.1 | Application build referenced in the login footer and logfile header |

---

## Narrative Strings in Use

### Application Identity

| String | Location |
|--------|----------|
| "Dunholm Research" / "Dunholm Research Ltd" | `templates/*.html`, all 7 seeded documents, log lines |
| "TrialVault" | `templates/fragments/layout.html`, login, dashboard, documents, admin, incident-report |
| "Editorial and document management" | dashboard subtitle, staff handbook |

### Login Page (`templates/login.html`)

- Heading: "TrialVault"
- Subtitle: "Dunholm Research, editorial and document management"
- System notice describing the external audit and the scoped engagement
- Footer comment: `<!-- TrialVault v3.4.1 / Powered by Spring Boot -->`
  (class-level breadcrumb for Flag 1; identifies the framework whose
  Actuator endpoints the player will enumerate)

### Staff Login Page (`templates/staff-login.html`)

- Heading: "TrialVault, technical owner console"
- Subtitle: restricted staff route; distinct from the player login
- Takes username + password, authenticates via the same `AuthService` as the
  player login, then sets `STAFF_USER` on the HTTP session. Only reachable
  path to the incident console.

### Dashboard (`templates/dashboard.html`)

- Greeting with the logged-in user's display name
- "Open studies" table listing DR-2024-017 (NIMMOD-2), DR-2024-009
  (cardiorenal safety), DR-2023-041 (oncology) with PIs and status
- "Recent editorial activity" list naming Sophie, James, Rachel, and Helen's
  recent work
- "Quick links" panel pointing at the documents page, the admin dashboard
  (role-gated), and the staff console
- "Handover status" panel showing the in-progress items: multi-factor
  authentication rollout, Q3 vault key rotation, log retention review
- Pinned notice describing the external audit and the 8 September competitor
  disclosure

### Documents Page (`templates/documents.html`)

Lists seven documents with classification badges. Each row renders filename,
summary, classification, and a download link to
`/api/files/download?name=<filename>` (the endpoint with the Flag 2
traversal).

| Filename | Author | Classification | Narrative role |
|----------|--------|----------------|----------------|
| welcome-note.txt | Sophie Chen | INTERNAL | Participant-facing welcome draft; mentions James and Rachel as reviewers |
| access-policy.txt | (corporate) | INTERNAL | Access policy; section 3 states password reuse with external systems is not permitted; section 4 describes auditor accounts |
| staff-handbook.txt | Helen Cross | INTERNAL | Leadership bios; offices at Durham Science Park; security posture |
| rachel-security-memo.txt | Rachel Osei | RESTRICTED | The pre-audit memo; lists five findings that map directly to Flags 1, 2, 3, 4, 5, 6 |
| board-minutes-2024-09.txt | Sophie Chen (mins) | RESTRICTED | September board meeting; the 8 September disclosure and the audit commission |
| regulatory-draft-v3.txt | Helen Cross | RESTRICTED | MHRA submission draft; "do not circulate externally until Rachel signs off" |
| trial-summary-2024-q2.txt | James Whitfield | INTERNAL | Q2 operational summary; enrolment figures; references the welcome note revision |

### Admin Page (`templates/admin.html`)

Client-side shell. JavaScript fetches `/api/admin/dashboard` using the JWT
cookie and renders: viewer identity, Flag 3 receipt, stats, Rachel's pinned
memo, Amir's sticky handover note, recent SQL queries table, tool states,
and the full user directory.

### Admin API Response (`/api/admin/dashboard`)

- `rachel_memo`: six-line excerpt of Rachel's pinned memo (abridged version of
  the full document; names `/api/research/search` and the RSA-512 release
  wrapping explicitly)
- `amir_note`: four-line sticky handover note from Amir defending the search
  endpoint as "fine for the handover"
- `recent_sql_queries`: three pinned queries. The first two are Amir's on
  2024-09-26; the `SELECT * FROM secrets WHERE secret_key =
  'encryption_key_part2'` names the column and key the player needs for Flag
  4. The third is Helen's, showing the shape of a `secret_key` lookup.
- `tools`: three tiles (user directory, key rotation, audit export) with
  states `ok`, `deferred`, `ok`
- `users`: full directory across researchers, staff, and players

### Incident Console (`templates/incident-report.html`)

Reached only via the staff-login flow. Renders `${staffUser}` (the staff
identity on the session) and `${playerUsername}` (the player whose JWT
cookie carried over), with the DR-2024-IR-001 incident summary, the 8
September timeline, and the player's Flag 6.

### Vault Narrative Plaintext (`service/VaultEncryptionService.buildNarrativePlaintext`)

Each player gets a per-user vault file at `data/vault/<username>.enc`.
After decryption, the plaintext header reads:

```
# DUNHOLM RESEARCH TRIALVAULT, classified release envelope
Phase 2 dossier for DR-2024-017 (NIMMOD-2)
Flag (audit receipt): durham-drflag5{...}
```

The envelope carries the NIMMOD-2 Phase 2 dossier narrative and the Flag 5
receipt.

### Application Log (`service/LogfileSeedService`)

The log header is `### Seeded audit history, read-only. Do not edit.
Shipped with release 3.4.1.` The log contains routine production events plus
the single historical DEBUG line that exposes Amir's plaintext password
during a login attempt. Served through the Actuator `logfile` endpoint.

### Pinned Error Page (`templates/error.html`)

Themed error shell carrying status, error name, request path, and timestamp.
No narrative beyond "TrialVault, Dunholm Research" branding.

### Static Assets

- `static/css/style.css`, clinical palette: `--tv-blue #0f3b66`,
  `--tv-blue-dark #082748`, `--tv-teal #147a7a`, `--tv-grey #eef1f5`;
  sans-serif system stack, no imported web fonts.

---

## Files That Contain NO Narrative Strings

These files hold only logic. Do not edit them when retheming:

- `src/main/java/com/dunholm/DunholmApplication.java`
- `src/main/java/com/dunholm/config/SecurityConfig.java`
- `src/main/java/com/dunholm/config/JwtConfig.java`
- `src/main/java/com/dunholm/filter/JwtAuthFilter.java`
- `src/main/java/com/dunholm/service/JwtService.java`
- `src/main/java/com/dunholm/service/AuthService.java`
- `src/main/java/com/dunholm/service/ResearchService.java`
- `src/main/java/com/dunholm/repository/*.java`
- `src/main/java/com/dunholm/model/*.java` (field names are part of the
  exploit surface; the `secrets.secret_key` column is referenced in Flag 4)
- `src/main/resources/db/schema.sql`

The following files are mostly logic but carry a small number of narrative
strings that are part of the exploit chain and should be preserved:

- `service/LogfileSeedService.java`, the seeded audit line carrying the CTO
  credential (Flag 6)
- `service/DataSeedRunner.java`, the `encryption_key_part2` description
  string ("Second half of the document AES key...")
- `info/DunholmInfoContributor.java`, the Actuator `info` body carrying
  Flag 1 and the handover credential property

---

## How to Retheme

1. Edit `src/main/resources/templates/*.html` to change visible copy.
2. Edit the seven documents in `src/main/resources/data/uploads/*.txt` to
   change the in-universe narrative. Keep `rachel-security-memo.txt` as the
   five-finding memo and keep `board-minutes-2024-09.txt` referencing the
   disclosure event; these two drive the story.
3. Edit `service/VaultEncryptionService.buildNarrativePlaintext` for the
   decrypted-release header. Keep the `Flag (audit receipt):` line,
   flag-format-agnostic but flag-token-preserving.
4. Edit `controller/AdminController.AdminApiController.dashboard` for the
   pinned memo, handover note, and recent SQL queries. Keep the
   `encryption_key_part2` query: it is the pointer that tells the auditor
   which secret to extract via blind SQLi.
5. Edit `static/css/style.css` for colours and typography. Any palette that
   preserves WCAG AA contrast works.
6. Update this file (`STORY.md`) to reflect the new strings.
7. Do NOT change route paths, the JWT cookie name (`trialvault_token`), the
   Actuator exposure, the `filename` / `name` query parameter on the
   download endpoint, or the JSON field names returned by
   `/api/admin/dashboard`. The SOLUTIONS walkthrough references these by
   name.
8. Staff usernames (`helen.cross`, `amir.patel`, `rachel.osei`,
   `james.whitfield`, `sophie.chen`) can be renamed, but the log seed line
   in `LogfileSeedService` hard-codes `amir.patel` as the Flag 6 identity,
   and the admin dashboard pins Amir's and Rachel's content by username.
   Rename in both places together.

---

## Alternative Theme Examples

- **Legal e-discovery platform.** Dunholm Research becomes a law firm's
  in-house discovery tool. NIMMOD-2 becomes a sealed filing. The competitor
  pre-print becomes a leaked discovery document. Rachel's memo becomes a
  pre-litigation security review.
- **University research office.** Dunholm becomes a departmental research
  admin system. The Phase 2 dossier becomes an embargoed grant proposal. The
  board meeting becomes a faculty research committee.
- **Editorial / publishing house.** TrialVault becomes a pre-release
  manuscript system. The dossier becomes an under-embargo title. Flag 6's
  incident console becomes a publisher's issue-tracking console.

In each case, the exploit chain is unchanged: Actuator misconfig leaks
Flag 1 and configuration pointers, filter-strip traversal downloads the
PEM and the application properties, JWT algorithm confusion mints an admin
token, blind SQLi extracts the per-user Flag 4 and the AES key half, hybrid
RSA-512 + AES-256-GCM decryption recovers Flag 5, DEBUG log exposure yields
the CTO credential, and the staff console gates Flag 6.

---

## References

- [OWASP Top 10 (2021)](https://owasp.org/Top10/)
- [Spring Boot Actuator docs](https://docs.spring.io/spring-boot/docs/3.2.x/reference/html/actuator.html)
- [RFC 7519, JSON Web Token](https://www.rfc-editor.org/rfc/rfc7519)
- [CWE-22, Path Traversal](https://cwe.mitre.org/data/definitions/22.html)
- [CWE-89, SQL Injection](https://cwe.mitre.org/data/definitions/89.html)
- [CWE-327, Broken/Risky Crypto](https://cwe.mitre.org/data/definitions/327.html)
- [CWE-532, Sensitive Info in Log](https://cwe.mitre.org/data/definitions/532.html)
