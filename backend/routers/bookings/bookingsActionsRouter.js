import { Router } from "express";
import db from "../../db/connection.js";
import * as queries from "../../db/queries/bookings.js";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import logger from "../../lib/logger.js";
import * as resourceQueries from "../../db/queries/resources.js";

const router = Router();
const API = "/api";

router.patch(`${API}/bookings/:id/confirm`, isLoggedIn, async (req, res) => {
  try {
    const id = req.params.id;
    const bookingResult = await db.query(queries.selectBookingById, [id]);
    if (!bookingResult.rowCount || !bookingResult.rows[0]) return res.status(404).json({ message: "Booking not found" });
    const booking = bookingResult.rows[0];

    logger.debug({ bookingId: id, booking }, "Booking details");

    const resourceResult = await db.query(resourceQueries.selectResourceOwner, [booking.resource_id]);
    logger.debug({ bookingResourceId: booking.resource_id, resourceResult }, "Resource query result");
    
    const resourceOwner = resourceResult.rowCount && resourceResult.rows[0] ? resourceResult.rows[0].owner : null;
    const username = req.user && req.user.username ? req.user.username : null;

    const normalizedUsername = String(username).trim().toLowerCase();
    const normalizedResourceOwner = String(resourceOwner).trim().toLowerCase();
    
    if (!username || !resourceOwner || normalizedUsername !== normalizedResourceOwner) {
      return res.status(403).json({ message: "Forbidden: only resource owner can confirm bookings" });
    }

    await db.query(queries.confirmBookingById, [id]);

    try {
      if (req.io) req.io.to(`resource:${booking.resourceId}`).emit("booking:confirmed", { bookingId: id, resourceId: booking.resourceId });
      try {
        const booker = booking.booker;
        if (booker && req.io) req.io.to(`user:${booker}`).emit("booking:confirmed", { bookingId: id, resourceId: booking.resourceId });
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

router.delete(`${API}/bookings/:id`, isLoggedIn, async (req, res) => {
  try {
    const id = req.params.id;
    const bookingResult = await db.query(queries.selectBookingById, [id]);
    if (!bookingResult.rowCount || !bookingResult.rows[0])
      return res.status(404).json({ message: "Booking not found" });
    const booking = bookingResult.rows[0];

    const resourceResult = await db.query(resourceQueries.selectResourceOwner, [booking.resource_id]);
    const resourceOwner = resourceResult.rowCount && resourceResult.rows[0] ? resourceResult.rows[0].owner : null;
    const username = req.user && req.user.username ? req.user.username : null;

    const normalizedUsername = String(username).trim().toLowerCase();
    const normalizedBooker = String(booking.booker).trim().toLowerCase();
    const normalizedResourceOwner = String(resourceOwner).trim().toLowerCase();

    if (normalizedUsername !== normalizedBooker && normalizedUsername !== normalizedResourceOwner) {
      logger.warn({ username, bookingBooker: booking.booker, resourceOwner, bookingId: id }, "Forbidden delete attempt");
      return res.status(403).json({ message: "Forbidden: cannot delete this booking" });
    }

    if (normalizedUsername === normalizedResourceOwner && normalizedBooker !== normalizedResourceOwner) {
      const updated = await db.query(queries.declineBookingById, [id]);
      logger.info({ bookingId: id, rowsAffected: updated.rowCount }, "Booking declined (marked)");
      try {
        if (req.io) {
          req.io.to(`resource:${booking.resourceId}`).emit("booking:declined", { bookingId: id, resourceId: booking.resourceId });
          req.io.to(`user:${booking.booker}`).emit("booking:declined", { bookingId: id, resourceId: booking.resourceId });
        }
      } catch (error) {
        logger.warn("Failed to emit booking:declined", error && error.message ? error.message : error);
      }

      return res.status(200).json({ message: "Booking declined" });
    }

    const deleteBooking = await db.query(queries.deleteBookingById, [id]);
    logger.info({ bookingId: id, rowsAffected: deleteBooking.rowCount }, "Booking deleted");

    try {
      if (req.io)
        req.io.to(`resource:${booking.resourceId}`).emit("booking:deleted", {
          bookingId: id,
          resourceId: booking.resourceId,
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
