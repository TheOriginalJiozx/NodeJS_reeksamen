import logger from "../lib/logger.js";
import notifier from "../lib/notifier.js";

function setupBookingSocket(backendOrigin, user, onBookingChange) {
  if (typeof globalThis.io !== "function") {
    logger.warn("Socket.io not available");
    return null;
  }

  try {
    const socket = globalThis.io(backendOrigin, { withCredentials: true });

    if (user && user.username) {
      socket.emit("joinUser", { username: user.username });
      logger.debug(`Joined user room: ${user.username}`);
    }

    if (user && user.fullname) {
      socket.emit("joinUser", { username: user.fullname });
      logger.debug(`Joined user room: ${user.fullname}`);
    }

    const handleBookingEvent = (eventName) => {
      socket.on(eventName, () => {
        if (eventName === "booking:deleted") {
          notifier.info("A booking was removed");
        }
        if (onBookingChange) {
          onBookingChange();
        }
      });
    };

    handleBookingEvent("booking:created");
    handleBookingEvent("booking:deleted");
    handleBookingEvent("booking:confirmed");
    handleBookingEvent("booking:declined");
    handleBookingEvent("availability:changed");

    return socket;
  } catch (error) {
    logger.warn("socket setup failed", error && error.message ? error.message : error);
    return null;
  }
}

function disconnectSocket(socket) {
  if (socket && typeof socket.disconnect === "function") {
    try {
      socket.disconnect();
    } catch (error) {
      logger.warn("Failed to disconnect socket", error && error.message ? error.message : error);
    }
  }
}

export { setupBookingSocket, disconnectSocket };
