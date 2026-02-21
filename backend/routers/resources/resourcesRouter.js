import { Router } from "express";
import db from "../../db/connection.js";
import * as queries from "../../db/queries/resources.js";
import * as typeQueries from "../../db/queries/types.js";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import logger from "../../lib/logger.js";
import fs from "fs";
import path from "path";

const router = Router();

const sendServerError = (res, tag, err) => {
  logger.error(err, tag);
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
  try { global.io?.emit?.(ev, payload); } catch (error) { logger.warn(`Emit ${ev} failed`, error); }
};

router.get("/api/resources", isLoggedIn, async (req, res) => {
  try {
    const result = await db.query(queries.getAllResources, [req.user.username]);
    return res.status(200).json(result.rows);
  } catch (err) {
    return sendServerError(res, "GET /api/resources error", err);
  }
});

router.get("/api/resources/mine", isLoggedIn, async (req, res) => {
  try {
    const result = await db.query(queries.getOwnedResources, [req.user.username]);
    return res.status(200).json(result.rows);
  } catch (err) {
    return sendServerError(res, "GET /api/resources/mine error", err);
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
      try { await db.query(queries.updateResourceImage, [imageUrl, insertId]); } catch (error) { logger.debug("Could not save image URL", error); }
    }
    emit("resource:created", { id: insertId, name, type: typeName, owner });
    return res.status(201).json({ message: "Resource created", id: insertId });
  } catch (err) {
    return sendServerError(res, "POST /api/resources error", err);
  }
});

const datesBetween = (startString, endString) => {
  const out = [];
  const [sy, sm, sd] = String(startString).split("-").map(Number);
  const [ey, em, ed] = String(endString).split("-").map(Number);
  const start = new Date(sy, (sm || 1) - 1, sd || 1);
  const end = new Date(ey, (em || 1) - 1, ed || 1);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
  }
  return out;
};

router.get("/api/resources/:id/availabilities", isLoggedIn, async (req, res) => {
  try {
    const id = req.params.id;
    const [availableResult, bookingsResult] = await Promise.all([
      db.query(queries.availabilitiesForResource, [id]),
      db.query(queries.bookingsForResource, [id]),
    ]);
    const availableSet = new Set();
    for (const a of availableResult.rows) if (a.startDate && a.endDate) datesBetween(a.startDate, a.endDate).forEach((d) => availableSet.add(d));
    for (const b of bookingsResult.rows) if (b.startDate && b.endDate) datesBetween(b.startDate, b.endDate).forEach((d) => availableSet.delete(d));
    return res.status(200).json({ availabilities: availableResult.rows, availableDates: Array.from(availableSet).sort() });
  } catch (err) {
    return sendServerError(res, "GET /api/resources/:id/availabilities error", err);
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
    try { global.io?.to?.(`resource:${id}`)?.emit?.("availability:changed", { resourceId: id, startDate, endDate, id: insertId }); } catch (error) { logger.warn("Emit availability failed", error); }
    return res.status(201).json({ message: "Availability added", id: insertId });
  } catch (err) {
    return sendServerError(res, "POST /api/resources/:id/availabilities error", err);
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
  } catch (err) {
    return sendServerError(res, "DELETE /api/resources/:id error", err);
  }
});

export default router;
