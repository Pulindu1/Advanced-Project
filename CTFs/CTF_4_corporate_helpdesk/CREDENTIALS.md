# CTF_4 User Credentials

## Admin Account
- **Username**: `admin`
- **Password**: `admin_secure_password_123`
- **Flag**: `CTF{admin_default_flag}`
- **Role**: admin

## Test Users

### User 1
- **Username**: `abcd12`
- **Password**: `KHXXSIILQYIF`
- **Flag**: `CTF{user_abcd12_8bb73ad76fdd80e0}`
- **Role**: user

### User 2
- **Username**: `efgh34`
- **Password**: `MWFXMTRKGZET`
- **Flag**: `CTF{user_efgh34_80eb85d81b52e9ca}`
- **Role**: user

### User 3
- **Username**: `ijkl56`
- **Password**: `MKWTCTBTCPSK`
- **Flag**: `CTF{user_ijkl56_1fb81908a0e8ba91}`
- **Role**: user

---

## Adding More Users

To add more users, use the provided script:

```bash
cd scripts
node add_users_db.js <username1> <username2> <username3> ...
```

**Username format**: 4 lowercase letters + 2 numbers (e.g., `abcd12`)

Example:
```bash
node add_users_db.js mnop78 qrst90 uvwx12
```

The script will:
1. Generate random secure passwords (uppercase A-Z only)
2. Generate unique flags for each user
3. Add users to the database
4. Update `credentials.json` and `flags.json` in the root directory

**Note**: `credentials.json` contains both passwords and flags, while `flags.json` contains only the flags for easier access.

---

## Login

All users log in at: http://localhost:5176/login

**Note**: Registration is disabled. Only pre-created users can access the system.
