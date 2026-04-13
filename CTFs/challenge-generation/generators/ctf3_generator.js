/**
 * CTF3 Flag Generator
 * Generates unique per-user flags for the HR System CTF.
 *
 * Each user gets two flags:
 *   - flag_api:     returned by the /api/flag endpoint (and shown on /flag page)
 *   - flag_decrypt: encrypted with AES-256-CBC, placed in the user's bot employee notes
 */

const crypto = require('crypto')

const FLAG_PREFIX = 'durham-hr'
const HMAC_SALT_API = 'ctf3-api-flag-salt-2026'
const HMAC_SALT_DECRYPT = 'ctf3-decrypt-flag-salt-2026'
const ENCRYPTION_KEY_PASSPHRASE = 'CTF_2026_SECRET_KEY_XJ9K2L'
const TOKEN_LENGTH = 20

/**
 * Deterministic HMAC-based flag token (consistent across runs for the same salt+username).
 */
function hmacToken(username, salt) {
  return crypto.createHmac('sha256', salt)
    .update(String(username))
    .digest('hex')
    .slice(0, TOKEN_LENGTH)
}

/**
 * Encrypt plaintext with AES-256-CBC using the shared CTF key.
 * Returns "iv_base64:ciphertext_base64".
 */
function encryptFlag(plaintext) {
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY_PASSPHRASE).digest()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(plaintext, 'utf8')
  encrypted = Buffer.concat([encrypted, cipher.final()])
  return `${iv.toString('base64')}:${encrypted.toString('base64')}`
}

/**
 * Generate flags for a single username.
 */
function generateUserFlags(username) {
  const norm = String(username).toLowerCase().trim()
  const flagApi = `${FLAG_PREFIX}{${hmacToken(norm, HMAC_SALT_API)}_${norm}}`
  const flagDecrypt = `${FLAG_PREFIX}{${hmacToken(norm, HMAC_SALT_DECRYPT)}_${norm}}`
  return { flag_api: flagApi, flag_decrypt: flagDecrypt }
}

/**
 * Generate flags for multiple usernames.
 * @param {string[]} usernames
 * @returns {Object} { username: { flag_api, flag_decrypt } }
 */
function generateFlags(usernames) {
  const flags = {}
  for (const username of usernames) {
    const norm = String(username).toLowerCase().trim()
    if (norm) {
      flags[norm] = generateUserFlags(norm)
    }
  }
  return flags
}

module.exports = {
  generateFlags,
  generateUserFlags,
  encryptFlag,
  FLAG_PREFIX,
}
