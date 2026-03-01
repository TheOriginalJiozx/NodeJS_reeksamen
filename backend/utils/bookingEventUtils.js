import db from "../db/connection.js";
import * as resourceQueries from "../db/queries/resources.js";
import logger from "../lib/logger.js";

function emitBookingCreatedEvents(io, resourceId, startDate, endDate, bookingId, resourceImage) {
  try {
    if (io) {
      io.to(`resource:${resourceId}`).emit("booking:created", {
        resourceId,
        startDate,
        endDate,
        bookingId,
        resourceImage,
      });
    }
  } catch (error) {
    logger.warn("Failed to emit booking:created", error?.message || error);
  }

  db.query(resourceQueries.selectResourceById, [resourceId])
    .then((resourceRes) => {
      const resourceName = resourceRes.rowCount && resourceRes.rows[0] ? resourceRes.rows[0].name : "Resource";
      db.query(resourceQueries.selectResourceOwner, [resourceId])
        .then((ownerRes) => {
          const owner = ownerRes.rowCount && ownerRes.rows[0] ? ownerRes.rows[0].owner : null;
          if (owner && io) {
            const normalizedOwner = String(owner).trim().toLowerCase();
            logger.debug(`Emitting booking:created to user:${normalizedOwner} (owner: ${owner})`);
            io.to(`user:${normalizedOwner}`).emit("booking:created", {
              resourceId,
              resourceName,
              startDate,
              endDate,
              bookingId,
              resourceImage,
            });
          }
        })
        .catch((error) => {
          logger.debug("Failed to emit booking:created to user room", error?.message || error);
        });
    })
    .catch((error) => {
      logger.debug("Failed to fetch resource for booking:created event", error?.message || error);
    });
}

export { emitBookingCreatedEvents };
