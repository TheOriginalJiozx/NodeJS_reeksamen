import logger from "../lib/logger.js";

const SOCKET_EVENTS = [
  "resource:created",
  "resource:deleted",
  "availability:changed",
  "booking:created",
  "booking:deleted",
  "booking:confirmed",
  "booking:declined",
];

export function initializeSocket(backendOrigin, username, onEventFired) {
  try {
    if (typeof globalThis.io !== "function") {
      logger.warn("Socket.io not available");
      return null;
    }

    const socket = globalThis.io(backendOrigin || window.location.origin, { withCredentials: true });

    SOCKET_EVENTS.forEach((event) => {
      socket.on(event, () => {
        logger.debug(`Socket event: ${event}`);
        if (typeof onEventFired === "function") {
          onEventFired();
        }
      });
    });

    if (username) {
      socket.emit("joinUser", { username });
      logger.debug(`Joined user room: ${username}`);
    }

    logger.info("Socket initialized successfully");
    return socket;
  } catch (error) {
    logger.error("Failed to initialize socket", error && error.message ? error.message : error);
    return null;
  }
}

export function disconnectSocket(socket) {
  try {
    if (socket && typeof socket.disconnect === "function") {
      socket.disconnect();
      logger.info("Socket disconnected");
    }
  } catch (error) {
    logger.debug("Failed to disconnect socket", error && error.message ? error.message : error);
  }
}

export function getAvailableSocketEvents() {
  return [...SOCKET_EVENTS];
}

export function joinResourceRoom(socket, resourceId) {
  if (socket && typeof socket.emit === "function") {
    socket.emit("joinResource", { resourceId });
    logger.debug(`Joined resource room: ${resourceId}`);
  }
}

export function leaveResourceRoom(socket, resourceId) {
  if (socket && typeof socket.emit === "function") {
    socket.emit("leaveResource", { resourceId });
    logger.debug(`Left resource room: ${resourceId}`);
  }
}
