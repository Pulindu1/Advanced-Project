const fs = require('fs');
const path = require('path');
const request = require('supertest');

process.env.NODE_ENV = 'test';
const app = require('../../src/app');

const USERS_PATH = path.join(__dirname, '..', '..', 'src', 'data', 'users.json');

function getFirstUser() {
  const users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
  const username = Object.keys(users)[0];
  return { username, password: users[username].password };
}

describe('CTF7 integration: full auth lifecycle across multiple routes', () => {
  test('GET / -> POST /login -> GET /home -> GET /note/1 -> GET /logout -> GET /home redirects', async () => {
    const { username, password } = getFirstUser();
    const agent = request.agent(app);

    const loginPage = await agent.get('/');
    expect(loginPage.status).toBe(200);

    const login = await agent
      .post('/login')
      .type('form')
      .send({ username, password });
    expect(login.status).toBe(302);
    expect(login.headers.location).toBe('/home');

    const home = await agent.get('/home');
    expect(home.status).toBe(200);
    expect(home.text).toContain(`Welcome back, ${username}`);

    const note = await agent.get('/note/1');
    expect(note.status).toBe(200);
    expect(note.text).toContain('Welcome to NorthSide Notes');

    const badNote = await agent.get('/note/abc');
    expect(badNote.status).toBe(400);

    const logout = await agent.get('/logout');
    expect(logout.status).toBe(302);

    const homeAfterLogout = await agent.get('/home');
    expect(homeAfterLogout.status).toBe(302);
    expect(homeAfterLogout.headers.location).toBe('/');
  });

  test('logged-in user visiting / is bounced to /home (no double-login form)', async () => {
    const { username, password } = getFirstUser();
    const agent = request.agent(app);

    await agent.post('/login').type('form').send({ username, password });

    const root = await agent.get('/').redirects(0);
    expect(root.status).toBe(302);
    expect(root.headers.location).toBe('/home');
  });
});
