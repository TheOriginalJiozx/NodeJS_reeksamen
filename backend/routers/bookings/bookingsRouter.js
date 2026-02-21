import { Router } from "express";
import db from "../../db/connection.js";
import * as queries from "../../db/queries/bookings.js";
import { rateLimit } from "express-rate-limit";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import logger from "../../lib/logger.js";
import * as resourceQueries from "../../db/queries/resources.js";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.get("/api/bookings", isLoggedIn, async (req, res) => {
  try {
    const resourceId = req.query.resourceId || req.query.resource_id;
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
  const resourceId = req.body.resourceId || req.body.resource_id;
  const startDate = req.body.startDate;
  const endDate = req.body.endDate || req.body.startDate;
  const comment = req.body.comment || null;
  const booker = (req.user && req.user.username) || req.body.booker || "anonymous";

  if (!resourceId || !startDate) {
    return res.status(400).json({ message: "Missing required booking fields" });
  }

  const datesBetween = (start, end) => {
    const array = [];
    const startDate = new Date(start);
    const endDate = new Date(end);
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      array.push(`${year}-${month}-${day}`);
    }
    return array;
  };

  try {
    const dates = datesBetween(startDate, endDate);

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

router.patch("/api/bookings/:id/confirm", isLoggedIn, async (req, res) => {
  try {
    const id = req.params.id;
    const bookingResult = await db.query(queries.selectBookingById, [id]);
    if (!bookingResult.rowCount || !bookingResult.rows[0]) return res.status(404).json({ message: "Booking not found" });
    const booking = bookingResult.rows[0];

    const resourceResult = await db.query(resourceQueries.selectResourceOwner, [booking.resource_id]);
    const resourceOwner = resourceResult.rowCount && resourceResult.rows[0] ? resourceResult.rows[0].owner : null;
    const username = req.user && req.user.username ? req.user.username : null;
    if (String(username) !== String(resourceOwner)) {
      return res.status(403).json({ message: "Forbidden: only resource owner can confirm bookings" });
    }

    await db.query(queries.confirmBookingById, [id]);

    try {
      if (global.io) global.io.to(`resource:${booking.resource_id}`).emit("booking:confirmed", { bookingId: id, resourceId: booking.resource_id });
      try {
        const booker = booking.booker;
        if (booker && global.io) global.io.to(`user:${booker}`).emit("booking:confirmed", { bookingId: id, resourceId: booking.resource_id });
      } catch (error) {
        logger.debug("Failed to emit booking:confirmed to booker", error && error.message ? error.message : error);
      }
    } catch (error) {
      logger.warn("Failed to emit booking:confirmed", error && error.message ? error.message : error);
    }

    return res.status(200).json({ message: "Booking confirmed" });
  } catch (error) {
    logger.error(error, "PATCH /bookings/:id/confirm error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/api/bookings/:id", isLoggedIn, async (req, res) => {
  try {
    const id = req.params.id;
    const bookingResult = await db.query(queries.selectBookingById, [id]);
    if (!bookingResult.rowCount || !bookingResult.rows[0])
      return res.status(404).json({ message: "Booking not found" });
    const booking = bookingResult.rows[0];

    const resourceResult = await db.query(resourceQueries.selectResourceOwner, [booking.resource_id]);
    const resourceOwner = resourceResult.rowCount && resourceResult.rows[0] ? resourceResult.rows[0].owner : null;
    const username = req.user && req.user.username ? req.user.username : null;

    logger.debug({ username, bookingBooker: booking.booker, resourceOwner, bookingId: id }, "DELETE /api/bookings/:id - permission check");

    if (String(username) !== String(booking.booker) && String(username) !== String(resourceOwner)) {
      logger.warn({ username, bookingBooker: booking.booker, resourceOwner, bookingId: id }, "Forbidden delete attempt");
      return res.status(403).json({ message: "Forbidden: cannot delete this booking" });
    }

    const usernameReq = req.user && req.user.username ? req.user.username : null;

    if (String(usernameReq) === String(resourceOwner) && String(booking.booker) !== String(resourceOwner)) {
      const upd = await db.query(queries.declineBookingById, [id]);
      logger.info({ bookingId: id, rowsAffected: upd.rowCount }, "Booking declined (marked)");
      try {
        if (global.io) {
          global.io.to(`resource:${booking.resource_id}`).emit("booking:declined", { bookingId: id, resourceId: booking.resource_id });
          global.io.to(`user:${booking.booker}`).emit("booking:declined", { bookingId: id, resourceId: booking.resource_id });
        }
      } catch (error) {
        logger.warn("Failed to emit booking:declined", error && error.message ? error.message : error);
      }

      return res.status(200).json({ message: "Booking declined" });
    }

    const del = await db.query(queries.deleteBookingById, [id]);
    logger.info({ bookingId: id, rowsAffected: del.rowCount }, "Booking deleted");

    try {
      if (global.io)
        global.io.to(`resource:${booking.resource_id}`).emit("booking:deleted", {
          bookingId: id,
          resourceId: booking.resource_id,
        });
    } catch (error) {
      logger.warn("Failed to emit booking:deleted", error && error.message ? error.message : error);
    }

    return res.status(200).json({ message: "Booking deleted" });
  } catch (error) {
    logger.error(error, "DELETE /bookings/:id error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
