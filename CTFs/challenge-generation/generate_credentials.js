#!/usr/bin/env node

/**
 * Credentials Generator for CTF_3_HR-system
 * 
 * Generates random passwords for each user in flags.json
 * Creates credentials.json with username -> password mapping
 * 
 * Usage:
 *   node generate_credentials.js [flags.json path]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Generate a random alphanumeric password
function generatePassword(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(length);
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  
  return password;
}

// Generate random hire date (1-36 months ago)
function generateHireDate() {
  const now = new Date();
  const monthsAgo = Math.floor(Math.random() * 36) + 1;
  now.setMonth(now.getMonth() - monthsAgo);
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Departments and positions
const DEPARTMENTS = ['Engineering', 'Human Resources', 'Finance', 'Operations'];
const POSITIONS = [
  'Software Engineer',
  'Junior Developer',
  'Data Analyst',
  'Systems Administrator',
  'Technical Support',
  'Project Coordinator'
];

function main() {
  const [, , flagsPath] = process.argv;
  
  let inputPath = flagsPath;
  if (!inputPath) {
    inputPath = path.resolve(__dirname, '..', 'CTF_3_HR-system', 'flags.json');
    console.log(`No input provided — using flags file: ${inputPath}`);
  }
  
  // Read flags.json
  let flags;
  try {
    const raw = fs.readFileSync(inputPath, 'utf8');
    flags = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load flags.json:', err.message);
    console.error('Make sure to run the flag generator first:');
    console.error('  node chgen_basic1.js --count 10');
    process.exit(1);
  }
  
  if (!flags || typeof flags !== 'object' || Object.keys(flags).length === 0) {
    console.error('flags.json is empty or invalid!');
    process.exit(1);
  }
  
  const usernames = Object.keys(flags);
  console.log(`Found ${usernames.length} users in flags.json`);
  
  // Generate credentials
  const credentials = {};
  let empNum = 1;
  
  for (const username of usernames) {
    // Validate username format (4 letters + 2 digits)
    if (!/^[a-z]{4}[0-9]{2}$/.test(username)) {
      console.warn(`Skipping invalid username: ${username}`);
      continue;
    }
    
    // Generate random password (8-12 characters)
    const passwordLength = 8 + Math.floor(Math.random() * 5); // 8-12 chars
    const password = generatePassword(passwordLength);
    
    // Generate employee data
    const employeeId = 'EMP' + String(empNum++).padStart(3, '0');
    const department = DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)];
    const position = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
    const hireDate = generateHireDate();
    
    credentials[username] = {
      password,
      employee_id: employeeId,
      department,
      position,
      hire_date: hireDate
    };
    
    console.log(`  ${username} -> ${password} | ${employeeId} | ${department} | ${position} | ${hireDate}`);
  }
  
  // Write credentials.json
  const outputPath = path.resolve(path.dirname(inputPath), 'credentials.json');
  fs.writeFileSync(outputPath, JSON.stringify(credentials, null, 2), 'utf8');
  
  console.log('');
  console.log(`✓ Credentials written to: ${outputPath}`);
  console.log(`  Generated ${Object.keys(credentials).length} passwords`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Copy flags.json and credentials.json to CTF_3_HR-system/');
  console.log('  2. Run: php artisan migrate:fresh --seed');
}

main();
