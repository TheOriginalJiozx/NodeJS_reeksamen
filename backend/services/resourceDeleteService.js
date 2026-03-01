import db from "../db/connection.js";
import * as bookingQueries from "../db/queries/bookings.js";
import * as defectQueries from "../db/queries/defectResources.js";
import * as queries from "../db/queries/resources.js";
import logger from "../lib/logger.js";

async function getResourceData(resourceId) {
  const imageRow = await db.query(queries.selectResourceImage, [resourceId]).catch(() => ({ rows: [] }));
  return {
    image: imageRow.rows[0]?.image,
    name: imageRow.rows[0]?.name,
    owner: imageRow.rows[0]?.owner,
  };
}

async function getActiveBookings(resourceId) {
  const result = await db.query(bookingQueries.getActiveBookingDetailsForResource, [resourceId]).catch(() => ({ rows: [] }));
  return result.rows || [];
}

async function createDefectRecords(resourceId, resourceName, resourceOwner, bookings) {
  for (const booking of bookings) {
    try {
      const bookerResult = await db.query(defectQueries.getUserIdByFullname, [booking.booker]).catch(() => ({ rows: [] }));
      const bookerId = bookerResult.rows[0]?.id || null;
      
      await db.query(defectQueries.markResourceDefect, [resourceId, resourceName, resourceOwner, bookerId]);
      logger.info(`DELETE resource ${resourceId}: inserted defect_resources for booker ${booking.booker} (id=${bookerId})`);
    } catch (insertError) {
      logger.warn(`DELETE resource ${resourceId}: failed to insert defect_resources for booking ${booking.id}`, insertError.message);
    }
  }
}

async function notifyUsersAboutDelete(io, resourceId, bookings, resourceOwner) {
  if (!io) return;

  bookings.forEach((booking) => {
    if (booking.booker) {
      const normalizedBooker = String(booking.booker).trim().toLowerCase();
      io.to(`user:${normalizedBooker}`).emit("resource:deleted", {
        id: resourceId,
        isDefect: true,
        message: "A resource with your active booking has been marked as defective and removed"
      });
      io.to(`user:${normalizedBooker}`).emit("defect:marked-seen", {
        message: "Defect resource added to your notifications"
      });
      logger.debug(`Emitting resource:deleted to user:${normalizedBooker}`);
    }
  });

  if (resourceOwner) {
    const normalizedOwner = String(resourceOwner).trim().toLowerCase();
    io.to(`user:${normalizedOwner}`).emit("bookings:updated", {
      message: "A resource was deleted"
    });
    logger.info(`DELETE resource ${resourceId}: Notifying owner "${resourceOwner}" (normalized: "${normalizedOwner}")`);
  }
}

export { getResourceData, getActiveBookings, createDefectRecords, notifyUsersAboutDelete };
