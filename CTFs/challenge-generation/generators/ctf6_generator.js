/**
 * CTF6 Flag Generator
 * Generates unique flags for each player in the Veridian Secure SSRF CTF
 * Uses HMAC-SHA256 for deterministic, per-user flags
 */

const crypto = require('crypto')

const FLAG_PREFIX = 'durham-vsec'
const SALT = 'veridian-ctf6-2026'

/**
 * Generate a single flag for a given username and flag number
 * @param {string} username
 * @param {number} flagNum - 1, 2, 3, or 4
 * @returns {string}
 */
function generateFlag(username, flagNum) {
  const normalized = String(username).toLowerCase().trim()
  const token = crypto
    .createHmac('sha256', `${SALT}-flag${flagNum}`)
    .update(normalized)
    .digest('hex')
    .slice(0, 20)
  return `${FLAG_PREFIX}-flag${flagNum}{${token}_${normalized}}`
}

/**
 * Generate all 4 flags for a single username
 * @param {string} username
 * @returns {Object}
 */
function generateUserFlags(username) {
  return {
    flag1: generateFlag(username, 1),
    flag2: generateFlag(username, 2),
    flag3: generateFlag(username, 3),
    flag4: generateFlag(username, 4),
  }
}

/**
 * Generate flags for multiple usernames
 * @param {string[]} usernames
 * @returns {Object}
 */
function generateFlags(usernames) {
  const flags = {}
  for (const username of usernames) {
    const normalized = String(username).toLowerCase().trim()
    if (normalized) {
      flags[normalized] = generateUserFlags(normalized)
    }
  }
  return flags
}

/**
 * Generate the cloud bootstrap script (user-data) with Flag 2 interpolated
 * @param {string} username
 * @returns {string}
 */
function generateBootstrapScript(username) {
  const flag2 = generateFlag(username, 2)
  return `#!/bin/bash
# Veridian Secure -- cloud bootstrap script
# Generated: 2024-01-15
# Environment: production-internal

# Service configuration
REDIS_HOST=redis
REDIS_PORT=6379
# internal session store -- no auth configured (legacy deployment)

APP_PORT=8080
APP_HOST=0.0.0.0

# Deployment credentials (rotate quarterly)
# DEPLOY_TOKEN=${flag2}

echo "Bootstrapping Veridian Secure portal..."
echo "Connecting to Redis at $REDIS_HOST:$REDIS_PORT"
echo "Starting application on $APP_HOST:$APP_PORT"
`
}

/**
 * Generate credentials for multiple usernames
 * @param {string[]} usernames
 * @returns {Object}
 */
function generateCredentials(usernames) {
  const creds = {}
  for (const username of usernames) {
    const normalized = String(username).toLowerCase().trim()
    if (normalized) {
      const passLen = 8 + Math.floor(Math.random() * 5)
      const password = crypto.randomBytes(passLen).toString('hex').slice(0, passLen)
      creds[normalized] = {
        password,
        role: 'analyst',
      }
    }
  }
  return creds
}

module.exports = {
  generateFlag,
  generateUserFlags,
  generateFlags,
  generateCredentials,
  generateBootstrapScript,
  FLAG_PREFIX,
}
