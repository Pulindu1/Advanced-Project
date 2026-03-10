import { Router } from 'express';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Public endpoint for XSS to exfiltrate data
// This is intentionally accessible without auth (the bot will call it)
router.post('/capture', async (req, res) => {
  try {
    const { data } = req.body;
    // Coerce reportId to a proper integer or null — passing a non-integer string
    // (e.g. 'test') would cause a PostgreSQL type error on the INTEGER column.
    const reportId = req.body.reportId != null
      ? (parseInt(String(req.body.reportId), 10) || null)
      : null;
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    if (!data) {
      return res.status(400).json({ error: 'Data required' });
    }

    // Log the exfiltration attempt
    await query(
      'INSERT INTO exfil_logs (data, user_agent, ip_address, report_id) VALUES ($1, $2, $3, $4)',
      [JSON.stringify(data), userAgent, ipAddress, reportId || null]
    );

    console.log('📤 Exfiltration captured:', { data, reportId, userAgent });

    res.json({ success: true, message: 'Data received' });
  } catch (error) {
    console.error('Exfil capture error:', error);
    res.status(500).json({ error: 'Failed to capture data' });
  }
});

// User endpoint to view their own exfiltration attempts
router.get('/my-captures', authenticate, async (req: AuthRequest, res) => {
  try {
    // Get all exfil logs for reports submitted by this user
    const result = await query(
      `SELECT e.id, e.data, e.created_at, e.report_id, r.url
       FROM exfil_logs e
       LEFT JOIN reports r ON e.report_id = r.id
       WHERE (r.user_id = $1 OR e.report_id IS NULL)
       ORDER BY e.created_at DESC
       LIMIT 50`,
      [req.user?.id]
    );

    res.json({ captures: result.rows });
  } catch (error) {
    console.error('Get captures error:', error);
    res.status(500).json({ error: 'Failed to fetch captures' });
  }
});

export default router;
