const fs = require('fs')
const os = require('os')
const path = require('path')
const request = require('supertest')
const { createApp } = require('../../server/index.js')

function freshApp(overrides = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctf2-int-'))
  fs.writeFileSync(path.join(tmp, 'flags.json'), JSON.stringify({}))
  fs.writeFileSync(path.join(tmp, 'credentials.json'), JSON.stringify({}))
  const { app } = createApp({
    dataDir: tmp,
    flagsPath: path.join(tmp, 'flags.json'),
    credsPath: path.join(tmp, 'credentials.json'),
    jwtSecret: 'integration-secret',
    isDev: true,
    powDifficulty: 1,
    lockoutThreshold: 3,
    lockoutMs: 250,
    ...overrides,
  })
  return { app, tmp }
}

describe('CTF2 integration: lockout state persists, then expires, across login attempts', () => {
  test('register -> 3 bad logins -> 429 -> wait past lockout -> good login -> whoami succeeds', async () => {
    jest.setTimeout(10000)
    const { app, tmp } = freshApp()
    await request(app).post('/api/auth/register').send({ username: 'abcd12', password: 'realpass99' })

    for (let i = 0; i < 2; i++) {
      const r = await request(app).post('/api/auth/login').send({ username: 'abcd12', password: 'wrong' })
      expect(r.status).toBe(401)
    }
    const locked = await request(app).post('/api/auth/login').send({ username: 'abcd12', password: 'wrong' })
    expect(locked.status).toBe(429)

    const persisted = JSON.parse(fs.readFileSync(path.join(tmp, 'login_attempts.json'), 'utf8'))
    expect(persisted.abcd12.lockedUntil).toBeGreaterThan(Date.now() - 1000)

    await new Promise((resolve) => setTimeout(resolve, 350))

    const recovered = await request(app)
      .post('/api/auth/login')
      .send({ username: 'abcd12', password: 'realpass99' })
    expect(recovered.status).toBe(200)

    const cookie = (recovered.headers['set-cookie'] || [])
      .find((c) => c.startsWith('session='))
      .split(';')[0]
    const whoami = await request(app).get('/api/auth/whoami').set('Cookie', cookie)
    expect(whoami.status).toBe(200)
    expect(whoami.body.user.username).toBe('abcd12')
  })
})
