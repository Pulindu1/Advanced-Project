import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

// Player credentials — matches credentials.json and flags.json
const PLAYER_CREDENTIALS = [
  { username: 'abcd12', password: 'KHXXSIILQYIF', flag: 'CTF{user_abcd12_8bb73ad76fdd80e0}', role: 'user' },
  { username: 'efgh34', password: 'MWFXMTRKGZET', flag: 'CTF{user_efgh34_80eb85d81b52e9ca}', role: 'user' },
  { username: 'ijkl56', password: 'MKWTCTBTCPSK', flag: 'CTF{user_ijkl56_1fb81908a0e8ba91}', role: 'user' },
];

export async function initDatabase() {
  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected');

    // Migration: add columns that may not exist on pre-existing DBs
    await pool.query(`
      ALTER TABLE reports
        ADD COLUMN IF NOT EXISTS visited_url TEXT,
        ADD COLUMN IF NOT EXISTS bot_console_logs TEXT
    `);
    console.log('✅ Reports table migrated (visited_url, bot_console_logs)');

    // Upsert admin user with a properly bcrypt-hashed password
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin_secure_password_123';
    const adminHash = await bcrypt.hash(adminPassword, 10);
    await pool.query(
      `INSERT INTO users (username, password_hash, role, flag)
       VALUES ($1, $2, 'admin', 'CTF{admin_default_flag}')
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      ['admin', adminHash]
    );
    console.log('✅ Admin user seeded');

    // Upsert all player users
    for (const cred of PLAYER_CREDENTIALS) {
      const hash = await bcrypt.hash(cred.password, 10);
      await pool.query(
        `INSERT INTO users (username, password_hash, role, flag)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (username) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           flag = EXCLUDED.flag`,
        [cred.username, hash, cred.role, cred.flag]
      );
      console.log(`✅ Player user '${cred.username}' seeded`);
    }

    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

export default pool;
