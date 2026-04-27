const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const request = require('supertest')
const { createApp } = require('../../server/index.js')

function freshApp(flagsContent = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctf2-int-'))
  fs.writeFileSync(path.join(tmp, 'flags.json'), JSON.stringify(flagsContent))
  fs.writeFileSync(path.join(tmp, 'credentials.json'), JSON.stringify({}))
  const { app, JWT_SECRET } = createApp({
    dataDir: tmp,
    flagsPath: path.join(tmp, 'flags.json'),
    credsPath: path.join(tmp, 'credentials.json'),
    jwtSecret: 'pow-leak-secret',
    isDev: true,
    powDifficulty: 1,
  })
  return { app, JWT_SECRET, tmp }
}

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex')
}

function solvePow(nonce, difficulty) {
  const prefix = '0'.repeat(difficulty)
  for (let i = 0; i < 100000; i++) {
    const suffix = String(i)
    if (sha256Hex(nonce + suffix).startsWith(prefix)) return suffix
  }
  throw new Error('PoW unsolved within bound')
}

describe('CTF2 integration: PoW reward -> JWT secret -> forge cookie -> /api/flag', () => {
  test('full intended chain across 4 routes returns a real per-user flag', async () => {
    const victimUsername = 'abcd12'
    const expectedFlag = `durham{integration-test-flag-${victimUsername}}`
    const { app, JWT_SECRET } = freshApp({ [victimUsername]: expectedFlag })

    const challenge = await request(app).get('/api/challenge')
    expect(challenge.status).toBe(200)
    const { nonce, difficulty } = challenge.body
    const suffix = solvePow(nonce, difficulty)

    const solve = await request(app).post('/api/challenge/solve').send({ nonce, suffix })
    expect(solve.status).toBe(200)
    expect(solve.body.ok).toBe(true)
    expect(solve.body.secret).toBe(JWT_SECRET)

    const forged = jwt.sign({ sub: victimUsername }, solve.body.secret)
    const flagResp = await request(app)
      .get('/api/flag')
      .set('Cookie', `session=${forged}`)
    expect(flagResp.status).toBe(200)
    expect(flagResp.body.flag).toBe(expectedFlag)
  })

  test('forged JWT signed with the wrong secret is rejected by /api/flag and /api/vault', async () => {
    const { app } = freshApp({ abcd12: 'durham{should-never-leak}' })

    const bogus = jwt.sign({ sub: 'abcd12' }, 'not-the-real-secret')
    const flag = await request(app).get('/api/flag').set('Cookie', `session=${bogus}`)
    expect(flag.status).toBe(401)

    const vault = await request(app).get('/api/vault').set('Cookie', `session=${bogus}`)
    expect(vault.status).toBe(401)
  })
})
