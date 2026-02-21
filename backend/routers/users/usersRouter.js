import { Router } from "express";
import db from "../../db/connection.js";
import * as resourceQueries from "../../db/queries/resources.js";
import * as bookingQueries from "../../db/queries/bookings.js";
import * as availabilityQueries from "../../db/queries/availabilities.js";
import * as userQueries from "../../db/queries/users.js";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import { allowSelfOrAdmin } from "../../auth/authorization.js";
import logger from "../../lib/logger.js";
import fs from "fs";
import path from "path";
import auth from "../../utils/authorizerUtils.js";

const router = Router();
const API = "/api";

const isValidId = (id) => !!id && /^[0-9]+$/.test(String(id));
const sendServerError = (res, tag, error) => {
  logger.error(error, tag);
  return res.status(500).json({ message: "Internal server error" });
};

async function collectSessionIdsForUsername(username) {
  const store = global.sessionStore;
  if (!store || typeof store.all !== "function") return [];
  return new Promise((resolve) => {
    store.all((error, sessions) => {
      if (error) return resolve([]);
      const ids = [];
      if (Array.isArray(sessions)) {
        for (const item of sessions) {
          const sid = item.session_id || item.id || item.key;
          const sess = item.session || item.data || item;
          if (sid && sess?.user?.username === username) ids.push(sid);
        }
      } else if (sessions && typeof sessions === "object") {
        for (const sid of Object.keys(sessions)) {
          if (sessions[sid]?.user?.username === username) ids.push(sid);
        }
      }
      resolve(ids);
    });
  });
}

async function destroySessionIds(ids) {
  if (!ids.length) return;
  const store = global.sessionStore;
  if (!store || typeof store.destroy !== "function") return;
  await Promise.all(ids.map((id) => new Promise((r) => store.destroy(id, () => r()))));
}

router.get(`${API}/users/:id`, isLoggedIn, allowSelfOrAdmin(), async (req, res) => {
  const idParam = req.params.id;
  if (!isValidId(idParam)) return res.status(400).json({ message: "Invalid user id" });
  try {
    const result = await db.query(userQueries.selectUserById, [idParam]);
    if (!result.rowCount) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ user: result.rows[0] });
  } catch (error) {
    return sendServerError(res, "GET /api/users/:id error", error);
  }
});

router.post(`${API}/users/export`, isLoggedIn, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(400).json({ message: "Invalid user" });
  try {
    const result = await db.query(userQueries.selectUserById, [userId]);
    const userData = result.rows[0] || null;
    const exportData = { user: userData, resources: [], bookings: [], availabilities: [] };
    if (userData?.username) {
      exportData.resources = (await db.query(resourceQueries.getOwnedResources, [userData.username])).rows || [];
      exportData.bookings = (await db.query(bookingQueries.getBookingsForUserOrOwner, [userData.username])).rows || [];
      exportData.availabilities = (await db.query(availabilityQueries.getAvailabilitiesForOwnerResources, [userData.username])).rows || [];
    }
    const payload = JSON.stringify(exportData, null, 2);
    res.setHeader("Content-Disposition", 'attachment; filename="user-data.json"');
    res.setHeader("Content-Type", "application/json");
    return res.status(200).send(payload);
  } catch (error) {
    return sendServerError(res, "POST /api/users/export error", error);
  }
});

router.delete(`${API}/users/:id`, isLoggedIn, allowSelfOrAdmin(), async (req, res) => {
  const idParam = req.params.id;
  if (!isValidId(idParam)) return res.status(400).json({ message: "Invalid user id" });

  try {
    const userRow = await db.query(userQueries.selectUserById, [idParam]);
    const username = userRow.rows?.[0]?.username;
    if (!username) return res.status(404).json({ message: "User not found" });

    const conflict = await db.query(bookingQueries.checkActiveBookingsForOwner, [username]);
    if (conflict?.rowCount > 0) return res.status(409).json({ message: "Cannot delete account while active bookings exist for your resources" });

    const images = await db.query(userQueries.selectImagesByOwner, [username]);
    const resourceImages = (images.rows || []).map((r) => r.image).filter(Boolean);

    try {
      await db.query("BEGIN");
      await db.query(userQueries.deleteBookingsByOwnerResources, [username]);
      await db.query(userQueries.deleteAvailabilitiesByOwnerResources, [username]);
      await db.query(userQueries.deleteResourcesByOwner, [username]);
      await db.query(userQueries.deleteUserById, [idParam]);
      await db.query("COMMIT");
    } catch (txErr) {
      try {
        await db.query("ROLLBACK");
      } catch (rbErr) {
        logger.error(rbErr, "DELETE /api/users/:id rollback error");
      }
      throw txErr;
    }

    const sessionIds = await collectSessionIdsForUsername(username);
    await destroySessionIds(sessionIds);

    for (const resourceImage of resourceImages) {
      if (!resourceImage || !String(resourceImage).includes(`${API}uploads/`)) continue;
      const filename = String(resourceImage).split(`${API}uploads/`).pop();
      const uploadPath = path.resolve("./Frontend/public/uploads", filename);
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
  const idParam = req.params.id;
  if (!isValidId(idParam)) return res.status(400).json({ message: "Invalid user id" });

  try {
    const { username: newUsername, currentPassword, newPassword } = req.body || {};
    if (!newUsername && !newPassword) return res.status(400).json({ message: "No changes provided" });

    const userRow = await db.query(userQueries.selectUserById, [idParam]);
    const existing = userRow.rows?.[0];
    if (!existing) return res.status(404).json({ message: "User not found" });

    if (newUsername && newUsername !== existing.username) {
      if (!/^[A-Za-z0-9_]+$/.test(newUsername)) return res.status(400).json({ message: "Username may only contain letters, numbers and underscores" });
      const taken = await db.query(userQueries.findUserByUsername, [newUsername]);
      if (taken.rowCount > 0 && String(taken.rows[0].id) !== String(idParam)) return res.status(409).json({ message: "Username already in use" });

      const oldUsername = existing.username;
      try {
        await db.query("BEGIN");
        await db.query(userQueries.updateUsername, [newUsername, idParam]);
        await db.query(userQueries.updateBookingsBooker, [newUsername, oldUsername]);
        await db.query(userQueries.updateResourcesOwner, [newUsername, oldUsername]);
        await db.query("COMMIT");
      } catch (txErr) {
        try {
          await db.query("ROLLBACK");
        } catch (rbErr) {
          logger.error(rbErr, "Failed rollback after username update error");
        }
        return sendServerError(res, "PATCH /api/users/:id username tx error", txErr);
      }

      try {
        if (req.session?.user?.id && String(req.session.user.id) === String(idParam)) req.session.user.username = newUsername;
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

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ message: "Current password required" });
      const loginRow = await db.query(userQueries.selectUserForLogin, [existing.username]);
      const stored = loginRow.rows?.[0]?.password_hash || null;
      if (!auth.validatePassword(currentPassword, stored)) return res.status(403).json({ message: "Current password incorrect" });
      const hashed = auth.encryptPassword(newPassword);
      await db.query(userQueries.updatePasswordHash, [hashed, idParam]);
    }

    return res.status(200).json({ message: "Account updated" });
  } catch (error) {
    return sendServerError(res, "PATCH /api/users/:id error", error);
  }
});

export default router;
