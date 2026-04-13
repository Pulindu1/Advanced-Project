#!/usr/bin/env node
/**
 * chgen_ctf2.js - Challenge Generator for CTF2 Password Manager (JWT IDOR)
 *
 * Generates per-player flags and credentials, writes them to:
 *   - CTFs/CTF_2_pswd_manager/flags.json
 *   - CTFs/CTF_2_pswd_manager/credentials.json
 *
 * Usage:
 *   node chgen_ctf2.js abcd12 efgh34 ijkl56    # Specify player usernames
 *   node chgen_ctf2.js --count 10               # Generate 10 random player usernames
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const ctf2Generator = require('./generators/ctf2_generator')

const CTF_DIR = path.resolve(__dirname, '..', 'CTF_2_pswd_manager')
const FLAGS_OUTPUT = path.join(CTF_DIR, 'flags.json')
const CREDS_OUTPUT = path.join(CTF_DIR, 'credentials.json')

const USERNAME_PATTERN = /^[a-z]{4}[0-9]{2}$/

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

function isValidUsername(username) {
  return USERNAME_PATTERN.test(username)
}

function generateFlag(username) {
  const token = ctf2Generator(username)
  return `durham-pm{${token}_${username}}`
}

function generateCredentials(usernames) {
  const creds = {}
  for (const username of usernames) {
    const normalized = String(username).toLowerCase().trim()
    if (normalized) {
      const passLen = 8 + Math.floor(Math.random() * 5)
      const password = crypto.randomBytes(passLen).toString('hex').slice(0, passLen)
      creds[normalized] = {
        password,
        role: 'user',
      }
    }
  }
  return creds
}

function main() {
  let usernames = []
  const args = process.argv.slice(2)

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
      if (!isValidUsername(normalized)) {
        console.error(`Error: Invalid username format "${arg}". Must be 4 letters + 2 numbers (e.g., abcd12)`)
        process.exit(1)
      }
      usernames.push(normalized)
    }
  } else {
    console.error('Usage:')
    console.error('  node chgen_ctf2.js abcd12 efgh34 ijkl56    # Specify player usernames')
    console.error('  node chgen_ctf2.js --count 10               # Generate 10 random players')
    process.exit(1)
  }

  console.log(`Generating flags and credentials for ${usernames.length} users...`)

  const flags = {}
  for (const username of usernames) {
    flags[username] = generateFlag(username)
  }

  const credentials = generateCredentials(usernames)

  fs.mkdirSync(path.dirname(FLAGS_OUTPUT), { recursive: true })
  fs.writeFileSync(FLAGS_OUTPUT, JSON.stringify(flags, null, 2))
  console.log(`Wrote flags to ${FLAGS_OUTPUT}`)

  fs.writeFileSync(CREDS_OUTPUT, JSON.stringify(credentials, null, 2))
  console.log(`Wrote credentials to ${CREDS_OUTPUT}`)

  console.log('\nGenerated flags:')
  for (const [user, flag] of Object.entries(flags)) {
    console.log(`  ${user}: ${flag}`)
  }

  console.log('\nGenerated credentials:')
  for (const [user, cred] of Object.entries(credentials)) {
    console.log(`  ${user}: password=${cred.password}, role=${cred.role}`)
  }
}

main()
