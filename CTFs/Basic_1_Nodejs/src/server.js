// src/server.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PORT } = require('./config');
const app = require('./app');

const CREDS_PATH = process.env.CREDS_PATH || '/app/credentials.json';
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// Seed users.json from mounted credentials.json before the app starts
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
    const password = typeof data === 'object' ? data.password : data;
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
