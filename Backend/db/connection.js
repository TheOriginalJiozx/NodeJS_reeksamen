import 'dotenv/config';
import mysql from 'mysql2/promise';
import logger from '../lib/logger.js';

const DB_HOST = process.env.MYSQL_HOST
const DB_USER = process.env.MYSQL_USER;
const DB_PASSWORD = process.env.MYSQL_PASSWORD;
const DB_NAME = process.env.MYSQL_DATABASE;
const DB_PORT = process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306;

let pool;

try {
    pool = mysql.createPool({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        port: DB_PORT,
        waitForConnections: true,
        connectionLimit: 10
    });
    pool.getConnection().then(connection => {
        connection.release();
        logger.info('Connected to MySQL');
    }).catch(error => logger.warn('MySQL connection warning:', error.message));
} catch (error) {
    logger.warn('MySQL pool creation failed, will use stub:', error.message);
    pool = null;
}

function convertQuery(text) {
    if (!text) return text;
    return text.replace(/\$([0-9]+)/g, '?');
}

async function query(text, params = []) {
    if (!pool) {
        return { rowCount: 0, rows: [] };
    }

    const sqlQuery = convertQuery(text);
    const [rows] = await pool.query(sqlQuery, params);

    if (Array.isArray(rows)) {
        return { rowCount: rows.length, rows };
    }

    return { rowCount: rows.affectedRows || 0, rows: rows.insertId ? [{ insertId: rows.insertId }] : [] };
}

const db = { query };
global.db = db;
export default db;
