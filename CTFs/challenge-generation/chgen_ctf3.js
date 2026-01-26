#!/usr/bin/env node
/**
 * chgen_ctf3.js - Challenge Generator for CTF3 HR System
 * 
 * Generates per-player flags and writes them to:
 *   - CTFs/CTF_3_HR-system/flags.json
 * 
 * Usage:
 *   node chgen_ctf3.js abcd12 efgh34 ijkl56    # Specify player usernames (4 letters + 2 numbers)
 *   node chgen_ctf3.js --count 10               # Generate 10 random player usernames
 */

const fs = require('fs')
const path = require('path')
const { generateFlags } = require('./generators/ctf3_generator')

// Paths
const CTF_DIR = path.resolve(__dirname, '..', 'CTF_3_HR-system')
const FLAGS_OUTPUT = path.join(CTF_DIR, 'flags.json')

// Username format: 4 lowercase letters + 2 digits (e.g., abcd12)
const USERNAME_PATTERN = /^[a-z]{4}[0-9]{2}$/

/**
 * Generate a random username in the format: 4 letters + 2 numbers
 */
function generateRandomUsername() {
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  const digits = '0123456789'
  let username = ''
  for (let i = 0; i < 4; i++) {
    username += letters[Math.floor(Math.random() * letters.length)]
  }
  for (let i = 0; i < 2; i++) {
    username += digits[Math.floor(Math.random() * digits.length)]
  }
  return username
}

/**
 * Validate username format
 */
function isValidUsername(username) {
  return USERNAME_PATTERN.test(username)
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
    // Validate provided usernames
    for (const arg of args) {
      const normalized = arg.toLowerCase().trim()
      if (!isValidUsername(normalized)) {
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

  const flags = generateFlags(usernames)

  // Write flags.json
  fs.mkdirSync(path.dirname(FLAGS_OUTPUT), { recursive: true })
  fs.writeFileSync(FLAGS_OUTPUT, JSON.stringify(flags, null, 2))
  console.log(`Wrote ${Object.keys(flags).length} flags to ${FLAGS_OUTPUT}`)

  // Display summary
  console.log('\nGenerated flags:')
  for (const [user, flag] of Object.entries(flags)) {
    console.log(`  ${user}: ${flag}`)
  }

  console.log('\nTo load flags into the database, run:')
  console.log('  cd CTFs/CTF_3_HR-system/backend')
  console.log('  php artisan migrate:fresh --seed')
}

main()
