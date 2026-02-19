import "dotenv/config";
import express from "express";
import logger from "./lib/logger.js";
import session from "express-session";
import expressMySQLSession from "express-mysql-session";
import cors from "cors";
import crypto from "crypto";
import { Server } from "socket.io";
import http from "http";
import authRoutes from "./routers/users/authRoutes.js";
import bookingRoutes from "./routers/bookings/bookingRoutes.js";
import resourceRoutes from "./routers/resources/resourceRoutes.js";
import typeRoutes from "./routers/types/typeRoutes.js";
import uploadRoutes from "./routers/uploads/uploadRoutes.js";
import initializeSocket from "./lib/socket.js";

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

const app = express();

const sessionOptions = {
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
};

const MySQLStore = expressMySQLSession(session);
const sessionStore = new MySQLStore(sessionOptions);
global.sessionStore = sessionStore;

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

const csrfExemptPaths = ["/login", "/users", "/csrf-token"];
function csrfMiddleware(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  if (csrfExemptPaths.includes(req.path)) return next();

  const headerToken = req.get("x-csrf-token") || req.get("x-xsrf-token");
  const bodyToken = req.body && (req.body._csrf || req.body.csrfToken);
  const token = headerToken || bodyToken;

  if (!req.session) return res.status(403).json({ message: "Missing session for CSRF validation" });
  if (!req.session.csrfToken)
    return res.status(403).json({ message: "Missing CSRF token in session" });
  if (!token || token !== req.session.csrfToken)
    return res.status(403).json({ message: "Invalid CSRF token" });
  return next();
}

app.use("/api", csrfMiddleware);

app.get("/api/csrf-token", (req, res) => {
  try {
    if (!req.session) return res.status(500).json({ message: "Session not available" });
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(24).toString("hex");
    }
    return res.status(200).json({ csrfToken: req.session.csrfToken });
  } catch (error) {
    return res.status(500).json({ message: "Could not generate CSRF token" });
  }
});

app.use(authRoutes);
app.use(bookingRoutes);
app.use(resourceRoutes);
app.use(typeRoutes);
app.use(uploadRoutes);

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
