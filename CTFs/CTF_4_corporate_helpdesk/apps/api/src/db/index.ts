import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

export async function initDatabase() {
  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected');

    // Ensure admin user has proper password hash
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin_secure_password_123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    await pool.query(
      `UPDATE users SET password_hash = $1 WHERE username = $2`,
      [hashedPassword, 'admin@intradesk.local']
    );

    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

export default pool;
