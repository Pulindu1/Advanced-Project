const fs = require('fs')
const os = require('os')
const path = require('path')
const request = require('supertest')
const { createApp } = require('../server/index.js')

function freshApp(overrides = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctf2-test-'))
  fs.writeFileSync(path.join(tmp, 'flags.json'), JSON.stringify({}))
  fs.writeFileSync(path.join(tmp, 'credentials.json'), JSON.stringify({}))
  const { app } = createApp({
    dataDir: tmp,
    flagsPath: path.join(tmp, 'flags.json'),
    credsPath: path.join(tmp, 'credentials.json'),
    jwtSecret: 'test-secret',
    isDev: true,
    powDifficulty: 1,
    lockoutThreshold: 3,
    lockoutMs: 500,
    ...overrides
  })
  return { app, tmp }
}

describe('CTF2 password manager contract tests', () => {
  jest.setTimeout(20000)

  test('T1 register accepts valid username format', async () => {
    const { app } = freshApp()
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'abcd12', password: 'hunter2hunter2' })
    expect(res.status).toBe(201)
    expect(res.body.user.username).toBe('abcd12')
  })

  test('T2 register rejects invalid username format', async () => {
    const { app } = freshApp()
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: '123456', password: 'hunter2hunter2' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/invalid username format/)
  })

  test('T3 login rejects wrong credentials with 401', async () => {
    const { app } = freshApp()
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'abcd12', password: 'hunter2hunter2' })
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'abcd12', password: 'wrong-pw-xx' })
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/invalid credentials/)
  })

  test('T4 login locks account with 429 after repeated failures', async () => {
    const { app } = freshApp({ lockoutThreshold: 3 })
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'abcd12', password: 'hunter2hunter2' })
    for (let i = 0; i < 2; i++) {
      const r = await request(app).post('/api/auth/login').send({ username: 'abcd12', password: 'bad' })
      expect(r.status).toBe(401)
    }
    const locked = await request(app).post('/api/auth/login').send({ username: 'abcd12', password: 'bad' })
    expect(locked.status).toBe(429)
    expect(locked.body).toHaveProperty('lockedUntil')
  })

  test('T5 whoami without cookie returns 401', async () => {
    const { app } = freshApp()
    const res = await request(app).get('/api/auth/whoami')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/not authenticated/)
  })

  test('T6 /api/flag without cookie returns 401', async () => {
    const { app } = freshApp()
    const res = await request(app).get('/api/flag')
    expect(res.status).toBe(401)
  })

  test('T7 vault GET requires authentication', async () => {
    const { app } = freshApp()
    const res = await request(app).get('/api/vault')
    expect(res.status).toBe(401)
  })

  test('T8 challenge endpoint issues nonce and difficulty', async () => {
    const { app } = freshApp({ powDifficulty: 2 })
    const res = await request(app).get('/api/challenge')
    expect(res.status).toBe(200)
    expect(typeof res.body.nonce).toBe('string')
    expect(res.body.nonce.length).toBe(16)
    expect(res.body.difficulty).toBe(2)
  })
})
