import "dotenv/config";
import mysql from "mysql2/promise";
import logger from "../lib/logger.js";
import { createAllTables } from "./queries/database.js";

const DB_HOST = process.env.MYSQL_HOST;
const DB_USER = process.env.MYSQL_USER;
const DB_PASSWORD = process.env.MYSQL_PASSWORD;
const DB_NAME = process.env.MYSQL_DATABASE;
const DB_PORT = process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306;

export const sessionOptions = {
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
};

let pool;

try {
  pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    port: DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
  });

  pool
    .getConnection()
    .then((connection) => {
      connection.release();
      logger.info("Connected to MySQL");
      (async () => {
        try {
          const statements = createAllTables
            .split(";")
            .map((statements) => statements.trim())
            .filter(Boolean);

          for (const sql of statements) {
            await pool.query(sql);
          }

          logger.info("Ensured database tables from DDL");
        } catch (error) {
          logger.warn("Could not ensure DDL tables:", error.message);
        }
      })();
    })
    .catch((error) => logger.warn("MySQL connection warning:", error.message));
} catch (error) {
  logger.warn("MySQL pool creation failed, will use stub:", error.message);
  pool = null;
}

async function query(sql, values = []) {
  if (!pool) {
    throw new Error("Database connection not available");
  }
  const [rows] = await pool.query(sql, values);
  return { rows, rowCount: rows.length };
}

const db = { query };
global.db = db;
export default db;
