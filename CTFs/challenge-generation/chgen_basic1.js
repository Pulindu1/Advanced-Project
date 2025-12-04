#!/usr/bin/env node

// Flags-only generator for Basic_1_Nodejs
// Usage:
//   node chgen_basic1.js basic1_server_config.json
//
// Reads a server_config-style JSON file with a `players` array:
//   { "players": [ { "username": "abcd12", "token": "..." }, ... ] }
// and writes a flags.json mapping username -> flag into
//   ../Basic_1_Nodejs/src/data/flags.json

const fs = require('fs');
const path = require('path');

function loadServerConfig(configPath) {
  const absPath = path.resolve(configPath);
  const raw = fs.readFileSync(absPath, 'utf8');
  const cfg = JSON.parse(raw);
  if (!cfg.players || !Array.isArray(cfg.players)) {
    throw new Error('server_config must contain a `players` array');
  }
  return cfg.players;
}

function validateUsername(username) {
  const re = /^[A-Za-z]{4}[0-9]{2}$/;
  return re.test(username);
}

function generateFlag(username, token) {
  // You can tweak the format if you like, but keep it consistent.
  return `durham{${token}_${username}}`;
}

function main() {
  const [, , serverConfigPath] = process.argv;

  if (!serverConfigPath) {
    console.error('Usage: node chgen_basic1.js <basic1_server_config.json>');
    process.exit(1);
  }

  let players;
  try {
    players = loadServerConfig(serverConfigPath);
  } catch (err) {
    console.error('Failed to load server config:', err.message);
    process.exit(1);
  }

  const flagsByUser = {};

  for (const p of players) {
    const username = p.username;
    const token = p.token;

    if (!username || !token) {
      console.warn('Skipping player with missing username or token:', p);
      continue;
    }

    if (!validateUsername(username)) {
      console.warn(`Skipping player with invalid username '${username}' (expected 4 letters + 2 digits)`);
      continue;
    }

    flagsByUser[username] = generateFlag(username, token);
  }

  const outputPath = path.resolve(__dirname, '..', 'Basic_1_Nodejs', 'src', 'data', 'flags.json');

  try {
    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(flagsByUser, null, 2));
  } catch (err) {
    console.error('Failed to write flags.json:', err.message);
    process.exit(1);
  }

  console.log(`Wrote ${Object.keys(flagsByUser).length} flags to`, outputPath);
}

if (require.main === module) {
  main();
}
