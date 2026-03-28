# CTF Docker Containerisation Workflow

**Project:** Designing and Deploying Realistic Web Exploitation CTF Challenges
**Goal:** Each CTF challenge must be fully self-contained and launchable with `docker compose up --build` — no host dependencies beyond Docker Desktop.

---

## Table of Contents

1. [Current State Summary](#1-current-state-summary)
2. [Target Repository Structure](#2-target-repository-structure)
3. [CTF 1 — Basic Node.js (Basic_1_Nodejs)](#3-ctf-1--basic-nodejs)
4. [CTF 2 — Password Manager (CTF_2_pswd_manager)](#4-ctf-2--password-manager)
5. [CTF 3 — HR System (CTF_3_HR-system)](#5-ctf-3--hr-system)
6. [CTF 4 — Corporate Helpdesk (CTF_4_corporate_helpdesk)](#6-ctf-4--corporate-helpdesk)
7. [Root-Level Orchestration (Optional)](#7-root-level-orchestration-optional)
8. [Testing Checklist](#8-testing-checklist)
9. [Port Allocation Reference](#9-port-allocation-reference)

---

## 1. Current State Summary

| CTF | Dockerfile(s) | docker-compose.yml | .env.example | Status |
|-----|---------------|--------------------|--------------|--------|
| CTF 1 — Basic Node.js | None | None | Yes | Needs full Docker setup |
| CTF 2 — Password Manager | None | None | None | Needs full Docker setup |
| CTF 3 — HR System (Laravel + React + Postgres) | None | Partial (DB only) | Yes (backend only) | Needs app Dockerfiles + compose update |
| CTF 4 — Corporate Helpdesk (Node + React + Postgres + Redis + Bot) | Yes (api, web, bot) | Yes (complete) | Yes | Essentially complete — minor hardening only |

---

## 2. Target Repository Structure

```
CTFs/
  Basic_1_Nodejs/
    Dockerfile              ← NEW
    docker-compose.yml      ← NEW
    .env.example            ← exists
    src/
    package.json
  CTF_2_pswd_manager/
    Dockerfile              ← NEW (multi-stage: api + frontend)
    docker-compose.yml      ← NEW
    .env.example            ← NEW
    server/
    src/
    package.json
  CTF_3_HR-system/
    docker-compose.yml      ← UPDATE (currently DB-only)
    .env.example            ← UPDATE (add frontend vars)
    backend/
      Dockerfile            ← NEW
      .env.example          ← exists
    frontend/
      Dockerfile            ← NEW
  CTF_4_corporate_helpdesk/
    docker-compose.yml      ← exists (complete)
    .env.example            ← exists
    apps/
      api/Dockerfile        ← exists
      web/Dockerfile        ← exists
      bot/Dockerfile        ← exists
    infra/
      init.sql              ← exists
```

---

## 3. CTF 1 — Basic Node.js

### Architecture

- **Stack:** Node.js 20, Express, EJS templates
- **Storage:** JSON flat files in `src/data/` (no external database)
- **Services required:** 1 container (the Node app)
- **Vulnerability category:** Broken authentication, insecure cookies, privilege escalation

### What needs to be created

#### `Basic_1_Nodejs/Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]
```

**Notes:**
- `npm ci --omit=dev` excludes `nodemon` and `jest` from the production image, keeping it minimal.
- No build step needed — pure CommonJS.
- Data files (`src/data/flags.json`) are baked into the image on `COPY . .`. If persistent writable state is needed for resets, a named volume can be added later.

#### `Basic_1_Nodejs/docker-compose.yml`

```yaml
version: "3.9"

services:
  app:
    build: .
    container_name: ctf1-basic-nodejs
    ports:
      - "3000:3000"
    env_file:
      - .env
    restart: unless-stopped
```

**Notes:**
- Single-service compose. No external DB or Redis required.
- Port `3000` on host maps to `3000` inside the container.
- `.env` provides `PORT` and `FLAG`. The `.env.example` already exists with the right keys.

#### `.env` (for deployment — copy from `.env.example`)

```
PORT=3000
FLAG=durham{example_flag_for_readme}
```

### Startup workflow

```bash
cd CTFs/Basic_1_Nodejs
cp .env.example .env
# Edit .env to set the real flag value
docker compose up --build
```

App available at: `http://localhost:3000`

### Reset procedure

```bash
docker compose down
docker compose up --build
```

Because there is no external volume for state (all data is baked in), each `down` + `up` cycle gives a clean instance.

---

## 4. CTF 2 — Password Manager

### Architecture

- **Stack:** Node.js backend (Express + bcryptjs + JWT), React + Vite frontend
- **Storage:** JSON flat files in `server/data/` (no external database)
- **Services required:** 2 containers — `api` (Express) and `web` (Vite/React served by Nginx or Vite preview)
- **Vulnerability category:** JWT secret disclosure via Proof-of-Work, JWT forgery, IDOR on vault endpoint

### What needs to be created

#### `CTF_2_pswd_manager/Dockerfile` (multi-stage)

Use a multi-stage build to produce two separate images from a single file, or use two separate Dockerfiles. Two separate files is cleaner for Compose:

**`server/Dockerfile`** (API):

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 4000

CMD ["node", "server/index.js"]
```

**`Dockerfile`** (Frontend — Vite build served via Nginx):

```dockerfile
# Stage 1: build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

# Stage 2: serve
FROM nginx:stable-alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config to proxy /api → backend and serve SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
```

**`nginx.conf`** (to create in `CTF_2_pswd_manager/`):

```nginx
server {
    listen 80;

    location /api {
        proxy_pass http://api:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

> **Alternative (simpler):** Keep Vite's dev server in the container (`CMD ["npm", "run", "dev", "--", "--host"]`). This avoids Nginx but is less production-realistic. For a CTF this is acceptable.

#### `CTF_2_pswd_manager/docker-compose.yml`

```yaml
version: "3.9"

services:
  api:
    build:
      context: .
      dockerfile: server/Dockerfile
    container_name: ctf2-api
    ports:
      - "4000:4000"
    env_file:
      - .env
    volumes:
      - ctf2-data:/app/server/data
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ctf2-web
    ports:
      - "5173:80"
    depends_on:
      - api
    restart: unless-stopped

volumes:
  ctf2-data:
```

**Notes:**
- `ctf2-data` volume persists `server/data/` (flags, vaults, users) across container restarts without rebuilding.
- To reset to clean state: `docker compose down -v` (removes the volume) then `docker compose up --build`.

#### `CTF_2_pswd_manager/.env.example`

```
PORT=4000
JWT_SECRET=dev-secret-change-me
NODE_ENV=production
CTF_DEV=false
```

### Startup workflow

```bash
cd CTFs/CTF_2_pswd_manager
cp .env.example .env
docker compose up --build
```

- API: `http://localhost:4000`
- Frontend: `http://localhost:5173`

### Reset procedure

```bash
docker compose down -v   # -v removes the data volume for a clean state
docker compose up --build
```

---

## 5. CTF 3 — HR System

### Architecture

- **Stack:** Laravel 11 (PHP 8.2) backend, React + Vite frontend, PostgreSQL 16
- **Storage:** PostgreSQL with Laravel migrations and seeders
- **Services required:** 3 containers — `db` (Postgres), `backend` (Laravel/PHP), `frontend` (React/Vite)
- **Vulnerability category:** SQL injection, path traversal, debug API exposure, client-side key exposure

### Current state

The `docker-compose.yml` exists but **only starts the Postgres database**. The Laravel backend and React frontend have no Dockerfiles and are not wired into Compose. The backend `.env.example` exists but references `127.0.0.1` as the DB host, which must be changed to the Docker service name `db`.

### What needs to be created

#### `CTF_3_HR-system/backend/Dockerfile`

```dockerfile
FROM php:8.2-cli

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpq-dev \
    unzip \
    && docker-php-ext-install pdo pdo_pgsql \
    && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:2.7 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-interaction

COPY . .

RUN cp .env.example .env && php artisan key:generate --force

RUN chown -R www-data:www-data storage bootstrap/cache
RUN chmod -R 775 storage bootstrap/cache

EXPOSE 8004

CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8004"]
```

**Notes:**
- Uses `php:8.2-cli` and `php artisan serve`. For a more production-like setup, swap to `php:8.2-fpm` + Nginx, but for a CTF `artisan serve` is sufficient.
- `pdo_pgsql` extension is required for the PostgreSQL connection.
- Laravel's `.env` is generated from `.env.example` at build time; the real secrets are injected at runtime via environment variables in Compose (overriding the baked-in values).

#### `CTF_3_HR-system/frontend/Dockerfile`

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build with API URL pointing to the Dockerised backend
ARG VITE_API_URL=http://localhost:8004
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:stable-alpine

COPY --from=builder /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
```

**`CTF_3_HR-system/frontend/nginx.conf`** (to create):

```nginx
server {
    listen 80;

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

> The frontend makes API calls to `VITE_API_URL`. In Docker, the browser makes requests from the user's machine, so this must be `http://localhost:8004` (the host-exposed port), not the internal service name.

#### `CTF_3_HR-system/docker-compose.yml` (replace existing)

```yaml
version: "3.9"

services:
  db:
    image: postgres:16-alpine
    container_name: ctf3-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: hr_system
      POSTGRES_USER: hr_admin
      POSTGRES_PASSWORD: hr_secure_pwd_2026
    ports:
      - "5434:5432"
    volumes:
      - ctf3-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hr_admin -d hr_system"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: ctf3-backend
    ports:
      - "8004:8004"
    environment:
      DB_HOST: db
      DB_PORT: 5432
      DB_DATABASE: hr_system
      DB_USERNAME: hr_admin
      DB_PASSWORD: hr_secure_pwd_2026
      APP_ENV: production
      APP_DEBUG: "false"
      JWT_SECRET: ${JWT_SECRET:-change-this-before-deployment}
    depends_on:
      db:
        condition: service_healthy
    networks:
      - ctf3-network
    # Run migrations and seeders automatically on first boot
    command: >
      sh -c "php artisan migrate --force &&
             php artisan db:seed --force &&
             php artisan serve --host=0.0.0.0 --port=8004"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        VITE_API_URL: http://localhost:8004
    container_name: ctf3-frontend
    ports:
      - "5174:80"
    depends_on:
      - backend
    networks:
      - ctf3-network

networks:
  ctf3-network:
    driver: bridge

volumes:
  ctf3-postgres-data:
```

**Notes:**
- The `command` override in the `backend` service runs `migrate` and `db:seed` automatically before starting the server. This means `docker compose up --build` fully seeds the challenge with no manual steps.
- `DB_HOST: db` overrides the baked-in `.env` value of `127.0.0.1` with the Docker service name.
- The frontend is built at image build time with the correct `VITE_API_URL` (the host-exposed port that the user's browser can reach).

#### `CTF_3_HR-system/.env.example` (root-level, for the compose file)

```
JWT_SECRET=change-this-before-deployment
```

### Startup workflow

```bash
cd CTFs/CTF_3_HR-system
cp .env.example .env
# Optionally edit .env to set a custom JWT_SECRET
docker compose up --build
```

- Backend API: `http://localhost:8004`
- Frontend: `http://localhost:5174`
- PostgreSQL: `localhost:5434` (for debugging)

### Reset procedure

```bash
docker compose down -v   # removes postgres volume for a clean DB
docker compose up --build
```

---

## 6. CTF 4 — Corporate Helpdesk

### Architecture

- **Stack:** Node.js + TypeScript API, React + Vite frontend, PostgreSQL 15, Redis 7, Playwright bot
- **Storage:** PostgreSQL (schema via `infra/init.sql`) + Redis (session/queue)
- **Services:** 5 containers — `db`, `redis`, `api`, `web`, `bot`
- **Vulnerability category:** Stored XSS with CSP bypass, admin bot URL submission, cookie theft

### Current state

**This challenge is the most complete.** All five Dockerfiles exist and the `docker-compose.yml` wires all services. The `infra/init.sql` auto-seeds the database. The `.env.example` covers all required variables.

### Remaining work (minor hardening only)

1. **Pin the `command` in `api` and `web` services** — currently both run `npm run dev` inside the container. For a distributable CTF, this should be replaced with a production start command after running the TypeScript build. This is already handled in the Dockerfiles (`RUN npm run build`) but the `command` override in `docker-compose.yml` calls `npm run dev` again, bypassing the build. Recommended fix: remove the `command` override and let the Dockerfile `CMD` run (which calls `npm run dev` anyway for now — acceptable for a CTF).

2. **Volume mounts for `api` and `web`** — the compose file mounts the full source directory (`./apps/api:/app`) into the running container. This means local source changes are reflected live (useful for development) but means the container is not fully self-contained for distribution. For a distributable CTF, these volume mounts should be removed so only the baked-in image is used.

3. **No `ADMIN_EMAIL` var in `.env.example`** — the bot service references `ADMIN_EMAIL` but the `.env.example` only has `ADMIN_PASSWORD`. Add `ADMIN_EMAIL=admin@intradesk.local` to `.env.example`.

### Suggested docker-compose.yml improvement (production-ready)

```yaml
  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    container_name: intradesk-api
    env_file:
      - .env
    ports:
      - "4001:4001"
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - intradesk-network
    # Remove: volumes and command override — use the image as built

  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    container_name: intradesk-web
    environment:
      VITE_API_URL: ""
    ports:
      - "5174:5173"
    depends_on:
      - api
    networks:
      - intradesk-network
    # Remove: volumes and command override — use the image as built
```

### Startup workflow (no changes required from current state)

```bash
cd CTFs/CTF_4_corporate_helpdesk
cp .env.example .env
# Edit .env to set JWT_SECRET, SESSION_SECRET to strong values for deployment
docker compose up --build
```

- Frontend: `http://localhost:5174`
- API: `http://localhost:4001`
- PostgreSQL: `localhost:5433`
- Redis: `localhost:6380`

### Reset procedure

```bash
docker compose down -v
docker compose up --build
```

---

## 7. Root-Level Orchestration (Optional)

If all four CTFs need to run simultaneously (e.g. for a live competition), a root-level `docker-compose.yml` can be added at `CTFs/docker-compose.yml` using the `include` directive (Compose v2.20+) or by merging all services directly. Port collisions must be avoided — see [Section 9](#9-port-allocation-reference).

**Approach using `include`:**

```yaml
# CTFs/docker-compose.yml
include:
  - Basic_1_Nodejs/docker-compose.yml
  - CTF_2_pswd_manager/docker-compose.yml
  - CTF_3_HR-system/docker-compose.yml
  - CTF_4_corporate_helpdesk/docker-compose.yml
```

Then from the `CTFs/` directory:

```bash
docker compose up --build
```

For the dissertation demo, launching challenges independently is recommended (simpler to debug, no port collision risk, easier to reset individual challenges).

---

## 8. Testing Checklist

For each CTF, after running `docker compose up --build`, verify:

### CTF 1

- [ ] `http://localhost:3000` returns the login page
- [ ] Login as a normal user works
- [ ] `/flag` route is inaccessible without admin cookie
- [ ] Forging the admin cookie grants access to `/flag`
- [ ] Flag value matches the one set in `.env`

### CTF 2

- [ ] `http://localhost:5173` loads the React frontend
- [ ] User registration and login work
- [ ] `/app/challenge` returns a PoW nonce
- [ ] Solving PoW returns the JWT secret
- [ ] Forged JWT for `flag12` grants access to the vault flag

### CTF 3

- [ ] `http://localhost:5174` loads the React HR frontend
- [ ] Login with seeded credentials works (`abcd12 / RVIFLBfM`)
- [ ] SQL injection in employee search returns the hidden employee row
- [ ] Debug API endpoint is reachable and exposes credentials
- [ ] Path traversal to `/flag` route works
- [ ] All 4 flags are retrievable

### CTF 4

- [ ] `http://localhost:5174` loads the Helpdesk frontend
- [ ] User login/registration works
- [ ] KB article creation with XSS payload works
- [ ] Submitting a URL to the bot triggers the Playwright visitor
- [ ] Bot visits the URL and executes XSS, leaking the admin cookie
- [ ] Admin cookie grants access to the flag endpoint

### General

- [ ] `docker compose down -v && docker compose up --build` gives a fully clean state (no residual users/data from previous run)
- [ ] No host packages (Node, PHP, Composer, Python) are required — only Docker Desktop

---

## 9. Port Allocation Reference

| CTF | Service | Host Port | Container Port |
|-----|---------|-----------|----------------|
| CTF 1 | App (Node.js) | 3000 | 3000 |
| CTF 2 | API (Express) | 4000 | 4000 |
| CTF 2 | Frontend (Nginx/Vite) | 5173 | 80 |
| CTF 3 | PostgreSQL | 5434 | 5432 |
| CTF 3 | Backend (Laravel) | 8004 | 8004 |
| CTF 3 | Frontend (Nginx) | 5174 | 80 |
| CTF 4 | PostgreSQL | 5433 | 5432 |
| CTF 4 | Redis | 6380 | 6379 |
| CTF 4 | API (Node.js) | 4001 | 4001 |
| CTF 4 | Frontend (Vite) | 5174 | 5173 |

> **Note:** CTF 3 Frontend and CTF 4 Frontend both use host port `5174`. If running simultaneously, change one of them (e.g. CTF 3 Frontend → `5175:80`).

---

## Implementation Order (Recommended)

1. **CTF 1** — Simplest: one service, no DB. Write Dockerfile + compose. ~30 mins.
2. **CTF 2** — Two services (api + frontend), no DB. Write two Dockerfiles + compose + nginx.conf. ~1 hour.
3. **CTF 3** — Three services. Hardest because of PHP/Composer and Laravel migration command. Write backend Dockerfile (PHP), frontend Dockerfile (Nginx), update docker-compose.yml. ~2 hours.
4. **CTF 4** — Already done. Minor hardening (remove volume mounts from compose, add missing env var). ~15 mins.
