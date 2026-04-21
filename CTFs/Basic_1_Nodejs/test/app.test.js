const fs = require('fs');
const path = require('path');
const request = require('supertest');

const usersPath = path.join(__dirname, '..', 'src', 'data', 'users.json');
let app;

beforeAll(() => {
  fs.mkdirSync(path.dirname(usersPath), { recursive: true });
  fs.writeFileSync(
    usersPath,
    JSON.stringify(
      [
        { username: 'admin', password: 'admin_seed_pw', role: 'admin' },
        { username: 'student', password: 'student123', role: 'student' },
      ],
      null,
      2
    )
  );
  app = require('../src/app');
});

describe('Basic_1 contract tests', () => {
  test('T1 unauthenticated /flag redirects to login', async () => {
    const res = await request(app).get('/flag');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });

  test('T2 student role hitting /flag gets 403', async () => {
    const agent = request.agent(app);
    await agent
      .post('/login')
      .type('form')
      .send({ username: 'student', password: 'student123' });
    const res = await agent.get('/flag');
    expect(res.status).toBe(403);
  });

  test('T3 unknown route returns 404', async () => {
    const res = await request(app).get('/random404test');
    expect(res.status).toBe(404);
  });

  test('T4 admin login with wrong password returns 401', async () => {
    const res = await request(app)
      .post('/login')
      .type('form')
      .send({ username: 'admin', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  test('T5 admin login with correct password redirects to /home and sets session cookie', async () => {
    const res = await request(app)
      .post('/login')
      .type('form')
      .send({ username: 'admin', password: 'admin_seed_pw' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/home');
    const setCookie = (res.headers['set-cookie'] || []).join(';');
    expect(setCookie).toMatch(/session=/);
  });

  test('T6 /home without session redirects to /', async () => {
    const res = await request(app).get('/home');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });

  test('T7 login with unknown user returns 401', async () => {
    const res = await request(app)
      .post('/login')
      .type('form')
      .send({ username: 'nonexistent_user_abc', password: 'anything' });
    expect(res.status).toBe(401);
  });

  test('T8 /whoami reflects cookie contents for authenticated session', async () => {
    const agent = request.agent(app);
    await agent
      .post('/login')
      .type('form')
      .send({ username: 'student', password: 'student123' });
    const res = await agent.get('/whoami');
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ username: 'student', role: 'student' });
  });
});
