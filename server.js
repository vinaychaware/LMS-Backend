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

const ALLOWED_ORIGINS = [
  "http://localhost:5173",        // dev Vite
  "http://localhost:3000",        // dev Next
  "https://lms-vhfz.vercel.app",  // your prod frontend
];


app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: false,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Cache-Control",
    "Pragma",
    "Expires",
    "Accept",
    "X-Requested-With"
  ],
  exposedHeaders: [],           
  optionsSuccessStatus: 204
}));


app.options("*", cors({
  origin: ALLOWED_ORIGINS,
  credentials: false,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Cache-Control",
    "Pragma",
    "Expires",
    "Accept",
    "X-Requested-With"
  ],
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security & essentials
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const origins = (process.env.CORS_ORIGIN || '').split(',').filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true, credentials: true }));

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
app.use('/uploads', express.static(path.resolve('uploads'))); 
app.use('/api', uploadsRouter);
app.use('/api', protect, chapterRouter);
app.use("/api", protect, enrollmentsRouter);
app.use('/api/assessments', protect, assessmentsRouter);


app.get('/diag/env', (_req, res) => {
  res.json({
    node: process.version,
    vercel: !!process.env.VERCEL,
    hasDB: !!process.env.DATABASE_URL,
    hasJWT: !!process.env.JWT_SECRET,
    corsOrigin: process.env.CORS_ORIGIN || null
  });
});

app.get('/diag/db', async (_req, res, next) => {
  try { await testConnection(); res.json({ db: 'ok' }); }
  catch (e) { next(e); }
});


let _ready = false;
async function initOnce() {
  if (_ready) return;
  await testConnection();
  _ready = true;
}

app.use(async (_req, _res, next) => {
  try { await initOnce(); next(); } catch (e) { next(e); }
});


const PORT = process.env.PORT || 5000;


export default serverless(app);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running locally on http://localhost:${PORT}`);
  });
}
