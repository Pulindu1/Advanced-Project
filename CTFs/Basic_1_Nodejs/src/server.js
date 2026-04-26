// src/server.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PORT } = require('./config');
const app = require('./app');

const CREDS_PATH = process.env.CREDS_PATH || '/app/credentials.json';
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// Seed users.json from mounted credentials.json before the app starts.
// Staff accounts ship with the SYSTEM_INTERNAL sentinel password; we swap
// it for a process-local random value here so the account exists for
// realism (role attribution, admin user shape) but no one can authenticate.
function seedUsers() {
  let credentials = {};
  try {
    const raw = fs.readFileSync(CREDS_PATH, 'utf8');
    credentials = JSON.parse(raw);
  } catch (err) {
    console.log('[seed] No credentials.json found at', CREDS_PATH, '-- skipping seed');
    return;
  }

  const users = [];
  for (const [username, data] of Object.entries(credentials)) {
    const normalized = username.toLowerCase().trim();
    let password = typeof data === 'object' ? data.password : data;
    if (password === 'SYSTEM_INTERNAL') {
      password = crypto.randomBytes(24).toString('hex');
    }
    const role = (typeof data === 'object' && data.role) ? data.role : 'user';
    users.push({ username: normalized, password, role });
  }

  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  console.log(`[seed] Seeded ${users.length} users from ${CREDS_PATH}`);
}

seedUsers();

app.listen(PORT, () => {
  console.log(`[*] Node CTF listening on http://localhost:${PORT}`);
});
