/**
 * CTF3 Flag Generator
 * Generates unique flags for each player in the HR System CTF
 */

const crypto = require('crypto')

const FLAG_PREFIX = 'durham-hr'

/**
 * Generate a unique flag for a given username
 * @param {string} username - The player's username
 * @returns {string} The generated flag
 */
function generateFlag(username) {
  const normalizedUsername = String(username).toLowerCase().trim()
  const timestamp = Date.now().toString(36)
  const randomPart = crypto.randomBytes(8).toString('hex')
  const hash = crypto.createHash('sha256')
    .update(`${normalizedUsername}:${timestamp}:${randomPart}`)
    .digest('hex')
    .substring(0, 20)
  
  return `${FLAG_PREFIX}{${hash}_${normalizedUsername}}`
}

/**
 * Generate flags for multiple usernames
 * @param {string[]} usernames - Array of usernames
 * @returns {Object} Map of username -> flag
 */
function generateFlags(usernames) {
  const flags = {}
  for (const username of usernames) {
    const normalized = String(username).toLowerCase().trim()
    if (normalized) {
      flags[normalized] = generateFlag(normalized)
    }
  }
  return flags
}

module.exports = {
  generateFlag,
  generateFlags,
  FLAG_PREFIX,
}
