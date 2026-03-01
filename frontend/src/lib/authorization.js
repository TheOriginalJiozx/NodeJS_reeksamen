import logger from "./logger.js";

function handleAuthorizationError(res) {
  if (res.status === 403) {
    logger.warn("Access denied - insufficient permissions");
    return { ok: false, forbidden: true, message: "Access denied" };
  }
  return null;
}

export { handleAuthorizationError };
