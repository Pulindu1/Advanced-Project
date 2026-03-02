# CTF Challenge Management Scripts

This directory contains utility scripts for managing and debugging the CTF challenge.

## Scripts

### 1. `health-check.sh`
**Purpose:** Quick health check of all services and database state

**Usage:**
```bash
./scripts/health-check.sh
```

**What it checks:**
- Container status
- Service availability (API, Web)
- Database stats (users, articles, reports)
- Queue status
- Environment configuration

---

### 2. `reset-challenge.sh`
**Purpose:** Reset the challenge to a clean state

**Usage:**
```bash
# Clear reports and exfil logs only
./scripts/reset-challenge.sh

# Also rotate the FLAG_SECRET (invalidates all existing flags)
./scripts/reset-challenge.sh --rotate-flag
```

**What it does:**
- Deletes all reports from database
- Deletes all exfiltration logs
- Resets database sequences
- Clears Redis queue
- Optionally rotates FLAG_SECRET and restarts API

**When to use:**
- Between testing sessions
- When preparing for a new player
- If you want to invalidate all existing flags

---

### 3. `collect-logs.sh`
**Purpose:** Collect logs from all services for debugging

**Usage:**
```bash
./scripts/collect-logs.sh
```

**What it collects:**
- Last 500 lines from API logs
- Last 500 lines from bot logs
- Last 500 lines from web logs
- Recent reports from database
- Recent exfil logs
- Redis info

**Output:** Creates timestamped log files in `logs/` directory

**When to use:**
- Debugging bot issues
- Investigating failed reports
- Analyzing player attempts
- Troubleshooting the challenge

---

## Common Operations

### View live bot logs
```bash
docker logs intradesk-bot -f
```

### View live API logs
```bash
docker logs intradesk-api -f
```

### Check report status
```bash
docker compose exec db psql -d ctf_db -c "SELECT id, status, url, created_at, visited_at FROM reports ORDER BY id DESC LIMIT 10;"
```

### Check exfiltration attempts
```bash
docker compose exec db psql -d ctf_db -c "SELECT * FROM exfil_logs ORDER BY created_at DESC LIMIT 10;"
```

### Restart specific service
```bash
docker compose restart api
docker compose restart bot
```

### Rebuild and restart all services
```bash
docker compose up -d --build
```

---

## Troubleshooting

### Bot not processing reports
1. Check bot logs: `docker logs intradesk-bot -f`
2. Check Redis queue: `docker compose exec redis redis-cli LLEN "bull:reports:wait"`
3. Restart bot: `docker compose restart bot`

### Rate limit errors
- Rate limit: 10 reports per hour per user
- Wait 1 hour or restart API to reset: `docker compose restart api`

### Database issues
- Check health: `./scripts/health-check.sh`
- Reset: `./scripts/reset-challenge.sh`

### Flag issues
- Verify FLAG_SECRET is set in `.env`
- Rotate flags: `./scripts/reset-challenge.sh --rotate-flag`
- Verify computation: Test `/api/admin/flag?reportId=X` as admin
