import logger from "../lib/logger.js";
import db from "../db/connection.js";

function isValidId(id) {
  return !!id && /^[0-9]+$/.test(String(id));
}

function sendServerError(res, tag, error) {
  logger.error(error, tag);
  return res.status(500).json({ message: "Internal server error" });
}

async function executeTransaction(queries) {
  try {
    await db.query("START TRANSACTION");
    for (const query of queries) {
      await db.query(query.sql, query.params);
    }
    await db.query("COMMIT");
    return { ok: true };
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error(rollbackError, "Failed rollback after transaction error");
    }
    return { ok: false, error };
  }
}

function updateSessionUser(req, userId, updates) {
  try {
    if (req.session?.user?.id && String(req.session.user.id) === String(userId)) {
      Object.assign(req.session.user, updates);
    }
  } catch (error) {
    logger.debug("Could not update session user", error);
  }
}

export { isValidId, sendServerError, executeTransaction, updateSessionUser };
