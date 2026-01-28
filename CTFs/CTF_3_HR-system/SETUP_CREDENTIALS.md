# CTF 3 HR System - Credentials Setup

## Phase 1 & 2 Implementation Complete ✓

### What's Been Set Up

#### 1. Credentials Generator (`generate_credentials.js`)
- Located in: `CTFs/challenge-generation/`
- Generates random passwords (8-12 characters) for each user in `flags.json`
- Generates complete employee data for each user
- Creates `credentials.json` with username → full employee record mapping

#### 2. Credentials Table (Database)
- New migration: `create_credentials_table.php`
- Stores PLAINTEXT passwords (intentionally vulnerable for SQL injection)
- Schema:
  - `username` (primary key)
  - `password` (plaintext - INSECURE BY DESIGN)
  - `password_hint` 
  - `employee_id` (e.g., EMP001, EMP002)
  - `department` (Engineering, HR, Finance, Operations)
  - `position` (job title)
  - `hire_date` (YYYY-MM-DD)
  - `last_login`
  - `created_at`, `updated_at`

#### 3. Updated Database Seeder
- Now reads both `flags.json` AND `credentials.json`
- Creates users with bcrypt passwords (for post-exploitation secure auth)
- Populates `credentials` table with PLAINTEXT passwords (vulnerable)
- Each user has a unique random password

#### 4. Credential Model
- `App\Models\Credential` - Eloquent model for credentials table
- Relationship to User model

---

## Usage

### Generate Credentials for Players

```bash
cd CTFs/challenge-generation

# Generate credentials from existing flags.json
node generate_credentials.js

# Or specify a custom flags.json path
node generate_credentials.js /path/to/flags.json
```

This creates `CTFs/CTF_3_HR-system/credentials.json`:
```json
{
  "abcd12": {
    "password": "RYjzfJZBd",
    "employee_id": "EMP001",
    "department": "Operations",
    "position": "Software Engineer",
    "hire_date": "2023-04-28"
  },
  "efgh34": {
    "password": "WzofNHHMUn",
    "employee_id": "EMP002",
    "department": "Finance",
    "position": "Junior Developer",
    "hire_date": "2024-06-28"
  }
}
```

### How Employee Data is Generated

For each user in `flags.json`, the generator creates:

1. **Password**: Random alphanumeric (8-12 characters)
   - Uses crypto.randomBytes for security
   - Character set: `a-z, A-Z, 0-9`

2. **Employee ID**: Sequential counter
   - Format: `EMP` + zero-padded number (EMP001, EMP002, ...)
   - Increments for each user in order

3. **Department**: Randomly selected
   - Options: `Engineering`, `Human Resources`, `Finance`, `Operations`
   - Each user gets one randomly assigned

4. **Position**: Randomly selected
   - Options: `Software Engineer`, `Junior Developer`, `Data Analyst`, `Systems Administrator`, `Technical Support`, `Project Coordinator`
   - Each user gets one randomly assigned

5. **Hire Date**: Random date 1-36 months ago
   - Calculated from current date minus random months
   - Format: `YYYY-MM-DD`

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
