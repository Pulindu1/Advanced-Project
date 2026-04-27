// Multi-route integration: a user logs in, submits a report, and then
// reads it back through two distinct routes — proving the insert state
// is visible to subsequent route handlers within the same in-process app.

import request from 'supertest';
import { createInMemoryDb, InMemoryDb } from './inMemoryDb';

let store: InMemoryDb;

jest.mock('../../src/db', () => {
  return {
    __esModule: true,
    query: (text: string, params?: any[]) => store.query(text, params),
    initDatabase: jest.fn(),
    default: { query: (text: string, params?: any[]) => store.query(text, params) },
  };
});

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

describe('CTF4 integration: report lifecycle persists across login + write + two reads', () => {
  test('login -> POST /api/report -> GET /my-reports -> GET /:id', async () => {
    await store.seedUser({ id: 11, username: 'abcd12', password: 'pwd123', role: 'user', flag: null });
    const app = createApp();

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'abcd12', password: 'pwd123' });
    expect(login.status).toBe(200);
    const tokenCookie = (([] as string[]).concat(login.headers['set-cookie'] || []))
      .find((c: string) => c.startsWith('token='))!
      .split(';')[0];

    const submit = await request(app)
      .post('/api/report')
      .set('Cookie', tokenCookie)
      .send({ url: '/kb/article-42' });
    expect(submit.status).toBe(201);
    const reportId = submit.body.reportId;

    const list = await request(app).get('/api/report/my-reports').set('Cookie', tokenCookie);
    expect(list.status).toBe(200);
    expect(list.body.reports.find((r: any) => r.id === reportId)).toBeDefined();

    const detail = await request(app).get(`/api/report/${reportId}`).set('Cookie', tokenCookie);
    expect(detail.status).toBe(200);
    expect(detail.body.report.url).toBe('/kb/article-42');
  });

  test('admin flag lookup uses report -> user -> flag join across two routes', async () => {
    await store.seedUser({ id: 22, username: 'efgh34', password: 'usrpwd', role: 'user', flag: 'durham{ctf4-test-flag}' });
    await store.seedUser({ id: 99, username: 'admin', password: 'admin-pw', role: 'admin', flag: null });
    const app = createApp();

    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'efgh34', password: 'usrpwd' });
    const userToken = (([] as string[]).concat(userLogin.headers['set-cookie'] || []))
      .find((c: string) => c.startsWith('token='))!
      .split(';')[0];

    const submit = await request(app)
      .post('/api/report')
      .set('Cookie', userToken)
      .send({ url: '/kb/team-page' });
    const reportId = submit.body.reportId;

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin-pw' });
    const adminToken = (([] as string[]).concat(adminLogin.headers['set-cookie'] || []))
      .find((c: string) => c.startsWith('token='))!
      .split(';')[0];

    const flagResp = await request(app)
      .get(`/api/admin/flag?reportId=${reportId}`)
      .set('Cookie', adminToken);
    expect(flagResp.status).toBe(200);
    expect(flagResp.body.flag).toBe('durham{ctf4-test-flag}');
    expect(flagResp.body.userId).toBe(22);
  });
});
