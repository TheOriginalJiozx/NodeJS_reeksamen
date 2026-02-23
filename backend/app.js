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
import usersExportRouter from "./routers/users/usersExportRouter.js";
import bookingsRouter from "./routers/bookings/bookingsRouter.js";
import bookingsActionsRouter from "./routers/bookings/bookingsActionsRouter.js";
import resourcesRouter from "./routers/resources/resourcesRouter.js";
import typesRouter from "./routers/types/typesRouter.js";
import uploadsRouter from "./routers/uploads/uploadsRouter.js";
import initializeSocket from "./lib/socket.js";
import csrfMiddleware from "./middleware/csrfMiddleware.js";

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

const app = express();

const MySQLStore = expressMySQLSession(session);
let sessionStore;
try {
  sessionStore = new MySQLStore(sessionOptions);
  global.sessionStore = sessionStore;
} catch (error) {
  logger.warn("Could not initialize MySQL session store, falling back to MemoryStore:", error.message);
  sessionStore = new session.MemoryStore();
  global.sessionStore = sessionStore;
}

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  logger.error("Environment variable SESSION_SECRET is not set. Set SESSION_SECRET and restart the server.");
  process.exit(1);
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
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
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

app.use(authRouter);
app.use(usersRouter);
app.use(usersExportRouter);
app.use(bookingsRouter);
app.use(bookingsActionsRouter);
app.use(resourcesRouter);
app.use(typesRouter);
app.use(uploadsRouter);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    credentials: true,
  },
});

global.io = io;

initializeSocket(io, sessionStore, logger);

const PORT = 8080;

server.listen(PORT, () => {
  logger.info({ port: PORT }, `Backend API + WebSocket server running on port ${PORT}`);
});

app.use((error, req, res, next) => {
  if (error && error.code === "EBADCSRFTOKEN") {
    logger.warn("Invalid CSRF token");
    return res.status(403).json({ message: "Invalid CSRF token" });
  }
  next(error);
});
