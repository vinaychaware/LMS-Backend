// server.js
import 'dotenv/config.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import serverless from 'serverless-http';

import { testConnection } from './config/prisma.js';
import { protect } from './middleware/auth.js';

// Routers
import uploadsRouter from './routes/upload.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import superAdminRouter from './routes/superadmin.js';
import adminRouter from './routes/admin.js';
import coursesRouter from './routes/courses.js';
import chapterRouter from './routes/chapter.js';
import enrollmentsRouter from './routes/enrollments.js';
import assessmentsRouter from './routes/assessments.js';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security & essentials
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  // IMPORTANT: set CORS_ORIGIN in Vercel env like: https://your-frontend.vercel.app,http://localhost:5173
  origin: (process.env.CORS_ORIGIN || '').split(',').filter(Boolean),
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// Optional: disable 304 caching while you debug
app.set('etag', false);
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Healthcheck
app.get('/health', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'development' });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);

app.use('/api/superadmin', protect, superAdminRouter);
app.use('/api/admin', protect, adminRouter);
app.use('/api/courses', protect, coursesRouter);
app.use('/uploads', express.static(path.resolve('uploads'))); // Ephemeral on Vercel; use S3/Cloudinary for real uploads
app.use('/api', uploadsRouter);
app.use('/api', protect, chapterRouter);
app.use('/api', protect, enrollmentsRouter);
app.use('/api/assessments', protect, assessmentsRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});

/**
 * Ensure DB connection once per cold start (safe for serverless).
 */
let _ready = false;
async function initOnce() {
  if (_ready) return;
  await testConnection();
  _ready = true;
}
// Run before handling any request
app.use(async (_req, _res, next) => {
  try { await initOnce(); next(); } catch (e) { next(e); }
});

// ---- Export for Vercel & run locally ----
const PORT = process.env.PORT || 4000;

// Always export a handler for Vercel
export default serverless(app);

// Only start a listener when running locally (not on Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running locally on http://localhost:${PORT}`);
  });
}
