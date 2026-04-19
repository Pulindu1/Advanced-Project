#!/usr/bin/env node
/**
 * chgen_ctf9.js - Challenge Generator for CTF9 Dunholm Research, TrialVault
 *
 * Generates six per-player flags (Actuator exposure, directory traversal,
 * JWT algorithm confusion, blind SQL injection, RSA-512 hybrid decryption,
 * log file password leak) and writes:
 *   - CTFs/CTF_9_dunholm/data/flags.json
 *   - CTFs/CTF_9_dunholm/data/users.json
 *
 * Phase B additionally reads flags.json to substitute per-user placeholders
 * into the encrypted vault files and the seeded database rows.
 *
 * Usage:
 *   node chgen_ctf9.js abcd12 efgh34 ijkl56
 *   node chgen_ctf9.js --count 10
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ctf9Generator = require('./generators/ctf9_generator');

const CTF_DIR = path.resolve(__dirname, '..', 'CTF_9_dunholm');
const DATA_DIR = path.join(CTF_DIR, 'data');
const FLAGS_OUTPUT = path.join(DATA_DIR, 'flags.json');
const USERS_OUTPUT = path.join(DATA_DIR, 'users.json');

const USERNAME_PATTERN = /^[a-z]{4}[0-9]{2}$/;
const FLAG_PREFIXES = {
  flag1: 'durham-drflag1',
  flag2: 'durham-drflag2',
  flag3: 'durham-drflag3',
  flag4: 'durham-drflag4',
  flag5: 'durham-drflag5',
  flag6: 'durham-drflag6',
};

// Fictional Dunholm Research staff. These accounts are not used for player
// login; amir.patel is the exception, his plaintext password is logged and
// harvested for Flag 6.
const STAFF_ACCOUNTS = {
  'helen.cross': {
    password: 'SYSTEM_INTERNAL',
    display_name: 'Dr. Helen Cross',
    role: 'research_lead',
    active: true,
    description: 'Managing Director of Dunholm Research. Signs off on board-level decisions.',
  },
  'amir.patel': {
    password: 'DunholmCTO2024!',
    display_name: 'Amir Patel',
    role: 'cto_admin',
    active: true,
    description: 'Chief Technology Officer. Full admin on TrialVault.',
  },
  'rachel.osei': {
    password: 'SYSTEM_INTERNAL',
    display_name: 'Rachel Osei',
    role: 'security_lead',
    active: true,
    description: 'Security Lead. Owns the security memos referenced in admin.',
  },
  'james.whitfield': {
    password: 'SYSTEM_INTERNAL',
    display_name: 'Dr. James Whitfield',
    role: 'clinical_lead',
    active: true,
    description: 'Clinical Lead. Lead investigator on the Phase 2 trials.',
  },
  'sophie.chen': {
    password: 'SYSTEM_INTERNAL',
    display_name: 'Sophie Chen',
    role: 'trial_coordinator',
    active: true,
    description: 'Trial Coordinator. Author of the Phase 2 cohort welcome note.',
  },
};

function generateRandomUsername() {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  let u = '';
  for (let i = 0; i < 4; i++) u += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 2; i++) u += digits[Math.floor(Math.random() * digits.length)];
  return u;
}

function isValidUsername(u) {
  return USERNAME_PATTERN.test(u);
}

function randomPassword() {
  const len = 9 + Math.floor(Math.random() * 4);
  return crypto.randomBytes(len).toString('hex').slice(0, len);
}

function buildFlag(prefix, token, username) {
  return `${prefix}{${token}_${username}}`;
}

function main() {
  const args = process.argv.slice(2);
  let usernames = [];

  const countIdx = args.indexOf('--count');
  if (countIdx !== -1 && args[countIdx + 1]) {
    const count = parseInt(args[countIdx + 1], 10);
    if (isNaN(count) || count < 1) {
      console.error('Error: --count must be a positive integer');
      process.exit(1);
    }
    const seen = new Set();
    while (seen.size < count) seen.add(generateRandomUsername());
    usernames = Array.from(seen);
  } else if (args.length > 0) {
    for (const arg of args) {
      const n = arg.toLowerCase().trim();
      if (!isValidUsername(n)) {
        console.error(`Error: Invalid username "${arg}". Expected 4 letters + 2 digits (e.g., abcd12)`);
        process.exit(1);
      }
      usernames.push(n);
    }
  } else {
    console.error('Usage:');
    console.error('  node chgen_ctf9.js abcd12 efgh34 ijkl56');
    console.error('  node chgen_ctf9.js --count 10');
    process.exit(1);
  }

  console.log(`Generating flags for ${usernames.length} players...`);

  const flags = {};
  for (const username of usernames) {
    const tokens = ctf9Generator(username);
    flags[username] = {};
    for (const [key, prefix] of Object.entries(FLAG_PREFIXES)) {
      flags[username][key] = buildFlag(prefix, tokens[key], username);
    }
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });

  fs.writeFileSync(FLAGS_OUTPUT, JSON.stringify(flags, null, 2) + '\n');
  console.log(`Wrote flags to ${FLAGS_OUTPUT}`);

  const users = { ...STAFF_ACCOUNTS };
  for (const username of usernames) {
    users[username] = {
      password: randomPassword(),
      display_name: username,
      role: 'researcher',
      active: true,
      description: 'Player account (external reviewer) seeded for the audit.',
    };
  }
  fs.writeFileSync(USERS_OUTPUT, JSON.stringify(users, null, 2) + '\n');
  console.log(`Wrote users to ${USERS_OUTPUT}`);

  console.log('\nGenerated flags:');
  for (const [u, f] of Object.entries(flags)) {
    console.log(`  ${u}:`);
    for (const k of Object.keys(FLAG_PREFIXES)) {
      console.log(`    ${k}: ${f[k]}`);
    }
  }

  console.log('\nPlayer credentials:');
  for (const u of usernames) {
    console.log(`  ${u} / ${users[u].password}`);
  }

  console.log('\nTo start CTF9:');
  console.log('  cd CTFs/CTF_9_dunholm && docker compose down && docker compose up --build');
}

main();
