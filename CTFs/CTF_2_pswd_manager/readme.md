CTF_2 Password Manager (skeleton)
================================

This folder contains a minimal, secure-by-design React + Vite TypeScript skeleton for the CTF password manager.

Quick start

1. From this folder install dependencies:

```bash
cd CTFs/CTF_2_pswd_manager
npm install
npm run dev
```

2. Open http://localhost:5173

Security notes
- Crypto logic is isolated in `src/lib/crypto/cryptoService.ts` and uses the Web Crypto API.
- Tokens are kept in-memory by default in `src/lib/auth/tokenStorage.ts` to avoid persisting secrets to localStorage.
- API calls should go through `src/lib/http/client.ts` which centralises headers and error handling.

Structure
- `src/app` – app root, providers and layouts
- `src/features` – feature-based modules (auth, vault, teams, activity, settings)
- `src/lib` – low-level helpers (crypto, http, storage)

This scaffold intentionally contains placeholder logic for authentication and data; flesh out backend API calls and storage according to your deployment model.
