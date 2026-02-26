import db from "../db/connection.js";
import * as queries from "../db/queries/resources.js";
import * as typeQueries from "../db/queries/types.js";
import logger from "../lib/logger.js";

async function createResourceTransaction(name, typeName, owner, imageUrl) {
  let insertId = null;

  try {
    await db.query("START TRANSACTION");
    const result = await db.query(queries.insertResource, [name, typeName, owner]);
    insertId = result.rows?.insertId ?? null;

    if (insertId && imageUrl) {
      await db.query(queries.updateResourceImage, [imageUrl, insertId]);
    }
    await db.query("COMMIT");
  } catch (transactionError) {
    try {
      await db.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error(rollbackError, "createResourceTransaction rollback error");
    }
    throw transactionError;
  }

  return insertId;
}

async function deleteResourceTransaction(resourceId) {
  try {
    await db.query("START TRANSACTION");
    await db.query(queries.deleteBookingsByResource, [resourceId]).catch(() => {});
    await db.query(queries.deleteAvailabilitiesByResource, [resourceId]).catch(() => {});
    await db.query(queries.deleteResource, [resourceId]);
    await db.query("COMMIT");
  } catch (transactionError) {
    logger.error(transactionError, "deleteResourceTransaction error, rolling back");
    await db.query("ROLLBACK").catch(() => {});
    throw transactionError;
  }
}

async function getTypeNameById(typeId) {
  const selectedType = await db.query(typeQueries.selectTypeNameById, [typeId]);
  if (!selectedType.rowCount) return null;
  return selectedType.rows[0].name;
}

async function checkResourceOwnership(resourceId, userFullname, username) {
  const ownerCheck = await db.query(queries.selectResourceOwner, [resourceId]);
  if (!ownerCheck.rowCount) return null;
  
  const resourceOwner = ownerCheck.rows[0].owner;
  if (resourceOwner && resourceOwner !== userFullname && resourceOwner !== username) {
    return false;
  }
  return true;
}

export { createResourceTransaction, deleteResourceTransaction, getTypeNameById, checkResourceOwnership };
