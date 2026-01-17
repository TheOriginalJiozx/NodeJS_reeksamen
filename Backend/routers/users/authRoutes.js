import { Router } from 'express';
import auth from '../../util/authorizer.js';
import db from '../../db/connection.js';
import { rateLimit } from 'express-rate-limit';
import { isLoggedIn } from '../../middleware/authMiddleware.js';
import logger from '../../lib/logger.js';
import fs from 'fs';
import path from 'path';

const router = Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false
});

router.get('/api/users/username', isLoggedIn, async (req, res) => {
    try {
        const result = await db.query('SELECT username, email, role FROM users WHERE id = $1', [req.user.id]);
        const user = result.rows[0];
        return res.status(200).json({ username: user?.username, email: user?.email, role: user?.role });
    } catch (error) {
        logger.error(error, 'GET /api/users/username error');
        return res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/api/me', isLoggedIn, async (req, res) => {
    res.status(200).send({ user: req.user });
});

router.post('/api/login', authLimiter, async (req, res) => {
    const { username, password } = req.body;
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (result.rowCount === 0 || !auth.validatePassword(password, user && user.password_hash)) {
        return res.status(401).json({ message: 'Invalid username or password' });
    }

    if (user.verified === 0) {
        return res.status(403).json({ message: 'Account not verified' });
    }

    req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email
    }

    return res.status(200).json({ message: 'Login successful', user: req.session.user });
});

router.post('/api/logout', isLoggedIn, (req, res) => {
    req.session.destroy();
    return res.status(200).json({ message: 'Logged out successfully' });
});

router.post('/api/users', authLimiter, async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const chosenEmail = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (chosenEmail.rowCount > 0) {
            return res.status(409).json({ message: 'Email already in use' });
        }

        const hashedPassword = auth.encryptPassword(password);

        await db.query(
            'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)',
            [username, email, hashedPassword, 'user']
        );

        return res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        logger.error(error, 'POST /api/users error');
        return res.status(500).json({ message: 'Internal server error' });
    }
});

router.delete('/api/users/:id', isLoggedIn, async (req, res) => {
    const idParam = req.params.id;
    if (!idParam || !/^[0-9]+$/.test(String(idParam))) return res.status(400).json({
        message: 'Invalid user id'
    });

    const requesterId = req.user && req.user.id ? String(req.user.id) : null;
    if (requesterId !== String(idParam) && req.user && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

    const userRow = await db.query('SELECT username FROM users WHERE id = $1', [idParam]);
    const username = userRow && userRow.rowCount && userRow.rows[0] ? userRow.rows[0].username : null;
    if (!username) return res.status(404).json({ message: 'User not found' });

    let resourceImages = [];
    try {
        const conflict = await db.query(
            `SELECT 1 FROM bookings b
             JOIN resources r ON b.resource_id = r.id
             WHERE r.owner = $1 AND (b.end_date IS NULL OR DATE(b.end_date) >= CURRENT_DATE)
             LIMIT 1`,
            [username]
        );

        if (conflict && conflict.rowCount && conflict.rowCount > 0) {
            return res.status(409).json({ message: 'Cannot delete account while active bookings exist for your resources' });
        }

        const images = await db.query('SELECT image FROM resources WHERE owner = $1', [username]);
        resourceImages = images.rows.map(resource => resource.image).filter(Boolean);

        await db.query('BEGIN');
        await db.query('DELETE FROM bookings WHERE resource_id IN (SELECT id FROM resources WHERE owner = $1)', [username]);
        await db.query('DELETE FROM availabilities WHERE resource_id IN (SELECT id FROM resources WHERE owner = $1)', [username]);
        await db.query('DELETE FROM resources WHERE owner = $1', [username]);
        await db.query('DELETE FROM users WHERE id = $1', [idParam]);
        await db.query('COMMIT');
    } catch (error) {
        try {
            await db.query('ROLLBACK');
        } catch (rollbackError) {
            logger.error(rollbackError, 'DELETE /api/users/me rollback error');
        }

        logger.error(error, 'DELETE /api/users/me transaction error');
        return res.status(500).json({ message: 'Internal server error' });
    }

    try {
        const store = global.sessionStore;
        if (store && typeof store.all === 'function' && typeof store.destroy === 'function') {
            const sessionIds = await new Promise((resolve) => {
                store.all((error, sessions) => {
                    if (error) {
                        logger.debug('sessionStore.all error', error && error.message ? error.message : error);
                        return resolve([]);
                    }

                    const ids = [];
                    if (Array.isArray(sessions)) {
                        for (const item of sessions) {
                            const sessionId = item && (item.session_id || item.id || item.key) ? (item.session_id || item.id || item.key) : null;
                            const session = item && (item.session || item.data) ? (item.session || item.data) : item;
                            const user = session && session.user ? session.user : null;
                            if (user && user.username === username && sessionId) ids.push(sessionId);
                        }
                    } else if (sessions && typeof sessions === 'object') {
                        for (const sessionId of Object.keys(sessions)) {
                            const session = sessions[sessionId];
                            const user = session && session.user ? session.user : null;
                            if (user && user.username === username) ids.push(sessionId);
                        }
                    }
                    resolve(ids);
                });
            });

            for (const sessionId of sessionIds) {
                await new Promise((resolve) => store.destroy(sessionId, () => resolve()));
            }
        } else {
            logger.debug('No session store available to delete sessions; skipping');
        }
    } catch (error) {
        logger.debug('Could not delete sessions for user', error && error.message ? error.message : error);
    }

    try {
        for (const resourceImage of resourceImages) {
            if (!resourceImage || !String(resourceImage).includes('/uploads/')) continue;
            const parts = String(resourceImage).split('/uploads/');
            const filename = parts[1] || parts[parts.length - 1];
            const uploadPath = path.resolve('./Frontend/public/uploads', filename);
            if (fs.existsSync(uploadPath)) {
                try { fs.unlinkSync(uploadPath); } catch (err) { logger.debug('Failed to delete resource image file', err && err.message ? err.message : err); }
            }
        }
    } catch (error) {
        logger.debug('Error while deleting resource images', error && error.message ? error.message : error);
    }

    req.session.destroy();
    return res.status(200).json({ message: 'User account and related resources deleted successfully' });
});

router.post('/api/users/export', isLoggedIn, async (req, res) => {
    try {
        const userId = req.user && req.user.id ? req.user.id : null;
        if (!userId) return res.status(400).json({ message: 'Invalid user' });

        const result = await db.query('SELECT id, username, email, role FROM users WHERE id = $1', [userId]);
        const userData = result.rows[0] || null;

        const exportData = { user: userData, resources: [], bookings: [], availabilities: [] };

        if (userData && userData.username) {
            const username = userData.username;

            const resourcesResult = await db.query('SELECT id, name, type, owner, image FROM resources WHERE owner = $1 ORDER BY id', [username]);
            exportData.resources = resourcesResult.rows || [];

            const bookingsSql = `SELECT id, booker, resource_id, DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date, comment
                                 FROM bookings
                                 WHERE booker = $1 OR resource_id IN (SELECT id FROM resources WHERE owner = $1)
                                 ORDER BY start_date`;
            
            const bookingsResult = await db.query(bookingsSql, [username, username]);
            exportData.bookings = bookingsResult.rows || [];

            const availableSql = `SELECT resource_id, DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date
                              FROM availabilities
                              WHERE resource_id IN (SELECT id FROM resources WHERE owner = $1)
                              ORDER BY start_date`;
            const availableResult = await db.query(availableSql, [username]);
            exportData.availabilities = availableResult.rows || [];
        }

        const payload = JSON.stringify(exportData, null, 2);
        res.setHeader('Content-Disposition', 'attachment; filename="user-data.json"');
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).send(payload);
    } catch (error) {
        logger.error(error, 'POST /api/users/export error');
        return res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;