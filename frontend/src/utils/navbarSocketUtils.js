import logger from "../lib/logger.js";
import { pushNotification } from "../store/notificationsStore.js";
import notifier from "../lib/notifier.js";
import { apiFetch } from "../lib/api.js";
import { getCachedUser } from "../lib/auth.js";

function setupNavbarSocket(io, backendOrigin, userFullname, callbacks = {}) {
  const {
    onResourcesUpdate,
    onAvailabilityUpdate,
    onBookingChange,
    onDefectUpdate,
  } = callbacks;

  const socket = io(backendOrigin, { withCredentials: true });

  const emitJoinUser = () => {
    try {
      if (userFullname) {
        socket.emit("joinUser", { username: userFullname });
        logger.info(`[SOCKET] Emitted joinUser with fullname: ${userFullname}`);
      }
    } catch (error) {
      logger.error("Failed to emit joinUser", error?.message || error);
    }
  };

  emitJoinUser();

  socket.on("connect", () => {
    try {
      logger.info("Socket connected");
      emitJoinUser();
    } catch (error) {
      logger.error("Failed on socket connect", error?.message || error);
    }
  });

  socket.on("disconnect", () => {
    logger.warn("Socket disconnected");
  });

  socket.on("connect_error", (error) => {
    logger.error("Socket connection error", error);
  });

  socket.on("booking:created", (payload) => {
    try {
      logger.debug({ payload }, "Received booking:created");
      pushNotification({ type: "booking", navTo: "/myresources", ...payload });
      notifier.info("New booking request");
      onBookingChange?.();
    } catch (error) {
      logger.error("Failed to handle booking:created", error?.message || error);
    }
  });

  socket.on("booking:confirmed", (payload) => {
    try {
      logger.debug({ payload }, "Received booking:confirmed");
      pushNotification({ type: "booking:confirmed", navTo: "/mybookings", ...payload });
      notifier.success("A booking was confirmed");
      onBookingChange?.();
    } catch (error) {
      logger.error("Failed to handle booking:confirmed", error?.message || error);
    }
  });

  socket.on("booking:declined", (payload) => {
    try {
      logger.debug({ payload }, "Received booking:declined");
      pushNotification({ type: "booking:declined", navTo: "/mybookings", ...payload });
      notifier.error("A booking was declined");
      onBookingChange?.();
    } catch (error) {
      logger.error("Failed to handle booking:declined", error?.message || error);
    }
  });

  socket.on("bookings:updated", () => {
    try {
      logger.info("Received bookings:updated - calling onBookingChange");
      onBookingChange?.();
    } catch (error) {
      logger.error("Failed to handle bookings:updated", error?.message || error);
    }
  });

  socket.on("resource:created", async () => {
    try {
      const cached = getCachedUser();
      const userId = cached?.id;
      if (userId) {
        const res = await apiFetch(`/api/users/${userId}/resources`);
        if (res.ok) {
          const resources = await res.json();
          onResourcesUpdate?.(resources);
        }
      }
      onBookingChange?.();
    } catch (error) {
      logger.error("Failed to handle resource:created", error?.message || error);
    }
  });

  socket.on("resource:deleted", async (data) => {
    try {
      logger.debug({ data }, "Received resource:deleted");
      if (data?.isDefect) {
        notifier.error(data.message || "A resource with your booking has been marked as defective");
      }
      const cached = getCachedUser();
      const userId = cached?.id;
      if (userId) {
        const res = await apiFetch(`/api/users/${userId}/resources`);
        if (res.ok) {
          const resources = await res.json();
          onResourcesUpdate?.(resources);
        }
      }
      onBookingChange?.();
    } catch (error) {
      logger.error("Failed to handle resource:deleted", error?.message || error);
    }
  });

  socket.on("availability:changed", async (payload) => {
    try {
      logger.debug({ payload }, "Received availability:changed");
      if (payload?.resourceId) {
        onAvailabilityUpdate?.(payload.resourceId);
      }
      onBookingChange?.();
    } catch (error) {
      logger.error("Failed to handle availability:changed", error?.message || error);
    }
  });

  socket.on("defect:reported", (data) => {
    try {
      logger.debug({ data }, "Received defect:reported");
      pushNotification({ type: "defect:reported", navTo: "/myresources", ...data });
      notifier.error(data?.message || "A defect was reported on one of your resources");
      onBookingChange?.();
    } catch (error) {
      logger.error("Failed to handle defect:reported", error?.message || error);
    }
  });

  socket.on("defect:marked-seen", (data) => {
    try {
      logger.info(`[SOCKET] Received defect:marked-seen - calling onDefectUpdate callback`, { data });
      onDefectUpdate?.();
    } catch (error) {
      logger.error("Failed to handle defect:marked-seen", error?.message || error);
    }
  });

  socket.on("defects:updated", (data) => {
    try {
      logger.debug({ data }, "Received defects:updated");
      onBookingChange?.();
    } catch (error) {
      logger.error("Failed to handle defects:updated", error?.message || error);
    }
  });

  return socket;
}

function disconnectSocket(socket) {
  try {
    if (socket && typeof socket.disconnect === "function") {
      socket.disconnect();
      logger.info("Socket disconnected");
    }
  } catch (error) {
    logger.debug("Failed to disconnect socket", error?.message || error);
  }
}

function joinResourceRoom(socket, resourceId) {
  if (socket && typeof socket.emit === "function") {
    socket.emit("joinResource", { resourceId });
    logger.debug(`Joined resource room: ${resourceId}`);
  }
}

export { setupNavbarSocket, disconnectSocket, joinResourceRoom };
