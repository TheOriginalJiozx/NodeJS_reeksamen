import { Router } from "express";
import db from "../../db/connection.js";
import * as queries from "../../db/queries/resources.js";
import * as availabilityQueries from "../../db/queries/availabilities.js";
import * as bookingQueries from "../../db/queries/bookings.js";
import * as typeQueries from "../../db/queries/types.js";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import { allowSelfOrAdmin } from "../../auth/authorization.js";
import * as userQueries from "../../db/queries/users.js";
import logger from "../../lib/logger.js";
import { sendServerError, deleteUploadFile, datesBetween } from "../../utils/resourceUtils.js";

const router = Router();
const API = "/api";

router.get(`${API}/resources`, isLoggedIn, async (req, res) => {
  try {
    const result = await db.query(queries.getAllResources, [req.user.username]);
    return res.status(200).json(result.rows);
  } catch (error) {
    return sendServerError(res, "GET /api/resources error", error);
  }
});

router.get(`${API}/users/:id/resources`, isLoggedIn, allowSelfOrAdmin(), async (req, res) => {
  try {
    const id = req.params.id;
    const userRow = await db.query(userQueries.selectUserById, [id]);
    if (!userRow.rowCount) return res.status(404).json({ message: "User not found" });
    const username = userRow.rows[0].username;
    const result = await db.query(queries.getOwnedResources, [username]);
    return res.status(200).json(result.rows);
  } catch (error) {
    return sendServerError(res, "GET /api/users/:id/resources error", error);
  }
});

router.post(`${API}/resources`, isLoggedIn, async (req, res) => {
  try {
    const { name, type } = req.body;
    const owner = req.user?.username ?? null;
    if (!name || !type) return res.status(400).json({ message: "Missing name or type" });

    let typeName = type;
    if (typeof type === "number" || /^\d+$/.test(String(type))) {
      const typeId = Number(type);
      const selectedType = await db.query(typeQueries.selectTypeNameById, [typeId]);
      if (!selectedType.rowCount) return res.status(400).json({ message: "Invalid type id" });
      typeName = selectedType.rows[0].name;
    }

    const imageUrl = req.body?.imageUrl ?? null;
    let insertId = null;

    try {
      await db.query("START TRANSACTION");
      const result = await db.query(queries.insertResource, [name, typeName, owner]);
      insertId = result.rows?.insertId ?? null;
      
      if (insertId && imageUrl) {
        await db.query(queries.updateResourceImage, [imageUrl, insertId]);
      }
      await db.query("COMMIT");
    } catch (transactionError) {
      try {
        await db.query("ROLLBACK");
      } catch (rollbackError) {
        logger.error(rollbackError, "POST /api/resources rollback error");
      }
      throw transactionError;
    }

    try {
      global.io?.emit?.("resource:created", { id: insertId, name, type: typeName, owner });
    } catch (error) {
      logger.warn("Emit resource:created failed", error);
    }
    return res.status(201).json({ message: "Resource created", id: insertId });
  } catch (error) {
    return sendServerError(res, "POST /api/resources error", error);
  }
});

router.get(`${API}/resources/:id/availabilities`, isLoggedIn, async (req, res) => {
  try {
    const id = req.params.id;
    // spørgsmål: hvorfor bruger vi Promise.all her?
    // Promise.all bruges til at køre flere asynkrone operationer parallelt og vente på, at de alle er færdige
    // I dette tilfælde vil vi gerne hente både tilgængeligheder og bookinger for ressourcen samtidig
    // Ved at bruge Promise.all kan vi starte begge forespørgsler på samme tid, hvilket kan være hurtigere end at vente på den første, før vi starter den anden
    const [availableResult, bookingsResult] = await Promise.all([db.query(queries.availabilitiesForResource, [id]), db.query(queries.bookingsForResource, [id])]);
    const availableSet = new Set();
    for (const available of availableResult.rows) if (available.startDate && available.endDate) datesBetween(available.startDate, available.endDate).forEach((date) => availableSet.add(date));
    for (const bookings of bookingsResult.rows) if (bookings.startDate && bookings.endDate) datesBetween(bookings.startDate, bookings.endDate).forEach((date) => availableSet.delete(date));
    return res.status(200).json({ availabilities: availableResult.rows, availableDates: Array.from(availableSet).sort() });
  } catch (error) {
    return sendServerError(res, "GET /api/resources/:id/availabilities error", error);
  }
});

router.post(`${API}/resources/:id/availabilities`, isLoggedIn, async (req, res) => {
  try {
    const id = req.params.id;
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) return res.status(400).json({ message: "Missing availability fields" });
    const ownerCheck = await db.query(queries.selectResourceOwner, [id]);
    if (!ownerCheck.rowCount) return res.status(404).json({ message: "Resource not found" });
    if (ownerCheck.rows[0].owner !== req.user?.username) return res.status(403).json({ message: "Forbidden: you are not the owner of this resource" });
    
    let insertId = null;
    try {
      await db.query("START TRANSACTION");
      const result = await db.query(queries.insertAvailability, [id, startDate, endDate]);
      insertId = result.rows?.[0]?.insertId ?? null;
      await db.query("COMMIT");
    } catch (transactionError) {
      try {
        await db.query("ROLLBACK");
      } catch (rollbackError) {
        logger.error(rollbackError, "POST /api/resources/:id/availabilities rollback error");
      }
      throw transactionError;
    }

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

router.delete(`${API}/resources/:id/availabilities/:availabilityId`, isLoggedIn, async (req, res) => {
  try {
    const resourceId = req.params.id;
    const availabilityId = req.params.availabilityId;

    const availableRes = await db.query(availabilityQueries.selectAvailabilityById, [availabilityId]);
    if (!availableRes.rowCount || !availableRes.rows[0]) return res.status(404).json({ message: "Availability not found" });
    const available = availableRes.rows[0];
    if (String(available.resourceId) !== String(resourceId)) return res.status(400).json({ message: "Availability does not belong to this resource" });

    const ownerCheck = await db.query(queries.selectResourceOwner, [resourceId]);
    if (!ownerCheck.rowCount) return res.status(404).json({ message: "Resource not found" });
    if (ownerCheck.rows[0].owner !== req.user?.username) return res.status(403).json({ message: "Forbidden: you are not the owner of this resource" });

    const start = available.startDate;
    const end = available.endDate;
    const conflict = await db.query(bookingQueries.checkConfirmedBookingConflict, [resourceId, start, end]);
    if (conflict?.rowCount > 0) return res.status(409).json({ message: "Cannot delete availability while confirmed bookings exist in that period" });

    try {
      await db.query("START TRANSACTION");
      await db.query(availabilityQueries.deleteAvailabilityById, [availabilityId]);
      await db.query("COMMIT");
    } catch (transactionError) {
      try {
        await db.query("ROLLBACK");
      } catch (rollbackError) {
        logger.error(rollbackError, "DELETE /api/resources/:id/availabilities/:availabilityId rollback error");
      }
      throw transactionError;
    }

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

router.delete(`${API}/resources/:id`, isLoggedIn, async (req, res) => {
  try {
    const id = req.params.id;
    const ownerCheck = await db.query(queries.selectResourceOwner, [id]);
    if (!ownerCheck.rowCount) return res.status(404).json({ message: "Resource not found" });
    if (ownerCheck.rows[0].owner !== req.user?.username) return res.status(403).json({ message: "Forbidden: you are not the owner of this resource" });

    const imageRow = await db.query(queries.selectResourceImage, [id]).catch(() => ({ rows: [] }));
    const resourceImage = imageRow.rows?.[0]?.image;

    try {
      await db.query("START TRANSACTION");
      await db.query(queries.deleteBookingsByResource, [id]).catch(() => {});
      await db.query(queries.deleteAvailabilitiesByResource, [id]).catch(() => {});
      await db.query(queries.deleteResource, [id]);
      await db.query("COMMIT");
    } catch (transactionError) {
      logger.error(transactionError, "Transaction error during resource delete, rolling back");
      await db.query("ROLLBACK").catch(() => {});
      throw transactionError;
    }

    deleteUploadFile(resourceImage);
    try {
      global.io?.emit?.("resource:deleted", { id });
    } catch (error) {
      logger.warn("Emit resource:deleted failed", error);
    }
    return res.status(200).json({ message: "Resource deleted" });
  } catch (error) {
    return sendServerError(res, "DELETE /api/resources/:id error", error);
  }
});

export default router;
