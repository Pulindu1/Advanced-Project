/**
 * CTF5 Flag Generator
 * Generates unique flags for each player in the NovaCMS SSTI CTF
 * Uses HMAC-SHA256 for deterministic, per-user flags
 */

const crypto = require('crypto')

const FLAG_PREFIX = 'durham-cms'
const SALT = 'novacms-ctf5-2026'

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
      const password = crypto.randomBytes(passLen).toString('base64').slice(0, passLen)
      creds[normalized] = {
        password,
        role: 'editor',
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
  FLAG_PREFIX,
}
