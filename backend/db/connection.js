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
    enableKeepAlive: true,
    keepAliveInitialDelayMs: 0,
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
  
  let retries = 3;
  let lastError;
  
  while (retries > 0) {
    try {
      const [rows] = await pool.query(sql, values);
      return { rows, rowCount: rows.length };
    } catch (error) {
      lastError = error;
      retries--;
      if (retries > 0) {
        logger.warn(`Database query error, retrying... (${3 - retries}/3)`, error.message);
        // spørgsmål: hvorfor bruger vi en Promise her?
        // en Promise er en måde at vente på noget asynkront på,
        // i dette tilfælde en timeout, før den fortsætter med at prøve igen
        // Her venter den i 100 millisekunder, før den prøver at køre forespørgslen igen
        // Dette kan hjælpe med at håndtere midlertidige forbindelsesproblemer eller belastning på databasen
        // En Promise lover at den vil blive opfyldt (resolve) eller afvist (reject) på et tidspunkt i fremtiden,
        // og vi bruger setTimeout til at skabe en forsinkelse, før vi prøver igen
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }
  
  throw lastError;
}

const db = { query };
global.db = db;
export default db;
