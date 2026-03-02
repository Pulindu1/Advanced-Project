# Port Allocation Across CTFs

To run all CTF challenges simultaneously, each uses unique port numbers:

## Port Map

| CTF Challenge | Frontend | Backend/API | Database | Redis | Other |
|--------------|----------|-------------|----------|-------|-------|
| **Basic_1_Nodejs** | - | 3000 | - | - | - |
| **CTF_2_pswd_manager** | 5173 | 4000 | - | - | - |
| **CTF_3_HR-system** | 8080 | 8004 | 5434 | - | - |
| **CTF_4_corporate_helpdesk** | **5174** | **4001** | **5433** | **6380** | - |

**Note: CTF_3 database port changed from 5432 to 5434 to avoid conflicts when running all CTFs simultaneously**

## CTF_4 Port Details

### External (Host) Ports
- **Frontend (Vite)**: `5174` → http://localhost:5174
- **API (Express)**: `4001` → http://localhost:4001
- **PostgreSQL**: `5433` → localhost:5433
- **Redis**: `6380` → localhost:6380

### Internal (Container) Ports
- Frontend: `5173` (inside container)
- API: `4001` (inside container)
- PostgreSQL: `5432` (inside container)
- Redis: `6379` (inside container)

## Why These Ports?

- **5174**: Incremented from standard Vite port (5173) used by CTF_2
- **4001**: Incremented from CTF_2's backend port (4000)
- **5433**: Incremented from standard PostgreSQL port (5432) used by CTF_3
- **6380**: Incremented from standard Redis port (6379)

## Running Multiple CTFs Simultaneously

You can now run all CTFs at the same time:

```bash
# Terminal 1 - Basic_1
cd CTFs/Basic_1_Nodejs
npm start
# Access: http://localhost:3000

# Terminal 2 - CTF_2 Backend
cd CTFs/CTF_2_pswd_manager
npm run server  # Backend: 4000

# Terminal 3 - CTF_2 Frontend
cd CTFs/CTF_2_pswd_manager
npm run dev  # Frontend: 5173

# Terminal 4 - CTF_3
cd CTFs/CTF_3_HR-system
docker compose up -d  # Database: 5434
cd backend && php artisan serve --host=127.0.0.1 --port=8004  # Backend: 8004
cd frontend && npm run dev  # Frontend: 8080

# Terminal 5 - CTF_4
cd CTFs/CTF_4_corporate_helpdesk
docker compose up
# Access: http://localhost:5174
```

## Quick Access URLs

- **Basic_1**: http://localhost:3000
- **CTF_2**: http://localhost:5173
- **CTF_3**: http://localhost:8080
- **CTF_4**: http://localhost:5174

All services can run concurrently without port conflicts! 🎉
