# CTF 3 – HR System (Internal Corporate Tool)

A deliberately vulnerable internal HR management system built with:
- **Backend:** PHP (Laravel 11) with PostgreSQL
- **Frontend:** React (Vite)
- **Theme:** Internal corporate tool – HR management, employee records, audit logs

## Quick Start

### Prerequisites
- Docker & Docker Compose (for PostgreSQL)
- PHP 8.2+ with Composer
- Node.js 18+

### 1. Start PostgreSQL
```bash
cd CTFs/CTF_3_HR-system
docker-compose up -d
```

### 2. Set up Laravel Backend
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve --host=127.0.0.1 --port=8004
```

### 3. Set up React Frontend
```bash
cd frontend
npm install
npm run dev  # Runs on http://localhost:5174
```

### 4. Generate Player Credentials & Flags
```bash
cd ../challenge-generation

# Generate flags for players (username -> flag mapping)
node chgen_basic1.js

# Generate credentials with employee data (username -> password, employee_id, dept, etc.)
node generate_credentials.js

# Both files will be created in CTFs/CTF_3_HR-system/
# - flags.json
# - credentials.json

# Then reseed the database
cd ../CTF_3_HR-system/backend
php artisan migrate:fresh --seed
```

## Architecture

```
CTF_3_HR-system/
├── backend/              # Laravel API
│   ├── app/
│   │   ├── Http/Controllers/
│   │   ├── Models/
│   │   │   ├── User.php
│   │   │   ├── Employee.php
│   │   │   ├── Credential.php    # VULNERABLE - plaintext passwords
│   │   │   └── Flag.php
│   │   └── ...
│   ├── database/
│   │   ├── migrations/
│   │   │   ├── *_create_users_table.php
│   │   │   ├── *_create_employees_table.php
│   │   │   ├── *_create_credentials_table.php    # VULNERABLE TABLE
│   │   │   └── *_create_flags_table.php
│   │   └── seeders/DatabaseSeeder.php
│   └── routes/api.php
├── frontend/             # React SPA
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── api/client.ts
│   │   └── context/AuthContext.tsx
│   └── ...
├── docker-compose.yml    # PostgreSQL container
├── flags.json            # Generated per-player flags
└── credentials.json      # Generated per-player credentials + employee data
```

## Security Features

### Secure Elements (Protected)
- ✓ CSRF protection on web routes
- ✓ Parameterized queries for all endpoints (except vulnerable login)
- ✓ Password hashing with bcrypt in `users` table
- ✓ JWT authentication with configurable expiry
- ✓ Input validation on all endpoints
- ✓ Rate limiting on auth endpoints
- ✓ Audit logging for sensitive actions

### Intentional Vulnerabilities (For CTF)
- ✗ **SQL Injection** - Login endpoint uses raw queries (Phase 3 - to be implemented)
- ✗ **Plaintext password storage** - `credentials` table stores passwords unencrypted
- ✗ **Information disclosure** - Error messages leak SQL structure

**Note:** The `users` table uses secure bcrypt passwords. The `credentials` table contains plaintext passwords specifically for the SQL injection challenge.

## CTF Integration

Player flags are generated via `CTFs/challenge-generation/chgen_ctf3.js` and stored in `flags.json`.
Each player's flag is stored in the database and accessible only to authorized users.

## Running the Application

**Ports:**
- Backend API: http://127.0.0.1:8004
- Frontend: http://localhost:5174
- PostgreSQL Database: localhost:5432

**Start Backend:**
```bash
cd backend
php artisan serve --host=127.0.0.1 --port=8004
```

**Start Frontend:**
```bash
cd frontend
npm run dev
```

**Note:** These ports differ from CTF_2_pswd_manager (which uses 4000/5173) to allow both CTFs to run simultaneously.

## Default Credentials (Seeded)

| Role    | Username    | Password   |
|---------|-------------|------------|
| Admin   | admin       | admin123   |
| HR      | hr.manager  | hr1234     |
| Employee| john.doe    | password   |

---
*This system is intentionally designed for CTF training. Do not deploy in production.*
