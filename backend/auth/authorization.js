import logger from "../lib/logger.js";

export function requireRole(role) {
  return function (req, res, next) {
    try {
      if (req.user && req.user.role === role) return next();
      return res.status(403).json({ message: "Forbidden" });
    } catch (error) {
      logger.error(error, "Authorization error in requireRole");
      return res.status(500).json({ message: "Internal server error" });
    }
  };
}

export const requireAdmin = requireRole("admin");

export function allowSelfOrAdmin(paramName = "id") {
  return function (req, res, next) {
    try {
      const idParameter = req.params && req.params[paramName];
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

const authorization = { requireRole, requireAdmin, allowSelfOrAdmin };
export default authorization;
