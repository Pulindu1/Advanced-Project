SORT THIS OUT LATER
# Sources Used for CTFs 1–4

This document outlines all sources used in the design and implementation of each CTF challenge, including academic literature, platforms, technical documentation, and direct project influences.

---

# 🔐 CTF 1 — Basic_1_Nodejs (Insecure Session Cookie)

## 📚 Academic / Literature Sources

* Meinsma et al. (2022) — CTF pedagogical structuring
  [https://doi.org/10.1145/3478432.3499122](https://doi.org/10.1145/3478432.3499122)
* Balaji et al. (2025) — Multi-level CTF progression
  [https://www.mdpi.com/2076-3417/15/13/7159](https://www.mdpi.com/2076-3417/15/13/7159)

## 🌐 CTF / Platform Inspiration

* picoCTF
  [https://picoctf.org](https://picoctf.org)
* OverTheWire
  [https://overthewire.org](https://overthewire.org)

## 💻 Technical / Implementation Sources

* Express.js Documentation
  [https://expressjs.com](https://expressjs.com)
* Node.js Documentation
  [https://nodejs.org](https://nodejs.org)

## 🧠 Key Design Influence

* Insecure session handling via unsigned cookies
* Privilege escalation through client-side manipulation

---

# 🔑 CTF 2 — Password Manager (JWT + Proof-of-Work)

## 📚 Academic / Literature Sources

* Yan & Li (2024) — Multi-stage exploit learning
  [https://dl.acm.org/doi/10.1145/3626252](https://dl.acm.org/doi/10.1145/3626252)

## 🌐 CTF / Platform Inspiration

* Hack The Box
  [https://www.hackthebox.com](https://www.hackthebox.com)
* PortSwigger Web Security Academy
  [https://portswigger.net/web-security](https://portswigger.net/web-security)
* picoCTF
  [https://picoctf.org](https://picoctf.org)

## 💻 Technical / Implementation Sources

* JWT Introduction
  [https://jwt.io/introduction](https://jwt.io/introduction)
* jsonwebtoken library
  [https://www.npmjs.com/package/jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken)

## 🧠 Key Design Influence

* Proof-of-Work used to expose sensitive data
* Weak JWT secret leading to token forgery

---

# 🗄️ CTF 3 — HR System (SQLi + Crypto + Info Disclosure)

## 📚 Academic / Literature Sources

* OWASP Top 10 (Injection & Sensitive Data Exposure)
  [https://owasp.org/www-project-top-ten/](https://owasp.org/www-project-top-ten/)

## 🌐 CTF / Platform Inspiration

* PortSwigger SQL Injection Labs
  [https://portswigger.net/web-security/sql-injection](https://portswigger.net/web-security/sql-injection)
* Hack The Box
  [https://www.hackthebox.com](https://www.hackthebox.com)
* picoCTF
  [https://picoctf.org](https://picoctf.org)

## 💻 Technical / Implementation Sources

* Laravel Documentation
  [https://laravel.com/docs](https://laravel.com/docs)
* PostgreSQL Documentation
  [https://www.postgresql.org/docs](https://www.postgresql.org/docs)
* AES Encryption Overview
  [https://en.wikipedia.org/wiki/Advanced_Encryption_Standard](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard)

## 🧠 Key Design Influence

* Multi-stage SQL injection leading to data extraction
* Information disclosure through debug endpoints
* Cryptographic misuse for flag protection

---

# 🧩 CTF 4 — Corporate Helpdesk (DOM XSS + Bot Exploitation)

## 📚 Academic / Literature Sources

* Multi-stage attack design theory (project plan based)
* Yan & Li (2024) — Advanced exploitation pedagogy
  [https://dl.acm.org/doi/10.1145/3626252](https://dl.acm.org/doi/10.1145/3626252)

## 🌐 CTF / Platform Inspiration

* PortSwigger XSS Labs
  [https://portswigger.net/web-security/cross-site-scripting](https://portswigger.net/web-security/cross-site-scripting)
* Hack The Box
  [https://www.hackthebox.com](https://www.hackthebox.com)

## 💻 Technical / Implementation Sources

* React Documentation
  [https://react.dev](https://react.dev)
* Playwright Documentation
  [https://playwright.dev](https://playwright.dev)
* BullMQ Documentation
  [https://docs.bullmq.io](https://docs.bullmq.io)

## 🧠 Key Design Influence

* DOM-based XSS via unsafe rendering (innerHTML)
* Admin bot simulation for privilege escalation
* Multi-step exploit chain (user → admin → flag)

---

# 🔁 Cross-CTF Sources (Used Across All Challenges)

## 📚 Academic

* Meinsma et al. (2022)
* Balaji et al. (2025)
* Yan & Li (2024)

## 🌐 Platforms

* picoCTF — [https://picoctf.org](https://picoctf.org)
* Hack The Box — [https://www.hackthebox.com](https://www.hackthebox.com)
* PortSwigger — [https://portswigger.net/web-security](https://portswigger.net/web-security)

## 🏗️ Design Principles

* Progressive difficulty (Basic → Intermediate → Advanced)
* Breadcrumbing (multi-step learning progression)
* Realistic modern tech stacks (Node.js, React, APIs)

---

# 🧾 Summary Statement

The design of CTFs 1–4 was informed by a combination of academic literature on cybersecurity education, established CTF platforms, and practical security documentation. These sources guided both the selection of vulnerabilities and the structuring of challenges, ensuring a progression from foundational exploits to realistic, multi-stage attack chains aligned with modern web application security pr
