import { Router } from "express";
import db from "../../db/connection.js";
import * as queries from "../../db/queries/resources.js";
import * as availabilityQueries from "../../db/queries/availabilities.js";
import * as bookingQueries from "../../db/queries/bookings.js";
import * as typeQueries from "../../db/queries/types.js";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import logger from "../../lib/logger.js";
import fs from "fs";
import path from "path";

const router = Router();

const sendServerError = (res, tag, error) => {
  logger.error(error, tag);
  return res.status(500).json({ message: "Internal server error" });
};

const deleteUploadFile = (image) => {
  if (!image || !String(image).includes("/uploads/")) return;
  try {
    const filename = String(image).split("/uploads/").pop();
    const uploadPath = path.resolve("./Frontend/public/uploads", filename);
    if (fs.existsSync(uploadPath)) fs.unlinkSync(uploadPath);
  } catch (error) {
    logger.debug("Failed removing upload file", error);
  }
};

const emit = (ev, payload) => {
  try {
    global.io?.emit?.(ev, payload);
  } catch (error) {
    logger.warn(`Emit ${ev} failed`, error);
  }
};

router.get("/api/resources", isLoggedIn, async (req, res) => {
  try {
    const result = await db.query(queries.getAllResources, [req.user.username]);
    return res.status(200).json(result.rows);
  } catch (error) {
    return sendServerError(res, "GET /api/resources error", error);
  }
});

router.get("/api/resources/mine", isLoggedIn, async (req, res) => {
  try {
    const result = await db.query(queries.getOwnedResources, [req.user.username]);
    return res.status(200).json(result.rows);
  } catch (error) {
    return sendServerError(res, "GET /api/resources/mine error", error);
  }
});

router.post("/api/resources", isLoggedIn, async (req, res) => {
  try {
    const { name, type } = req.body;
    const owner = req.user?.username ?? null;
    if (!name || !type) return res.status(400).json({ message: "Missing name or type" });

    let typeName = type;
    if (typeof type === "number" || /^\d+$/.test(String(type))) {
      const typeId = Number(type);
      const t = await db.query(typeQueries.selectTypeNameById, [typeId]);
      if (!t.rowCount) return res.status(400).json({ message: "Invalid type id" });
      typeName = t.rows[0].name;
    }

    const result = await db.query(queries.insertResource, [name, typeName, owner]);
    const insertId = result.rows?.[0]?.insertId ?? null;
    const imageUrl = req.body?.imageUrl ?? null;
    if (insertId && imageUrl) {
      try {
        await db.query(queries.updateResourceImage, [imageUrl, insertId]);
      } catch (error) {
        logger.debug("Could not save image URL", error);
      }
    }
    emit("resource:created", { id: insertId, name, type: typeName, owner });
    return res.status(201).json({ message: "Resource created", id: insertId });
  } catch (error) {
    return sendServerError(res, "POST /api/resources error", error);
  }
});

const datesBetween = (startString, endString) => {
  const out = [];
  const [startYear, startMonth, startDay] = String(startString).split("-").map(Number);
  const [endYear, endMonth, endDay] = String(endString).split("-").map(Number);
  const start = new Date(startYear, (startMonth || 1) - 1, startDay || 1);
  const end = new Date(endYear, (endMonth || 1) - 1, endDay || 1);
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    out.push(`${year}-${month}-${day}`);
  }
  return out;
};

router.get("/api/resources/:id/availabilities", isLoggedIn, async (req, res) => {
  try {
    const id = req.params.id;
    const [availableResult, bookingsResult] = await Promise.all([db.query(queries.availabilitiesForResource, [id]), db.query(queries.bookingsForResource, [id])]);
    const availableSet = new Set();
    for (const available of availableResult.rows) if (available.startDate && available.endDate) datesBetween(available.startDate, available.endDate).forEach((date) => availableSet.add(date));
    for (const bookings of bookingsResult.rows) if (bookings.startDate && bookings.endDate) datesBetween(bookings.startDate, bookings.endDate).forEach((date) => availableSet.delete(date));
    return res.status(200).json({ availabilities: availableResult.rows, availableDates: Array.from(availableSet).sort() });
  } catch (error) {
    return sendServerError(res, "GET /api/resources/:id/availabilities error", error);
  }
});

router.post("/api/resources/:id/availabilities", isLoggedIn, async (req, res) => {
  try {
    const id = req.params.id;
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) return res.status(400).json({ message: "Missing availability fields" });
    const ownerCheck = await db.query(queries.selectResourceOwner, [id]);
    if (!ownerCheck.rowCount) return res.status(404).json({ message: "Resource not found" });
    if (ownerCheck.rows[0].owner !== req.user?.username) return res.status(403).json({ message: "Forbidden: you are not the owner of this resource" });
    const result = await db.query(queries.insertAvailability, [id, startDate, endDate]);
    const insertId = result.rows?.[0]?.insertId ?? null;
    try {
      global.io?.to?.(`resource:${id}`)?.emit?.("availability:changed", { resourceId: id, startDate, endDate, id: insertId });
    } catch (error) {
      logger.warn("Emit availability failed", error);
    }
    return res.status(201).json({ message: "Availability added", id: insertId });
  } catch (error) {
    return sendServerError(res, "POST /api/resources/:id/availabilities error", error);
  }
});

router.delete("/api/resources/:id/availabilities/:availabilityId", isLoggedIn, async (req, res) => {
  try {
    const resourceId = req.params.id;
    const availabilityId = req.params.availabilityId;

    const availableRes = await db.query(availabilityQueries.selectAvailabilityById, [availabilityId]);
    if (!availableRes.rowCount || !availableRes.rows[0]) return res.status(404).json({ message: "Availability not found" });
    const available = availableRes.rows[0];
    if (String(available.resource_id) !== String(resourceId)) return res.status(400).json({ message: "Availability does not belong to this resource" });

    const ownerCheck = await db.query(queries.selectResourceOwner, [resourceId]);
    if (!ownerCheck.rowCount) return res.status(404).json({ message: "Resource not found" });
    if (ownerCheck.rows[0].owner !== req.user?.username) return res.status(403).json({ message: "Forbidden: you are not the owner of this resource" });

    const start = available.start_date || available.startDate;
    const end = available.end_date || available.endDate;
    const conflict = await db.query(bookingQueries.checkConfirmedBookingConflict, [resourceId, start, end]);
    if (conflict?.rowCount > 0) return res.status(409).json({ message: "Cannot delete availability while confirmed bookings exist in that period" });

    await db.query(availabilityQueries.deleteAvailabilityById, [availabilityId]);

    try {
      global.io?.to(`resource:${resourceId}`)?.emit?.("availability:changed", { resourceId });
    } catch (error) {
      logger.warn("Emit availability failed", error);
    }

    return res.status(200).json({ message: "Availability deleted" });
  } catch (error) {
    return sendServerError(res, "DELETE /api/resources/:id/availabilities/:availabilityId error", error);
  }
});

router.delete("/api/resources/:id", isLoggedIn, async (req, res) => {
  try {
    const id = req.params.id;
    const ownerCheck = await db.query(queries.selectResourceOwner, [id]);
    if (!ownerCheck.rowCount) return res.status(404).json({ message: "Resource not found" });
    if (ownerCheck.rows[0].owner !== req.user?.username) return res.status(403).json({ message: "Forbidden: you are not the owner of this resource" });

    const imageRow = await db.query(queries.selectResourceImage, [id]).catch(() => ({ rows: [] }));
    const resourceImage = imageRow.rows?.[0]?.image;

    await db.query(queries.deleteBookingsByResource, [id]).catch(() => {});
    await db.query(queries.deleteAvailabilitiesByResource, [id]).catch(() => {});
    await db.query(queries.deleteResource, [id]);

    deleteUploadFile(resourceImage);
    emit("resource:deleted", { id });
    return res.status(200).json({ message: "Resource deleted" });
  } catch (error) {
    return sendServerError(res, "DELETE /api/resources/:id error", error);
  }
});

export default router;
