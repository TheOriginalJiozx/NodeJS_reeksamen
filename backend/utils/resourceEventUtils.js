import logger from "../lib/logger.js";

function emitResourceCreated(io, resourceId, name, typeName, owner) {
  try {
    if (io) {
      io.emit("resource:created", { id: resourceId, name, type: typeName, owner });
    }
  } catch (error) {
    logger.warn("Emit resource:created failed", error);
  }
}

function emitResourceDeleted(io, resourceId) {
  try {
    if (io) {
      io.emit("resource:deleted", { id: resourceId });
    }
  } catch (error) {
    logger.warn("Emit resource:deleted failed", error);
  }
}

function emitAvailabilityChanged(io, resourceId, startDate, endDate, availabilityId) {
  try {
    if (io) {
      const payload = { resourceId, startDate, endDate };
      if (availabilityId) payload.id = availabilityId;
      io.to(`resource:${resourceId}`).emit("availability:changed", payload);
    }
  } catch (error) {
    logger.warn("Emit availability:changed failed", error);
  }
}

export { emitResourceCreated, emitResourceDeleted, emitAvailabilityChanged };
