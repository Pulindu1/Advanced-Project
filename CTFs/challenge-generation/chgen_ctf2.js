#!/usr/bin/env node

// Flags-only generator for CTF_2_pswd_manager
// Usage:
//   node chgen_ctf2.js [<path-to-users-or-config.json>]
//
// If no path is provided, the script reads usernames from
// ../CTF_2_pswd_manager/server/data/users.json. If the JSON contains a top-level
// `users` array it will be used; if it's an array of user objects, their `username`
// fields are used to synthesise tokens.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function validateUsername(username) {
  const re = /^[A-Za-z]{4}[0-9]{2}$/;
  return re.test(username);
}

function generateFlag(username, token) {
  return `durham-pm{${token}_${username}}`;
}

function main() {
  const [, , inputPath] = process.argv;

  let users = null;
  let generatorName = process.env.GENERATOR_NAME || 'ctf2';
  const generatorOptions = {
    salt: process.env.GENERATOR_SALT,
    tokenLength: process.env.GENERATOR_TOKEN_LENGTH
      ? Number(process.env.GENERATOR_TOKEN_LENGTH)
      : undefined
  };

  try {
    let dataPath = inputPath;
    if (!dataPath) {
      dataPath = path.resolve(__dirname, '..', 'CTF_2_pswd_manager', 'server', 'data', 'users.json');
      console.log(`No input provided — using users file: ${dataPath}`);
    }

    const raw = fs.readFileSync(path.resolve(dataPath), 'utf8');
    const json = JSON.parse(raw);

    if (Array.isArray(json)) {
      users = json;
    } else if (json && Array.isArray(json.users)) {
      users = json.users;
    } else {
      throw new Error('Unrecognized input JSON structure — expected array or users array');
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

  for (const u of users) {
    const username = u && (u.username || u.user || u.id);
    let token = u && u.token;

    if (!username) {
      console.warn('Skipping user with missing username or unexpected entry:', u);
      continue;
    }

    if (!validateUsername(username)) {
      console.warn(`Skipping user with invalid username '${username}' (expected 4 letters + 2 digits)`);
      continue;
    }

    if (!token) {
      if (tokenGenerator && typeof tokenGenerator === 'function') {
        token = tokenGenerator(username, generatorOptions);
      } else {
        const salt = generatorOptions.salt || 'ctf2-default-salt';
        const tokenLen = generatorOptions.tokenLength || 20; // hex chars
        token = crypto
          .createHmac('sha256', String(salt))
          .update(String(username))
          .digest('hex')
          .slice(0, tokenLen);
      }
    }

    flagsByUser[String(username).toLowerCase()] = generateFlag(String(username).toLowerCase(), token);
  }

  const outputPath = path.resolve(
    __dirname,
    '..',
    'CTF_2_pswd_manager',
    'server',
    'data',
    'flags.json'
  );

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
