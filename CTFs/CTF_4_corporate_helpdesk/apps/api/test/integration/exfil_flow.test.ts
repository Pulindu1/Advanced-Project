// Multi-route integration: anonymous /api/exfil/capture writes a row,
// then an authenticated GET /api/exfil/my-captures observes it. Mirrors
// the intended exploit shape (admin-bot drives the capture, victim user
// reads back) but with deterministic, in-process fixtures.

import request from 'supertest';
import { createInMemoryDb, InMemoryDb } from './inMemoryDb';

let store: InMemoryDb;

jest.mock('../../src/db', () => ({
  __esModule: true,
  query: (text: string, params?: any[]) => store.query(text, params),
  initDatabase: jest.fn(),
  default: { query: (text: string, params?: any[]) => store.query(text, params) },
}));

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    quit: jest.fn(),
    disconnect: jest.fn(),
  }))
);

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    close: jest.fn(),
  })),
  Worker: jest.fn(),
}));

import { createApp } from '../../src/index';

beforeEach(() => {
  store = createInMemoryDb();
});

describe('CTF4 integration: exfil capture -> my-captures sees the same row', () => {
  test('anonymous POST /api/exfil/capture then logged-in GET /api/exfil/my-captures', async () => {
    await store.seedUser({ id: 5, username: 'ijkl56', password: 'p', role: 'user', flag: null });
    const app = createApp();

    const capture = await request(app)
      .post('/api/exfil/capture')
      .send({ data: { stolen: 'cookie-payload-marker' } });
    expect(capture.status).toBe(200);
    expect(store.exfilLogCount()).toBe(1);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ijkl56', password: 'p' });
    const token = (([] as string[]).concat(login.headers['set-cookie'] || []))
      .find((c: string) => c.startsWith('token='))!
      .split(';')[0];

    const captures = await request(app).get('/api/exfil/my-captures').set('Cookie', token);
    expect(captures.status).toBe(200);
    expect(captures.body.captures.length).toBe(1);
    expect(JSON.parse(captures.body.captures[0].data).stolen).toBe('cookie-payload-marker');
  });

  test('exfil capture missing data field returns 400 and writes nothing', async () => {
    const app = createApp();

    const bad = await request(app).post('/api/exfil/capture').send({});
    expect(bad.status).toBe(400);
    expect(store.exfilLogCount()).toBe(0);
  });
});
