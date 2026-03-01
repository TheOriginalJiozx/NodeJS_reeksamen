import { Router } from "express";
import db from "../../db/connection.js";
import * as queries from "../../db/queries/bookings.js";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import logger from "../../lib/logger.js";
import * as resourceQueries from "../../db/queries/resources.js";
import { verifyBookingOwner } from "../../services/bookingAuthService.js";
import { emitBookingConfirmed, emitBookingDeclined, emitDefectReported } from "../../utils/bookingSocketUtils.js";

const router = Router();
const API = "/api";

router.patch(`${API}/bookings/:id/confirm`, isLoggedIn, async (req, res) => {
  try {
    const id = req.params.id;
    const userFullname = req.user?.fullname;

    await db.query("START TRANSACTION");

    const bookingResult = await db.query(queries.selectBookingById, [id]);
    if (!bookingResult.rowCount) {
      await db.query("ROLLBACK");
      return res.status(404).json({ message: "Booking not found" });
    }
    const booking = bookingResult.rows[0];

    const resourceResult = await db.query(resourceQueries.selectResourceOwner, [booking.resourceId]);
    const resourceOwner = resourceResult.rowCount && resourceResult.rows[0] ? resourceResult.rows[0].owner : null;

    if (!userFullname || !resourceOwner || String(userFullname).trim().toLowerCase() !== String(resourceOwner).trim().toLowerCase()) {
      await db.query("ROLLBACK");
      return res.status(403).json({ message: "Forbidden: only resource owner can confirm bookings" });
    }

    await db.query(queries.confirmBookingById, [id]);
    await db.query("COMMIT");

    try {
      emitBookingConfirmed(req.io, booking.booker, resourceOwner);
    } catch (error) {
      logger.warn("Socket emit failed", error);
    }

    return res.status(200).json({ message: "Booking confirmed" });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch (error) {
      logger.error("Rollback failed", error);
    }
    logger.error(error, "PATCH /bookings/:id/confirm error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch(`${API}/bookings/:id/decline`, isLoggedIn, async (req, res) => {
  try {
    const id = req.params.id;
    const userFullname = req.user?.fullname;

    await db.query("START TRANSACTION");

    const verify = await verifyBookingOwner(id, userFullname);
    if (!verify.valid) {
      await db.query("ROLLBACK");
      return res.status(verify.status).json({ message: verify.error });
    }

    const { booking, resourceOwner } = verify;
    const isOwner = String(userFullname).trim().toLowerCase() === String(resourceOwner).trim().toLowerCase();

    if (!isOwner) {
      await db.query("ROLLBACK");
      return res.status(403).json({ message: "Forbidden: only resource owner can decline bookings" });
    }

    await db.query(queries.declineBookingById, [id]);
    await db.query("COMMIT");
    emitBookingDeclined(req.io, booking.booker, resourceOwner);
    
    return res.status(200).json({ message: "Booking declined" });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch (error) {
      logger.error("Rollback failed", error);
    }
    logger.error(error, "PATCH /bookings/:id/decline error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch(`${API}/bookings/:id/defect`, isLoggedIn, async (req, res) => {
  try {
    const id = req.params.id;
    const { defectReport, defectImage } = req.body || {};
    const userUsername = req.user?.username;
    const userFullname = req.user?.fullname;

    logger.info(`[/bookings/:id/defect] Received: id=${id}, defectReport=${defectReport}, userUsername=${userUsername}, userFullname=${userFullname}`);

    if (!defectReport) {
      logger.warn("[/bookings/:id/defect] No defect report provided");
      return res.status(400).json({ message: "Defect report is required" });
    }

    const bookingResult = await db.query(queries.selectBookingById, [id]);
    if (!bookingResult.rowCount) {
      logger.warn(`[/bookings/:id/defect] Booking ${id} not found`);
      return res.status(404).json({ message: "Booking not found" });
    }
    const booking = bookingResult.rows[0];
    logger.debug(`[/bookings/:id/defect] Found booking: booker=${booking.booker}`);

    const normalizedUserUsername = String(userUsername).trim().toLowerCase();
    const normalizedUserFullname = userFullname ? String(userFullname).trim().toLowerCase() : null;
    const normalizedBooker = String(booking.booker).trim().toLowerCase();

    logger.debug(`[/bookings/:id/defect] Validation: normalizedUsername=${normalizedUserUsername}, normalizedFullname=${normalizedUserFullname}, normalizedBooker=${normalizedBooker}`);

    if (normalizedUserUsername !== normalizedBooker && normalizedUserFullname !== normalizedBooker) {
      logger.warn(`[/bookings/:id/defect] Forbidden: user does not match booker`);
      return res.status(403).json({ message: "Forbidden: only the booker can report defects" });
    }

    logger.info(`[/bookings/:id/defect] Updating booking ${id} with defect report`);
    await db.query(queries.reportDefectOnBooking, [defectReport, defectImage || null, id]);
    logger.info(`[/bookings/:id/defect] Successfully updated booking ${id}`);

    try {
      const resourceResult = await db.query(resourceQueries.selectResourceOwner, [booking.resourceId]);
      const resourceOwner = resourceResult.rowCount && resourceResult.rows[0] ? resourceResult.rows[0].owner : null;
      emitDefectReported(req.io, userFullname, resourceOwner);
    } catch (error) {
      logger.warn("Socket emit failed", error?.message || error);
    }

    return res.status(200).json({ message: "Defect reported successfully" });
  } catch (error) {
    logger.error(error, "PATCH /bookings/:id/defect error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
