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
        { username: 'editor', password: 'editor_pw', role: 'student' },
      ],
      null,
      2
    )
  );
  jest.resetModules();
  app = require('../../src/app');
});

afterAll(() => {
  fs.writeFileSync(usersPath, originalUsers);
});

describe('CTF1 integration: users.json persistence drives auth', () => {
  test('every seeded user can log in, hit /whoami, and is reflected in returned role', async () => {
    const expected = [
      { username: 'admin', password: 'admin_seed_pw', role: 'admin' },
      { username: 'student', password: 'student123', role: 'student' },
      { username: 'editor', password: 'editor_pw', role: 'student' },
    ];

    for (const u of expected) {
      const agent = request.agent(app);
      const login = await agent
        .post('/login')
        .type('form')
        .send({ username: u.username, password: u.password });
      expect(login.status).toBe(302);

      const whoami = await agent.get('/whoami');
      expect(whoami.status).toBe(200);
      expect(whoami.body.user).toMatchObject({ username: u.username, role: u.role });
    }
  });

  test('removing a user from disk invalidates new logins for that user only', async () => {
    const reduced = [
      { username: 'admin', password: 'admin_seed_pw', role: 'admin' },
      { username: 'student', password: 'student123', role: 'student' },
    ];
    fs.writeFileSync(usersPath, JSON.stringify(reduced, null, 2));

    jest.resetModules();
    const freshApp = require('../../src/app');

    const removed = await request(freshApp)
      .post('/login')
      .type('form')
      .send({ username: 'editor', password: 'editor_pw' });
    expect(removed.status).toBe(401);

    const surviving = await request(freshApp)
      .post('/login')
      .type('form')
      .send({ username: 'student', password: 'student123' });
    expect(surviving.status).toBe(302);
  });
});
