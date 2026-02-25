import { Router } from "express";
import db from "../../db/connection.js";
import * as resourceQueries from "../../db/queries/resources.js";
import * as bookingQueries from "../../db/queries/bookings.js";
import * as availabilityQueries from "../../db/queries/availabilities.js";
import * as userQueries from "../../db/queries/users.js";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import logger from "../../lib/logger.js";

const router = Router();
const API = "/api";

const sendServerError = (res, tag, error) => {
  logger.error(error, tag);
  return res.status(500).json({ message: "Internal server error" });
};

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
    return sendServerError(res, "GET /api/users/export error", error);
  }
});

export default router;
