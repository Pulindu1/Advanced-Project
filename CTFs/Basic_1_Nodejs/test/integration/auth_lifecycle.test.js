const fs = require('fs');
const path = require('path');
const request = require('supertest');

const usersPath = path.join(__dirname, '..', '..', 'src', 'data', 'users.json');
let app;
let originalUsers;

beforeAll(() => {
  fs.mkdirSync(path.dirname(usersPath), { recursive: true });
  originalUsers = fs.existsSync(usersPath) ? fs.readFileSync(usersPath, 'utf8') : '[]\n';
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
  app = require('../../src/app');
});

afterAll(() => {
  fs.writeFileSync(usersPath, originalUsers);
});

describe('CTF1 integration: auth lifecycle multi-route flow', () => {
  test('GET / -> POST /login -> GET /home -> GET /whoami -> GET /logout -> GET /home', async () => {
    const agent = request.agent(app);

    const loginPage = await agent.get('/');
    expect(loginPage.status).toBe(200);

    const login = await agent
      .post('/login')
      .type('form')
      .send({ username: 'student', password: 'student123' });
    expect(login.status).toBe(302);
    expect(login.headers.location).toBe('/home');

    const home = await agent.get('/home');
    expect(home.status).toBe(200);

    const whoami = await agent.get('/whoami');
    expect(whoami.status).toBe(200);
    expect(whoami.body.user).toMatchObject({ username: 'student', role: 'student' });

    const logout = await agent.get('/logout');
    expect(logout.status).toBe(302);
    expect(logout.headers.location).toBe('/');

    const homeAfterLogout = await agent.get('/home');
    expect(homeAfterLogout.status).toBe(302);
    expect(homeAfterLogout.headers.location).toBe('/');
  });

  test('failed login does not lock out subsequent successful login on the same agent', async () => {
    const agent = request.agent(app);

    const bad = await agent
      .post('/login')
      .type('form')
      .send({ username: 'student', password: 'wrong-password' });
    expect(bad.status).toBe(401);

    const good = await agent
      .post('/login')
      .type('form')
      .send({ username: 'student', password: 'student123' });
    expect(good.status).toBe(302);

    const home = await agent.get('/home');
    expect(home.status).toBe(200);
  });
});
