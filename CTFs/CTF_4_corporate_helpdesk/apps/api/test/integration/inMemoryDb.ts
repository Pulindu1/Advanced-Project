// Tiny in-memory dispatcher that stands in for the real Postgres pool during
// integration tests. Each `createInMemoryDb()` call returns an isolated
// store, so tests do not share rows. Only handles the SQL fragments that
// the routes under test actually execute -- keep it dumb on purpose.
//
// State written by an INSERT is observable to a later SELECT inside the
// same store, which is the §2.2 hallmark we need: real persistence within
// an isolated, in-process fixture.

import bcrypt from 'bcrypt';

export interface SeededUser {
  id: number;
  username: string;
  password: string;
  role: 'user' | 'admin';
  flag: string | null;
}

export interface InMemoryDb {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number }>;
  seedUser: (u: SeededUser) => Promise<void>;
  reportRowCount: () => number;
  exfilLogCount: () => number;
}

interface InternalUser {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  flag: string | null;
}

interface ReportRow {
  id: number;
  user_id: number;
  url: string;
  status: string;
  created_at: Date;
  visited_at: Date | null;
  visited_url: string | null;
  bot_console_logs: string | null;
  last_error: string | null;
}

interface ExfilRow {
  id: number;
  data: string;
  user_agent: string;
  ip_address: string;
  report_id: number | null;
  created_at: Date;
}

export function createInMemoryDb(): InMemoryDb {
  const users: InternalUser[] = [];
  const reports: ReportRow[] = [];
  const exfilLogs: ExfilRow[] = [];
  let nextReportId = 1;
  let nextExfilId = 1;

  async function seedUser(u: SeededUser) {
    const password_hash = await bcrypt.hash(u.password, 4);
    users.push({
      id: u.id,
      username: u.username,
      password_hash,
      role: u.role,
      flag: u.flag,
    });
  }

  async function query(text: string, params: any[] = []) {
    const t = text.trim();

    if (t.startsWith('SELECT id, username, password_hash, role, flag FROM users WHERE username')) {
      const u = users.find((x) => x.username === params[0]);
      return { rows: u ? [u] : [], rowCount: u ? 1 : 0 };
    }

    if (t.startsWith('SELECT id, username, role FROM users WHERE id')) {
      const u = users.find((x) => x.id === params[0]);
      return { rows: u ? [{ id: u.id, username: u.username, role: u.role }] : [], rowCount: u ? 1 : 0 };
    }

    if (t.startsWith('INSERT INTO reports')) {
      const row: ReportRow = {
        id: nextReportId++,
        user_id: params[0],
        url: params[1],
        status: params[2],
        created_at: new Date(),
        visited_at: null,
        visited_url: null,
        bot_console_logs: null,
        last_error: null,
      };
      reports.push(row);
      return { rows: [{ id: row.id, created_at: row.created_at }], rowCount: 1 };
    }

    if (t.startsWith('SELECT id, url, status, created_at, visited_at, visited_url, bot_console_logs, last_error')) {
      const r = reports.find((x) => x.id === Number(params[0]) && x.user_id === params[1]);
      return { rows: r ? [r] : [], rowCount: r ? 1 : 0 };
    }

    if (t.startsWith('SELECT id, url, status, created_at, visited_at, visited_url, bot_console_logs')) {
      const list = reports
        .filter((r) => r.user_id === params[0])
        .map((r) => ({
          id: r.id,
          url: r.url,
          status: r.status,
          created_at: r.created_at,
          visited_at: r.visited_at,
          visited_url: r.visited_url,
          bot_console_logs: r.bot_console_logs,
        }));
      return { rows: list, rowCount: list.length };
    }

    if (t.startsWith('SELECT r.user_id, r.status, u.flag')) {
      const r = reports.find((x) => x.id === Number(params[0]));
      if (!r) return { rows: [], rowCount: 0 };
      const u = users.find((x) => x.id === r.user_id);
      return { rows: [{ user_id: r.user_id, status: r.status, flag: u?.flag ?? null }], rowCount: 1 };
    }

    if (t.startsWith('INSERT INTO exfil_logs')) {
      const row: ExfilRow = {
        id: nextExfilId++,
        data: params[0],
        user_agent: params[1],
        ip_address: params[2],
        report_id: params[3] ?? null,
        created_at: new Date(),
      };
      exfilLogs.push(row);
      return { rows: [], rowCount: 1 };
    }

    if (t.includes('FROM exfil_logs e')) {
      const list = exfilLogs
        .filter((e) => {
          const r = e.report_id != null ? reports.find((x) => x.id === e.report_id) : null;
          return (r && r.user_id === params[0]) || e.report_id == null;
        })
        .map((e) => ({
          id: e.id,
          data: e.data,
          created_at: e.created_at,
          report_id: e.report_id,
          url: e.report_id != null ? reports.find((x) => x.id === e.report_id)?.url ?? null : null,
        }));
      return { rows: list, rowCount: list.length };
    }

    if (t.startsWith('SELECT id, title, body, tags, created_at FROM kb_articles')) {
      return { rows: [], rowCount: 0 };
    }

    throw new Error(`inMemoryDb: unhandled query: ${t.slice(0, 80)}...`);
  }

  return {
    query,
    seedUser,
    reportRowCount: () => reports.length,
    exfilLogCount: () => exfilLogs.length,
  };
}
