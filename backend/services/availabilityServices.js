import db from "../db/connection.js";
import * as queries from "../db/queries/availabilities.js";
import * as bookingQueries from "../db/queries/bookings.js";
import logger from "../lib/logger.js";

async function createAvailabilityTransaction(resourceId, startDate, endDate) {
  let insertId = null;

  try {
    await db.query("START TRANSACTION");
    const result = await db.query(queries.insertAvailability, [resourceId, startDate, endDate]);
    insertId = result.insertId ?? null;
    await db.query("COMMIT");
  } catch (transactionError) {
    try {
      await db.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error(rollbackError, "createAvailabilityTransaction rollback error");
    }
    throw transactionError;
  }

  return insertId;
}

async function deleteAvailabilityTransaction(availabilityId) {
  try {
    await db.query("START TRANSACTION");
    await db.query(queries.deleteAvailabilityById, [availabilityId]);
    await db.query("COMMIT");
  } catch (transactionError) {
    try {
      await db.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error(rollbackError, "deleteAvailabilityTransaction rollback error");
    }
    throw transactionError;
  }
}

async function getAvailabilityById(availabilityId) {
  const result = await db.query(queries.selectAvailabilityById, [availabilityId]);
  if (!result.rowCount) return null;
  return result.rows[0];
}

async function checkBookingConflicts(resourceId, startDate, endDate) {
  const conflict = await db.query(bookingQueries.checkAnyNonDeclinedBookingConflict, [resourceId, startDate, endDate]);
  return conflict?.rowCount > 0;
}

export { createAvailabilityTransaction, deleteAvailabilityTransaction, getAvailabilityById, checkBookingConflicts };
