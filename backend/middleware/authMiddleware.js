import logger from "../lib/logger.js";

function isLoggedIn(req, res, next) {
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

export { isLoggedIn };
