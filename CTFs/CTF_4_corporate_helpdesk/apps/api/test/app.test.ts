import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockQuery = jest.fn();

jest.mock('../src/db', () => ({
  __esModule: true,
  query: (text: string, params?: any[]) => mockQuery(text, params),
  initDatabase: jest.fn(),
  default: { query: (text: string, params?: any[]) => mockQuery(text, params) },
}));

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    quit: jest.fn(),
    disconnect: jest.fn(),
  }));
});

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    close: jest.fn(),
  })),
  Worker: jest.fn(),
}));

import { createApp } from '../src/index';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

function signToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

describe('CTF4 IntraDesk API contract tests', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  test('T1 /health returns ok with timestamp', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
  });

  test('T2 /api/routes advertises public/authenticated/admin sections', async () => {
    const app = createApp();
    const res = await request(app).get('/api/routes');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.public)).toBe(true);
    expect(Array.isArray(res.body.authenticated)).toBe(true);
    expect(Array.isArray(res.body.admin)).toBe(true);
    expect(res.body.admin.some((r: string) => r.includes('/api/admin/flag'))).toBe(true);
  });

  test('T3 /api/auth/login missing body returns 400', async () => {
    const app = createApp();
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test('T4 /api/auth/login unknown user returns 401', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ghost', password: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  test('T5 /api/auth/register is disabled with 403', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'newbie', password: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/disabled/i);
  });

  test('T6 /api/auth/me without cookie returns 401', async () => {
    const app = createApp();
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication/i);
  });

  test('T7 /api/admin/flag without token returns 401', async () => {
    const app = createApp();
    const res = await request(app).get('/api/admin/flag?reportId=1');
    expect(res.status).toBe(401);
  });

  test('T8 /api/admin/flag with non-admin token returns 403 with discovery hint', async () => {
    const app = createApp();
    const token = signToken({ id: 42, username: 'abcd12', role: 'user' });
    const res = await request(app)
      .get('/api/admin/flag?reportId=1')
      .set('Cookie', [`token=${token}`]);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin/i);
    expect(res.body.usage).toMatch(/reportId/);
  });
});
