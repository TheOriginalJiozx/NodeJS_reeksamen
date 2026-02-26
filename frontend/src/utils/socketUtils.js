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

function initializeSocket(backendOrigin, username, onEventFired) {
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

    const emitJoinUser = () => {
      if (username) {
        try {
          socket.emit("joinUser", { username });
          logger.debug(`Emitted joinUser for: ${username}`);
        } catch (error) {
          logger.error("Failed to emit joinUser", error && error.message ? error.message : error);
        }
      }
    };

    socket.on("connect", () => {
      logger.debug("Socket connected, emitting joinUser");
      emitJoinUser();
    });

    if (socket.connected) {
      logger.debug("Socket already connected, emitting joinUser immediately");
      emitJoinUser();
    }

    logger.info("Socket initialized successfully");
    return socket;
  } catch (error) {
    logger.error("Failed to initialize socket", error && error.message ? error.message : error);
    return null;
  }
}

function disconnectSocket(socket) {
  try {
    if (socket && typeof socket.disconnect === "function") {
      socket.disconnect();
      logger.info("Socket disconnected");
    }
  } catch (error) {
    logger.debug("Failed to disconnect socket", error && error.message ? error.message : error);
  }
}

function getAvailableSocketEvents() {
  return [...SOCKET_EVENTS];
}

function joinResourceRoom(socket, resourceId) {
  if (socket && typeof socket.emit === "function") {
    socket.emit("joinResource", { resourceId });
    logger.debug(`Joined resource room: ${resourceId}`);
  }
}

function leaveResourceRoom(socket, resourceId) {
  if (socket && typeof socket.emit === "function") {
    socket.emit("leaveResource", { resourceId });
    logger.debug(`Left resource room: ${resourceId}`);
  }
}

export default {
  initializeSocket,
  disconnectSocket,
  getAvailableSocketEvents,
  joinResourceRoom,
  leaveResourceRoom,
};
