# Advanced-Project
A repo to store all my progress on my Advanced Computer Science Project (Masters Project) as part of my MEng Computer Science dissertation for Durham University.

## Run the CTFs locally

This repository contains two CTF example apps. Quick commands below show how to start each one locally for development.

- CTF1: Basic Node.js CTF (EJS + Express)

	```bash
	# from repo root
	cd CTFs/Basic_1_Nodejs
	npm install
	# run in development (auto-restarts on change)
	npm run dev
	# or run once:
	npm run start
	# open in browser:
	# http://localhost:3000 (or the port printed by the server)
	```

- CTF2: Password Manager skeleton (Vite + React + demo auth server)

	```bash
	# from repo root
	cd CTFs/CTF_2_pswd_manager
	npm install

	# Start the demo auth backend (foreground - useful for debugging):
	npm run server

	# OR start backend in background and save logs/pid (Unix/macOS):
	# Start: runs the server and writes logs to server.log, pid to server.pid
	nohup npm run server > server.log 2>&1 & echo $! > server.pid
	# Stop: kill $(cat server.pid)

	# Start the frontend dev server in a second terminal
	npm run dev

	# Vite prints the exact local URL to open (example):
	# http://localhost:5173
	```

Notes
- The CTF2 demo backend listens on port 4000 by default and the frontend is configured to proxy `/api` to the backend during development so cookies and session requests work correctly.
- For CTF2 you can override the `JWT_SECRET` environment variable for the demo server if you need a persistent secret:

Verification (quick curl checks)

```bash
# Replace 5173 with the port Vite prints if different
curl -i -X POST http://localhost:5173/api/auth/login \
	-H "Content-Type: application/json" \
	-d '{"username":"abcd12","password":"password"}' -c /tmp/cookies.txt

curl -i http://localhost:5173/api/auth/whoami -b /tmp/cookies.txt
```

```bash
JWT_SECRET="my-secret" npm run server
```

Remove or harden demo credentials before using these apps in a production environment.
