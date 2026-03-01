import { Router } from "express";
import db from "../../db/connection.js";
import * as userQueries from "../../db/queries/users.js";
import * as resourceQueries from "../../db/queries/resources.js";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import { allowSelfOrAdmin } from "../../auth/authorization.js";
import logger from "../../lib/logger.js";
import { encryptPassword, validatePassword } from "../../utils/passwordUtils.js";
import { collectSessionIdsForUsername, destroySessionIds } from "../../utils/sessionUtils.js";
import { isValidId, sendServerError, executeTransaction, updateSessionUser } from "../../utils/usersUpdateRouterUtils.js";

const router = Router();
const API = "/api";

router.patch(`${API}/users/:id/username`, isLoggedIn, allowSelfOrAdmin(), async (req, res) => {
  const idParameter = req.params.id;
  if (!isValidId(idParameter)) return res.status(400).json({ message: "Invalid user id" });

  try {
    const { newUsername } = req.body || {};
    if (!newUsername) return res.status(400).json({ message: "New username required" });

    const userRow = await db.query(userQueries.selectUserById, [idParameter]);
    const existing = userRow.rows?.[0];
    if (!existing) return res.status(404).json({ message: "User not found" });

    if (!/^[A-Za-zÆØÅæøå0-9_]+$/.test(newUsername)) {
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
    
    const transactionResult = await executeTransaction([
      { sql: userQueries.updateUsername, params: [newUsername, idParameter] },
      { sql: userQueries.updateBookingsBooker, params: [newUsername, oldUsername] },
    ]);

    if (!transactionResult.ok) {
      return sendServerError(res, "PATCH /api/users/:id/username transaction error", transactionResult.error);
    }

    updateSessionUser(req, idParameter, { username: newUsername });

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

    if (newFullName.length < 2 || newFullName.length > 100) {
      return res.status(400).json({ message: "Fullname must be between 2 and 100 characters" });
    }

    if (!/^[A-Za-zÆØÅæøå\s-]+$/.test(newFullName)) {
      return res.status(400).json({ message: "Fullname may only contain letters, spaces and hyphens (no numbers)" });
    }

    const userRow = await db.query(userQueries.selectUserById, [idParameter]);
    const existing = userRow.rows[0];
    if (!existing) return res.status(404).json({ message: "User not found" });

    if (newFullName === existing.fullname) {
      return res.status(400).json({ message: "New fullname must be different from current fullname" });
    }

    try {
      const transactionResult = await executeTransaction([
        { sql: userQueries.updateFullName, params: [newFullName, idParameter] },
        { sql: resourceQueries.updateResourceOwner, params: [newFullName, existing.fullname] },
      ]);

      if (!transactionResult.ok) {
        return sendServerError(res, "PATCH /api/users/:id/fullname transaction error", transactionResult.error);
      }

      updateSessionUser(req, idParameter, { fullname: newFullName });
    } catch (error) {
      return sendServerError(res, "PATCH /api/users/:id/fullname error", error);
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

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters long" });
    }

    if (/\s/.test(newPassword)) {
      return res.status(400).json({ message: "Password cannot contain spaces" });
    }

    const userRow = await db.query(userQueries.selectUserById, [idParameter]);
    const existing = userRow.rows[0];
    if (!existing) return res.status(404).json({ message: "User not found" });

    const loginRow = await db.query(userQueries.selectUserForLogin, [existing.username]);
    const stored = loginRow.rows[0].passwordHash || null;
    
    if (!validatePassword(currentPassword, stored)) {
      return res.status(403).json({ message: "Current password incorrect" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }

    const hashed = encryptPassword(newPassword);
    
    const transactionResult = await executeTransaction([
      { sql: userQueries.updatePasswordHash, params: [hashed, idParameter] },
    ]);

    if (!transactionResult.ok) {
      return sendServerError(res, "PATCH /api/users/:id/password transaction error", transactionResult.error);
    }

    return res.status(200).json({ message: "Password updated" });
  } catch (error) {
    return sendServerError(res, "PATCH /api/users/:id/password error", error);
  }
});

export default router;
