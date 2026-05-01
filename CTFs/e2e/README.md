# CTF End-to-End Exploit Verification

Automated scripts that walk through every CTF's full exploit chain and confirm each flag is retrievable. Serves as regression testing for all exploit paths.

## Test Coverage

| Script | CTF | Flags | Tests | Exploit Technique |
|--------|-----|-------|-------|-------------------|
| `ctf1_exploit.py` | Basic_1_Nodejs | 1 | 2 | Base64 cookie tampering -> admin privilege escalation |
| `ctf2_exploit.py` | CTF_2_pswd_manager | 1 | 2 | PoW solve -> JWT secret disclosure -> JWT forgery -> vault IDOR |
| `ctf3_exploit.py` | CTF_3_HR-system | 2 | 10 | Path traversal + SQLi + debug API leak + AES-256-CBC decrypt |
| `ctf4_exploit.py` | CTF_4_corporate_helpdesk | 1 | 3 | DOM XSS -> admin bot exfiltration -> flag capture |
| `ctf5_exploit.py` | CTF_5_internal_blog | 4 | 8 | Info disclosure -> SSTI -> WAF bypass -> RCE |
| `ctf6_exploit.py` | CTF_6_veridian | 4 | 11 | SSRF -> cloud metadata -> Redis pivot (dict:// + gopher://) -> session replay |
| `ctf7_exploit.py` | CTF_7_notes_app | 1 | 6 | node-serialize@0.0.4 IIFE deserialisation (CVE-2017-5941) |
| `ctf8_exploit.py` | CTF_8_gazette | 3 | 4 | IDOR + missing server-side auth + `$(...)` command injection |
| `ctf9_exploit.py` | CTF_9_dunholm | 6 | 12 | Actuator info leak + `....//` traversal + RS256->HS256 forgery + blind SQLi + AES-GCM vault decrypt + log-leak & staff login |
| **Total** | | **23 flags** | **58 tests** | |

## Prerequisites

```bash
pip3 install -r requirements.txt
```

Dependencies: `requests`, `pytest`, `PyJWT`, `pycryptodome`, `cryptography`

## Usage

### Single CTF

Start the CTF's Docker containers, then run its exploit script:

```bash
# Example: CTF5
cd CTFs/CTF_5_internal_blog && docker compose up -d --build
cd CTFs/e2e && python3 -m pytest ctf5_exploit.py -v
```

### All CTFs

```bash
cd CTFs/e2e && ./run_all.sh
```

Or run them individually in sequence:

```bash
python3 -m pytest ctf1_exploit.py -v    # requires port 3000
python3 -m pytest ctf2_exploit.py -v    # requires ports 4000, 5173
python3 -m pytest ctf3_exploit.py -v    # requires ports 8004, 5174
python3 -m pytest ctf4_exploit.py -v    # requires ports 4001, 5176
python3 -m pytest ctf5_exploit.py -v    # requires port 5175
python3 -m pytest ctf6_exploit.py -v    # requires port 5180
python3 -m pytest ctf7_exploit.py -v    # requires port 3001
python3 -m pytest ctf8_exploit.py -v    # requires port 3002
python3 -m pytest ctf9_exploit.py -v    # requires port 3003
```

## Port Mapping

| CTF | Service | Port |
|-----|---------|------|
| CTF1 | Node.js app | 3000 |
| CTF2 | API / Frontend | 4000 / 5173 |
| CTF3 | Laravel API / React frontend / PostgreSQL | 8004 / 5174 / 5434 |
| CTF4 | Express API / React frontend / PostgreSQL / Redis | 4001 / 5176 / 5433 / 6380 |
| CTF5 | Flask app | 5175 |
| CTF6 | Rust/Actix-web app (+ internal metadata, Redis) | 5180 |
| CTF7 | Node.js notes app | 3001 |
| CTF8 | Go/Gin pressroom + SQLite | 3002 |
| CTF9 | Java/Spring Boot + PostgreSQL 16 + Redis 7 | 3003 |

## Credential Handling

Scripts auto-detect the first available user from each CTF's `credentials.json`. All CTFs use generated credentials (no hardcoded passwords).

## Startup Wait Times

Each script includes a `wait_for_service()` fixture that polls the target URL until it responds (up to 60-90s). For CTFs with databases, allow extra time after `docker compose up`:

- **CTF3**: ~30s for PostgreSQL + Laravel migrations
- **CTF4**: ~15s for PostgreSQL + Redis + bot initialization
- **CTF6**: ~30s for Rust build + Redis seeding
- **CTF1, CTF2, CTF5**: Ready within seconds

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `TimeoutError: Service not ready` | Container not running or still starting | `docker compose up -d` and wait |
| `KeyError` on credentials | `credentials.json` out of sync with DB | Rebuild: `docker compose down -v && docker compose up -d --build` |
| CTF2 PoW takes >30s | Unexpected difficulty level | Check `GET /api/challenge`; difficulty=4 solves in <5s |
| CTF4 flag not in captures | Bot can't reach `web:5173` | Check `docker compose logs bot` |
| CTF5 "Blocked" on flag3/4 | Double-escaped hex in payload | Test payload manually with `curl` |
| CTF6 metadata returns error | Metadata container not started | Check `docker compose logs metadata` |
| CTF6 dict:// returns empty | Redis keys not seeded | Rebuild: `docker compose down -v && docker compose up --build` |
| CTF6 KEYS * returns `*0` | seed.sh used `shutdown nosave` | Ensure seed.sh uses `shutdown save` |
