import { Router } from "express";
import db from "../../db/connection.js";
import * as queries from "../../db/queries/bookings.js";
import { rateLimit } from "express-rate-limit";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import logger from "../../lib/logger.js";
import { datesBetween } from "../../utils/dateUtils.js";
import { validateBookingInput, checkAvailability, createBookingTransaction } from "../../services/bookingServices.js";
import { emitBookingCreatedEvents } from "../../services/bookingEvents.js";

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
