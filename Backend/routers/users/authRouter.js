import { Router } from "express";
import auth from "../../utils/authorizerUtils.js";
import db from "../../db/connection.js";
import * as userQueries from "../../db/queries/users.js";
import { rateLimit } from "express-rate-limit";
import { isLoggedIn } from "../../middleware/authMiddleware.js";
import logger from "../../lib/logger.js";

const router = Router();

const API = "/api"

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.post(`${API}/auth/login`, authLimiter, async (req, res) => {
  const { username, password } = req.body;
  const result = await db.query(userQueries.selectUserForLogin, [username]);
  const user = result.rows[0];

  if (result.rowCount === 0 || !auth.validatePassword(password, user && user.password_hash)) {
    return res.status(401).json({ message: "Invalid username or password" });
  }

  if (user.verified === 0) {
    return res.status(403).json({ message: "Account not verified" });
  }

  return new Promise((resolve) => {
    req.session.regenerate((error) => {
      if (error) {
        logger.error(error, "Session regenerate failed during login");
      }
      req.session.user = {
        id: user.id,
        username: user.username,
          fullname: user.fullname || null,
          role: user.role,
          email: user.email,
      };
      return resolve(res.status(200).json({ message: "Login successful", user: req.session.user }));
    });
  });
});

router.post(`${API}/auth/logout`, isLoggedIn, (req, res) => {
  req.session.destroy((error) => {
    try {
      res.clearCookie("connect.sid");
    } catch (error) {
      logger.error(error, "Clearing cookie error during logout");
    }
    if (error) {
      logger.error(error, "Session destroy error");
      return res.status(500).json({ message: "Logout failed" });
    }
    return res.status(200).json({ message: "Logged out successfully" });
  });
});

router.post(`${API}/auth/register`, authLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!/^[A-Za-z0-9_]+$/.test(username)) {
      return res.status(400).json({ message: "Username may only contain letters, numbers and underscores" });
    }

    const chosenEmail = await db.query(userQueries.findUserByEmail, [email]);
    if (chosenEmail.rowCount > 0) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const hashedPassword = auth.encryptPassword(password);

    await db.query(userQueries.insertUser, [null, username, email, hashedPassword, "user"]);

    return res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    logger.error(error, "POST /api/users error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
