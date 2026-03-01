import { Router } from "express";
import crypto from "crypto";
import logger from "../../lib/logger.js";

const router = Router();
const API = "/api";

router.get(`${API}/csrf-token`, (req, res) => {
  try {
    if (!req.session) return res.status(500).json({ message: "Session not available" });
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(24).toString("hex");
    }
    return res.status(200).json({ csrfToken: req.session.csrfToken });
  } catch (error) {
    logger.error(error, "Could not generate CSRF token");
    return res.status(500).json({ message: "Could not generate CSRF token" });
  }
});

export default router;
