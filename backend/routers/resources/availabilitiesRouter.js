import { Router } from "express";
import db from "../../db/connection.js";
import * as availabilityQueries from "../../db/queries/availabilities.js";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import logger from "../../lib/logger.js";
import { datesBetween } from "../../utils/resourceUtils.js";
import * as queries from "../../db/queries/resources.js";
import { createAvailabilityTransaction, deleteAvailabilityTransaction, getAvailabilityById, checkBookingConflicts } from "../../services/availabilityServices.js";
import { checkResourceOwnership } from "../../services/resourceServices.js";
import { emitAvailabilityChanged } from "../../utils/resourceEventUtils.js";

const router = Router();
const API = "/api";

router.get(`${API}/resources/:id/availabilities`, isLoggedIn, async (req, res) => {
  try {
    const id = req.params.id;
    const [availableResult, bookingsResult] = await Promise.all([
      db.query(queries.availabilitiesForResource, [id]),
      db.query(queries.bookingsForResource, [id]),
    ]);
    
    const availableSet = new Set();
    for (const available of availableResult.rows)
      if (available.startDate && available.endDate)
        datesBetween(available.startDate, available.endDate).forEach((date) => availableSet.add(date));

    for (const bookings of bookingsResult.rows)
      if (bookings.startDate && bookings.endDate)
        datesBetween(bookings.startDate, bookings.endDate).forEach((date) => availableSet.delete(date));
      
    return res.status(200).json({ availabilities: availableResult.rows, availableDates: Array.from(availableSet).sort() });
  } catch (error) {
    logger.error(error, "GET /api/resources/:id/availabilities error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post(`${API}/resources/:id/availabilities`, isLoggedIn, async (req, res) => {
  try {
    const id = req.params.id;
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) return res.status(400).json({ message: "Missing availability fields" });

    const isOwner = await checkResourceOwnership(id, req.user?.fullname, req.user?.username);
    if (isOwner === null) return res.status(404).json({ message: "Resource not found" });
    if (isOwner === false) return res.status(403).json({ message: "Forbidden: you are not the owner of this resource" });

    const hasOverlap = await db.query(availabilityQueries.checkAvailabilityOverlap, [id, startDate, endDate]).catch(() => ({ rowCount: 0 }));
    if (hasOverlap.rowCount > 0) {
      return res.status(409).json({ message: "These dates overlap with existing availabilities" });
    }

    let insertId;
    try {
      await db.query("START TRANSACTION");
      insertId = await createAvailabilityTransaction(id, startDate, endDate);
      await db.query("COMMIT");
    } catch (transactionError) {
      try {
        await db.query("ROLLBACK");
      } catch (rollbackError) {
        logger.error(rollbackError, "POST /api/resources/:id/availabilities rollback error");
      }
      throw transactionError;
    }

    emitAvailabilityChanged(req.io, id, startDate, endDate, insertId);
    return res.status(201).json({ message: "Availability added", id: insertId });
  } catch (error) {
    logger.error(error, "POST /api/resources/:id/availabilities error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch(`${API}/resources/:id/availabilities/:availabilityId`, isLoggedIn, async (req, res) => {
  try {
    const resourceId = req.params.id;
    const availabilityId = req.params.availabilityId;
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) return res.status(400).json({ message: "Missing availability fields" });

    const available = await getAvailabilityById(availabilityId);
    if (!available) return res.status(404).json({ message: "Availability not found" });
    if (String(available.resourceId) !== String(resourceId)) return res.status(400).json({ message: "Availability does not belong to this resource" });

    const isOwner = await checkResourceOwnership(resourceId, req.user?.fullname, req.user?.username);
    if (isOwner === null) return res.status(404).json({ message: "Resource not found" });
    if (isOwner === false) return res.status(403).json({ message: "Forbidden: you are not the owner of this resource" });

    try {
      await db.query("START TRANSACTION");
      await db.query(availabilityQueries.updateAvailabilityById, [startDate, endDate, availabilityId]);
      await db.query("COMMIT");
    } catch (transactionError) {
      try {
        await db.query("ROLLBACK");
      } catch (rollbackError) {
        logger.error(rollbackError, "PATCH /api/resources/:id/availabilities/:availabilityId rollback error");
      }
      throw transactionError;
    }

    emitAvailabilityChanged(req.io, resourceId, startDate, endDate, availabilityId);
    return res.status(200).json({ message: "Availability updated", id: availabilityId });
  } catch (error) {
    logger.error(error, "PATCH /api/resources/:id/availabilities/:availabilityId error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.delete(`${API}/resources/:id/availabilities/:availabilityId`, isLoggedIn, async (req, res) => {
  try {
    const resourceId = req.params.id;
    const availabilityId = req.params.availabilityId;

    const available = await getAvailabilityById(availabilityId);
    if (!available) return res.status(404).json({ message: "Availability not found" });
    if (String(available.resourceId) !== String(resourceId)) return res.status(400).json({ message: "Availability does not belong to this resource" });

    const isOwner = await checkResourceOwnership(resourceId, req.user?.fullname, req.user?.username);
    if (isOwner === null) return res.status(404).json({ message: "Resource not found" });
    if (isOwner === false) return res.status(403).json({ message: "Forbidden: you are not the owner of this resource" });

    const hasConflict = await checkBookingConflicts(resourceId, available.startDate, available.endDate);
    if (hasConflict) return res.status(409).json({ message: "Cannot delete availability while bookings exist in that period" });

    try {
      await db.query("START TRANSACTION");
      await deleteAvailabilityTransaction(availabilityId);
      await db.query("COMMIT");
    } catch (transactionError) {
      try {
        await db.query("ROLLBACK");
      } catch (rollbackError) {
        logger.error(rollbackError, "DELETE /api/resources/:id/availabilities/:availabilityId rollback error");
      }
      throw transactionError;
    }

    emitAvailabilityChanged(req.io, resourceId);
    return res.status(200).json({ message: "Availability deleted" });
  } catch (error) {
    logger.error(error, "DELETE /api/resources/:id/availabilities/:availabilityId error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
