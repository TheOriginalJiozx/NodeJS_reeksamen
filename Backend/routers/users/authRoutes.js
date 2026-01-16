import { Router } from 'express';
import auth from '../../util/authorizer.js';
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

router.delete('/api/users/me', isLoggedIn, async (req, res) => {
    const username = req.user && req.user.username ? req.user.username : null;
    if (!username) return res.status(400).json({ message: 'Invalid user' });

    try {
        const conflict = await db.query(
            `SELECT 1 FROM bookings b
             JOIN resources r ON b.resource_id = r.id
             WHERE r.owner = $1 AND (b.end_date IS NULL OR DATE(b.end_date) <> CURRENT_DATE)
             LIMIT 1`,
            [username]
        );

        if (conflict && conflict.rowCount && conflict.rowCount > 0) {
            return res.status(409).json({ message: 'Cannot delete account while active bookings exist for your resources' });
        }

        try {
            await db.query('BEGIN');
            await db.query('DELETE FROM bookings WHERE resource_id IN (SELECT id FROM resources WHERE owner = $1)', [username]);
            await db.query('DELETE FROM availabilities WHERE resource_id IN (SELECT id FROM resources WHERE owner = $1)', [username]);
            await db.query('DELETE FROM resources WHERE owner = $1', [username]);
            await db.query('DELETE FROM users WHERE id = $1', [req.user.id]);
            await db.query('COMMIT');
        } catch (error) {
            try {
                await db.query('ROLLBACK');
            } catch (error) {
                logger.error(error, 'DELETE /api/users/me rollback error');
            }
            logger.error(error, 'DELETE /api/users/me transaction error');
            return res.status(500).json({ message: 'Internal server error' });
        }

        req.session.destroy();
        return res.status(200).json({ message: 'User account and related resources deleted successfully' });
    } catch (error) {
        logger.error(error, 'DELETE /api/users/me error');
        return res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;