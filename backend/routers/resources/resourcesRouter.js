import { Router } from "express";
import db from "../../db/connection.js";
import * as queries from "../../db/queries/resources.js";
import * as userQueries from "../../db/queries/users.js";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import { allowSelfOrAdmin } from "../../auth/authorization.js";
import logger from "../../lib/logger.js";
import { deleteUploadFile, datesBetween } from "../../utils/resourceUtils.js";
import { createResourceTransaction, deleteResourceTransaction, getTypeNameById, checkResourceOwnership } from "../../services/resourceServices.js";
import { createAvailabilityTransaction, deleteAvailabilityTransaction, getAvailabilityById, checkBookingConflicts } from "../../services/availabilityServices.js";
import { emitResourceCreated, emitResourceDeleted, emitAvailabilityChanged } from "../../services/resourceEvents.js";

const router = Router();
const API = "/api";

router.get(`${API}/resources`, isLoggedIn, async (req, res) => {
  try {
    const result = await db.query(queries.getAllResources, [req.user.fullname]);
    return res.status(200).json(result.rows);
  } catch (error) {
    logger.error(error, "GET /api/resources error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get(`${API}/users/:id/resources`, isLoggedIn, allowSelfOrAdmin(), async (req, res) => {
  try {
    const id = req.params.id;
    const userRow = await db.query(userQueries.selectUserById, [id]);
    if (!userRow.rowCount) return res.status(404).json({ message: "User not found" });
    const fullname = userRow.rows[0].fullname;
    const result = await db.query(queries.getOwnedResources, [fullname]);
    return res.status(200).json(result.rows);
  } catch (error) {
    logger.error(error, "GET /api/users/:id/resources error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post(`${API}/resources`, isLoggedIn, async (req, res) => {
  try {
    const { name, type } = req.body;
    const owner = req.user?.fullname ?? null;
    if (!name || !type) return res.status(400).json({ message: "Missing name or type" });

    let typeName = type;
    if (typeof type === "number" || /^\d+$/.test(String(type))) {
      typeName = await getTypeNameById(Number(type));
      if (!typeName) return res.status(400).json({ message: "Invalid type id" });
    }

    const imageUrl = req.body?.imageUrl ?? null;
    const insertId = await createResourceTransaction(name, typeName, owner, imageUrl);

    emitResourceCreated(req.io, insertId, name, typeName, owner);
    return res.status(201).json({ message: "Resource created", id: insertId });
  } catch (error) {
    logger.error(error, "POST /api/resources error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

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

    const insertId = await createAvailabilityTransaction(id, startDate, endDate);
    emitAvailabilityChanged(req.io, id, startDate, endDate, insertId);
    return res.status(201).json({ message: "Availability added", id: insertId });
  } catch (error) {
    logger.error(error, "POST /api/resources/:id/availabilities error");
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

    await deleteAvailabilityTransaction(availabilityId);
    emitAvailabilityChanged(req.io, resourceId);
    return res.status(200).json({ message: "Availability deleted" });
  } catch (error) {
    logger.error(error, "DELETE /api/resources/:id/availabilities/:availabilityId error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.delete(`${API}/resources/:id`, isLoggedIn, async (req, res) => {
  try {
    const id = req.params.id;

    const isOwner = await checkResourceOwnership(id, req.user?.fullname, req.user?.username);
    if (isOwner === null) return res.status(404).json({ message: "Resource not found" });
    if (isOwner === false) return res.status(403).json({ message: "Forbidden: you are not the owner of this resource" });

    const imageRow = await db.query(queries.selectResourceImage, [id]).catch(() => ({ rows: [] }));
    const resourceImage = imageRow.rows?.[0]?.image;

    await deleteResourceTransaction(id);
    deleteUploadFile(resourceImage);
    emitResourceDeleted(req.io, id);
    return res.status(200).json({ message: "Resource deleted" });
  } catch (error) {
    logger.error(error, "DELETE /api/resources/:id error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
