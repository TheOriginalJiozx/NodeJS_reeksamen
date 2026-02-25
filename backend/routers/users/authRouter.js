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
  const username = (req.body.username || "").trim();
  const password = req.body.password || "";

  if (!username || !password) {
    return res.status(400).json({ message: "Missing username or password" });
  }

  const result = await db.query(userQueries.selectUserForLogin, [username]);
  const user = result.rows[0];

  if (result.rowCount === 0) {
    return res.status(401).json({ message: "User does not exist" });
  }

  if (!auth.validatePassword(password, user && user.passwordHash)) {
    return res.status(401).json({ message: "Invalid password" });
  }

  // spørgsmål: hvorfor buger vi Promise her?
  // Vi bruger en Promise her for at håndtere den asynkrone natur af session.regenerate,
  // som ikke returnerer en Promise i sig selv.
  // Ved at indpakke det i en Promise kan vi bruge async/await-syntaksen,
  // hvilket gør koden mere læsbar og lettere at håndtere i tilfælde af fejl.
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
    const username = (req.body.username || "").trim();
    const fullname = (req.body.fullname || "").trim();
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";
    const confirmPassword = req.body.confirmPassword || "";

    if (!username || !fullname || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    if (!/^[A-Za-z0-9_]+$/.test(username)) {
      return res.status(400).json({ message: "Username may only contain letters, numbers and underscores" });
    }

    if (!/^[A-Za-z0-9\s-]+$/.test(fullname)) {
      return res.status(400).json({ message: "Fullname may only contain letters, numbers, spaces and hyphens" });
    }

    if (!/^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    const chosenUsername = await db.query(userQueries.findUserByUsername, [username]);
    if (chosenUsername.rowCount > 0) {
      return res.status(409).json({ message: "Username already in use" });
    }

    const reservedUsername = await db.query(userQueries.findReservedUsername, [username]);
    if (reservedUsername.rowCount > 0) {
      return res.status(409).json({ message: "You cannot create a user with this username" });
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
