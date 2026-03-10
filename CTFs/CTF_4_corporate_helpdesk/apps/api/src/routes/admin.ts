import { Router } from 'express';
import { query } from '../db';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// All admin routes require authentication
router.use(authenticate);
// Note: requireAdmin is applied per-route so /flag can return a richer 403 hint

// Get flag by reportId - returns the flag of the user who submitted the report
// This ensures the bot (logged in as admin) gets the reporter's flag, not admin's flag
router.get('/flag', async (req: AuthRequest, res) => {
  // Custom 403 with discovery hint — players can find this endpoint and learn the query param
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required',
      hint: 'This endpoint requires admin authentication. Expected query param: reportId'
    });
  }
  try {
    const { reportId } = req.query;

    if (!reportId) {
      return res.status(400).json({ error: 'reportId query parameter required' });
    }

    // Get the report and find the user who submitted it, along with the user's stored flag
    const result = await query(
      `SELECT r.user_id, r.status, u.flag
       FROM reports r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1`,
      [reportId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const { user_id: userId, status, flag } = result.rows[0];

    // Only allow accessing flags for queued or visited reports
    if (status !== 'queued' && status !== 'visited') {
      return res.status(400).json({ error: 'Invalid report status' });
    }

    if (!flag) {
      return res.status(404).json({ error: 'Flag not found for this user' });
    }

    // Log flag access
    console.log(`🚩 Admin flag accessed - Report #${reportId}, User ID: ${userId}, Flag: ${flag}, Admin: ${req.user?.username}`);

    res.json({ flag, userId });
  } catch (error) {
    console.error('Admin flag error:', error);
    res.status(500).json({ error: 'Failed to fetch flag' });
  }
});

// Get all reports
router.get('/reports', requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT r.id, r.url, r.status, r.created_at, r.visited_at, u.username as reporter_username
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
router.get('/exfil-logs', requireAdmin, async (req, res) => {
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
