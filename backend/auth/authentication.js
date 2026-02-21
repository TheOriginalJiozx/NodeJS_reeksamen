import logger from "../lib/logger.js";
import crypto from "crypto";

const ITERATIONS = 100000;
const KEYLEN = 64;
const DIGEST = "sha512";

export function encryptPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString("hex");
  return `${salt}:${derived}`;
}

export function validatePassword(password, stored) {
  if (!stored) return false;
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derived = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString("hex");
  const derivedBuffer = Buffer.from(derived, "hex");
  const storedBuffer = Buffer.from(key, "hex");
  if (derivedBuffer.length !== storedBuffer.length) return false;
  return crypto.timingSafeEqual(derivedBuffer, storedBuffer);
}

export function isLoggedIn(req, res, next) {
  try {
    logger.debug("isLoggedIn check", {
      sessionId: req.sessionID,
      hasSession: !!req.session,
      hasUser: !!(req.session && req.session.user),
      cookies: req.headers && req.headers.cookie ? req.headers.cookie : null,
    });

    if (req.session && req.session.user) {
      req.user = req.session.user;
      return next();
    }

    return res.status(401).json({ message: "Not authenticated" });
  } catch (error) {
    logger.error(error, "isLoggedIn middleware error");
    return res.status(500).json({ message: "Internal server error" });
  }
}

const authentication = { encryptPassword, validatePassword, isLoggedIn };
export default authentication;
