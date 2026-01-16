import { Router } from 'express';
import db from '../../db/connection.js';
import { rateLimit } from 'express-rate-limit';
import { isLoggedIn } from '../../middleware/authMiddleware.js';
import logger from '../../lib/logger.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});

router.get('/api/availabilities', isLoggedIn, async (req, res) => {
    try {
        const resourceId = req.query.resourceId || req.query.resource_id;
        let result;
        if (resourceId) {
            result = await db.query('SELECT start_date AS startDate, end_date AS endDate FROM availabilities WHERE resource_id = $1 ORDER BY start_date', [resourceId]);
        } else {
            result = await db.query('SELECT start_date AS startDate, end_date AS endDate, resource_id FROM availabilities ORDER BY resource_id, start_date');
        }
        return res.status(200).json({ availabilities: result.rows });
    } catch (error) {
        logger.error(error, 'GET /bookings error');
        return res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/api/availabilities', authLimiter, isLoggedIn, async (req, res) => {
    const resourceId = req.body.resourceId || req.body.resource_id;
    const startDate = req.body.startDate;
    const endDate = req.body.endDate || req.body.startDate;

    if (!resourceId || !startDate) {
        return res.status(400).json({ message: 'Missing required availability fields' });
    }

    try {
        const result = await db.query('INSERT INTO availabilities (resource_id, start_date, end_date) VALUES ($1, $2, $3)', [resourceId, startDate, endDate]);
        const insertId = result.rows[0] && result.rows[0].insertId ? result.rows[0].insertId : null;
        try {
            if (global.io) global.io.to(`resource:${resourceId}`).emit('availability:changed', { resourceId, startDate, endDate, id: insertId });
        } catch (error) {
            logger.warn('Failed to emit availability:changed', error && error.message ? error.message : error);
        }
        return res.status(201).json({ message: 'Availability created', id: insertId });
    }
    catch (error) {
        logger.error(error, 'POST /availabilities error');
        return res.status(500).json({ message: 'Internal server error' });
    }
});

router.delete('/api/availabilities/:id', isLoggedIn, async (req, res) => {
    try {
        const id = req.params.id;
        const availableRes = await db.query('SELECT id, resource_id, start_date, end_date FROM availabilities WHERE id = $1', [id]);
        if (!availableRes.rowCount || !availableRes.rows[0]) return res.status(404).json({ message: 'Availability not found' });
        const available = availableRes.rows[0];
        const resourceResult = await db.query('SELECT owner FROM resources WHERE id = $1', [available.resource_id]);
        const resourceOwner = resourceResult.rowCount && resourceResult.rows[0] ? resourceResult.rows[0].owner : null;
        const username = req.user && req.user.username ? req.user.username : null;
        if (String(username) !== String(resourceOwner)) return res.status(403).json({ message: 'Forbidden: you are not the owner of this resource' });

        await db.query('DELETE FROM availabilities WHERE id = $1', [id]);

        try {
            if (global.io) global.io.to(`resource:${available.resource_id}`).emit('availability:changed', { resourceId: available.resource_id });
        } catch (error) {
            logger.warn('Failed to emit availability:changed on delete', error && error.message ? error.message : error);
        }

        return res.status(200).json({ message: 'Availability deleted' });
    } catch (error) {
        logger.error(error, 'DELETE /availabilities/:id error');
        return res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;