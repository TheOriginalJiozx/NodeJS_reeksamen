import { Router } from "express";
import db from "../../db/connection.js";
import * as queries from "../../db/queries/resources.js";
import * as bookingQueries from "../../db/queries/bookings.js";
import * as userQueries from "../../db/queries/users.js";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import { allowSelfOrAdmin } from "../../auth/authorization.js";
import logger from "../../lib/logger.js";
import { deleteUploadFile } from "../../utils/resourceUtils.js";
import { createResourceTransaction, deleteResourceTransaction, getTypeNameById, checkResourceOwnership } from "../../services/resourceServices.js";
import { emitResourceCreated, emitResourceDeleted } from "../../utils/resourceEventUtils.js";
import { getResourceData, getActiveBookings, createDefectRecords, notifyUsersAboutDelete } from "../../services/resourceDeleteService.js";

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
    const { name, type, brand, model, year } = req.body;
    const owner = req.user?.fullname ?? null;
    
    let finalName = name;
    let isCarResource = false;
    
    if (brand || model || year) {
      isCarResource = true;
      if (!brand || !model || !year) {
        return res.status(400).json({ message: "Brand, model, and year are required for cars" });
      }
      if (!/^[A-Za-z0-9\s-]+$/.test(String(brand).trim())) {
        return res.status(400).json({ message: "Brand may only contain letters, numbers, spaces and hyphens" });
      }
      if (!/^[A-Za-z0-9\s-]+$/.test(String(model).trim())) {
        return res.status(400).json({ message: "Model may only contain letters, numbers, spaces and hyphens" });
      }
      finalName = `${brand} ${model} ${year}`;
    } else if (!finalName) {
      return res.status(400).json({ message: "Missing name or brand/model/year" });
    }
    
    if (!type) return res.status(400).json({ message: "Missing type" });

    const nameRegex = isCarResource 
      ? /^[A-Za-z0-9\s-]+$/
      : /^[A-Za-zÆØÅæøå\s-]+$/;
    
    if (!nameRegex.test(String(finalName).trim())) {
      const errorMsg = isCarResource
        ? "Car name may only contain letters, numbers, spaces and hyphens"
        : "Room name may only contain letters, numbers, spaces, hyphens and Danish characters (æøå)";
      return res.status(400).json({ message: errorMsg });
    }

    let typeName = type;
    if (typeof type === "number" || /^\d+$/.test(String(type))) {
      typeName = await getTypeNameById(Number(type));
      if (!typeName) return res.status(400).json({ message: "Invalid type id" });
    }

    const imageUrl = req.body?.imageUrl ?? null;
    const insertId = await createResourceTransaction(finalName, typeName, owner, imageUrl);

    emitResourceCreated(req.io, insertId, finalName, typeName, owner);
    return res.status(201).json({ message: "Resource created", id: insertId });
  } catch (error) {
    logger.error(error, "POST /api/resources error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.delete(`${API}/resources/:id`, isLoggedIn, async (req, res) => {
  try {
    const id = req.params.id;
    const { defect } = req.body || {};
    logger.info(`DELETE /api/resources/${id}`, { defect, body: req.body });

    const isOwner = await checkResourceOwnership(id, req.user?.fullname, req.user?.username);
    if (isOwner === null) return res.status(404).json({ message: "Resource not found" });
    if (isOwner === false) return res.status(403).json({ message: "Forbidden: you are not the owner of this resource" });

    if (!defect) {
      const hasConflict = await db.query(bookingQueries.getActiveBookingsForResource, [id]).catch(() => ({ rowCount: 0 }));
      if (hasConflict.rowCount > 0) {
        return res.status(409).json({ message: "Cannot delete resource with active bookings. Mark as defect to delete anyway." });
      }
    }

    const { image: resourceImage, name: resourceName, owner: resourceOwner } = await getResourceData(id);
    const bookings = defect ? await getActiveBookings(id) : [];

    try {
      await db.query("START TRANSACTION");
      logger.info(`DELETE resource ${id}: starting transaction, defect=${defect}`);
      
      if (defect && bookings.length > 0) {
        logger.info(`DELETE resource ${id}: inserting into defect_resources for ${bookings.length} bookings`);
        await createDefectRecords(id, resourceName, resourceOwner, bookings);
      }
      
      await deleteResourceTransaction(id);
      logger.info(`DELETE resource ${id}: deleteResourceTransaction completed`);
      
      await db.query("COMMIT");
      logger.info(`DELETE resource ${id}: transaction committed`);
    } catch (transactionError) {
      logger.error(`DELETE resource ${id}: transaction error, rolling back`, transactionError.message);
      try {
        await db.query("ROLLBACK");
      } catch (rollbackError) {
        logger.error(rollbackError, "Failed rollback after delete resource error");
      }
      throw transactionError;
    }

    deleteUploadFile(resourceImage);
    
    if (defect) {
      logger.info(`Resource ${id} deleted as defect, notifying ${bookings.length} bookers`);
      notifyUsersAboutDelete(req.io, id, bookings, resourceOwner);
    } else {
      emitResourceDeleted(req.io, id);
    }
    
    return res.status(200).json({ message: "Resource deleted" });
  } catch (error) {
    logger.error(error, "DELETE /api/resources/:id error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
