#!/usr/bin/env node
/**
 * chgen_ctf8.js - Challenge Generator for CTF8 Greystone Gazette (PressRoom)
 *
 * Generates three per-player flags (IDOR, missing server-side auth, command
 * injection) and writes:
 *   - CTFs/CTF_8_gazette/src/data/flags.json
 *   - CTFs/CTF_8_gazette/src/data/users.json
 *   - CTFs/CTF_8_gazette/src/data/flag-files/flag3-<username>.txt
 *
 * The users.json file is authored by hand and contains both player entries
 * and fictional Gazette staff accounts (Sarah Lin, Tom Ashworth, Priya
 * Kapoor, Marcus Webb). This generator merges freshly generated player
 * passwords into users.json without disturbing the seeded staff entries.
 *
 * Usage:
 *   node chgen_ctf8.js abcd12 efgh34 ijkl56
 *   node chgen_ctf8.js --count 10
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ctf8Generator = require('./generators/ctf8_generator');

const CTF_DIR = path.resolve(__dirname, '..', 'CTF_8_gazette');
const DATA_DIR = path.join(CTF_DIR, 'src', 'data');
const FLAGS_OUTPUT = path.join(DATA_DIR, 'flags.json');
const USERS_OUTPUT = path.join(DATA_DIR, 'users.json');
const CONTRIB_ARTICLES_OUTPUT = path.join(DATA_DIR, 'contributor-articles.json');
const FLAG_FILES_DIR = path.join(DATA_DIR, 'flag-files');

// Contributor articles start at this ID to stay clear of the hand-authored
// staff articles in articles.json (IDs 1..9). Each player gets exactly one
// onboarding draft so the dashboard is not empty on first login.
const CONTRIB_ARTICLE_BASE_ID = 10;

const USERNAME_PATTERN = /^[a-z]{4}[0-9]{2}$/;
const FLAG1_PREFIX = 'durham-gzflag1';
const FLAG2_PREFIX = 'durham-gzflag2';
const FLAG3_PREFIX = 'durham-gzflag3';

// Fictional Gazette staff. These accounts are never usable by players but the
// seeder creates them so that articles can be attributed to the right authors
// and the admin dashboard has a realistic roster to display.
const STAFF_ACCOUNTS = {
  'sarah.lin': {
    password: 'SYSTEM_INTERNAL',
    display_name: 'Sarah Lin',
    role: 'admin',
    active: true,
    description: 'Editor-in-chief. PressRoom administrator.',
  },
  'tom.ashworth': {
    password: 'SYSTEM_INTERNAL',
    display_name: 'Tom Ashworth',
    role: 'reporter',
    active: true,
    description: 'Reporter covering community and local news.',
  },
  'priya.kapoor': {
    password: 'SYSTEM_INTERNAL',
    display_name: 'Priya Kapoor',
    role: 'reporter',
    active: true,
    description: 'Reporter covering council affairs and planning.',
  },
  'marcus.webb': {
    password: 'SYSTEM_INTERNAL',
    display_name: 'Marcus Webb',
    role: 'sysadmin',
    active: false,
    description: 'Former sole developer and sysadmin. Account disabled after redundancy.',
  },
};

// Narrative memo that lives in a sibling file (memo.txt). Kept separate
// from the flag file so that $(cat flag3-<user>.txt) expands to a single
// whitespace-delimited token (the flag) which ping echoes back in full.
// The memo is narrative flavour only and is not part of the exploit path.
const FLAG3_MEMO = [
  'INTERNAL MEMO -- Greystone Gazette Editorial Desk',
  'Subject: Riverside Associates Ltd -- preliminary findings',
  'Classification: RESTRICTED',
  '',
  'Cross-referencing the last three cycles of planning decisions approved',
  'by the River Wear Development Sub-committee with Companies House filings,',
  'Riverside Associates Ltd appears to have received four consultancy',
  'payments in the same week that three of its directors voted through',
  'permissions favouring the Elvet Wharf regeneration bid. Two of those',
  'directors sit on the sub-committee. The consultancy invoices are routed',
  'through a shell address near the Viaduct that shares a registered agent',
  'with Councillor J. Holt\'s constituency office.',
  '',
  'The anonymous source has provided enough to justify a formal filing with',
  'the audit office. Sarah needs to see this before we publish.',
  '',
  '-- S.L.',
  '',
].join('\n');

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
  const len = 8 + Math.floor(Math.random() * 5);
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
    console.error('  node chgen_ctf8.js abcd12 efgh34 ijkl56');
    console.error('  node chgen_ctf8.js --count 10');
    process.exit(1);
  }

  console.log(`Generating flags for ${usernames.length} players...`);

  const flags = {};
  for (const username of usernames) {
    const tokens = ctf8Generator(username);
    flags[username] = {
      flag1: buildFlag(FLAG1_PREFIX, tokens.flag1, username),
      flag2: buildFlag(FLAG2_PREFIX, tokens.flag2, username),
      flag3: buildFlag(FLAG3_PREFIX, tokens.flag3, username),
    };
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(FLAG_FILES_DIR, { recursive: true });

  fs.writeFileSync(FLAGS_OUTPUT, JSON.stringify(flags, null, 2) + '\n');
  console.log(`Wrote flags to ${FLAGS_OUTPUT}`);

  const users = { ...STAFF_ACCOUNTS };
  for (const username of usernames) {
    users[username] = {
      password: randomPassword(),
      display_name: username,
      role: 'contributor',
      active: true,
      description: 'Contributor (player) account seeded by the security audit.',
    };
  }
  fs.writeFileSync(USERS_OUTPUT, JSON.stringify(users, null, 2) + '\n');
  console.log(`Wrote users to ${USERS_OUTPUT}`);

  // Emit one onboarding article per player. IDs start at CONTRIB_ARTICLE_BASE_ID
  // and increment in the order usernames were provided, so the dashboard shows
  // a sensible "first piece" for a newly-logged-in contributor. The bodies
  // intentionally carry no exploit hints -- they are plain onboarding copy so
  // the player learns the /articles/<id> URL pattern by clicking their own
  // piece without any Flag 1 breadcrumb leaking through.
  const contributorArticles = usernames.map((username, index) => ({
    id: CONTRIB_ARTICLE_BASE_ID + index,
    title: 'Welcome to PressRoom -- file your first piece',
    author: username,
    status: 'draft',
    category: 'onboarding',
    body: [
      `Welcome, ${username}. Sarah has asked the editorial desk to seed a placeholder draft under every new contributor's byline so that the dashboard is never empty on first login.`,
      '',
      'Use this slot to write your first piece for the Gazette. Stories that stay close to the street tend to work best. Community diary items, planning meeting notes, and short interviews with people who live in the neighbourhood are all welcome.',
      '',
      'Replace this text when you are ready. If the draft system behaves unexpectedly -- articles appearing in the wrong bylines, drafts you did not file showing up in your list -- flag it in the audit report rather than editing round it.',
    ].join('\n'),
  }));
  fs.writeFileSync(CONTRIB_ARTICLES_OUTPUT, JSON.stringify(contributorArticles, null, 2) + '\n');
  console.log(`Wrote contributor articles to ${CONTRIB_ARTICLES_OUTPUT}`);

  for (const username of usernames) {
    // The flag file must contain only the flag token. When the intended
    // exploit payload $(cat <file>) expands inside ping's sh -c command,
    // the shell word-splits the file contents and ping takes the hostname
    // from that list. A single-token file guarantees the flag appears in
    // ping's "Name does not resolve" error message verbatim.
    const body = `${flags[username].flag3}\n`;
    const filePath = path.join(FLAG_FILES_DIR, `flag3-${username}.txt`);
    fs.writeFileSync(filePath, body);
    console.log(`Wrote flag file: ${filePath}`);
  }

  // Write the narrative memo once, alongside the per-user flag files, so
  // the directory still reads like a realistic editorial-desk drop folder.
  const memoPath = path.join(FLAG_FILES_DIR, 'memo.txt');
  fs.writeFileSync(memoPath, FLAG3_MEMO);
  console.log(`Wrote memo: ${memoPath}`);

  console.log('\nGenerated flags:');
  for (const [u, f] of Object.entries(flags)) {
    console.log(`  ${u}:`);
    console.log(`    flag1: ${f.flag1}`);
    console.log(`    flag2: ${f.flag2}`);
    console.log(`    flag3: ${f.flag3}`);
  }

  console.log('\nPlayer credentials:');
  for (const u of usernames) {
    console.log(`  ${u} / ${users[u].password}`);
  }

  console.log('\nTo start CTF8:');
  console.log('  cd CTFs/CTF_8_gazette && docker compose down && docker compose up --build');
}

main();
