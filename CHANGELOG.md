# CHANGELOG.md
The logs will have newer updates at the top. Each entry is of the following format:

### Title - Date - CTF Number
- description

files changed (optional)

# Logs:









### Initial Commit - 26/01/26 - CTF 3
- Initial commit. There is a lot wrong with the current code, so we may have to fall back later, but its okay for now.
- We are currently working on getting docker working, and having the site up and running still.

### Login Limiter - 19/01/26 - CTF 2
- Added a login limiter.

### Fixed vault bug - 19/01/26 - CTF 2
- The vault had a bug where it had the flag on abcd12's account. The server didn't let me delete it.
I fixed this.

### Full CTF completion - 17/01/26 - CTF 2
- I added the complete implementation of the CTF. It is two stages, once the user solves the /app/challenge,
they will be able to use the secret JWT signature to forge the cookie. There still remains minor fixes to the CTF though.

### Modified Vault (/app/vault) - 17/01/26 - CTF 2
- Added a few users for realism, including the flag.

### Added Vault Feature (/app/vault) - 15/01/26 - CTF 2
- Built a /app/vault. It has a with a table interface displaying storing credentials. Implemented server-side storage in vaults.json with JWT-based authentication where vault entries are keyed by username extracted from the session token. Added complete CRUD API endpoints (GET, POST, DELETE) for vault management with intentional vulnerabilities including plaintext password storage and predictable entry IDs for CTF exploitation scenarios.

### Flag Generation - 10/12/25 - CTF 2
- I made a generator, similar to CTF1, where with usernames, we can generate individualised flags.

### Fixed refresh issue - 10/12/25 - CTF 2
- When logged in, if you refreshed it sent you straight back to the login page. I fixed this. I also added bootstrap/csv to make it look better.

### Initial Commit CTF2 - 10/12/25 - CTF 2
- Added general structure and got the basics of CTF working.

### Modified redme - 10/12/25 - CTF 1
- Changed readme. We now include instructions on how to add more players username/password and to generate the flags automatically.

### Added CHANGELOG.md - 05/12/25 - Repo
- Added this CHANGELOG.md file to log all changes.

### Updated flag generation. It now works properly. - 04/12/25 - CTF 1
- We modified basic1_generator.js to essentially use each username to act as a seed to generate a flag for each stuedent. It is deterministic.
- For each CTF, we will have a salt. So that for each CTF, username+salt generates a token for each student.
- It is automated too. If you add a new user, you can easily run the script to automatically get their flag, and so the CTF is now scalable.

### clear previous cookie session - 04/12/25 - CTF 1
- When switching accounts I found that it can someties remember the cookie. So I simply modified the JS to refresh it every time.

### flag_individualisation - 04/12/25 - CTF 1
- worked on the flag individualisation. Not fully complete yet though.

### Modified the hint - 03/12/25 - CTF 1
- The hint was out in the open. I removed it and made sure it only pops up after 4 reloads of the page /flag.

### removed challenge gen files - 27/11/25 - CTF 1
- I couldn't get Charles's Challenge generation to work. So I temporarily scrapped it.

### updated readme - 27/11/25 - CTF 1
- updated readme.

### fixed front-end CSV issues. Also fixed minor bug. - 27/11/25 - CTF 1
- The rate limiter had some issues, so we fixed that.
- Modified the CSV.

### added CSV and bootstrap - 27/11/25 - CTF 1
- Simply modified front end to include CSVs. Using bootstrap, it now isn't plain. This was a concern of David's and was a trivial fix.

### Introduced login rate limiter - 27/11/25 - CTF 1
- The CTF could be password brute forced, which allows admin access. This was unintended so I added a login rate limiter that makes brute force infeasible. Even if students refreshed their page, since we remember cookies, we can stop them logging in temporarily.

### updated solutions.md file - 24/11/25 - CTF 1
- Updated the solutions.md file.

### Removed uneeded vulnerability - 24/11/25 - CTF 1
- There was an issue, where if the player got the b64 cookie for an admin, they could paste it as the password and then log in as an admin. This was unintended so we fixed the faulty JS file.

### Added testing and a readme - 20/11/25 - CTF 1
- Added a readme file. There still needs to be work done on that as we go. We have also added testing.

### Fixed unintended path traversal vulnerability - 20/11/25 - CTF 1
- The CTF had an issue with path traversal which was unintended. So, I fixed that.

### Added SOLUTIONS.md file - 20/11/25 - CTF 1
- Added solutions file.

### Add full browser-based CTF (login bypass + insecure cookie) and remove old header auth challenge - 20/11/25 - CTF 1
- got it working (kind of). 

### feat: initial complete Node.js CTF implementation - 20/11/25 - CTF 1
- A barebones version of the site is up and running. We got the layout all set.
- Implemented Express server, routing modules, controllers, and services
- Added intentionally insecure auth middleware (X-Admin header bypass)
- Implemented protected /debug and /flag endpoints
- Added environment variable handling (.env, .env.example)
- Added static public page and basic config metadata (ctf-config.json)
- Verified working exploit and flag retrieval


### Added node modules - 20/11/25 - CTF 1
- Added Node modules and set up the directory /Advanced-Project/CTFs/Basic_1_Nodejs.
- 

### Initial Commit - 20/10/25 - Repo
- created the repo and added a description