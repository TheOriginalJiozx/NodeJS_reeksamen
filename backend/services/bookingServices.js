import db from "../db/connection.js";
import * as queries from "../db/queries/bookings.js";
import * as resourceQueries from "../db/queries/resources.js";
import logger from "../lib/logger.js";

async function validateBookingInput(resourceId, startDate) {
  if (!resourceId || !startDate) {
    return { valid: false, error: "Missing required booking fields" };
  }

  const resourceCheck = await db.query(resourceQueries.selectResourceById, [resourceId]);
  if (!resourceCheck.rowCount) {
    return { valid: false, error: "Resource not found" };
  }

  return { valid: true };
}

async function checkAvailability(resourceId, startDate, endDate, datesBetweenFn) {
  const dates = datesBetweenFn(startDate, endDate);

  for (const date of dates) {
    const availableResponse = await db.query(queries.checkAvailabilityExists, [resourceId, date, date]);
    if (!availableResponse.rowCount || availableResponse.rows.length === 0) {
      return { available: false, error: `No availability for ${date}` };
    }
  }

  const conflict = await db.query(queries.checkConfirmedBookingConflict, [resourceId, startDate, endDate]);
  if (conflict.rowCount && conflict.rowCount > 0) {
    return { available: false, error: "Requested date range conflicts with existing confirmed booking" };
  }

  return { available: true };
}

async function createBookingTransaction(booker, resourceId, startDate, endDate, comment) {
  let insertId = null;
  let resourceImage = null;

  try {
    await db.query("START TRANSACTION");

    const insert = await db.query(queries.insertBooking, [booker, resourceId, startDate, endDate, comment]);
    insertId = insert.rows && insert.rows.insertId ? insert.rows.insertId : null;

    try {
      const image = await db.query(queries.selectImageForResource, [resourceId]);
      if (image.rowCount && image.rows[0] && image.rows[0].image) resourceImage = image.rows[0].image;
    } catch (error) {
      logger.debug("Could not fetch resource image for booking", error && error.message ? error.message : error);
    }

    if (insertId && resourceImage) {
      try {
        await db.query(queries.updateBookingImage, [resourceImage, insertId]);
      } catch (error) {
        logger.debug("Could not save image URL to bookings table", error && error.message ? error.message : error);
      }
    }

    await db.query("COMMIT");
  } catch (transactionError) {
    try {
      await db.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error(rollbackError, "commitBookingTransaction rollback error");
    }
    throw transactionError;
  }

  return { insertId, resourceImage };
}

export { validateBookingInput, checkAvailability, createBookingTransaction };
