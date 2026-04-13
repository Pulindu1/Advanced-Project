#!/usr/bin/env node
/**
 * chgen_ctf3.js - Challenge Generator for CTF3 HR System
 *
 * Generates per-player flags and credentials, then writes:
 *   - CTFs/CTF_3_HR-system/flags.json
 *   - CTFs/CTF_3_HR-system/credentials.json
 *
 * Usage:
 *   node chgen_ctf3.js abcd12 efgh34 ijkl56    # Specify player usernames (4 letters + 2 numbers)
 *   node chgen_ctf3.js --count 10               # Generate 10 random player usernames
 */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { generateFlags, encryptFlag } = require('./generators/ctf3_generator')

// Paths
const CTF_DIR = path.resolve(__dirname, '..', 'CTF_3_HR-system')
const FLAGS_OUTPUT = path.join(CTF_DIR, 'flags.json')
const CREDS_OUTPUT = path.join(CTF_DIR, 'credentials.json')

// Username format: 4 lowercase letters + 2 digits (e.g., abcd12)
const USERNAME_PATTERN = /^[a-z]{4}[0-9]{2}$/

const DEPARTMENTS = ['Engineering', 'Human Resources', 'Finance', 'Operations']
const POSITIONS = [
  'Software Engineer',
  'Junior Developer',
  'Data Analyst',
  'Systems Administrator',
  'Technical Support',
  'Project Coordinator',
]

function generateRandomUsername() {
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  const digits = '0123456789'
  let username = ''
  for (let i = 0; i < 4; i++) username += letters[Math.floor(Math.random() * letters.length)]
  for (let i = 0; i < 2; i++) username += digits[Math.floor(Math.random() * digits.length)]
  return username
}

function randomPassword() {
  return crypto.randomBytes(6).toString('hex')
}

function randomDate(startYear = 2023, endYear = 2026) {
  const start = new Date(startYear, 0, 1)
  const end = new Date(endYear, 11, 31)
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
  return d.toISOString().split('T')[0]
}

function main() {
  let usernames = []
  const args = process.argv.slice(2)

  // Check for --count flag to generate random usernames
  const countIndex = args.indexOf('--count')
  if (countIndex !== -1 && args[countIndex + 1]) {
    const count = parseInt(args[countIndex + 1], 10)
    if (isNaN(count) || count < 1) {
      console.error('Error: --count must be a positive number')
      process.exit(1)
    }
    console.log(`Generating ${count} random player usernames...`)
    const generated = new Set()
    while (generated.size < count) {
      generated.add(generateRandomUsername())
    }
    usernames = Array.from(generated)
  } else if (args.length > 0) {
    for (const arg of args) {
      const normalized = arg.toLowerCase().trim()
      if (!USERNAME_PATTERN.test(normalized)) {
        console.error(`Error: Invalid username format "${arg}". Must be 4 letters + 2 numbers (e.g., abcd12)`)
        process.exit(1)
      }
      usernames.push(normalized)
    }
  } else {
    console.error('Usage:')
    console.error('  node chgen_ctf3.js abcd12 efgh34 ijkl56    # Specify player usernames')
    console.error('  node chgen_ctf3.js --count 10               # Generate 10 random players')
    process.exit(1)
  }

  console.log(`Generating flags for ${usernames.length} users...`)

  // Generate per-user flags
  const flags = generateFlags(usernames)

  // Build credentials.json with player entries + per-user bot entries
  const credentials = {}
  usernames.forEach((username, idx) => {
    const empId = 'EMP' + String(idx + 1).padStart(3, '0')
    const dept = DEPARTMENTS[idx % DEPARTMENTS.length]
    const position = POSITIONS[idx % POSITIONS.length]

    // Player credential
    credentials[username] = {
      password: randomPassword(),
      employee_id: empId,
      department: dept,
      position: position,
      hire_date: randomDate(),
      monthly_pay: 4000 + Math.floor(Math.random() * 6000),
    }

    // Bot credential (hidden employee with encrypted flag in notes)
    const encryptedFlag = encryptFlag(flags[username].flag_decrypt)
    const botId = 'BOT' + String(idx + 1).padStart(3, '0')
    credentials[`${username}-bot`] = {
      password: 'SYSTEM_INTERNAL',
      employee_id: botId,
      department: 'Operations',
      position: 'System Account',
      hire_date: '2024-01-01',
      monthly_pay: 0,
      notes: `AES-256-CBC encrypted data: ${encryptedFlag} (hint: check legacy code for the key)`,
      owner: username,
    }
  })

  // Write files
  fs.mkdirSync(path.dirname(FLAGS_OUTPUT), { recursive: true })
  fs.writeFileSync(FLAGS_OUTPUT, JSON.stringify(flags, null, 2))
  console.log(`Wrote ${Object.keys(flags).length} flag entries to ${FLAGS_OUTPUT}`)

  fs.writeFileSync(CREDS_OUTPUT, JSON.stringify(credentials, null, 2))
  console.log(`Wrote ${Object.keys(credentials).length} credential entries to ${CREDS_OUTPUT}`)

  // Display summary
  console.log('\nGenerated flags:')
  for (const [user, f] of Object.entries(flags)) {
    console.log(`  ${user}:`)
    console.log(`    flag_api:     ${f.flag_api}`)
    console.log(`    flag_decrypt: ${f.flag_decrypt}`)
  }

  console.log('\nPlayer credentials:')
  for (const username of usernames) {
    console.log(`  ${username} / ${credentials[username].password}`)
  }

  console.log('\nTo start CTF3:')
  console.log('  cd CTFs/CTF_3_HR-system && docker compose down -v && docker compose up --build')
}

main()
