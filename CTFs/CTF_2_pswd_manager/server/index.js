const express = require('express')
const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const crypto = require('crypto')

const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const IS_DEV = process.env.NODE_ENV !== 'production' || process.env.CTF_DEV === 'true'
const app = express()

app.use(express.json())
app.use(cookieParser())
app.use(cors({ 
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://www.localhost.com:5173'],
  credentials: true 
}))

const DATA_DIR = path.resolve(__dirname, 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const FLAGS_FILE = path.join(DATA_DIR, 'flags.json')
const VAULTS_FILE = path.join(DATA_DIR, 'vaults.json')
const DELETED_FLAGS_FILE = path.join(DATA_DIR, 'deleted_flags.json')
const LOGIN_ATTEMPTS_FILE = path.join(DATA_DIR, 'login_attempts.json')

function readUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    return []
  }
}

function writeUsers(users) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
}

function readFlags() {
  try {
    const raw = fs.readFileSync(FLAGS_FILE, 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    return {}
  }
}

function readVaults() {
  try {
    const raw = fs.readFileSync(VAULTS_FILE, 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    return {}
  }
}

function readDeletedFlags() {
  try {
    const raw = fs.readFileSync(DELETED_FLAGS_FILE, 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    return {}
  }
}

function writeDeletedFlags(deleted) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(DELETED_FLAGS_FILE, JSON.stringify(deleted, null, 2))
}

function writeVaults(vaults) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(VAULTS_FILE, JSON.stringify(vaults, null, 2))
}

// In-memory challenge store and simple rate limiter for PoW
const CHALLENGES = {} // nonce -> { difficulty, createdAt, solved }
const ATTEMPTS = {} // ip -> { count, resetAt }

function generateNonce() {
  return crypto.randomBytes(8).toString('hex')
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(String(input), 'utf8').digest('hex')
}

function cleanupChallenges() {
  const now = Date.now()
  for (const k of Object.keys(CHALLENGES)) {
    if (now - CHALLENGES[k].createdAt > 1000 * 60 * 10) { // 10 minutes
      delete CHALLENGES[k]
    }
  }
}

// Ensure flags.json entries are mirrored into vaults.json as special flag entries
function syncFlagsToVaults() {
  try {
    const flags = readFlags()
    const vaults = readVaults()
    const deleted = readDeletedFlags()
    let changed = false
    for (const username of Object.keys(flags)) {
      if (!vaults[username]) vaults[username] = []
      const flagId = `flag-${username}`
      // If the user has explicitly deleted this auto-flag, do not re-add it.
      if (deleted[username] && Array.isArray(deleted[username]) && deleted[username].includes(flagId)) {
        continue
      }

      const existing = vaults[username].find(e => e.id === flagId)
      if (!existing) {
        vaults[username].push({
          id: flagId,
          site: 'CTF Flag',
          username: 'flag',
          password: flags[username],
          notes: 'Auto-added from flags.json',
          createdAt: new Date().toISOString()
        })
        changed = true
      } else if (existing.password !== flags[username]) {
        existing.password = flags[username]
        existing.createdAt = new Date().toISOString()
        changed = true
      }
    }
    if (changed) writeVaults(vaults)
  } catch (err) {
    console.error('[syncFlagsToVaults] failed', err && err.message)
  }
}

function readLoginAttempts() {
  try {
    const raw = fs.readFileSync(LOGIN_ATTEMPTS_FILE, 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    return {}
  }
}

function writeLoginAttempts(obj) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(LOGIN_ATTEMPTS_FILE, JSON.stringify(obj, null, 2))
  } catch (err) {
    console.error('[writeLoginAttempts] failed', err && err.message)
  }
}

// Load persisted login attempts into memory
let LOGIN_ATTEMPTS = readLoginAttempts() || {}

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'username and password required' })
  if (!/^[A-Za-z]{4}[0-9]{2}$/.test(username)) return res.status(400).json({ error: 'invalid username format' })

  const users = readUsers()
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: 'user exists' })
  }
  const hash = await bcrypt.hash(password, 12)
  const user = { id: 'u-' + Date.now(), username, passwordHash: hash }
  users.push(user)
  writeUsers(users)
  res.status(201).json({ user: { username: user.username } })
})

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'username and password required' })

  const now = Date.now()
  const ukey = String(username).toLowerCase()
  if (!LOGIN_ATTEMPTS[ukey]) LOGIN_ATTEMPTS[ukey] = { count: 0, lockedUntil: 0 }
  const la = LOGIN_ATTEMPTS[ukey]

  // If currently locked, return 429 with lockedUntil
  if (la.lockedUntil && now < la.lockedUntil) {
    return res.status(429).json({ error: 'too many attempts', lockedUntil: la.lockedUntil })
  }

  const users = readUsers()
  const user = users.find(u => u.username.toLowerCase() === ukey)

  // Helper to record a failed attempt and possibly lock
  const recordFailure = () => {
    la.count = (la.count || 0) + 1
    if (la.count >= 4) {
      la.lockedUntil = Date.now() + 45 * 1000 // 45 seconds lock
      la.count = 0
      writeLoginAttempts(LOGIN_ATTEMPTS)
      return { locked: true, lockedUntil: la.lockedUntil }
    }
    writeLoginAttempts(LOGIN_ATTEMPTS)
    return { locked: false }
  }

  if (!user) {
    const r = recordFailure()
    if (r.locked) return res.status(429).json({ error: 'too many attempts', lockedUntil: r.lockedUntil })
    return res.status(401).json({ error: 'invalid credentials' })
  }

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) {
    const r = recordFailure()
    if (r.locked) return res.status(429).json({ error: 'too many attempts', lockedUntil: r.lockedUntil })
    return res.status(401).json({ error: 'invalid credentials' })
  }

  // success - reset attempts and persist
  LOGIN_ATTEMPTS[ukey] = { count: 0, lockedUntil: 0 }
  writeLoginAttempts(LOGIN_ATTEMPTS)

  const tokenOpts = IS_DEV ? { expiresIn: '7d' } : { expiresIn: '15m' }
  const token = jwt.sign({ sub: user.username }, JWT_SECRET, tokenOpts)

  // Cookie options: in dev allow more permissive cookie so browsers on localhost accept it when
  // using the Vite dev proxy. In production use tighter defaults.
  const cookieOptions = IS_DEV
    ? { httpOnly: true, sameSite: 'lax', secure: false, path: '/' }
    : { httpOnly: true, sameSite: 'lax', secure: true, path: '/' }

  res.cookie('session', token, cookieOptions)
  res.json({ user: { username: user.username } })
})

app.get('/api/auth/whoami', (req, res) => {
  // NOTE: server will receive cookies if the browser sends them. Use /api/debug-cookies to inspect.
  const token = req.cookies.session
  if (!token) return res.status(401).json({ error: 'not authenticated' })
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    return res.json({ user: { username: decoded.sub } })
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' })
  }
})

// Protected per-user flag endpoint.
// Relies on flags.json generated by CTFs/challenge-generation/chgen_ctf2.js
app.get('/api/flag', (req, res) => {
  const token = req.cookies.session
  if (!token) return res.status(401).json({ error: 'not authenticated' })

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const username = String(decoded.sub || '').toLowerCase()
    const flags = readFlags()
    const flag = flags[username]
    if (!flag) return res.status(404).json({ error: 'flag not found' })
    return res.json({ flag })
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' })
  }
})

// Temporary debug endpoint to show all cookies received by the server from the client.
app.get('/api/debug-cookies', (req, res) => {
  console.log('[auth] debug-cookies:', req.cookies)
  res.json({ cookies: req.cookies || {} })
})

// === Proof-of-Work challenge endpoints ===
// GET /api/challenge -> { nonce, difficulty }
app.get('/api/challenge', (req, res) => {
  cleanupChallenges()
  const nonce = generateNonce()
  const difficulty = 4 // tune this if needed
  CHALLENGES[nonce] = { difficulty, createdAt: Date.now(), solved: false }
  return res.json({ nonce, difficulty })
})

// POST /api/challenge/solve -> { nonce, suffix }
app.post('/api/challenge/solve', (req, res) => {
  const ip = req.ip || req.connection && req.connection.remoteAddress || 'unknown'
  const now = Date.now()
  const bucket = ATTEMPTS[ip] || { count: 0, resetAt: now + 60 * 1000 }
  if (now > bucket.resetAt) {
    bucket.count = 0
    bucket.resetAt = now + 60 * 1000
  }
  if (bucket.count > 200) return res.status(429).json({ error: 'too many attempts' })

  bucket.count++
  ATTEMPTS[ip] = bucket

  const { nonce, suffix } = req.body || {}
  if (!nonce || typeof suffix !== 'string') return res.status(400).json({ error: 'invalid parameters' })
  const challenge = CHALLENGES[nonce]
  if (!challenge) return res.status(404).json({ error: 'challenge not found or expired' })
  if (challenge.solved) return res.status(400).json({ error: 'already solved' })

  const h = sha256Hex(nonce + suffix)
  if (h.startsWith('0'.repeat(challenge.difficulty))) {
    challenge.solved = true
    // return the JWT secret as the reward
    return res.json({ ok: true, secret: JWT_SECRET })
  }

  return res.status(400).json({ ok: false })
})

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('session')
  res.json({ ok: true })
})

// Vault endpoints
app.get('/api/vault', (req, res) => {
  const token = req.cookies.session
  if (!token) return res.status(401).json({ error: 'not authenticated' })

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const username = String(decoded.sub || '').toLowerCase()
    // Ensure vaults.json contains latest flags
    syncFlagsToVaults()
    const vaults = readVaults()
    const userVault = (vaults[username] || []).slice()

    // If there is a flag for this user in flags.json, include it dynamically
    const flags = readFlags()
    const flagForUser = flags[username]
    if (flagForUser) {
      const flagId = `flag-${username}`
      const deleted = readDeletedFlags()
      const isDeleted = deleted[username] && Array.isArray(deleted[username]) && deleted[username].includes(flagId)
      if (!isDeleted) {
        const flagEntry = {
          id: flagId,
          site: 'CTF Flag',
          username: 'flag',
          password: flagForUser,
          notes: 'Automatically inserted flag entry',
          createdAt: new Date().toISOString()
        }
        userVault.push(flagEntry)
      }
    }

    return res.json({ entries: userVault })
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' })
  }
})

app.post('/api/vault', (req, res) => {
  const token = req.cookies.session
  if (!token) return res.status(401).json({ error: 'not authenticated' })

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const username = String(decoded.sub || '').toLowerCase()
    const { site, username: entryUsername, password, notes } = req.body || {}
    
    if (!site || !entryUsername || !password) {
      return res.status(400).json({ error: 'site, username, and password are required' })
    }

    const vaults = readVaults()
    if (!vaults[username]) vaults[username] = []

    const entry = {
      id: 'v-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      site,
      username: entryUsername,
      password,
      notes: notes || '',
      createdAt: new Date().toISOString()
    }

    vaults[username].push(entry)
    writeVaults(vaults)

    return res.status(201).json({ entry })
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' })
  }
})

app.delete('/api/vault/:id', (req, res) => {
  const token = req.cookies.session
  if (!token) return res.status(401).json({ error: 'not authenticated' })

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const username = String(decoded.sub || '').toLowerCase()
    const { id } = req.params

    const vaults = readVaults()
    if (!vaults[username]) return res.status(404).json({ error: 'entry not found' })

    const initialLength = vaults[username].length
    vaults[username] = vaults[username].filter(e => e.id !== id)

    if (vaults[username].length === initialLength) {
      return res.status(404).json({ error: 'entry not found' })
    }

    writeVaults(vaults)
    // If the deleted entry is an auto-inserted flag, persist the deletion so sync doesn't re-add it
    if (id && String(id).startsWith('flag-')) {
      try {
        const deleted = readDeletedFlags()
        if (!deleted[username]) deleted[username] = []
        if (!deleted[username].includes(id)) {
          deleted[username].push(id)
          writeDeletedFlags(deleted)
        }
      } catch (e) {
        console.error('[delete flag] failed to record deletion', e && e.message)
      }
    }

    return res.json({ ok: true })
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' })
  }
})

// Teams endpoint - list all users
app.get('/api/teams/users', (req, res) => {
  const token = req.cookies.session
  if (!token) return res.status(401).json({ error: 'not authenticated' })

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const users = readUsers()
    // Return just usernames, sorted alphabetically
    const userList = users.map(u => ({ username: u.username })).sort((a, b) => a.username.localeCompare(b.username))
    return res.json({ users: userList })
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' })
  }
})

app.listen(PORT, () => {
  console.log(`Auth server listening on http://localhost:${PORT}`)
})
