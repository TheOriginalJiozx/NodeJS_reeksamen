import { Router } from "express";
import db from "../../db/connection.js";
import * as queries from "../../db/queries/bookings.js";
import * as defectQueries from "../../db/queries/defectResources.js";
import * as userQueries from "../../db/queries/users.js";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import logger from "../../lib/logger.js";
import { emitDefectMarkedSeen, emitBookingMarkedSeen } from "../../utils/bookingSocketUtils.js";

const router = Router();
const API = "/api";

router.patch(`${API}/bookings/defected/:id/mark-seen`, isLoggedIn, async (req, res) => {
  try {
    const defectId = req.params.id;
    const username = req.user?.username;
    const fullname = req.user?.fullname;
    logger.info(`PATCH /bookings/defected/${defectId}/mark-seen - username="${username}", fullname="${fullname}"`);
    
    const userResult = await db.query(userQueries.getBookerUserIdByUsername, [username]).catch(() => ({ rows: [] }));
    const userId = userResult.rows[0]?.id;
    
    if (!userId) {
      logger.warn(`PATCH /bookings/defected - user not found for username ${username}`);
      return res.status(404).json({ message: "User not found" });
    }
    
    const result = await db.query(defectQueries.markDefectResourceAsSeen, [defectId, userId]);
    
    if ((result.affectedRows || result.changedRows || result.rowCount || 0) === 0) {
      return res.status(404).json({ message: "Defect resource not found or not authorized" });
    }
    
    logger.info(`PATCH /bookings/defected/${defectId}/mark-seen - marked as seen for user_id=${userId}`);
    emitDefectMarkedSeen(req.io, fullname);
    
    return res.status(200).json({ message: "Marked as seen" });
  } catch (error) {
    logger.error(error, "PATCH /bookings/defected/:id/mark-seen error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch(`${API}/bookings/:id/mark-seen`, isLoggedIn, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const bookerName = req.user?.fullname;
    
    logger.info(`PATCH /bookings/${bookingId}/mark-seen - bookingId="${bookingId}", bookerName="${bookerName}"`);
    
    const result = await db.query(queries.markBookingAsSeen, [bookingId, bookerName]);
    
    logger.info(`PATCH /bookings/${bookingId}/mark-seen - result type:`, typeof result);
    logger.info(`PATCH /bookings/${bookingId}/mark-seen - result keys:`, Object.keys(result || {}));
    logger.info(`PATCH /bookings/${bookingId}/mark-seen - affectedRows:`, result?.affectedRows, "changedRows:", result?.changedRows, "rowCount:", result?.rowCount);
    
    const affectedCount = (result?.affectedRows || result?.changedRows || result?.rowCount || 0);
    logger.info(`PATCH /bookings/${bookingId}/mark-seen - affectedCount=${affectedCount}`);
    
    if (affectedCount === 0) {
      logger.warn(`PATCH /bookings/${bookingId}/mark-seen - No rows updated. bookingId=${bookingId}, bookerName=${bookerName}`);
      
      const checkBooking = await db.query(queries.selectBookingById, [bookingId]);
      logger.info(`PATCH /bookings/${bookingId}/mark-seen - booking exists:`, checkBooking?.rowCount > 0);
      if (checkBooking?.rowCount > 0) {
        logger.info(`PATCH /bookings/${bookingId}/mark-seen - booking data:`, JSON.stringify(checkBooking.rows[0]));
      }
      
      return res.status(404).json({ message: "Booking not found or not authorized" });
    }
    
    emitBookingMarkedSeen(req.io, bookerName);
    if (!req.io) logger.warn("Socket IO not available in request");
    if (!bookerName) logger.warn("Booker name not found in request user");
    
    return res.status(200).json({ message: "Marked as seen" });
  } catch (error) {
    logger.error(error, "PATCH /bookings/:id/mark-seen error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
