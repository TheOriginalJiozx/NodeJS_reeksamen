import { Router } from "express";
import db from "../../db/connection.js";
import * as bookingQueries from "../../db/queries/bookings.js";
import * as userQueries from "../../db/queries/users.js";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import { allowSelfOrAdmin } from "../../auth/authorization.js";
import logger from "../../lib/logger.js";
import fs from "fs";
import path from "path";
import { collectSessionIdsForUsername, destroySessionIds } from "../../utils/sessionUtils.js";

const router = Router();
const API = "/api";

const isValidId = (id) => !!id && /^[0-9]+$/.test(String(id));
const sendServerError = (res, tag, error) => {
  logger.error(error, tag);
  return res.status(500).json({ message: "Internal server error" });
};

router.get(`${API}/users/:id`, isLoggedIn, allowSelfOrAdmin(), async (req, res) => {
  const idParameter = req.params.id;
  if (!isValidId(idParameter)) return res.status(400).json({ message: "Invalid user id" });
  try {
    const result = await db.query(userQueries.selectUserById, [idParameter]);
    if (!result.rowCount) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ user: result.rows[0] });
  } catch (error) {
    return sendServerError(res, "GET /api/users/:id error", error);
  }
});

router.delete(`${API}/users/:id`, isLoggedIn, allowSelfOrAdmin(), async (req, res) => {
  const idParameter = req.params.id;
  if (!isValidId(idParameter)) return res.status(400).json({ message: "Invalid user id" });

  try {
    const userRow = await db.query(userQueries.selectUserById, [idParameter]);
    const username = userRow.rows?.[0]?.username;
    if (!username) return res.status(404).json({ message: "User not found" });

    const conflict = await db.query(bookingQueries.checkActiveBookingsForOwner, [username]);
    if (conflict?.rowCount > 0) return res.status(409).json({ message: "Cannot delete account while active bookings exist for your resources" });

    const userHasBookings = await db.query(userQueries.checkUserHasBookings, [username]);

    const images = await db.query(userQueries.selectImagesByOwner, [username]);
    const resourceImages = (images.rows || []).map((resource) => resource.image).filter(Boolean);

    try {
      await db.query("START TRANSACTION");
      await db.query(userQueries.deleteBookingsByOwnerResources, [username]);
      await db.query(userQueries.deleteAvailabilitiesByOwnerResources, [username]);
      await db.query(userQueries.deleteResourcesByOwner, [username]);
      await db.query(userQueries.deleteUserById, [idParameter]);
      
      if (userHasBookings?.rowCount > 0) {
        await db.query(userQueries.reserveUsername, [username]);
      }

      await db.query("COMMIT");
    } catch (transactionError) {
      try {
        await db.query("ROLLBACK");
      } catch (rollbackError) {
        logger.error(rollbackError, "DELETE /api/users/:id rollback error");
      }
      throw transactionError;
    }

    const sessionIds = await collectSessionIdsForUsername(req.sessionStore, username);
    await destroySessionIds(req.sessionStore, sessionIds);

    for (const resourceImage of resourceImages) {
      if (!resourceImage || !String(resourceImage).includes(`${API}uploads/`)) continue;
      const filename = String(resourceImage).split(`${API}uploads/`).pop();
      const uploadPath = path.resolve("./frontend/public/uploads", filename);
      if (fs.existsSync(uploadPath)) {
        try {
          fs.unlinkSync(uploadPath);
        } catch (error) {
          logger.debug("Failed to delete resource image file", error);
        }
      }
    }

    try {
      req.session?.destroy?.();
    } catch (error) {
      logger.debug("Failed to destroy session after account deletion", error);
    }
    return res.status(200).json({ message: "User account and related resources deleted successfully" });
  } catch (error) {
    return sendServerError(res, "DELETE /api/users/:id error", error);
  }
});

export default router;
