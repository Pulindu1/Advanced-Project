# Basic Node.js Web CTF Challenge

This repository contains a beginner-friendly web security Capture The Flag challenge built using **Node.js** and **Express**.  
The site is designed for students learning about **authentication flaws**, **insecure session management**, and **client-side trust issues**.

The CTF is fully browser-based — no external tools like curl, Burp Suite, or command-line exploits are required.

---

## 🕸️ Challenge Website

Once running, the application is hosted locally at:

http://localhost:3000/

The website includes:

- A login page (`/`)
- A user home page (`/home`)
- An admin-only page containing the flag (`/flag`)
- A deliberately insecure session cookie
- A flawed authentication mechanism for demonstration purposes

Students must identify and exploit the security weaknesses to retrieve the flag.

---

## 📘 Overview

This CTF models a realistic scenario where a web application suffers from:

- **Broken authentication**  
- **Insecure client-side session storage**  
- **Privilege escalation vulnerabilities**

Participants authenticate as a normal user, inspect the application behaviour using browser tools, discover insecure mechanisms, and escalate themselves to an admin.

**One-sentence summary of the solution:**  
The challenge is solved by understanding how the site stores user roles and exploiting insecure authentication/session logic — full details are available in `SOLUTIONS.md`.

---

## 🚀 Getting Started

### 1. Install dependencies

```
npm install
```

### 2. Start the server

```
npm run dev
```

You should see:

```
[*] Node CTF listening on http://localhost:3000
```

### 3. Open the challenge

Visit:

http://localhost:3000/

---

## 🧪 Testing & Verification

This project includes both **manual** and **automated** testing approaches to ensure that only the intended vulnerabilities exist.

### ✔ Manual Testing

Performed to confirm:

- `/home` is protected and requires login  
- `/flag` only grants access to admin role  
- Session cookies behave as designed  
- No accidental endpoints are exposed  
- No stack traces or server errors appear  
- The challenge is solvable entirely via the browser  

### ✔ Fuzz Testing

The application was stress-tested using high-rate HTTP fuzzing tools.  
Highlights:

- **0 server crashes**
- **0 unintended 500 errors**
- **Rapid, stable response times**
- **All invalid requests handled gracefully**

This verifies that the CTF has a controlled attack surface and does not contain unintended vulnerabilities.

### ✔ Automated Testing (Optional)

The repository supports adding Jest + Supertest tests to validate:

- Access control behaviour  
- Route safety  
- Cookie handling  
- Error response consistency  

(These can be added if needed for assessment.)

---

## 📁 Repository Structure

```
src/
  routes/
  controllers/
  middleware/
  services/
  data/
  public/
  app.js
  server.js

.env (local only)
SOLUTIONS.md
README.md
```

---

## 🏁 Flag Retrieval (For Markers)

To retrieve the flag as an evaluator, follow the documented walkthrough in:

SOLUTIONS.md

This file explains the vulnerabilities, the exploitation steps, and the security principles demonstrated by the challenge.

---

## 📚 Educational Purpose

This CTF is intended for learning and assessment in controlled environments.  
It demonstrates why:

- Authentication logic must be robust  
- Cookies must be signed or server-side  
- User roles must never be stored client-side  
- Clients cannot be trusted  

It is **not** intended for deployment on production systems.

---

## 📝 License

This project is provided for academic and educational use.
