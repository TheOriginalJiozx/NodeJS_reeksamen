import logger from "../lib/logger.js";

function requireRole(role) {
  return function (req, res, next) {
    try {
      if (req.user?.role === role) return next();
      return res.status(403).json({ message: "Forbidden" });
    } catch (error) {
      logger.error(error, "Authorization error in requireRole");
      return res.status(500).json({ message: "Internal server error" });
    }
  };
}

const requireAdmin = requireRole("admin");

function allowSelfOrAdmin(parameterName = "id") {
  return function (req, res, next) {
    try {
      const idParameter = req.params?.[parameterName];
      const requesterId = req.user?.id ? String(req.user.id) : null;
      if (requesterId && String(idParameter) === String(requesterId)) return next();
      if (req.user?.role === "admin") return next();
      return res.status(403).json({ message: "Forbidden" });
    } catch (error) {
      logger.error(error, "Authorization error in allowSelfOrAdmin");
      return res.status(500).json({ message: "Internal server error" });
    }
  };
}

export { requireRole, requireAdmin, allowSelfOrAdmin };
