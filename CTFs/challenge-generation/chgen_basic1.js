#!/usr/bin/env node

// Flags-only generator for Basic_1_Nodejs
// Usage:
//   node chgen_basic1.js [<path-to-users-or-config.json>]
//
// If no path is provided, the script reads usernames from
// ../Basic_1_Nodejs/src/data/users.json. If the JSON contains a top-level
// `players` array (legacy), it will be used. If the JSON is an array of user
// objects (users.json), the usernames will be used to synthesize tokens.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function validateUsername(username) {
  const re = /^[A-Za-z]{4}[0-9]{2}$/;
  return re.test(username);
}

function generateFlag(username, token) {
  return `durham{${token}_${username}}`;
}

function main() {
  const [, , inputPath] = process.argv;

  let players = null;
  let generatorName = process.env.GENERATOR_NAME || 'basic1';
  const generatorOptions = {
    salt: process.env.GENERATOR_SALT,
    tokenLength: process.env.GENERATOR_TOKEN_LENGTH ? Number(process.env.GENERATOR_TOKEN_LENGTH) : undefined
  };

  try {
    let dataPath = inputPath;
    if (!dataPath) {
      dataPath = path.resolve(__dirname, '..', 'Basic_1_Nodejs', 'src', 'data', 'users.json');
      console.log(`No input provided — using users file: ${dataPath}`);
    }

    const raw = fs.readFileSync(path.resolve(dataPath), 'utf8');
    const json = JSON.parse(raw);

    if (json && Array.isArray(json.players)) {
      players = json.players;
      if (json.generator) generatorName = json.generator;
      if (json.generatorOptions) Object.assign(generatorOptions, json.generatorOptions);
    } else if (Array.isArray(json)) {
      // likely users.json — map to players structure
      players = json.map(u => ({ username: u.username, token: u.token }));
    } else if (json && Array.isArray(json.users)) {
      players = json.users.map(u => ({ username: u.username, token: u.token }));
    } else {
      throw new Error('Unrecognized input JSON structure — expected players array or users array');
    }
  } catch (err) {
    console.error('Failed to load input file:', err.message);
    process.exit(1);
  }

  // Try to load a generator module from ./generators/<generatorName>_generator.js
  let tokenGenerator = null;
  try {
    const genPath = path.resolve(__dirname, 'generators', `${generatorName}_generator.js`);
    if (fs.existsSync(genPath)) {
      tokenGenerator = require(genPath);
      console.log(`Using token generator: ${genPath}`);
    } else {
      console.log(`No generator module found at ${genPath}; falling back to default deterministic HMAC`);
    }
  } catch (err) {
    console.warn('Failed to load generator module, falling back to default:', err.message);
    tokenGenerator = null;
  }

  const flagsByUser = {};

  for (const p of players) {
    const username = p && (p.username || p.user || p.id);
    let token = p && p.token;

    if (!username) {
      console.warn('Skipping player with missing username or unexpected entry:', p);
      continue;
    }

    if (!validateUsername(username)) {
      console.warn(`Skipping player with invalid username '${username}' (expected 4 letters + 2 digits)`);
      continue;
    }

    // If token missing, synthesize deterministically using generator module or default HMAC
    if (!token) {
      if (tokenGenerator && typeof tokenGenerator === 'function') {
        token = tokenGenerator(username, generatorOptions);
      } else {
        const salt = generatorOptions.salt || 'basic1-default-salt';
        const tokenLen = generatorOptions.tokenLength || 16; // hex chars
        token = crypto.createHmac('sha256', String(salt)).update(String(username)).digest('hex').slice(0, tokenLen);
      }
    }

    flagsByUser[String(username).toLowerCase()] = generateFlag(String(username).toLowerCase(), token);
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
