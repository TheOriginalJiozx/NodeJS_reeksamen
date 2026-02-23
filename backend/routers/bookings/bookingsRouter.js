import { Router } from "express";
import db from "../../db/connection.js";
import * as queries from "../../db/queries/bookings.js";
import * as resourceQueries from "../../db/queries/resources.js";
import { rateLimit } from "express-rate-limit";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import logger from "../../lib/logger.js";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.get("/api/bookings", isLoggedIn, async (req, res) => {
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

router.post("/api/bookings", authLimiter, isLoggedIn, async (req, res) => {
  const resourceId = req.body.resourceId;
  const startDate = req.body.startDate;
  const endDate = req.body.endDate;
  const comment = req.body.comment || null;
  const booker = (req.user && req.user.username) || req.body.booker;

  if (!resourceId || !startDate) {
    return res.status(400).json({ message: "Missing required booking fields" });
  }

  const datesBetween = (start, end) => {
    const array = [];
    const startDateObject = new Date(start);
    const endDateObject = new Date(end);
    for (let date = new Date(startDateObject); date <= endDateObject; date.setDate(date.getDate() + 1)) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      array.push(`${year}-${month}-${day}`);
    }
    return array;
  };

  try {
    const dates = datesBetween(startDate, endDate);

    const resourceCheck = await db.query(resourceQueries.selectResourceById, [resourceId]);
    if (!resourceCheck.rowCount) {
      return res.status(404).json({ message: "Resource not found" });
    }

    for (const date of dates) {
      const availableResponse = await db.query(queries.checkAvailabilityExists, [resourceId, date, date]);

      if (!availableResponse.rowCount || availableResponse.rows.length === 0) {
        return res.status(409).json({ message: `No availability for ${date}` });
      }
    }

    const conflict = await db.query(queries.checkConfirmedBookingConflict, [resourceId, startDate, endDate]);

    if (conflict.rowCount && conflict.rowCount > 0) {
      return res.status(409).json({ message: "Requested date range conflicts with existing confirmed booking" });
    }

    const insert = await db.query(queries.insertBooking, [booker, resourceId, startDate, endDate, comment]);

    const insertId = insert.rows[0] && insert.rows[0].insertId ? insert.rows[0].insertId : null;

    let resourceImage = null;
    try {
      const image = await db.query(queries.selectImageForResource, [resourceId]);
      if (image.rowCount && image.rows[0] && image.rows[0].image)
        resourceImage = image.rows[0].image;
    } catch (error) {
      logger.debug(
        "Could not fetch resource image for booking",
        error && error.message ? error.message : error,
      );
    }

    if (insertId && resourceImage) {
      try {
        await db.query(queries.updateBookingImage, [resourceImage, insertId]);
      } catch (error) {
        logger.debug(
          "Could not save image URL to bookings table (column may be missing)",
          error && error.message ? error.message : error,
        );
      }
    }

    try {
      if (global.io) {
        global.io.to(`resource:${resourceId}`).emit("booking:created", {
          resourceId,
          startDate,
          endDate,
          bookingId: insertId,
          resourceImage,
        });
      }
    } catch (error) {
      logger.warn("Failed to emit booking:created", error && error.message ? error.message : error);
    }

    try {
      const ownerRes = await db.query(resourceQueries.selectResourceOwner, [resourceId]);
      const owner = ownerRes.rowCount && ownerRes.rows[0] ? ownerRes.rows[0].owner : null;
      if (owner && global.io) {
        global.io.to(`user:${owner}`).emit("booking:created", {
          resourceId,
          startDate,
          endDate,
          bookingId: insertId,
          resourceImage,
        });
      }
    } catch (error) {
      logger.debug("Failed to emit booking:created to user room", error && error.message ? error.message : error);
    }

    return res.status(201).json({ message: "Booking created", bookingId: insertId, resourceImage });
  } catch (error) {
    logger.error(error, "POST /bookings error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
