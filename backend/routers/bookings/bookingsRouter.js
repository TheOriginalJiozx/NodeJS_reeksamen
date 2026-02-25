import { Router } from "express";
import db from "../../db/connection.js";
import * as queries from "../../db/queries/bookings.js";
import * as resourceQueries from "../../db/queries/resources.js";
import { rateLimit } from "express-rate-limit";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import logger from "../../lib/logger.js";
import { datesBetween } from "../../utils/dateUtils.js";

const router = Router();
const API = "/api";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

async function validateBookingInput(resourceId, startDate, endDate) {
  if (!resourceId || !startDate) {
    return { valid: false, error: "Missing required booking fields" };
  }

  const resourceCheck = await db.query(resourceQueries.selectResourceById, [resourceId]);
  if (!resourceCheck.rowCount) {
    return { valid: false, error: "Resource not found" };
  }

  return { valid: true };
}

async function checkAvailability(resourceId, startDate, endDate) {
  const dates = datesBetween(startDate, endDate);

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
      if (image.rowCount && image.rows[0] && image.rows[0].image)
        resourceImage = image.rows[0].image;
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
      logger.error(rollbackError, "POST /api/bookings rollback error");
    }
    throw transactionError;
  }

  return { insertId, resourceImage };
}

function emitBookingCreatedEvents(io, resourceId, startDate, endDate, bookingId, resourceImage) {
  try {
    if (io) {
      io.to(`resource:${resourceId}`).emit("booking:created", {
        resourceId,
        startDate,
        endDate,
        bookingId,
        resourceImage,
      });
    }
  } catch (error) {
    logger.warn("Failed to emit booking:created", error && error.message ? error.message : error);
  }

  db.query(resourceQueries.selectResourceOwner, [resourceId])
    .then((ownerRes) => {
      const owner = ownerRes.rowCount && ownerRes.rows[0] ? ownerRes.rows[0].owner : null;
      if (owner && io) {
        io.to(`user:${owner}`).emit("booking:created", {
          resourceId,
          startDate,
          endDate,
          bookingId,
          resourceImage,
        });
      }
    })
    .catch((error) => {
      logger.debug("Failed to emit booking:created to user room", error && error.message ? error.message : error);
    });
}

router.get(`${API}/bookings`, isLoggedIn, async (req, res) => {
  try {
    const resourceId = req.query.resourceId;
    let result;
    if (resourceId) {
      result = await db.query(queries.getBookingsForResource, [resourceId]);
    } else {
      result = await db.query(queries.getAllBookings);
    }
    return res.status(200).json({ bookings: result.rows });
  } catch (error) {
    logger.error(error, "GET /bookings error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post(`${API}/bookings`, authLimiter, isLoggedIn, async (req, res) => {
  const resourceId = req.body.resourceId;
  const startDate = req.body.startDate;
  const endDate = req.body.endDate;
  const comment = req.body.comment || null;
  const booker = (req.user && req.user.username) || req.body.booker;

  try {
    const validation = await validateBookingInput(resourceId, startDate, endDate);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.error });
    }

    const availability = await checkAvailability(resourceId, startDate, endDate);
    if (!availability.available) {
      return res.status(409).json({ message: availability.error });
    }

    const { insertId, resourceImage } = await createBookingTransaction(booker, resourceId, startDate, endDate, comment);

    emitBookingCreatedEvents(req.io, resourceId, startDate, endDate, insertId, resourceImage);

    return res.status(201).json({ message: "Booking created", bookingId: insertId, resourceImage });
  } catch (error) {
    logger.error(error, "POST /bookings error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
