import { Router } from 'express';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const router = Router();

// Initialize Redis and Queue
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const reportQueue = new Queue('reports', { connection });

// Submit a report
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL (must be same-origin KB path)
    try {
      const urlObj = new URL(url, 'http://localhost:5173');
      if (!urlObj.pathname.startsWith('/kb')) {
        return res.status(400).json({ error: 'Only KB URLs can be reported' });
      }
    } catch (error) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Insert report
    const result = await query(
      'INSERT INTO reports (user_id, url, status) VALUES ($1, $2, $3) RETURNING id, created_at',
      [req.user?.id, url, 'queued']
    );

    const report = result.rows[0];

    console.log(`📝 Report #${report.id} created by user ${req.user?.id}: ${url}`);

    // Add to queue for bot processing
    await reportQueue.add('visit', {
      reportId: report.id,
      url,
      userId: req.user?.id,
    });

    console.log(`📬 Report #${report.id} queued for bot processing`);

    res.status(201).json({
      message: 'Report submitted successfully. A moderator will review it shortly.',
      reportId: report.id,
      status: 'queued',
      createdAt: report.created_at
    });
  } catch (error) {
    console.error('Report submission error:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// Get user's reports
router.get('/my-reports', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      'SELECT id, url, status, created_at, visited_at FROM reports WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.user?.id]
    );

    res.json({ reports: result.rows });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Internal endpoint for bot to update report status
// Note: This should ideally be behind internal network only or use a shared secret
router.put('/internal/update/:reportId', async (req, res) => {
  try {
    console.log(`🔄 Report status update for #${req.params.reportId}:`, req.body);
    const { reportId } = req.params;
    const { status, error } = req.body;

    if (!status || !['visited', 'error'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    if (status === 'visited') {
      await query(
        'UPDATE reports SET status = $1, visited_at = NOW() WHERE id = $2',
        [status, reportId]
      );
    } else if (status === 'error') {
      await query(
        'UPDATE reports SET status = $1, last_error = $2 WHERE id = $3',
        [status, error || 'Unknown error', reportId]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

export default router;
