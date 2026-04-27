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
    lockoutMs: 200,
    ...overrides,
  })
  return { app, tmp }
}

async function loginAsNewUser(app, username, password) {
  await request(app).post('/api/auth/register').send({ username, password })
  const login = await request(app).post('/api/auth/login').send({ username, password })
  const cookie = (login.headers['set-cookie'] || []).find((c) => c.startsWith('session='))
  return cookie.split(';')[0]
}

describe('CTF2 integration: vault CRUD flow against real JSON files', () => {
  test('register -> login -> add entry -> list -> delete -> list reflects deletion', async () => {
    const { app, tmp } = freshApp()
    const cookie = await loginAsNewUser(app, 'abcd12', 'hunter2hunter2')

    const empty = await request(app).get('/api/vault').set('Cookie', cookie)
    expect(empty.status).toBe(200)
    expect(empty.body.entries).toEqual([])

    const add = await request(app)
      .post('/api/vault')
      .set('Cookie', cookie)
      .send({ site: 'github.com', username: 'me', password: 'p4ss', notes: 'work' })
    expect(add.status).toBe(201)
    const entryId = add.body.entry.id
    expect(entryId).toMatch(/^v-/)

    const list = await request(app).get('/api/vault').set('Cookie', cookie)
    expect(list.status).toBe(200)
    expect(list.body.entries.find((e) => e.id === entryId)).toMatchObject({
      site: 'github.com',
      username: 'me',
      password: 'p4ss',
    })

    const onDisk = JSON.parse(fs.readFileSync(path.join(tmp, 'vaults.json'), 'utf8'))
    expect(onDisk.abcd12.find((e) => e.id === entryId)).toBeDefined()

    const remove = await request(app).delete(`/api/vault/${entryId}`).set('Cookie', cookie)
    expect(remove.status).toBe(200)

    const after = await request(app).get('/api/vault').set('Cookie', cookie)
    expect(after.body.entries.find((e) => e.id === entryId)).toBeUndefined()
  })

  test('one user cannot list another user\'s vault entries', async () => {
    const { app } = freshApp()
    const aliceCookie = await loginAsNewUser(app, 'abcd12', 'hunter2hunter2')
    const bobCookie = await loginAsNewUser(app, 'bobb34', 'cantankerous99')

    await request(app)
      .post('/api/vault')
      .set('Cookie', aliceCookie)
      .send({ site: 'alice-site', username: 'a', password: 'a' })

    const bobView = await request(app).get('/api/vault').set('Cookie', bobCookie)
    expect(bobView.status).toBe(200)
    expect(bobView.body.entries.find((e) => e.site === 'alice-site')).toBeUndefined()
  })
})
