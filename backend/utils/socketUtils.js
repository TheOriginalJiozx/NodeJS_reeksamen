function extractSessionIdFromCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/connect\.sid=([^;]+)/);
  if (!match) return null;
  let raw = decodeURIComponent(match[1]);
  if (raw.startsWith("s:")) {
    const dot = raw.indexOf(".");
    return dot !== -1 ? raw.slice(2, dot) : raw.slice(2);
  }
  return raw;
}

const activeUserSockets = new Map();

async function getSessionByCookieHeader(cookieHeader, sessionStore, logger) {
  try {
    const sessionId = extractSessionIdFromCookie(cookieHeader);
    if (!sessionId) return null;
    const store = sessionStore;
    if (!store || typeof store.get !== "function") return null;
    return await new Promise((resolve) => {
      store.get(sessionId, (error, session) => {
        if (error) {
          if (logger && typeof logger.debug === "function") {
            logger.debug("Session store get error", error?.message || error);
          }
          return resolve(null);
        }
        resolve(session);
      });
    });
  } catch (error) {
    if (logger && typeof logger.debug === "function") logger.debug("getSessionByCookieHeader error", error?.message || error);
    return null;
  }
}

function initializeSocket(io, sessionStore, logger) {
  io.on("connection", (socket) => {
    logger.info("Socket connected", socket.id);

    (async () => {
      const cookieHeader = socket.handshake && socket.handshake.headers ? socket.handshake.headers.cookie : "";
      const session = await getSessionByCookieHeader(cookieHeader, sessionStore, logger);
      const username = session && session.user ? session.user.username : null;
      if (!username) {
        logger.warn(`Disconnecting unauthenticated socket ${socket.id}`);
        try {
          socket.disconnect(true);
        } catch (error) {
          logger.debug("Socket disconnect error", error?.message || error);
        }
        return;
      }

      socket.data = socket.data || {};
      socket.data.user = username;
    })();

    socket.on("joinResource", async (payload) => {
      try {
        const id = payload?.resourceId ? String(payload.resourceId) : null;
        if (!id) return;
        const cookieHeader = socket.handshake?.headers?.cookie ?? "";
        const session = await getSessionByCookieHeader(cookieHeader, sessionStore, logger);
        const username = session?.user?.username ?? null;
        if (!username) {
          logger.warn(`Unauthorized socket join attempt ${socket.id}`);
          return;
        }
        socket.join(`resource:${id}`);
        socket.data = socket.data || {};
        socket.data.user = username;
        logger.info(`Socket ${socket.id} (${username}) joined resource:${id}`);
      } catch (error) {
        logger.warn("joinResource handler error", error?.message || error);
      }
    });

    socket.on("joinUser", async (payload) => {
      try {
        const usernameParameter = payload?.username ? String(payload.username).trim().toLowerCase() : null;
        if (!usernameParameter) {
          logger.warn(`[SOCKET] joinUser - empty username parameter`);
          return;
        }
        logger.info(`[SOCKET] joinUser request for: ${usernameParameter} (payload: ${payload.username})`);
        
        const cookieHeader = socket.handshake?.headers?.cookie ?? "";
        const session = await getSessionByCookieHeader(cookieHeader, sessionStore, logger);
        const username = session?.user?.username ?? null;
        const fullname = session?.user?.fullname ?? null;
        
        logger.debug(`[SOCKET] Session user - username: ${username}, fullname: ${fullname}`);
        
        if (!username) {
          logger.warn(`Unauthorized socket joinUser attempt ${socket.id}`);
          return;
        }

        const normalizedUsername = String(username).trim().toLowerCase();
        const normalizedFullname = fullname ? String(fullname).trim().toLowerCase() : null;
        
        logger.debug(`[SOCKET] Checking: normalized=${normalizedUsername}, fullname=${normalizedFullname}, param=${usernameParameter}`);
        
        if (normalizedUsername !== usernameParameter && normalizedFullname !== usernameParameter) {
          logger.warn(`Socket ${socket.id} attempted to join user room for different user (${usernameParameter})`);
          return;
        }
        
        const previousSocket = activeUserSockets.get(usernameParameter);
        if (previousSocket && previousSocket.id !== socket.id) {
          logger.info(`[SOCKET] Disconnecting previous socket ${previousSocket.id} for user ${usernameParameter}`);
          previousSocket.disconnect(true);
        }
        
        socket.join(`user:${usernameParameter}`);
        socket.data = socket.data || {};
        socket.data.user = username;
        
        activeUserSockets.set(usernameParameter, socket);
        
        logger.info(`[SOCKET] Socket ${socket.id} (${username}/${fullname}) joined user:${usernameParameter}`);
      } catch (error) {
        logger.warn("joinUser handler error", error?.message || error);
      }
    });

    socket.on("leaveUser", async (payload) => {
      try {
        const usernameParam = payload?.username ? String(payload.username).trim().toLowerCase() : null;
        if (!usernameParam) return;
        const cookieHeader = socket.handshake?.headers?.cookie ?? "";
        const session = await getSessionByCookieHeader(cookieHeader, sessionStore, logger);
        const username = session?.user?.username ?? null;
        const fullname = session?.user?.fullname ?? null;
        if (!username) {
          logger.warn(`Unauthorized socket leaveUser attempt ${socket.id}`);
          return;
        }

        const normalizedUsername = String(username).trim().toLowerCase();
        const normalizedFullname = fullname ? String(fullname).trim().toLowerCase() : null;
        if (normalizedUsername !== usernameParam && normalizedFullname !== usernameParam) return;
        socket.leave(`user:${usernameParam}`);
        logger.info(`Socket ${socket.id} (${username}) left user:${usernameParam}`);
      } catch (error) {
        logger.warn("leaveUser handler error", error?.message || error);
      }
    });

    socket.on("leaveResource", async (payload) => {
      try {
        const id = payload?.resourceId ? String(payload.resourceId) : null;
        if (!id) return;
        const cookieHeader = socket.handshake?.headers?.cookie ?? "";
        const session = await getSessionByCookieHeader(cookieHeader, sessionStore, logger);
        const username = session?.user?.username ?? null;
        if (!username) {
          logger.warn(`Unauthorized socket leave attempt ${socket.id}`);
          return;
        }
        socket.leave(`resource:${id}`);
        logger.info(`Socket ${socket.id} (${username}) left resource:${id}`);
      } catch (error) {
        logger.warn("leaveResource handler error", error?.message || error);
      }
    });

    socket.on("disconnect", (reason) => {
      for (const [key, storedSocket] of activeUserSockets.entries()) {
        if (storedSocket.id === socket.id) {
          activeUserSockets.delete(key);
          logger.info(`[SOCKET] Cleaned up socket ${socket.id} for user ${key}`);
          break;
        }
      }
      logger.info("Socket disconnected", socket.id, reason);
    });
  });
}

export { initializeSocket };
