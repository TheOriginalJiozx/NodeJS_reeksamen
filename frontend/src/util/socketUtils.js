import logger from "../lib/logger.js";

export function initializeResourceSocket(backendOrigin, username, onEventFired) {
  try {
    if (typeof globalThis.io !== "function") {
      logger.warn("Socket.io not available");
      return null;
    }

    const socket = globalThis.io(backendOrigin || window.location.origin, { withCredentials: true });

    const events = [
      "resource:created",
      "resource:deleted",
      "availability:changed",
      "booking:created",
      "booking:deleted",
      "booking:confirmed",
      "booking:declined",
    ];

    events.forEach((event) => {
      socket.on(event, () => {
        logger.debug(`Socket event: ${event}`);
        onEventFired();
      });
    });

    if (username) {
      socket.emit("joinUser", { username });
    }

    return socket;
  } catch (error) {
    logger.error("Failed to initialize socket", error && error.message ? error.message : error);
    return null;
  }
}

export function disconnectSocket(socket) {
  try {
    if (socket?.disconnect) {
      socket.disconnect();
    }
  } catch (error) {
    logger.debug("Failed to disconnect socket", error && error.message ? error.message : error);
  }
}
