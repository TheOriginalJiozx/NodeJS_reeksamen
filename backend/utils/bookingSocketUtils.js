import logger from "../lib/logger.js";

function emitBookingConfirmed(io, booker, resourceOwner) {
  if (!io) return;
  try {
    if (booker) {
      const normalizedBooker = String(booker).trim().toLowerCase();
      io.to(`user:${normalizedBooker}`).emit("booking:confirmed", {
        message: "Your booking was confirmed"
      });
    }
    if (resourceOwner) {
      const normalizedOwner = String(resourceOwner).trim().toLowerCase();
      io.to(`user:${normalizedOwner}`).emit("bookings:updated", {
        message: "A booking was confirmed"
      });
    }
  } catch (error) {
    logger.warn("Failed to emit booking confirmed", error?.message || error);
  }
}

function emitBookingDeclined(io, booker, resourceOwner) {
  if (!io) return;
  try {
    if (booker) {
      const normalizedBooker = String(booker).trim().toLowerCase();
      io.to(`user:${normalizedBooker}`).emit("booking:declined", {
        message: "Your booking was declined"
      });
    }
    if (resourceOwner) {
      const normalizedOwner = String(resourceOwner).trim().toLowerCase();
      io.to(`user:${normalizedOwner}`).emit("bookings:updated", {
        message: "A booking was declined"
      });
    }
  } catch (error) {
    logger.warn("Failed to emit booking declined", error?.message || error);
  }
}

function emitDefectReported(io, booker, resourceOwner) {
  if (!io) return;
  try {
    if (booker) {
      const normalizedBooker = String(booker).trim().toLowerCase();
      io.to(`user:${normalizedBooker}`).emit("defect:marked-seen", {
        message: "Your defect report was recorded"
      });
    }
    if (resourceOwner) {
      const normalizedOwner = String(resourceOwner).trim().toLowerCase();
      io.to(`user:${normalizedOwner}`).emit("defects:updated", {
        message: "A defect was reported on one of your bookings"
      });
    }
  } catch (error) {
    logger.warn("Failed to emit defect reported", error?.message || error);
  }
}

function emitBookingMarkedSeen(io, booker) {
  if (!io || !booker) return;
  try {
    const normalizedBooker = String(booker).trim().toLowerCase();
    io.to(`user:${normalizedBooker}`).emit("bookings:updated", {
      message: "Booking marked as seen"
    });
  } catch (error) {
    logger.warn("Failed to emit booking marked seen", error?.message || error);
  }
}

function emitDefectMarkedSeen(io, booker) {
  if (!io || !booker) return;
  try {
    const normalizedBooker = String(booker).trim().toLowerCase();
    io.to(`user:${normalizedBooker}`).emit("defect:marked-seen", {
      message: "Defect resource marked as seen"
    });
  } catch (error) {
    logger.warn("Failed to emit defect marked seen", error?.message || error);
  }
}

export { emitBookingConfirmed, emitBookingDeclined, emitDefectReported, emitBookingMarkedSeen, emitDefectMarkedSeen };
