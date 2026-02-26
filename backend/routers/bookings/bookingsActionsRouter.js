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
    const userFullname = req.user && req.user.fullname ? req.user.fullname : null;

    const normalizedUserFullname = String(userFullname).trim().toLowerCase();
    const normalizedResourceOwner = String(resourceOwner).trim().toLowerCase();
    
    if (!userFullname || !resourceOwner || normalizedUserFullname !== normalizedResourceOwner) {
      return res.status(403).json({ message: "Forbidden: only resource owner can confirm bookings" });
    }

    await db.query(queries.confirmBookingById, [id]);

    try {
      if (req.io && booking.resource_id) {
        logger.debug({ bookingId: id, booker: booking.booker, resourceId: booking.resource_id }, "Emitting booking:confirmed");
        
        const resourceData = await db.query(resourceQueries.selectResourceById, [booking.resource_id]).catch(() => ({ rowCount: 0 }))
        const resourceName = resourceData && resourceData.rowCount > 0 ? resourceData.rows[0].name : "Resource";
        
        const confirmPayload = {
          bookingId: id,
          resourceId: booking.resource_id,
          resourceName,
          bookingDate: booking.startDate,
          bookingEndDate: booking.endDate,
        };
        
        req.io.to(`resource:${booking.resource_id}`).emit("booking:confirmed", confirmPayload);
        const booker = booking.booker;
        if (booker && req.io) {
          req.io.to(`user:${booker}`).emit("booking:confirmed", confirmPayload);
          logger.debug({ booker }, "Emitted to booker user room");
        }
      } else {
        logger.warn({ io: !!req.io, resourceId: booking.resource_id }, "Cannot emit - missing io or resourceId");
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
    const userFullname = req.user && req.user.fullname ? req.user.fullname : null;

    const normalizedUserFullname = String(userFullname).trim().toLowerCase();
    const normalizedBooker = String(booking.booker).trim().toLowerCase();
    const normalizedResourceOwner = String(resourceOwner).trim().toLowerCase();

    if (normalizedUserFullname !== normalizedBooker && normalizedUserFullname !== normalizedResourceOwner) {
      logger.warn({ userFullname, bookingBooker: booking.booker, resourceOwner, bookingId: id }, "Forbidden delete attempt");
      return res.status(403).json({ message: "Forbidden: cannot delete this booking" });
    }

    if (normalizedUserFullname === normalizedResourceOwner && normalizedBooker !== normalizedResourceOwner) {
      const updated = await db.query(queries.declineBookingById, [id]);
      logger.info({ bookingId: id, rowsAffected: updated.rowCount }, "Booking declined (marked)");
      try {
        if (req.io && booking.booker) {
          logger.debug({ bookingId: id, booker: booking.booker, resourceId: booking.resource_id }, "Emitting booking:declined to booker only");
          
          const resourceData = await db.query(resourceQueries.selectResourceById, [booking.resource_id]).catch(() => ({ rowCount: 0 }));
          const resourceName = resourceData && resourceData.rowCount > 0 ? resourceData.rows[0].name : "Resource";
          
          const declinePayload = {
            bookingId: id,
            resourceId: booking.resource_id,
            resourceName,
            bookingDate: booking.startDate,
            bookingEndDate: booking.endDate,
          };
          
          req.io.to(`resource:${booking.resource_id}`).emit("booking:declined", declinePayload);
          req.io.to(`user:${booking.booker}`).emit("booking:declined", declinePayload);
          logger.debug({ booker: booking.booker }, "Emitted to booker user room");
        } else {
          logger.warn({ io: !!req.io, booker: booking.booker }, "Cannot emit - missing io or booker");
        }
      } catch (error) {
        logger.warn("Failed to emit booking:declined", error && error.message ? error.message : error);
      }

      return res.status(200).json({ message: "Booking declined" });
    }

    const deleteBooking = await db.query(queries.deleteBookingById, [id]);
    logger.info({ bookingId: id, rowsAffected: deleteBooking.rowCount }, "Booking deleted");

    try {
      if (req.io && booking.booker && booking.resource_id) {
        logger.debug({ bookingId: id, booker: booking.booker, resourceId: booking.resource_id, owner: resourceOwner }, "Emitting booking:deleted");
        
        const resourceData = await db.query(resourceQueries.selectResourceById, [booking.resource_id]).catch(() => ({ rowCount: 0 }))
        const resourceName = resourceData && resourceData.rowCount > 0 ? resourceData.rows[0].name : "Resource";
        
        const deletePayload = {
          bookingId: id,
          resourceId: booking.resource_id,
          resourceName,
          bookingDate: booking.startDate,
          bookingEndDate: booking.endDate,
        };
        
        req.io.to(`resource:${booking.resource_id}`).emit("booking:deleted", deletePayload);
        req.io.to(`user:${booking.booker}`).emit("booking:deleted", deletePayload);
        logger.debug({ booker: booking.booker }, "Emitted to booker user room");
        if (String(resourceOwner) !== String(booking.booker)) {
          req.io.to(`user:${resourceOwner}`).emit("booking:deleted", deletePayload);
          logger.debug({ owner: resourceOwner }, "Emitted to owner user room");
        }
      } else {
        logger.warn({ io: !!req.io, booker: booking.booker, resourceId: booking.resource_id }, "Cannot emit - missing io, booker, or resourceId");
      }
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
