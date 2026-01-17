import 'dotenv/config'
import express from 'express';
import logger from './lib/logger.js';
import session from 'express-session';
import expressMySQLSession from 'express-mysql-session';
import cors from 'cors';
import { Server } from 'socket.io'
import http from 'http';
import authRoutes from './routers/users/authRoutes.js';
import bookingRoutes from './routers/bookings/bookingRoutes.js';
import resourceRoutes from './routers/resources/resourceRoutes.js';
import typesRoutes from './routers/types/typesRoutes.js';
import uploadRoutes from './routers/uploads/uploadRoutes.js';
import authMiddleware from './middleware/authMiddleware.js';

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

const app = express();

const sessionOptions = {
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
};

const MySQLStore = expressMySQLSession(session);
const sessionStore = new MySQLStore(sessionOptions);
global.sessionStore = sessionStore;

app.use(express.json())

app.use(cors({
    origin: FRONTEND_ORIGIN,
    credentials: true
}));

app.use(
    session({
        store: sessionStore,
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false }
    })
);

app.use(authRoutes);
app.use(bookingRoutes);
app.use(resourceRoutes);
app.use(typesRoutes);
app.use(uploadRoutes);

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: FRONTEND_ORIGIN,
        credentials: true
    }
});

global.io = io;

io.on('connection', (socket) => {
    logger.info('Socket connected', socket.id);

    socket.on('joinResource', (payload) => {
        try {
            const id = payload && payload.resourceId ? String(payload.resourceId) : null;
            if (id) {
                socket.join(`resource:${id}`);
                logger.info(`Socket ${socket.id} joined resource:${id}`);
            }
        } catch (error) {
            logger.warn('joinResource handler error', error && error.message ? error.message : error);
        }
    });

    socket.on('leaveResource', (payload) => {
        try {
            const id = payload && payload.resourceId ? String(payload.resourceId) : null;
            if (id) {
                socket.leave(`resource:${id}`);
                logger.info(`Socket ${socket.id} left resource:${id}`);
            }
        } catch (error) {
            logger.warn('leaveResource handler error', error && error.message ? error.message : error);
        }
    });

    socket.on('disconnect', (reason) => {
        logger.info('Socket disconnected', socket.id, reason);
    });
});

const PORT = 8080;

server.listen(PORT, () => {
    logger.info({ port: PORT }, `Backend API + WebSocket server running on port ${PORT}`);
});