import { Router } from "express";
import db from "../../db/connection.js";
import * as bookingQueries from "../../db/queries/bookings.js";
import * as userQueries from "../../db/queries/users.js";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import { allowSelfOrAdmin } from "../../auth/authorization.js";
import logger from "../../lib/logger.js";
import fs from "fs";
import path from "path";
import auth from "../../utils/authorizerUtils.js";
import { collectSessionIdsForUsername, destroySessionIds } from "../../lib/sessionUtils.js";

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

    const sessionIds = await collectSessionIdsForUsername(username);
    await destroySessionIds(sessionIds);

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

router.patch(`${API}/users/:id`, isLoggedIn, allowSelfOrAdmin(), async (req, res) => {
  const idParameter = req.params.id;
  if (!isValidId(idParameter)) return res.status(400).json({ message: "Invalid user id" });

  try {
    let { newUsername, newFullName, currentPassword, newPassword, confirmNewPassword } = req.body || {};
    newFullName = newFullName ? String(newFullName).trim() : null;
    if (!newUsername && !newFullName && !newPassword) return res.status(400).json({ message: "No changes provided" });

    const userRow = await db.query(userQueries.selectUserById, [idParameter]);
    const existing = userRow.rows?.[0];
    if (!existing) return res.status(404).json({ message: "User not found" });

    if (newUsername && newUsername !== existing.username) {
      if (!/^[A-Za-z0-9_]+$/.test(newUsername)) return res.status(400).json({ message: "Username may only contain letters, numbers and underscores" });
      const taken = await db.query(userQueries.findUserByUsername, [newUsername]);
      if (taken.rowCount > 0 && String(taken.rows[0].id) !== String(idParameter)) return res.status(409).json({ message: "Username already in use" });

      const oldUsername = existing.username;
      
      try {
        await db.query("START TRANSACTION");
        await db.query(userQueries.updateUsername, [newUsername, idParameter]);
        await db.query(userQueries.updateBookingsBooker, [newUsername, oldUsername]);
        await db.query(userQueries.updateResourcesOwner, [newUsername, oldUsername]);
        await db.query("COMMIT");
      } catch (transactionError) {
        try {
          await db.query("ROLLBACK");
        } catch (rollbackError) {
          logger.error(rollbackError, "Failed rollback after username update error");
        }
        return sendServerError(res, "PATCH /api/users/:id username tx error", transactionError);
      }

      try {
        if (req.session?.user?.id && String(req.session.user.id) === String(idParameter)) req.session.user.username = newUsername;
      } catch (error) {
        logger.debug("Could not update session username after change", error);
      }

      try {
        const ids = await collectSessionIdsForUsername(oldUsername);
        await destroySessionIds(ids);
      } catch (error) {
        logger.debug("Could not update other sessions after username change", error);
      }
    }

    if (newFullName && newFullName !== existing.fullname) {
      if (!/^[A-Za-z0-9\s-]+$/.test(newFullName)) return res.status(400).json({ message: "Fullname may only contain letters, numbers, spaces and hyphens" });
      await db.query(userQueries.updateFullName, [newFullName, idParameter]);
      try {
        if (req.session?.user?.id && String(req.session.user.id) === String(idParameter)) req.session.user.fullname = newFullName;
      } catch (error) {
        logger.debug("Could not update session fullname after change", error);
      }
    }

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ message: "Current password required" });
      if (!confirmNewPassword) return res.status(400).json({ message: "Please confirm new password" });
      if (newPassword !== confirmNewPassword) return res.status(400).json({ message: "Passwords do not match" });
      const loginRow = await db.query(userQueries.selectUserForLogin, [existing.username]);
      const stored = loginRow.rows?.[0]?.passwordHash || null;
      if (!auth.validatePassword(currentPassword, stored)) return res.status(403).json({ message: "Current password incorrect" });
      const hashed = auth.encryptPassword(newPassword);
      await db.query(userQueries.updatePasswordHash, [hashed, idParameter]);
    }

    return res.status(200).json({ message: "Account updated" });
  } catch (error) {
    return sendServerError(res, "PATCH /api/users/:id error", error);
  }
});

export default router;
