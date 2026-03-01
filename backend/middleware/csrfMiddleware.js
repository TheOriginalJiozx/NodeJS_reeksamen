import logger from "../lib/logger.js";

export default function csrfMiddleware({ exemptPaths = [] } = {}) {
  return function (req, res, next) {
    try {
      if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
      
      const isExempt = exemptPaths.some(path => 
        req.path === path || req.path.startsWith(path + "/")
      );
      if (isExempt) return next();

      const headerToken = req.get("x-csrf-token") || req.get("x-xsrf-token");
      const bodyToken = req.body && req.body.csrfToken;
      const token = headerToken || bodyToken;

      if (!req.session) return res.status(403).json({ message: "Missing session for CSRF validation" });
      if (!req.session.csrfToken)
        return res.status(403).json({ message: "Missing CSRF token in session" });
      if (!token || token !== req.session.csrfToken)
        return res.status(403).json({ message: "Invalid CSRF token" });
      return next();
    } catch (error) {
      logger.error(error, "csrfMiddleware error");
      return res.status(500).json({ message: "Internal server error" });
    }
  };
}
