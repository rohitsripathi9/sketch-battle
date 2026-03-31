import './env.js';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import userRoutes from './routes/users.js';
import replayRoutes from './routes/replays.js';
import { setupSocketHandlers } from './handlers/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
const httpServer = createServer(app);

// ─── Middleware ───────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ─── REST Routes ─────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/users', userRoutes);
app.use('/api/replays', replayRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ─── Serve Frontend (production only) ────────────────────
if (isProduction) {
  const webDist = path.resolve(__dirname, '../../web/dist');
  app.use(express.static(webDist, { maxAge: '7d' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

// ─── Redis ───────────────────────────────────────────────
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
export const redis = new Redis(redisUrl);
export const redisSub = new Redis(redisUrl);

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', (err) => console.error('❌ Redis error:', err.message));
redisSub.on('connect', () => console.log('✅ Redis sub connected'));
redisSub.on('error', (err) => console.error('❌ Redis sub error:', err.message));

// ─── Socket.io ───────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 30000,
  },
});

// Redis adapter for multi-node scaling
io.adapter(createAdapter(redis, redisSub));

// Setup all socket handlers
setupSocketHandlers(io);

// ─── Start ───────────────────────────────────────────────
// ─── Global error handler ─────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

// ─── Start ───────────────────────────────────────────────
const PORT = process.env.SERVER_PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`\n🎮 SketchBattle Server running on port ${PORT}`);
  console.log(`   REST API: http://localhost:${PORT}/api`);
  console.log(`   WebSocket: ws://localhost:${PORT}\n`);
});

export { io };
