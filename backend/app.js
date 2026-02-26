import "dotenv/config";
import express from "express";
import logger from "./lib/logger.js";
import session from "express-session";
import expressMySQLSession from "express-mysql-session";
import { sessionOptions } from "./db/connection.js";
import cors from "cors";
import crypto from "crypto";
import { Server } from "socket.io";
import http from "http";
import authRouter from "./routers/users/authRouter.js";
import usersRouter from "./routers/users/usersRouter.js";
import usersUpdateRouter from "./routers/users/usersUpdateRouter.js";
import usersExportRouter from "./routers/users/usersExportRouter.js";
import bookingsRouter from "./routers/bookings/bookingsRouter.js";
import bookingsActionsRouter from "./routers/bookings/bookingsActionsRouter.js";
import resourcesRouter from "./routers/resources/resourcesRouter.js";
import typesRouter from "./routers/types/typesRouter.js";
import uploadsRouter from "./routers/uploads/uploadsRouter.js";
import carBrandsRouter from "./routers/carBrands/carBrandsRouter.js";
import { initializeSocket } from "./utils/socketUtils.js";
import csrfMiddleware from "./middleware/csrfMiddleware.js";

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;
const NODE_ENV = process.env.NODE_ENV || "development";

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  logger.error("Environment variable SESSION_SECRET is not set. Set SESSION_SECRET and restart the server.");
  process.exit(1);
}

if (!sessionOptions.host || !sessionOptions.user || !sessionOptions.database) {
  logger.error("Database configuration incomplete. Check MYSQL_HOST, MYSQL_USER, and MYSQL_DATABASE environment variables.");
  process.exit(1);
}

const app = express();

const MySQLStore = expressMySQLSession(session);
let sessionStore;

try {
  sessionStore = new MySQLStore(sessionOptions);
  logger.info("MySQL session store initialized successfully");
} catch (error) {
  logger.error(error, "Failed to initialize MySQL session store");
  if (NODE_ENV === "production") {
    logger.error("CRITICAL: Cannot start server in production without MySQL session store. Exiting.");
    process.exit(1);
  }
  logger.warn("Falling back to MemoryStore for development only. Sessions will NOT persist between restarts.");
  sessionStore = new session.MemoryStore();
}

app.use(express.json());

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  }),
);

app.use(
  session({
    store: sessionStore,
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

app.use(
  "/api",
  csrfMiddleware({
    exemptPaths: ["/auth/login", "/auth/register", "/auth/logout", "/users", "/csrf-token"],
  }),
);

app.get("/api/csrf-token", (req, res) => {
  try {
    if (!req.session) return res.status(500).json({ message: "Session not available" });
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(24).toString("hex");
    }
    return res.status(200).json({ csrfToken: req.session.csrfToken });
  } catch (error) {
    logger.error(error, "Could not generate CSRF token");
    return res.status(500).json({ message: "Could not generate CSRF token" });
  }
});

let io;

const dependencyInjector = (req, res, next) => {
  if (io) {
    req.io = io;
    req.sessionStore = sessionStore;
  }
  next();
};

app.use(dependencyInjector);

app.use(authRouter);
app.use(usersRouter);
app.use(usersUpdateRouter);
app.use(usersExportRouter);
app.use(bookingsRouter);
app.use(bookingsActionsRouter);
app.use(resourcesRouter);
app.use(typesRouter);
app.use(uploadsRouter);
app.use(carBrandsRouter);

app.use((req, res) => {
  logger.warn(`404 Not Found: ${req.method} ${req.path}`);
  return res.status(404).json({ message: "Endpoint not found" });
});

app.use((error, req, res, next) => {
  if (error && error.code === "EBADCSRFTOKEN") {
    logger.warn("Invalid CSRF token");
    return res.status(403).json({ message: "Invalid CSRF token" });
  }

  logger.error(error, `Unhandled error in ${req.method} ${req.path}`);

  const statusCode = error?.status || error?.statusCode || 500;
  const message = error?.message || "Internal server error";

  return res.status(statusCode).json({
    message: statusCode === 500 ? "Internal server error" : message,
  });
});

const server = http.createServer(app);
io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    credentials: true,
  },
});

initializeSocket(io, sessionStore, logger);

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  logger.info(
    { port: PORT, environment: NODE_ENV, store: NODE_ENV === "production" ? "MySQL" : "Memory" },
    "Backend API + WebSocket server started"
  );
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, gracefully shutting down...");
  server.close(() => {
    logger.info("Server closed");
    if (sessionStore && typeof sessionStore.close === "function") {
      sessionStore.close();
    }
    process.exit(0);
  });
});
