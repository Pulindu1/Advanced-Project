# NorthSide Notes -- Narrative Design Document

This document lists all narrative strings used in the challenge and where they live. The theme can be rewritten by editing only the files listed here, without touching any exploit logic.

---

## Narrative Strings in Use

### Application Identity

| String | Location |
|--------|----------|
| "NorthSide Notes" | `src/views/partials/header.ejs`, `src/views/index.ejs` |
| "A nostalgic self-hosted note-taking app, built in 2017, still going strong." | `src/views/index.ejs` |
| "NorthSide Notes v1.0.0" | `src/views/partials/footer.ejs` |

### Login Page (`src/views/index.ejs`)

- Page heading: "NorthSide Notes"
- Tagline: "A nostalgic self-hosted note-taking app, built in 2017, still going strong."
- Prompt: "Log in to access your notes."
- Error message template: "Invalid username or password." (set in `src/routes/auth.js`, but the string is a UI label, not exploit logic)

### Home Page (`src/views/home.ejs`)

- Greeting: "Welcome back, <%= userProfile.username %>"
- Section heading: "Your Notes"
- Note cards rendered from `src/data/notes.json`

### About Page (`src/views/about.ejs`)

- "About NorthSide Notes"
- "Version: 1.0.0 (released 2017)"
- "Built with Express and EJS."
- "Last updated: never. If it works, do not touch it."
- Paragraph about the solo developer

### Seeded Notes (`src/data/notes.json`)

Three notes:
1. "Welcome to NorthSide Notes" -- introduction to the app
2. "Maintenance Log" -- dates and dependency audit note (breadcrumb)
3. "Internal Reminder" -- mentions the serialised profile cookie format (breadcrumb)

### Red Herring Page (`src/views/flag.ejs`)

- "Nothing here yet."
- "This page is under construction. Check back later."

### Footer (`src/views/partials/footer.ejs`)

- "NorthSide Notes v1.0.0"
- "About" link
- "Internal Tools" link (subtle, greyed-out; points to /debug)

### Lockout Page (`src/views/lockout.ejs`)

- "Too Many Attempts"
- Countdown message with `<%= retrySec %>` seconds

### Forbidden Page (`src/views/forbidden.ejs`)

- "Access Denied"
- Dynamic message or default: "You do not have permission to view this page."

---

## Files That Contain NO Narrative Strings

These files contain only logic and must not be edited when retheming:

- `src/app.js`
- `src/routes/auth.js` (except the error message string)
- `src/routes/home.js`
- `src/routes/notes.js`
- `src/routes/debug.js`
- `src/middleware/profileDeserializer.js`
- `src/middleware/loginRateLimiter.js`
- `src/services/flagSync.js`
- `src/services/flagService.js`
- `src/services/attemptTracker.js`

---

## How to Retheme

1. Edit `src/views/*.ejs` and `src/views/partials/*.ejs` to change all visible text.
2. Edit `src/data/notes.json` to change seeded note content.
3. Edit `public/styles.css` to change colours and fonts.
4. Update this file (`STORY.md`) to reflect the new strings.
5. Do NOT change route paths, cookie names, or the `_engine` field in `/debug`.

---

## Alternative Theme Examples

- **Corporate Wiki:** "Pinnacle Knowledge Base," a long-forgotten internal wiki for a fictional consulting firm. Notes become wiki articles. The about page describes the wiki's history.
- **Recipe Blog:** "Gran's Kitchen," a recipe blog abandoned by a hobbyist. Notes become recipes. The maintenance log becomes a "recipe changelog."
- **Durham-specific:** "Dunelm Digital Notebook," a student note-taking tool from a fictional Durham University CS project. Notes become lecture summaries. The about page references the original student developer.

In each case, the exploit chain remains identical: inspect cookie, discover node-serialize, craft IIFE, read flag file.
