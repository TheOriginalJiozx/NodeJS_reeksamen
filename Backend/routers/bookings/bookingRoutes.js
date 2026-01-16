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

router.get('/api/bookings', isLoggedIn, async (req, res) => {
    try {
        const resourceId = req.query.resourceId || req.query.resource_id;
        let result;
        if (resourceId) {
            result = await db.query(
                "SELECT id, booker, resource_id, DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date, comment, image FROM bookings WHERE resource_id = $1 ORDER BY start_date",
                [resourceId]
            );
        } else {
            result = await db.query(
                "SELECT id, booker, resource_id, DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date, comment, image FROM bookings ORDER BY start_date"
            );
        }
        return res.status(200).json({ bookings: result.rows });
    } catch (error) {
        logger.error(error, 'GET /bookings error');
        return res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/api/bookings', authLimiter, isLoggedIn, async (req, res) => {
    const resourceId = req.body.resourceId || req.body.resource_id;
    const startDate = req.body.startDate;
    const endDate = req.body.endDate || req.body.startDate;
    const comment = req.body.comment || null;
    const booker = (req.user && req.user.username) || req.body.booker || 'anonymous';

    if (!resourceId || !startDate) {
        return res.status(400).json({ message: 'Missing required booking fields' });
    }

    const datesBetween = (start, end) => {
        const array = [];
        const startDate = new Date(start);
        const endDate = new Date(end);
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            array.push(`${year}-${month}-${day}`);
        }
        return array;
    };

    try {
        const dates = datesBetween(startDate, endDate);

        for (const date of dates) {
            const availableResponse = await db.query(
                'SELECT 1 FROM availabilities WHERE resource_id = ? AND start_date <= ? AND end_date >= ?',
                [resourceId, date, date]
            );

            if (!availableResponse.rowCount || availableResponse.rows.length === 0) {
                return res.status(409).json({ message: `No availability for ${date}` });
            }
        }

        const conflict = await db.query(
            'SELECT 1 FROM bookings WHERE resource_id = ? AND NOT (end_date < ? OR start_date > ?)',
            [resourceId, startDate, endDate]
        );

        if (conflict.rowCount && conflict.rowCount > 0) {
            return res.status(409).json({ message: 'Requested date range conflicts with existing booking' });
        }

        const insert = await db.query(
            'INSERT INTO bookings (booker, resource_id, start_date, end_date, comment) VALUES ($1, $2, $3, $4, $5)',
            [booker, resourceId, startDate, endDate, comment]
        );

        const insertId = insert.rows[0] && insert.rows[0].insertId ? insert.rows[0].insertId : null;

        let resourceImage = null;
        try {
            const image = await db.query('SELECT image FROM resources WHERE id = $1', [resourceId]);
            if (image.rowCount && image.rows[0] && image.rows[0].image) resourceImage = image.rows[0].image;
        } catch (error) {
            logger.debug('Could not fetch resource image for booking', error && error.message ? error.message : error);
        }

        if (insertId && resourceImage) {
            try {
                await db.query('UPDATE bookings SET image = $1 WHERE id = $2', [resourceImage, insertId]);
            } catch (error) {
                logger.debug('Could not save image URL to bookings table (column may be missing)', error && error.message ? error.message : error);
            }
        }

        try {
            if (global.io) {
                global.io.to(`resource:${resourceId}`).emit('booking:created', { resourceId, startDate, endDate, bookingId: insertId, resourceImage });
            }
        } catch (error) {
            logger.warn('Failed to emit booking:created', error && error.message ? error.message : error);
        }

        return res.status(201).json({ message: 'Booking created', bookingId: insertId, resourceImage });
    } catch (error) {
        logger.error(error, 'POST /bookings error');
        return res.status(500).json({ message: 'Internal server error' });
    }
});

router.delete('/api/bookings/:id', isLoggedIn, async (req, res) => {
    try {
        const id = req.params.id;
        const bookingResult = await db.query('SELECT id, booker, resource_id FROM bookings WHERE id = $1', [id]);
        if (!bookingResult.rowCount || !bookingResult.rows[0]) return res.status(404).json({ message: 'Booking not found' });
        const booking = bookingResult.rows[0];

        const resourceResult = await db.query('SELECT owner FROM resources WHERE id = $1', [booking.resource_id]);
        const resourceOwner = resourceResult.rowCount && resourceResult.rows[0] ? resourceResult.rows[0].owner : null;
        const username = req.user && req.user.username ? req.user.username : null;
        if (String(username) !== String(booking.booker) && String(username) !== String(resourceOwner)) {
            return res.status(403).json({ message: 'Forbidden: cannot delete this booking' });
        }

        await db.query('DELETE FROM bookings WHERE id = $1', [id]);

        try {
            if (global.io) global.io.to(`resource:${booking.resource_id}`).emit('booking:deleted', { bookingId: id, resourceId: booking.resource_id });
        } catch (error) {
            logger.warn('Failed to emit booking:deleted', error && error.message ? error.message : error);
        }

        return res.status(200).json({ message: 'Booking deleted' });
    } catch (error) {
        logger.error(error, 'DELETE /bookings/:id error');
        return res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;