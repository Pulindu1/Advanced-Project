# Greystone Gazette -- Narrative Design Document

This document lists the narrative strings used in the challenge and where they live. The newspaper theme can be rethemed by editing only the files listed here, without touching any exploit logic.

The Greystone Gazette is a fictional local newspaper; it is not affiliated with Durham University's Palatinate or any real publication.

---

## Scenario Premise

PressRoom is the in-house editorial management system of the Greystone Gazette, a small Durham-based local newspaper. The Gazette's sole developer (Marcus Webb) was made redundant last quarter after a round of cuts. His replacement has not been hired. Sarah Lin, the editor-in-chief, has asked a security audit team to review the system after unpublished drafts started appearing in places they shouldn't.

The player is that audit. They log in as a contributor and work through three progressively deeper access-control failures.

---

## Named Cast

| Name | Role | Status | Purpose |
|------|------|--------|---------|
| Sarah Lin | Editor-in-chief (admin) | Active | Authors article 3 (Flag 1 carrier); narrative voice for the investigation |
| Tom Ashworth | Reporter | Active | Community beat; supplementary articles |
| Priya Kapoor | Reporter | Active | Council / planning beat; mentioned in article 3 as a victim of the leak |
| Marcus Webb | Former sysadmin | Inactive | Built PressRoom; author of the vulnerable health endpoint (breadcrumb chain); subject of the redundancy subplot |

Player contributor accounts (`abcd12`, `efgh34`, `ijkl56`) are described in-story as "external security auditor" seats added for the engagement.

---

## Narrative Strings in Use

### Application Identity

| String | Location |
|--------|----------|
| "Greystone Gazette" | `templates/layout.html`, multiple pages |
| "PressRoom" | `templates/layout.html`, `templates/login.html` |
| "Editorial System" / "Editorial Desk" | page subtitles |

### Login Page (`templates/login.html`)

- Heading: "PressRoom"
- Subtitle: "Greystone Gazette Editorial System"
- System notice referencing Marcus Webb's departure and the ongoing security review
- Dev handover notice pointing at "archive APIs in an intermediate migration state" with "ownership enforcement landed on the frontend only" -- class-level breadcrumb for Flag 1, deliberately vague about endpoints
- About PressRoom expandable block (version, tech stack flavour)

### Dashboard (`templates/dashboard.html`)

- Greeting with the logged-in user's display name
- "Your articles" panel listing the signed-in user's own articles (always non-empty because each player is seeded with an onboarding draft at id >= 10)
- Narrative "PressRoom tips" panel -- no exploit hints, just flavour about the Elvet Wynd office and the editorial channel
- Newsroom sidebar with four fictional Durham-flavoured headlines

### Archive Page (`templates/archive.html`)

- `/archive` route, available to every signed-in user via the top nav
- Lists articles where `status = 'published'` OR `author_id = current user`. Foreign drafts are excluded server-side, so article 3 (Sarah's Flag 1 carrier) is absent and the ID gaps (`#3`, `#8`, and other players' onboarding IDs) become the player's discovery surface.
- Columns: #id, Title (link), Byline, Desk, Status pill

### Article Page (`templates/article.html`)

- Renders `articles.json` entries with author name, status badge, category, and body paragraphs
- Article 3 ("DRAFT: The tips that won't stop coming") is Sarah Lin's investigation draft. Its body contains `{{PLAYER_FLAG1}}` which the server substitutes with the viewer's personal flag1 at response time.
- Article 9 ("Internal note: network diagnostics") is Marcus Webb's breadcrumb pointing at `/admin` and the ping endpoint.

### Admin Page (`templates/admin.html`)

- Minimal shell: `<div id="admin-root"></div>` plus `<script src="/static/js/admin.js">`
- JavaScript fetches `/api/me`, redirects non-admins, and if admin fetches `/api/admin/dashboard` and renders stats, user table, and maintenance tools.

### Admin API Response (`/api/admin/dashboard`)

- `maintenance_tools[0].note`: *"Quick ping utility for checking if upstream services are reachable. Added a filter after the incident in March. -- M.W."* (Marcus's voice; breadcrumb for Flag 3's existence)
- `system.notes`: flavour text about flag storage path
- `users`: full directory, marked `active: false` for `marcus.webb`

### Flag 3 Memo (`src/data/flag-files/memo.txt`)

Stand-alone narrative file containing the Riverside Associates / Elvet Wharf / Councillor J. Holt corruption summary. Not part of the exploit path -- it exists so the `flag-files/` directory reads like a realistic editorial drop folder if the player enumerates it.

### Contributor Onboarding Articles (`src/data/contributor-articles.json`)

Emitted by `chgen_ctf8.js` -- one article per player at IDs starting at 10, authored by the player, status `draft`, category `onboarding`. Body is narrative filler only (no exploit hints). Ensures the dashboard "Your articles" panel is never empty on first login, and gives the player a concrete example of the `/articles/<id>` <-> `/api/articles/<id>` parallel.

### Articles Data (`src/data/articles.json`)

Nine articles across four states (published, draft, archived, review). Short form (100-150 words each):

1. "Riverside bridge reopens after inspection" -- published by tom.ashworth
2. "Planning committee defers Elvet Wharf decision" -- published by priya.kapoor
3. "DRAFT: The tips that won't stop coming" -- **draft by sarah.lin, carries {{PLAYER_FLAG1}}**
4. "Student union debates library hours" -- published by tom.ashworth
5. "Funding shortfall at the Brandon community centre" -- published by priya.kapoor
6. "Viaduct repairs delayed to autumn" -- published by tom.ashworth
7-8. Filler contributor-authored stubs
9. "Internal note: network diagnostics" -- published note by marcus.webb, breadcrumb for Flag 3

### Newsroom Sidebar (`templates/dashboard.html`)

Static fictional headlines -- purely flavour, no exploit relevance:
- "Council approves winter cycle scheme"
- "Durham market moves to Saturday opening"
- "Greystone FC announces ground expansion consultation"
- "Viaduct photo competition winners"

### Static Assets

- `static/css/style.css` -- Durham purple palette (`--gz-purple: #68246d`) with Playfair Display headings and Georgia body, newspaper grid layout
- `static/js/admin.js` -- client-side admin guard (deliberately bypassable)

---

## Files That Contain NO Narrative Strings

These files hold only logic. Do not edit them when retheming:

- `cmd/server/main.go`
- `internal/database/*.go`
- `internal/handlers/*.go`
- `internal/middleware/*.go`
- `internal/services/flagsync.go`
- `internal/services/health.go` (the block-list characters and ping command are exploit logic)

---

## How to Retheme

1. Edit `templates/*.html` to change visible copy.
2. Edit `src/data/articles.json` -- keep article 3 as the flag-1 carrier (must include the literal token `{{PLAYER_FLAG1}}`) and keep article 9 referencing the admin panel and ping endpoint. Do not change the ID space `1..9` used for staff articles; contributor onboarding articles start at `10` (see `src/data/contributor-articles.json`, generator output).
3. Edit `src/data/flag-files/memo.txt` to change the investigation flavour text.
4. Edit `static/css/style.css` for colours and typography. The purple `#68246d` is a Durham University convention; any replacement that keeps contrast above WCAG AA works.
5. Update this file (`STORY.md`) to reflect the new strings.
6. Do NOT change route paths, cookie name (`pressroom_session`), or the JSON field names in API responses.
7. The staff usernames (`sarah.lin`, `tom.ashworth`, `priya.kapoor`, `marcus.webb`) can be renamed, but the tests at `test/integration_test.go` reference `marcus.webb` in the admin dashboard assertion -- update the test if renaming.

---

## Alternative Theme Examples

- **University student paper:** "Palatinate desk" or a fictional campus outlet. Articles become campus stories; Marcus Webb becomes a departing student developer.
- **Independent magazine:** A regional arts magazine. Flag 1 carrier becomes an unpublished exposé, flag 2 carrier becomes the admin subscriber dashboard.
- **Medical research bulletin:** An in-house faculty bulletin. Flag 1 carrier becomes an embargoed findings draft.

In each case, the exploit chain is unchanged: IDOR -> missing server-side auth on admin API -> command substitution bypass on a ping utility.
