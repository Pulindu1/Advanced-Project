const request = require('supertest');
const app = require('../src/app');

describe('CTF Security Tests', () => {
  test('Unauthenticated user cannot access /flag', async () => {
    const res = await request(app).get('/flag');
    expect(res.status).toBe(403);
  });

  test('Normal student cannot view admin page', async () => {
    const agent = request.agent(app);

    // login as student
    await agent
      .post('/login')
      .send({ username: 'student', password: 'student123' });

    const res = await agent.get('/flag');
    expect(res.status).toBe(403);
  });

  test('Invalid route returns 404 (no unintended endpoints)', async () => {
    const res = await request(app).get('/random404test');
    expect(res.status).toBe(404);
  });
});
