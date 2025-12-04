# SOLUTIONS.md

### Walkthrough & Explanation of Vulnerabilities in the Basic Node.js CTF

This document explains how to solve the CTF challenge and describes the
underlying security vulnerabilities. The challenge is designed so it can
be solved entirely through the browser using built-in developer tools.

------------------------------------------------------------------------

# 1. Overview of the Challenge

The Node.js CTF application includes:

-   A login page (`/`)
-   A home page (`/home`)
-   An admin-only `\flag` page
-   A deliberately insecure Base64 session cookie

To solve the CTF, students must escalate privileges from a normal
"student" user to an admin and retrieve the flag.

------------------------------------------------------------------------

# 2. Vulnerability: Insecure Base64 Session Cookie

## Description

Even though the login form now requires the correct password for every
user (including `admin`), the application still trusts whatever is stored
in the `session` cookie. When a user logs in normally (e.g. as
`student`), the application stores their session in a cookie named
`session`:

-   The cookie contains JSON (`{ "username": "...", "role": "..." }`)
-   It is simply Base64-encoded
-   It is not signed, encrypted, or protected
-   The server fully trusts this cookie

Because of this, a user can decode, modify, and re-encode the cookie to
escalate their role to `admin`.

# 3. Exploitation Steps (Cookie Tampering Path)

## Step 1 --- Log in as a normal user

1.  Go to: `http://localhost:3000/`
2.  Log in using one of the example student accounts (your cohort will use real IDs):
        - **Username:** `abcd12`  
            **Password:** `password`
        - **Username:** `efgh34`  
            **Password:** `password`
3.  You will be redirected to `/home`.

------------------------------------------------------------------------

## Step 2 --- Attempt to access the admin area

Visit:

`http://localhost:3000/flag`

You will see:

-   "Admins only"
-   A hint suggesting that you investigate how the site remembers your
    role.

------------------------------------------------------------------------

## Step 3 --- Inspect the session cookie

1.  Open Developer Tools.
2.  Go to Application (Chrome) or Storage (Firefox) → Cookies → `http://localhost:3000`.
3.  Locate the cookie named `session` and note its value (a Base64 string).

------------------------------------------------------------------------

## Step 4 --- Decode the cookie

In the browser console run (replace <base64> with the cookie value):

```js
atob('<base64>')
```

You should see JSON like:

```json
{"username":"abcd12","role":"user"}
```

------------------------------------------------------------------------

## Step 5 --- Modify the role

Change the JSON to set `"role": "admin"` (keep the same `username`). For example:

```json
{"username":"abcd12","role":"admin"}
```

Re-encode to Base64 in the console:

```js
btoa('{"username":"abcd12","role":"admin"}')
```

This produces a new Base64 string to paste back into the cookie editor.

------------------------------------------------------------------------

## Step 6 --- Overwrite the cookie

1. Return to the browser's cookie editor.
2. Replace the `session` value with the Base64 string you just generated (paste the Base64, not the raw JSON).
3. Press Enter to save it.

Because the cookie is intentionally not protected (`httpOnly: false` and unsigned), the browser accepts this change.

------------------------------------------------------------------------

## Step 7 --- Refresh `/flag`

Go back to:

`http://localhost:3000/flag`

Because the server now believes you are an admin, the flag will be
displayed.

------------------------------------------------------------------------

# 4. What These Vulnerabilities Demonstrate

## ✔ Insecure Session Management

-   Storing role information in an unsigned cookie\
-   Full trust in client-controlled data

## ✔ Privilege Escalation

-   A user can promote themselves from `user` to `admin` by modifying a
    cookie

# 5. Recommended Fixes

Although not required for the CTF, the proper security controls would
include:

### 1. Secure Authentication

-   Always verify passwords
-   Never introduce special-case bypass logic

### 2. Secure Cookie Handling

-   Use server-signed cookies (`signed: true`)
-   Set `httpOnly: true`
-   Avoid storing role or privilege information on the client

### 3. Reliable Authorization

-   Always check privileges using trusted server-side state

# 6. Summary

To solve the CTF, students must exploit **a privilege escalation flaw**
by decoding and modifying the insecure Base64 session cookie. This single
vulnerability is enough to jump from a normal user to an admin and
retrieve the flag, showing how fragile applications become when they
trust client-controlled state.

------------------------------------------------------------------------
