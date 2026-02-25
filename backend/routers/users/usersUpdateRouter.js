import { Router } from "express";
import db from "../../db/connection.js";
import * as userQueries from "../../db/queries/users.js";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import { allowSelfOrAdmin } from "../../auth/authorization.js";
import logger from "../../lib/logger.js";
import auth from "../../utils/authorizerUtils.js";
import { collectSessionIdsForUsername, destroySessionIds } from "../../utils/sessionUtils.js";

const router = Router();
const API = "/api";

const isValidId = (id) => !!id && /^[0-9]+$/.test(String(id));
const sendServerError = (res, tag, error) => {
  logger.error(error, tag);
  return res.status(500).json({ message: "Internal server error" });
};

router.patch(`${API}/users/:id/username`, isLoggedIn, allowSelfOrAdmin(), async (req, res) => {
  const idParameter = req.params.id;
  if (!isValidId(idParameter)) return res.status(400).json({ message: "Invalid user id" });

  try {
    const { newUsername } = req.body || {};
    if (!newUsername) return res.status(400).json({ message: "New username required" });

    const userRow = await db.query(userQueries.selectUserById, [idParameter]);
    const existing = userRow.rows?.[0];
    if (!existing) return res.status(404).json({ message: "User not found" });

    if (!/^[A-Za-z0-9_]+$/.test(newUsername)) {
      return res.status(400).json({ message: "Username may only contain letters, numbers and underscores" });
    }

    if (newUsername === existing.username) {
      return res.status(400).json({ message: "New username must be different from current username" });
    }

    const taken = await db.query(userQueries.findUserByUsername, [newUsername]);
    if (taken.rowCount > 0 && String(taken.rows[0].id) !== String(idParameter)) {
      return res.status(409).json({ message: "Username already in use" });
    }

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
      return sendServerError(res, "PATCH /api/users/:id/username transaction error", transactionError);
    }

    try {
      if (req.session?.user?.id && String(req.session.user.id) === String(idParameter)) {
        req.session.user.username = newUsername;
      }
    } catch (error) {
      logger.debug("Could not update session username after change", error);
    }

    try {
      const ids = await collectSessionIdsForUsername(req.sessionStore, oldUsername);
      await destroySessionIds(req.sessionStore, ids);
    } catch (error) {
      logger.debug("Could not update other sessions after username change", error);
    }

    return res.status(200).json({ message: "Username updated" });
  } catch (error) {
    return sendServerError(res, "PATCH /api/users/:id/username error", error);
  }
});

router.patch(`${API}/users/:id/fullname`, isLoggedIn, allowSelfOrAdmin(), async (req, res) => {
  const idParameter = req.params.id;
  if (!isValidId(idParameter)) return res.status(400).json({ message: "Invalid user id" });

  try {
    let { newFullName } = req.body || {};
    newFullName = newFullName ? String(newFullName).trim() : null;
    if (!newFullName) return res.status(400).json({ message: "New fullname required" });

    const userRow = await db.query(userQueries.selectUserById, [idParameter]);
    const existing = userRow.rows?.[0];
    if (!existing) return res.status(404).json({ message: "User not found" });

    if (newFullName === existing.fullname) {
      return res.status(400).json({ message: "New fullname must be different from current fullname" });
    }

    if (!/^[A-Za-z0-9\s-]+$/.test(newFullName)) {
      return res.status(400).json({ message: "Fullname may only contain letters, numbers, spaces and hyphens" });
    }

    await db.query(userQueries.updateFullName, [newFullName, idParameter]);
    
    try {
      if (req.session?.user?.id && String(req.session.user.id) === String(idParameter)) {
        req.session.user.fullname = newFullName;
      }
    } catch (error) {
      logger.debug("Could not update session fullname after change", error);
    }

    return res.status(200).json({ message: "Fullname updated" });
  } catch (error) {
    return sendServerError(res, "PATCH /api/users/:id/fullname error", error);
  }
});

router.patch(`${API}/users/:id/password`, isLoggedIn, allowSelfOrAdmin(), async (req, res) => {
  const idParameter = req.params.id;
  if (!isValidId(idParameter)) return res.status(400).json({ message: "Invalid user id" });

  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body || {};
    
    if (!currentPassword) return res.status(400).json({ message: "Current password required" });
    if (!newPassword) return res.status(400).json({ message: "New password required" });
    if (!confirmNewPassword) return res.status(400).json({ message: "Please confirm new password" });
    
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const userRow = await db.query(userQueries.selectUserById, [idParameter]);
    const existing = userRow.rows?.[0];
    if (!existing) return res.status(404).json({ message: "User not found" });

    const loginRow = await db.query(userQueries.selectUserForLogin, [existing.username]);
    const stored = loginRow.rows?.[0]?.passwordHash || null;
    
    if (!auth.validatePassword(currentPassword, stored)) {
      return res.status(403).json({ message: "Current password incorrect" });
    }

    const hashed = auth.encryptPassword(newPassword);
    await db.query(userQueries.updatePasswordHash, [hashed, idParameter]);

    return res.status(200).json({ message: "Password updated" });
  } catch (error) {
    return sendServerError(res, "PATCH /api/users/:id/password error", error);
  }
});

export default router;
