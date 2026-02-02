import { Router } from 'express';
import { query } from '../db';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// Get admin flag
router.get('/flag', async (req: AuthRequest, res) => {
  try {
    const result = await query(
      'SELECT flag FROM users WHERE id = $1 AND role = $2',
      [req.user?.id, 'admin']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    res.json({ flag: result.rows[0].flag });
  } catch (error) {
    console.error('Admin flag error:', error);
    res.status(500).json({ error: 'Failed to fetch flag' });
  }
});

// Get all reports
router.get('/reports', async (req, res) => {
  try {
    const result = await query(
      `SELECT r.id, r.url, r.status, r.created_at, r.visited_at, u.email as reporter_email
       FROM reports r
       JOIN users u ON r.user_id = u.id
       ORDER BY r.created_at DESC
       LIMIT 50`
    );

    res.json({ reports: result.rows });
  } catch (error) {
    console.error('Admin reports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Get exfiltration logs
router.get('/exfil-logs', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, data, user_agent, ip_address, report_id, created_at FROM exfil_logs ORDER BY created_at DESC LIMIT 100'
    );

    res.json({ logs: result.rows });
  } catch (error) {
    console.error('Admin exfil logs error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

export default router;
