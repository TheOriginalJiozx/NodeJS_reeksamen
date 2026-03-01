import { Router } from "express";
import db from "../../db/connection.js";
import * as queries from "../../db/queries/bookings.js";
import * as defectQueries from "../../db/queries/defectResources.js";
import { rateLimit } from "express-rate-limit";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import logger from "../../lib/logger.js";
import { datesBetween } from "../../utils/dateUtils.js";
import { validateBookingInput, checkAvailability, createBookingTransaction } from "../../services/bookingServices.js";
import { emitBookingCreatedEvents } from "../../utils/bookingEventUtils.js";

const router = Router();
const API = "/api";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.get(`${API}/bookings`, isLoggedIn, async (req, res) => {
  try {
    const resourceId = req.query.resourceId;
    let result;
    if (resourceId) {
      result = await db.query(queries.getBookingsForResource, [resourceId]);
    } else {
      const booker = req.user?.fullname;
      result = await db.query(queries.getBookingsByBooker, [booker]);
    }
    return res.status(200).json({ bookings: result.rows });
  } catch (error) {
    logger.error(error, "GET /bookings error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get(`${API}/bookings/unseen-count`, isLoggedIn, async (req, res) => {
  try {
    const bookerName = req.user?.fullname;
    logger.info(`GET /bookings/unseen-count - booker="${bookerName}"`);
    
    const result = await db.query(queries.getUnseenBookingsCountForBooker, [bookerName]);
    const count = result.rows[0]?.unseen_count || 0;
    logger.info(`GET /bookings/unseen-count - result: unseen_count=${count}`);
    return res.status(200).json({ unseenCount: count });
  } catch (error) {
    logger.error(error, "GET /bookings/unseen-count error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get(`${API}/bookings/defected-count`, isLoggedIn, async (req, res) => {
  try {
    const bookerName = req.user?.fullname;
    
    const userResult = await db.query(defectQueries.getUserIdByFullname, [bookerName]).catch(() => ({ rows: [] }));
    const bookerId = userResult.rows[0]?.id;
    
    if (!bookerId) {
      return res.status(200).json({ defectCount: 0 });
    }
    
    const result = await db.query(defectQueries.getDefectResourcesForUserBookings, [bookerId]);
    const count = result.rows[0]?.defect_count || 0;
    return res.status(200).json({ defectCount: count });
  } catch (error) {
    logger.error(error, "GET /bookings/defected-count error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get(`${API}/bookings/defected`, isLoggedIn, async (req, res) => {
  try {
    const bookerName = req.user?.fullname;
    
    const userResult = await db.query(defectQueries.getUserIdByFullname, [bookerName]).catch(() => ({ rows: [] }));
    const bookerId = userResult.rows[0]?.id;
    
    if (!bookerId) {
      return res.status(200).json({ defected: [] });
    }
    
    const result = await db.query(defectQueries.getDefectResourcesForBooker, [bookerId]);
    return res.status(200).json({ defected: result.rows || [] });
  } catch (error) {
    logger.error(error, "GET /bookings/defected error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post(`${API}/bookings`, authLimiter, isLoggedIn, async (req, res) => {
  const resourceId = req.body.resourceId;
  const startDate = req.body.startDate;
  const endDate = req.body.endDate;
  const comment = req.body.comment || null;
  const booker = (req.user && req.user.fullname) || req.body.booker;

  try {
    const validation = await validateBookingInput(resourceId, startDate);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.error });
    }

    const availability = await checkAvailability(resourceId, startDate, endDate, datesBetween);
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
