import { Router } from 'express';
import db from '../../db/connection.js';
import { isLoggedIn } from '../../middleware/authMiddleware.js';
import logger from '../../lib/logger.js';

const router = Router();

router.get('/api/types', isLoggedIn, async (req, res) => {
  try {
    const result = await db.query('SELECT id, name FROM types ORDER BY name');
    return res.status(200).json(result.rows);
  } catch (error) {
    logger.error(error, 'GET /api/types error');
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
