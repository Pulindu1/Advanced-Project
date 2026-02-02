import { Router } from 'express';
import { query } from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

// Get all KB articles (with optional search and filtering)
router.get('/articles', authenticate, async (req, res) => {
  try {
    const { search, tag, sort = 'created_at' } = req.query;
    
    let queryText = 'SELECT id, title, body, tags, created_at FROM kb_articles WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      queryText += ` AND (title ILIKE $${paramCount} OR body ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (tag) {
      paramCount++;
      queryText += ` AND $${paramCount} = ANY(tags)`;
      params.push(tag);
    }

    queryText += ` ORDER BY ${sort === 'title' ? 'title' : 'created_at'} DESC`;

    const result = await query(queryText, params);

    res.json({
      articles: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('KB articles error:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// Get single KB article
router.get('/articles/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT id, title, body, tags, created_at FROM kb_articles WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({ article: result.rows[0] });
  } catch (error) {
    console.error('KB article error:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// Get all unique tags
router.get('/tags', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT DISTINCT unnest(tags) as tag FROM kb_articles ORDER BY tag'
    );

    res.json({
      tags: result.rows.map((row: any) => row.tag)
    });
  } catch (error) {
    console.error('KB tags error:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

export default router;
