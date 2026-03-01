import db from "../db/connection.js";
import * as resourceQueries from "../db/queries/resources.js";
import * as bookingQueries from "../db/queries/bookings.js";
import logger from "../lib/logger.js";

async function verifyBookingOwner(bookingId, userFullname) {
  const bookingResult = await db.query(bookingQueries.selectBookingById, [bookingId]);
  if (!bookingResult.rowCount || !bookingResult.rows[0]) {
    return { valid: false, error: "Booking not found", status: 404 };
  }
  const booking = bookingResult.rows[0];

  const resourceResult = await db.query(resourceQueries.selectResourceOwner, [booking.resourceId]);
  const resourceOwner = resourceResult.rowCount && resourceResult.rows[0] ? resourceResult.rows[0].owner : null;

  const normalizedUserId = String(userFullname).trim().toLowerCase();
  const normalizedBooker = String(booking.booker).trim().toLowerCase();
  const normalizedResourceOwner = String(resourceOwner).trim().toLowerCase();

  if (normalizedUserId !== normalizedBooker && normalizedUserId !== normalizedResourceOwner) {
    return { valid: false, error: "Forbidden: cannot delete this booking", status: 403 };
  }

  return { valid: true, booking, resourceOwner };
}

async function getResourceName(resourceId) {
  const resourceData = await db.query(resourceQueries.selectResourceById, [resourceId]).catch(() => ({ rowCount: 0 }));
  return resourceData && resourceData.rowCount > 0 ? resourceData.rows[0].name : "Resource";
}

async function emitBookingEvent(io, booking, eventType, resourceOwner = null) {
  try {
    if (!io || !booking.booker || !booking.resourceId) {
      logger.warn(`emitBookingEvent - missing data: booker=${booking.booker}, resourceId=${booking.resourceId}`);
      return;
    }
    const resourceName = await getResourceName(booking.resourceId);
    const payload = { 
      bookingId: booking.id, 
      resourceId: booking.resourceId, 
      resourceName, 
      bookingDate: booking.startDate, 
      bookingEndDate: booking.endDate 
    };
    
    io.to(`resource:${booking.resourceId}`).emit(eventType, payload);
    logger.debug(`Emitted ${eventType} to resource:${booking.resourceId}`);
    
    const normalizedBooker = String(booking.booker).trim().toLowerCase();
    logger.info(`[${eventType}] Emitting to user:${normalizedBooker} (original: ${booking.booker})`);
    io.to(`user:${normalizedBooker}`).emit(eventType, payload);
    
    if (resourceOwner) {
      const normalizedOwner = String(resourceOwner).trim().toLowerCase();
      if (normalizedOwner !== normalizedBooker) {
        logger.debug(`Emitted ${eventType} to user:${normalizedOwner}`);
        io.to(`user:${normalizedOwner}`).emit(eventType, payload);
      }
    }
  } catch (error) {
    logger.warn(`Failed to emit ${eventType}`, error?.message);
  }
}

async function emitDefectEvent(io, booking, defectReport, resourceOwner) {
  try {
    if (!io || !booking.booker || !booking.resourceId) {
      logger.warn(`emitDefectEvent - missing data: booker=${booking.booker}, resourceId=${booking.resourceId}`);
      return;
    }
    const resourceName = await getResourceName(booking.resourceId);
    const payload = {
      bookingId: booking.id,
      resourceId: booking.resourceId,
      resourceName,
      booker: booking.booker,
      defectReport
    };

    if (resourceOwner) {
      const normalizedOwner = String(resourceOwner).trim().toLowerCase();
      logger.info(`[emitDefectEvent] Resource owner: "${resourceOwner}" normalized: "${normalizedOwner}"`);
      
      const sockets = io.sockets.adapter.rooms.get(`user:${normalizedOwner}`);
      const socketCount = sockets ? sockets.size : 0;
      logger.info(`[emitDefectEvent] Sockets connected to user:${normalizedOwner}: ${socketCount}`);
      
      if (socketCount > 0) {
        io.to(`user:${normalizedOwner}`).emit("defect:reported", {
          ...payload,
          message: `Defect reported on your resource by ${booking.booker}`
        });
        logger.info(`[emitDefectEvent] Event emitted to user:${normalizedOwner}`);
      } else {
        logger.warn(`[emitDefectEvent] No connected sockets for user:${normalizedOwner} - user is offline`);
      }
    }
  } catch (error) {
    logger.warn("Failed to emit defect:reported", error?.message);
  }
}

async function emitBookingEventToBookerOnly(io, booking, eventType) {
  try {
    if (!io || !booking.booker) {
      logger.warn(`emitBookingEventToBookerOnly - missing data: booker=${booking.booker}`);
      return;
    }
    const resourceName = await getResourceName(booking.resourceId);
    const payload = { 
      bookingId: booking.id, 
      resourceId: booking.resourceId, 
      resourceName, 
      bookingDate: booking.startDate, 
      bookingEndDate: booking.endDate 
    };
    
    const normalizedBooker = String(booking.booker).trim().toLowerCase();
    logger.info(`[${eventType}] Emitting to booker only: user:${normalizedBooker} (original: ${booking.booker})`);
    io.to(`user:${normalizedBooker}`).emit(eventType, payload);
  } catch (error) {
    logger.warn(`Failed to emit ${eventType} to booker`, error?.message);
  }
}

export { verifyBookingOwner, getResourceName, emitBookingEvent, emitBookingEventToBookerOnly, emitDefectEvent };
