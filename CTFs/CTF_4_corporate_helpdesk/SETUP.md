# Setup Guide

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development only)
- Git

## Quick Start (Docker - Recommended)

1. **Clone and navigate to the project:**
   ```bash
   cd CTFs/CTF_4_corporate_helpdesk
   ```

2. **Copy environment variables:**
   ```bash
   cp .env.example .env
   ```

3. **Start all services:**
   ```bash
   docker compose up --build
   ```

4. **Wait for all services to start:**
   - API: http://localhost:4001
   - Frontend: http://localhost:5174
   - Database: localhost:5433
   - Redis: localhost:6380

5. **Access the application:**
   Open http://localhost:5174 in your browser

## Local Development (Without Docker)

### 1. Setup Database

Install PostgreSQL and create database:
```bash
createdb intradesk_kb
psql intradesk_kb < infra/init.sql
```

### 2. Setup Redis

Install and start Redis:
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu
sudo apt install redis-server
sudo systemctl start redis
```

### 3. Install Dependencies

```bash
# Root
npm install

# API
cd apps/api
npm install

# Web
cd apps/web
npm install

# Bot
cd apps/bot
npm install
npx playwright install chromium
```

### 4. Start Services

In separate terminals:

```bash
# Terminal 1 - API
cd apps/api
npm run dev

# Terminal 2 - Web
cd apps/web
npm run dev

# Terminal 3 - Bot
cd apps/bot
npm run dev
```

## Default Credentials

**Admin Account:**
- Email: `admin@intradesk.local`
- Password: `admin_secure_password_123`

**Test User (create via registration):**
- Any email/password combination

## Testing the Challenge

1. **Register a new user:**
   - Go to http://localhost:5174/register
   - Create an account

2. **Explore the Knowledge Base:**
   - Search for articles
   - Notice the search term in the URL: `/kb?search=password`

3. **Test for XSS:**
   - Try: `/kb?search=<b>test</b>`
   - If bold text appears, XSS is possible!

4. **Craft exploit:**
   - Create payload to steal admin's cookie
   - Report the crafted URL
   - Wait for admin bot to visit

5. **Check exfiltration:**
   - Data will be logged in `exfil_logs` table

## Troubleshooting

### Port already in use
```bash
# Find and kill process using port 4001
lsof -ti:4001 | xargs kill -9

# Or use different ports in .env
```

### Database connection failed
```bash
# Check if PostgreSQL is running
docker compose ps db

# View logs
docker compose logs db
```

### Bot not processing reports
```bash
# Check bot logs
docker compose logs bot

# Check Redis connection
docker compose logs redis
```

### Frontend not loading
```bash
# Check if Vite dev server is running
docker compose logs web

# Rebuild frontend
cd apps/web
npm run build
```

## Architecture

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ HTTP
       ▼
┌─────────────┐         ┌──────────┐
│  Frontend   │────────▶│   API    │
│  (React)    │  Axios  │ (Express)│
└─────────────┘         └────┬─────┘
                             │
                    ┌────────┴────────┐
                    │                 │
              ┌─────▼─────┐    ┌─────▼─────┐
              │ PostgreSQL│    │   Redis   │
              └───────────┘    └─────┬─────┘
                                     │
                                     │ Queue
                                     ▼
                              ┌─────────────┐
                              │     Bot     │
                              │ (Playwright)│
                              └─────────────┘
```

## Next Steps

After completing Objectives 0 and 1, continue with:
- Objective 2: Implement the DOM XSS vulnerability
- Objective 3: Add admin bot functionality
- Objective 4: Create challenge generation integration
- Objective 5: Add scoring and flag validation
