#!/usr/bin/env node
/**
 * Add Users Script for CTF_4 IntraDesk (Direct DB Connection)
 * 
 * Adds users directly to the database using pg library
 * Usage: node add_users_db.js <username1> <username2> <username3> ...
 * Example: node add_users_db.js abcd12 efgh34 ijkl56
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Generate a random password
function generatePassword(length = 12) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  return password;
}

// Generate a unique flag for the user
function generateFlag(username) {
  const randomPart = crypto.randomBytes(8).toString('hex');
  return `CTF{user_${username}_${randomPart}}`;
}

async function generateUsers(usernames) {
  const users = [];
  
  for (const username of usernames) {
    // Validate username format (4 letters + 2 numbers)
    if (!/^[a-z]{4}\d{2}$/.test(username)) {
      console.error(`❌ Invalid username format: ${username} (must be 4 letters + 2 numbers, e.g., abcd12)`);
      continue;
    }
    
    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);
    const flag = generateFlag(username);
    
    users.push({
      username,
      password,
      passwordHash,
      flag
    });
  }
  
  return users;
}

async function addUsersToDatabase(users) {
  console.log('\n🗄️  Adding users to database...\n');
  
  const client = new Client({
    host: 'localhost',
    port: 5433,
    user: 'intradesk',
    password: 'intradesk_password',
    database: 'intradesk_kb',
  });

  await client.connect();
  const results = [];
  
  for (const user of users) {
    try {
      await client.query(
        'INSERT INTO users (username, password_hash, role, flag) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING',
        [user.username, user.passwordHash, 'user', user.flag]
      );
      
      console.log(`✅ Added user: ${user.username}`);
      results.push({
        success: true,
        username: user.username,
        password: user.password,
        flag: user.flag
      });
    } catch (error) {
      console.error(`❌ Failed to add user: ${user.username}`);
      console.error(error.message);
      results.push({
        success: false,
        username: user.username,
        error: error.message
      });
    }
  }
  
  await client.end();
  return results;
}

async function main() {
  const usernames = process.argv.slice(2);
  
  if (usernames.length === 0) {
    console.log('Usage: node add_users_db.js <username1> <username2> ...');
    console.log('Example: node add_users_db.js abcd12 efgh34 ijkl56');
    console.log('\nUsername format: 4 lowercase letters + 2 numbers (e.g., abcd12)');
    process.exit(1);
  }
  
  console.log('🔐 Generating users...\n');
  
  const users = await generateUsers(usernames);
  
  if (users.length === 0) {
    console.error('No valid users generated.');
    process.exit(1);
  }
  
  const results = await addUsersToDatabase(users);
  
  // Output credentials
  console.log('\n📝 User Credentials:');
  console.log('='.repeat(70));
  
  const successfulUsers = results.filter(r => r.success);
  successfulUsers.forEach(user => {
    console.log(`Username: ${user.username}`);
    console.log(`Password: ${user.password}`);
    console.log(`Flag:     ${user.flag}`);
    console.log('-'.repeat(70));
  });
  
  // Save credentials.json to parent directory
  const credentialsFile = path.join(__dirname, '..', 'credentials.json');
  const credentials = {};
  successfulUsers.forEach(user => {
    credentials[user.username] = {
      password: user.password,
      flag: user.flag
    };
  });
  
  // Load existing credentials if file exists
  let allCredentials = {};
  if (fs.existsSync(credentialsFile)) {
    allCredentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
  }
  
  // Merge new credentials
  Object.assign(allCredentials, credentials);
  fs.writeFileSync(credentialsFile, JSON.stringify(allCredentials, null, 2));
  
  // Save flags.json to parent directory
  const flagsFile = path.join(__dirname, '..', 'flags.json');
  const flags = {};
  Object.keys(allCredentials).forEach(username => {
    flags[username] = allCredentials[username].flag;
  });
  fs.writeFileSync(flagsFile, JSON.stringify(flags, null, 2));
  
  console.log(`\n✅ ${successfulUsers.length} user(s) added successfully`);
  console.log(`📄 Credentials saved to: ${credentialsFile}`);
  console.log(`🚩 Flags saved to: ${flagsFile}`);
}

main().catch(console.error);
