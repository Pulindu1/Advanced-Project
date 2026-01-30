# Credentials Setup

## Login Accounts

```json
{
  "abcd12": {
    "password": "RVIFLBfM",
    "employee_id": "EMP001",
    "department": "Engineering",
    "position": "Project Coordinator",
    "hire_date": "2024-02-29",
    "monthly_pay": 5834
  },
  "efgh34": {
    "password": "bcgxO1ZkSle",
    "employee_id": "EMP002",
    "department": "Finance",
    "position": "Data Analyst",
    "hire_date": "2025-10-29",
    "monthly_pay": 6796
  },
  "ijkl56": {
    "password": "kH0g5imYtZ",
    "employee_id": "EMP003",
    "department": "Human Resources",
    "position": "Systems Administrator",
    "hire_date": "2025-07-28",
    "monthly_pay": 7565
  }
}
```

## Hidden Account (CTF Target)

```json
{
  "flag12": {
    "password": "SYSTEM_INTERNAL",
    "employee_id": "FLAG012",
    "department": "Operations",
    "position": "System Auditor",
    "hire_date": "2020-01-01",
    "monthly_pay": 0,
    "notes": "AES-256-CBC encrypted data: +DUi/1MfXD1MDdwdvzE2YA==:uj1qPXtZow7ovD1UgKZT6PAmDWWZScvFnJqgpxY4bsWeApZZ7pZY4GN64Fa1SBj6 (hint: check legacy code for the key)",
    "hidden": true
  }
}
```

## Database Seeding

The seeder reads from `credentials.json` and populates:
- `users` table (bcrypt passwords for authentication)
- `employees` table (employee metadata + notes)
- `departments` table

Flag12 is excluded from normal employee listings by the `hidden` flag.
   - Base pay varies by position:
     - Software Engineer: $8,000
     - Junior Developer: $5,000
     - Data Analyst: $6,500
     - Systems Administrator: $7,000
     - Technical Support: $4,500
     - Project Coordinator: $5,500
   - Experience bonus: $200 per year worked
   - Random variation: +$100 to +$500

**Important**: Once generated, this data is **fixed in credentials.json**. The database seeder uses these exact values - it does NOT regenerate them randomly during seeding.

### Reset and Seed Database

```bash
cd CTFs/CTF_3_HR-system/backend

# Drop all tables, run migrations, and seed with credentials
php artisan migrate:fresh --seed
```

Output shows each player's unique password:
```
Player credentials:
  abcd12 / RYjzfJZBd
  efgh34 / WzofNHHMUn
  ijkl56 / omjbvE07

NOTE: Credentials table contains PLAINTEXT passwords + employee data
      This is INTENTIONALLY VULNERABLE for SQL injection challenge
```

### Verify Credentials Table

```bash
docker exec ctf3_postgres psql -U hr_admin -d hr_system \
  -c "SELECT username, password, employee_id, department, position, hire_date FROM credentials;"
```

Expected output:
```
 username |  password  | employee_id | department |     position      | hire_date  
----------+------------+-------------+------------+-------------------+------------
 abcd12   | RYjzfJZBd  | EMP001      | Operations | Software Engineer | 2023-04-28
 efgh34   | WzofNHHMUn | EMP002      | Finance    | Junior Developer  | 2024-06-28
 ijkl56   | omjbvE07   | EMP003      | Operations | Software Engineer | 2024-06-28
```

---

## Current Database State

### Files Required
1. `CTFs/CTF_3_HR-system/flags.json` - username → flag mapping
2. `CTFs/CTF_3_HR-system/credentials.json` - username → password mapping

### Tables Created
- `users` - User accounts with bcrypt passwords
- `credentials` - **VULNERABLE** plaintext password storage
- `employees` - Employee information
- `departments` - Department data
- `flags` - User-specific flags
- `audit_logs` - Activity logging
- `cache` - Laravel cache (for rate limiting)

---

## Security Design

### Intentional Vulnerabilities (For CTF)
✗ **Plaintext passwords in `credentials` table**
✗ **SQL injection attack surface** (to be implemented in Phase 3)
✗ **No input sanitization in login** (to be implemented)

### Protected Elements (Secure)
✓ **Bcrypt passwords in `users` table** (for legitimate post-exploitation auth)
✓ **JWT token authentication** (flag retrieval requires valid token)
✓ **Parameterized queries** (all other endpoints use secure queries)

---

## Next Steps (Phases 3-4)

### Phase 3: Vulnerable Login Implementation
- [ ] Create vulnerable login endpoint with raw SQL queries
- [ ] Implement string concatenation (SQLi attack vector)
- [ ] Add error messages that leak SQL structure
- [ ] Route `/api/auth/login` to vulnerable endpoint

### Phase 4: Testing & Validation
- [ ] Test authentication bypass: `' OR '1'='1' --`
- [ ] Test credential extraction: `' UNION SELECT username, password FROM credentials --`
- [ ] Verify flag retrieval requires valid JWT
- [ ] Document attack payloads

---

## File Structure

```
CTFs/
├── challenge-generation/
│   ├── generate_credentials.js  ← NEW: Password generator
│   └── chgen_basic1.js          (generates flags.json)
│
└── CTF_3_HR-system/
    ├── flags.json               ← username → flag
    ├── credentials.json         ← NEW: username → password
    │
    └── backend/
        ├── app/Models/
        │   └── Credential.php   ← NEW: Credential model
        │
        └── database/
            ├── migrations/
            │   └── 2026_01_28_*_create_credentials_table.php  ← NEW
            │
            └── seeders/
                └── DatabaseSeeder.php  ← MODIFIED: reads credentials.json
```

---

## Example Player Data

| Username | Password    | Employee ID | Department | Position          | Hire Date  | Flag                          |
|----------|-------------|-------------|------------|-------------------|------------|-------------------------------|
| abcd12   | RYjzfJZBd   | EMP001      | Operations | Software Engineer | 2023-04-28 | durham-hr{...hash...}         |
| efgh34   | WzofNHHMUn  | EMP002      | Finance    | Junior Developer  | 2024-06-28 | durham-hr{...hash...}         |
| ijkl56   | omjbvE07    | EMP003      | Operations | Software Engineer | 2024-06-28 | durham-hr{...hash...}         |

**All employee data (ID, department, position, hire date) comes from `credentials.json` and matches what's in the vulnerable `credentials` table.**

Each player must:
1. **Exploit** SQL injection to discover their password
2. **Login** with discovered credentials
3. **Retrieve** their unique flag from `/api/flag`
