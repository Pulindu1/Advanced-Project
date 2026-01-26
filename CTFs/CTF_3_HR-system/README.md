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
php artisan serve --port=8000
```

### 3. Set up React Frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. Generate Player Flags
```bash
cd CTFs/challenge-generation
node chgen_ctf3.js
```

## Architecture

```
CTF_3_HR-system/
├── backend/              # Laravel API
│   ├── app/
│   │   ├── Http/Controllers/
│   │   ├── Models/
│   │   └── ...
│   ├── database/
│   │   ├── migrations/
│   │   └── seeders/
│   └── routes/api.php
├── frontend/             # React SPA
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── api/
│   └── ...
├── docker-compose.yml    # PostgreSQL
└── flags.json            # Generated per-player flags
```

## Security Features (Secure by Default)

- CSRF protection on all forms
- Parameterized queries (Eloquent ORM)
- Password hashing (bcrypt)
- JWT authentication with short expiry
- Input validation on all endpoints
- Rate limiting on auth endpoints
- Audit logging for sensitive actions

## CTF Integration

Player flags are generated via `CTFs/challenge-generation/chgen_ctf3.js` and stored in `flags.json`.
Each player's flag is stored in the database and accessible only to authorized users.

## Default Credentials (Seeded)

| Role    | Username    | Password   |
|---------|-------------|------------|
| Admin   | admin       | admin123   |
| HR      | hr.manager  | hr1234     |
| Employee| john.doe    | password   |

---
*This system is intentionally designed for CTF training. Do not deploy in production.*
