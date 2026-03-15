import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { config } from './config';
import { logger, morganStream } from './utils/logger';
import { errorHandler, notFound } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import complaintRoutes from './routes/complaints';
import mastersRoutes from './routes/masters';
import uploadRoutes from './routes/uploads';

const app = express();

// ── Security middleware ─────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Rate limiting ───────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.general.windowMs,
  max: config.rateLimit.general.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
});

const authLimiter = rateLimit({
  windowMs: config.rateLimit.auth.windowMs,
  max: config.rateLimit.auth.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later' },
});

app.use(generalLimiter);

// ── Body parsing ────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── HTTP logging ────────────────────────────────────────────────
app.use(morgan('combined', { stream: morganStream }));

// ── Static uploads ──────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', config.uploads.dir)));

// ── Health check ────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ──────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/complaints', uploadRoutes);
app.use('/api/masters', mastersRoutes);

// ── Serve React frontend in production ──────────────────────────
if (config.server.nodeEnv === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  // Catch-all: send index.html for any non-API route (React Router)
  app.get('/*path', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ── Error handling ──────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
