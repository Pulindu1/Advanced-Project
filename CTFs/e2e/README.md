# CTF End-to-End Exploit Verification

Automated scripts that walk through every CTF's full exploit chain and confirm each flag is retrievable. Serves as regression testing for all exploit paths.

## Test Coverage

| Script | CTF | Flags | Tests | Exploit Technique |
|--------|-----|-------|-------|-------------------|
| `ctf1_exploit.py` | Basic_1_Nodejs | 1 | 2 | Base64 cookie tampering -> admin privilege escalation |
| `ctf2_exploit.py` | CTF_2_pswd_manager | 1 | 2 | PoW solve -> JWT secret disclosure -> JWT forgery -> vault IDOR |
| `ctf3_exploit.py` | CTF_3_HR-system | 4 | 6 | Path traversal + JS bundle key + SQLi + AES-256-CBC decrypt |
| `ctf4_exploit.py` | CTF_4_corporate_helpdesk | 1 | 3 | DOM XSS -> admin bot exfiltration -> flag capture |
| `ctf5_exploit.py` | CTF_5_internal_blog | 4 | 8 | Info disclosure -> SSTI -> WAF bypass -> RCE |
| `ctf6_exploit.py` | CTF_6_veridian | 4 | 10 | SSRF -> cloud metadata -> dict:// Redis pivot -> session replay |
| **Total** | | **15 flags** | **31 tests** | |

## Prerequisites

```bash
pip3 install -r requirements.txt
```

Dependencies: `requests`, `pytest`, `PyJWT`, `pycryptodome`

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

Or run them individually in sequence (CTF3 and CTF4 share port 5174, so they cannot run simultaneously):

```bash
python3 -m pytest ctf1_exploit.py -v    # requires port 3000
python3 -m pytest ctf2_exploit.py -v    # requires ports 4000, 5173
python3 -m pytest ctf3_exploit.py -v    # requires ports 8004, 5174
python3 -m pytest ctf4_exploit.py -v    # requires ports 4001, 5174
python3 -m pytest ctf5_exploit.py -v    # requires port 5175
python3 -m pytest ctf6_exploit.py -v    # requires port 5180
```

## Port Mapping

| CTF | Service | Port |
|-----|---------|------|
| CTF1 | Node.js app | 3000 |
| CTF2 | API / Frontend | 4000 / 5173 |
| CTF3 | Laravel API / React frontend / PostgreSQL | 8004 / 5174 / 5434 |
| CTF4 | Express API / React frontend / PostgreSQL / Redis | 4001 / 5174 / 5433 / 6380 |
| CTF5 | Flask app | 5175 |
| CTF6 | Rust/Actix-web app (+ internal metadata, Redis) | 5180 |

**Conflict:** CTF3 and CTF4 both bind to port 5174. Stop one before starting the other.

## Credential Handling

Scripts auto-detect the first available user from each CTF's `credentials.json`. No hardcoded passwords for CTFs 3-5 (they use generated credentials). CTF1 and CTF2 use the default `abcd12` / `password`.

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
| CTF4 port conflict | CTF3 still running on 5174 | `cd CTF_3_HR-system && docker compose down` |
| CTF5 "Blocked" on flag3/4 | Double-escaped hex in payload | Test payload manually with `curl` |
| CTF6 metadata returns error | Metadata container not started | Check `docker compose logs metadata` |
| CTF6 dict:// returns empty | Redis keys not seeded | Rebuild: `docker compose down -v && docker compose up --build` |
| CTF6 KEYS * returns `*0` | seed.sh used `shutdown nosave` | Ensure seed.sh uses `shutdown save` |
