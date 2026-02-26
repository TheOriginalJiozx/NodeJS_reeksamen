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
            logger.debug("Session store get error", error && error.message ? error.message : error);
          }
          return resolve(null);
        }
        resolve(session);
      });
    });
  } catch (error) {
    if (logger && typeof logger.debug === "function") logger.debug("getSessionByCookieHeader error", error && error.message ? error.message : error);
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
          logger.debug("Socket disconnect error", error && error.message ? error.message : error);
        }
        return;
      }

      socket.data = socket.data || {};
      socket.data.user = username;
    })();

    socket.on("joinResource", async (payload) => {
      try {
        const id = payload && payload.resourceId ? String(payload.resourceId) : null;
        if (!id) return;
        const cookieHeader = socket.handshake && socket.handshake.headers ? socket.handshake.headers.cookie : "";
        const session = await getSessionByCookieHeader(cookieHeader, sessionStore, logger);
        const username = session && session.user ? session.user.username : null;
        if (!username) {
          logger.warn(`Unauthorized socket join attempt ${socket.id}`);
          return;
        }
        socket.join(`resource:${id}`);
        socket.data = socket.data || {};
        socket.data.user = username;
        logger.info(`Socket ${socket.id} (${username}) joined resource:${id}`);
      } catch (error) {
        logger.warn("joinResource handler error", error && error.message ? error.message : error);
      }
    });

    socket.on("joinUser", async (payload) => {
      try {
        const usernameParameter = payload && payload.username ? String(payload.username) : null;
        if (!usernameParameter) return;
        const cookieHeader = socket.handshake && socket.handshake.headers ? socket.handshake.headers.cookie : "";
        const session = await getSessionByCookieHeader(cookieHeader, sessionStore, logger);
        const username = session && session.user ? session.user.username : null;
        const fullname = session && session.user ? session.user.fullname : null;
        if (!username) {
          logger.warn(`Unauthorized socket joinUser attempt ${socket.id}`);
          return;
        }

        if (String(username) !== String(usernameParameter) && String(fullname) !== String(usernameParameter)) {
          logger.warn(`Socket ${socket.id} attempted to join user room for different user (${usernameParameter})`);
          return;
        }
        socket.join(`user:${usernameParameter}`);
        socket.data = socket.data || {};
        socket.data.user = username;
        logger.info(`Socket ${socket.id} (${username}) joined user:${usernameParameter}`);
      } catch (error) {
        logger.warn("joinUser handler error", error && error.message ? error.message : error);
      }
    });

    socket.on("leaveUser", async (payload) => {
      try {
        const usernameParam = payload && payload.username ? String(payload.username) : null;
        if (!usernameParam) return;
        const cookieHeader = socket.handshake && socket.handshake.headers ? socket.handshake.headers.cookie : "";
        const session = await getSessionByCookieHeader(cookieHeader, sessionStore, logger);
        const username = session && session.user ? session.user.username : null;
        const fullname = session && session.user ? session.user.fullname : null;
        if (!username) {
          logger.warn(`Unauthorized socket leaveUser attempt ${socket.id}`);
          return;
        }

        if (String(username) !== String(usernameParam) && String(fullname) !== String(usernameParam)) return;
        socket.leave(`user:${usernameParam}`);
        logger.info(`Socket ${socket.id} (${username}) left user:${usernameParam}`);
      } catch (error) {
        logger.warn("leaveUser handler error", error && error.message ? error.message : error);
      }
    });

    socket.on("leaveResource", async (payload) => {
      try {
        const id = payload && payload.resourceId ? String(payload.resourceId) : null;
        if (!id) return;
        const cookieHeader = socket.handshake && socket.handshake.headers ? socket.handshake.headers.cookie : "";
        const session = await getSessionByCookieHeader(cookieHeader, sessionStore, logger);
        const username = session && session.user ? session.user.username : null;
        if (!username) {
          logger.warn(`Unauthorized socket leave attempt ${socket.id}`);
          return;
        }
        socket.leave(`resource:${id}`);
        logger.info(`Socket ${socket.id} (${username}) left resource:${id}`);
      } catch (error) {
        logger.warn("leaveResource handler error", error && error.message ? error.message : error);
      }
    });

    socket.on("disconnect", (reason) => {
      logger.info("Socket disconnected", socket.id, reason);
    });
  });
}

export { extractSessionIdFromCookie, getSessionByCookieHeader, initializeSocket };
