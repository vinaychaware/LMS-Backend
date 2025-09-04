// server.js
import 'dotenv/config.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { testConnection } from './config/prisma.js';
import { protect } from './middleware/auth.js';

// Routers
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import superAdminRouter from './routes/superadmin.js';
import adminRouter from './routes/admin.js';
import coursesRouter from './routes/courses.js';
import chapterRouter from './routes/chapter.js';
import enrollmentsRouter from './routes/enrollments.js';
import assessmentsRouter from './routes/assessments.js'; // if you renamed to assessments, update import & mount

const app = express();

/* ---------- core middleware ---------- */
app.use(helmet());
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || '*').split(','),
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

/* ---------- health ---------- */
app.get('/health', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'development' });
});

/* ---------- public routes ---------- */
app.use('/api/auth', authRouter);

/* ---------- protected routes ---------- */
// users.js already calls `router.use(protect)` internally; mount as-is:
app.use('/api/users', usersRouter);

// Everything below expects req.user to be set; guard at the mount:
app.use('/api/superadmin', protect, superAdminRouter);
app.use('/api/admin', protect, adminRouter);
app.use('/api/courses', protect, coursesRouter);

// chapter/enrollments/assignments routers contain mixed paths like
// /courses/:courseId/chapters, /chapters/:id, /courses/:courseId/enrollments, etc.
// Mount them under /api with protect so all declared paths work:
app.use('/api', protect, chapterRouter);
app.use('/api', protect, enrollmentsRouter);
app.use('/api/assessments', protect, assessmentsRouter);

/* ---------- 404 ---------- */
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

/* ---------- error handler ---------- */
app.use((err, _req, res, _next) => {
  console.error(err);
  res
    .status(err.status || 500)
    .json({ success: false, message: err.message || 'Internal Server Error' });
});

/* ---------- start ---------- */
const PORT = process.env.PORT || 4000;

await testConnection(); // fail fast if DB is down

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
