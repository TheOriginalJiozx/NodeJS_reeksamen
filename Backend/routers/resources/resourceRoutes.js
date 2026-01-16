import { Router } from 'express';
import db from '../../db/connection.js';
import { isLoggedIn } from '../../middleware/authMiddleware.js';
import logger from '../../lib/logger.js';

const router = Router();

router.get('/api/resources', isLoggedIn, async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, type, owner, image FROM resources WHERE owner != $1 ORDER BY name', [req.user.username]);
    return res.status(200).json(result.rows);
  } catch (error) {
    logger.error(error, 'GET /api/resources error');
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/api/resources/mine', isLoggedIn, async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, type, owner, image FROM resources WHERE owner = $1 ORDER BY name', [req.user.username]);
    return res.status(200).json(result.rows);
  } catch (error) {
    logger.error(error, 'GET /api/resources/mine error');
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/api/resources', isLoggedIn, async (req, res) => {
  try {
    const { name, type } = req.body;
    const owner = req.user && req.user.username ? req.user.username : null;
    if (!name || !type) return res.status(400).json({ message: 'Missing name or type' });

    let typeName = type;
    if (typeof type === 'number' || (/^\d+$/.test(String(type)))) {
      const typeId = Number(type);
      const typeResult = await db.query('SELECT name FROM types WHERE id = $1', [typeId]);
      if (!typeResult.rowCount || !typeResult.rows[0]) return res.status(400).json({ message: 'Invalid type id' });
      typeName = typeResult.rows[0].name;
    }

    const result = await db.query('INSERT INTO resources (name, type, owner) VALUES ($1, $2, $3)', [name, typeName, owner]);
    const insertId = result.rows[0] && result.rows[0].insertId ? result.rows[0].insertId : null;
    const imageUrl = req.body && req.body.imageUrl ? req.body.imageUrl : null;
    if (insertId && imageUrl) {
      try {
        await db.query('UPDATE resources SET image = $1 WHERE id = $2', [imageUrl, insertId]);
      } catch (error) {
        logger.debug('Could not save image URL to resources table (column may be missing)', error && error.message ? error.message : error);
      }
    }
    try {
      if (global.io) global.io.emit('resource:created', { id: insertId, name, type: typeName, owner });
    } catch (error) {
      logger.warn('Failed to emit resource:created', error && error.message ? error.message : error);
    }
    return res.status(201).json({ message: 'Resource created', id: insertId });
  } catch (error) {
    logger.error(error, 'POST /api/resources error');
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/api/resources/:id/availability', isLoggedIn, async (req, res) => {
  try {
    const id = req.params.id;
    const sql = `SELECT DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
                        DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate
                 FROM availabilities
                 WHERE resource_id = $1
                 ORDER BY start_date`;
    const availableResult = await db.query(sql, [id]);

    const bookingsSql = `SELECT DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate, DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate FROM bookings WHERE resource_id = $1 ORDER BY start_date`;
    const bookingsResult = await db.query(bookingsSql, [id]);

    const availableSet = new Set();
    const datesBetween = (startString, endString) => {
      const out = [];
      const [startYear, startMonth, startDate] = String(startString).split('-').map(Number);
      const [endYear, endMonth, endDate] = String(endString).split('-').map(Number);
      const startDateObject = new Date(startYear, (startMonth || 1) - 1, startDate || 1);
      const endDateObject = new Date(endYear, (endMonth || 1) - 1, endDate || 1);
      for (let current = new Date(startDateObject); current <= endDateObject; current.setDate(current.getDate() + 1)) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const date = String(current.getDate()).padStart(2, '0');
        out.push(`${year}-${month}-${date}`);
      }
      return out;
    };

    for (const availableRows of availableResult.rows) {
      if (!availableRows.startDate || !availableRows.endDate) continue;
      for (const dates of datesBetween(availableRows.startDate, availableRows.endDate)) availableSet.add(dates);
    }

    for (const bookingRows of bookingsResult.rows) {
      if (!bookingRows.startDate || !bookingRows.endDate) continue;
      for (const dates of datesBetween(bookingRows.startDate, bookingRows.endDate)) availableSet.delete(dates);
    }

    const availableDates = Array.from(availableSet).sort();
    return res.status(200).json({ availabilities: availableResult.rows, availableDates });
  } catch (error) {
    logger.error(error, 'GET /api/resources/:id/availability error');
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/api/resources/:id/availability', isLoggedIn, async (req, res) => {
  try {
    const id = req.params.id;
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) return res.status(400).json({ message: 'Missing availability fields' });

    const ownerCheck = await db.query('SELECT owner FROM resources WHERE id = $1', [id]);
    if (!ownerCheck.rowCount || ownerCheck.rows.length === 0) return res.status(404).json({ message: 'Resource not found' });
    const resourceOwner = ownerCheck.rows[0].owner;
    const username = req.user && req.user.username ? req.user.username : null;
    if (resourceOwner !== username) return res.status(403).json({ message: 'Forbidden: you are not the owner of this resource' });

    const result = await db.query('INSERT INTO availabilities (resource_id, start_date, end_date) VALUES ($1, $2, $3)', [id, startDate, endDate]);
    const insertId = result.rows[0] && result.rows[0].insertId ? result.rows[0].insertId : null;
    try {
      if (global.io) global.io.to(`resource:${id}`).emit('availability:changed', { resourceId: id, startDate, endDate, id: insertId });
    } catch (error) {
      logger.warn('Failed to emit availability:changed', error && error.message ? error.message : error);
    }
    return res.status(201).json({ message: 'Availability added', id: insertId });
  } catch (error) {
    logger.error(error, 'POST /api/resources/:id/availabilities error');
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/api/resources/:id', isLoggedIn, async (req, res) => {
  try {
    const id = req.params.id;
    const ownerCheck = await db.query('SELECT owner FROM resources WHERE id = $1', [id]);
    if (!ownerCheck.rowCount || ownerCheck.rows.length === 0) return res.status(404).json({ message: 'Resource not found' });
    const resourceOwner = ownerCheck.rows[0].owner;
    const username = req.user && req.user.username ? req.user.username : null;
    if (resourceOwner !== username) return res.status(403).json({ message: 'Forbidden: you are not the owner of this resource' });

    try {
      await db.query('DELETE FROM bookings WHERE resource_id = $1', [id]);
    } catch (error) {
      logger.debug('Could not delete bookings for resource', error && error.message ? error.message : error);
    }
    try {
      await db.query('DELETE FROM availabilities WHERE resource_id = $1', [id]);
    } catch (error) {
      logger.debug('Could not delete availabilities for resource', error && error.message ? error.message : error);
    }

    await db.query('DELETE FROM resources WHERE id = $1', [id]);

    try {
      if (global.io) global.io.emit('resource:deleted', { id });
    } catch (error) {
      logger.warn('Failed to emit resource:deleted', error && error.message ? error.message : error);
    }

    return res.status(200).json({ message: 'Resource deleted' });
  } catch (error) {
    logger.error(error, 'DELETE /api/resources/:id error');
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
