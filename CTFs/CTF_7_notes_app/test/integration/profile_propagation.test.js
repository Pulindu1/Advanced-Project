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

describe('CTF7 integration: profile cookie set on /login propagates through every protected route', () => {
  test('/login set-cookie -> /home renders username -> /note/2 renders username -> /debug echoes parsed profile', async () => {
    const { username, password } = getFirstUser();
    const agent = request.agent(app);

    await agent.post('/login').type('form').send({ username, password });

    const home = await agent.get('/home');
    expect(home.status).toBe(200);
    expect(home.text).toContain(username);

    const note = await agent.get('/note/2');
    expect(note.status).toBe(200);
    expect(note.text).toContain('Maintenance Log');

    const debug = await agent.get('/debug');
    expect(debug.status).toBe(200);
    expect(debug.body.profile).toMatchObject({ username, theme: 'light' });
    expect(debug.body._engine).toBe('node-serialize@0.0.4');
  });

  test('/debug surfaces CVE hint after the second hit on the same agent', async () => {
    const { username, password } = getFirstUser();
    const agent = request.agent(app);

    await agent.post('/login').type('form').send({ username, password });

    const first = await agent.get('/debug');
    expect(first.body._hint).toBeUndefined();

    const second = await agent.get('/debug');
    expect(second.body._hint).toMatch(/CVE-2017-5941/);
  });
});
