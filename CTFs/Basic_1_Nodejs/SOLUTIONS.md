# CTF 1 -- Solutions

> **Instructors/markers only.** Do not distribute to participants.

---

## Credentials

- See `credentials.json` for generated per-user passwords.
- Usernames follow the `abcd12` format (4 letters + 2 digits).
- Generate credentials with: `cd CTFs/challenge-generation && node chgen_basic1.js abcd12 efgh34`

---

## Flag Location

Each user's flag is stored in `flags.json` keyed by username. When a user sets their cookie role to `admin`, the `/flag` endpoint looks up their username in `flags.json` and returns their per-user flag.

Flag format: `durham{<token>_<username>}`

---

## Overview

The Node.js CTF application includes:

- A login page (`/`)
- A home page (`/home`)
- An admin-only `/flag` page
- A deliberately insecure Base64 session cookie

To solve the CTF, students must escalate privileges from a normal user to admin by tampering with the session cookie, then retrieve the flag.

---

## Vulnerability: Insecure Base64 Session Cookie

The application stores session data in a cookie named `session`:

- The cookie contains JSON: `{"username": "abcd12", "role": "user"}`
- It is Base64-encoded with no signature, encryption, or protection
- The server fully trusts this cookie
- `httpOnly` is set to `false` so students can edit it in DevTools

Because of this, a user can decode, modify, and re-encode the cookie to escalate their role to `admin`.

---

## Exploitation Steps

### Step 1 -- Log in as a normal user

1. Go to `http://localhost:3000/`
2. Log in with a username and password from `credentials.json`
3. You will be redirected to `/home`

### Step 2 -- Attempt to access the admin area

Visit `http://localhost:3000/flag`

You will see "Admins only" with a hint suggesting you investigate how the site remembers your role.

### Step 3 -- Inspect the session cookie

1. Open Developer Tools
2. Go to Application (Chrome) or Storage (Firefox) > Cookies > `http://localhost:3000`
3. Locate the cookie named `session` and note its Base64 value

### Step 4 -- Decode the cookie

In the browser console:

```js
atob('<base64_cookie_value>')
```

You should see JSON like:

```json
{"username":"abcd12","role":"user"}
```

### Step 5 -- Modify the role

Change the JSON to set `"role": "admin"` (keep the same username):

```json
{"username":"abcd12","role":"admin"}
```

Re-encode to Base64:

```js
btoa('{"username":"abcd12","role":"admin"}')
```

### Step 6 -- Overwrite the cookie

1. Return to the browser's cookie editor
2. Replace the `session` value with the Base64 string you generated
3. Press Enter to save

### Step 7 -- Refresh /flag

Go back to `http://localhost:3000/flag`

The server now believes you are an admin, and your per-user flag will be displayed.

**Flag:** `durham{..._abcd12}` *(per-user, see flags.json)*

---

## Vulnerabilities Exploited

| Vulnerability | Location | Description |
|---------------|----------|-------------|
| Insecure session management | `authCookie.js` | Session stored in unsigned, unencrypted Base64 cookie |
| Privilege escalation | `flagController.js` | Role checked from client-controlled cookie data |
| Cookie trust | `publicController.js` | Cookie set with `httpOnly: false`, no signing |

---

## Reset

```bash
docker compose down && docker compose up --build
```

This reseeds users from the mounted `credentials.json`.
