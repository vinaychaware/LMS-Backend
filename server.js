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
import assessmentsRouter from './routes/assessments.js'; 
const app = express();


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


app.get('/health', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'development' });
});


app.use('/api/auth', authRouter);


app.use('/api/users', usersRouter);


app.use('/api/superadmin', protect, superAdminRouter);
app.use('/api/admin', protect, adminRouter);
app.use('/api/courses', protect, coursesRouter);


app.use('/api', protect, chapterRouter);
app.use('/api', protect, enrollmentsRouter);
app.use('/api/assessments', protect, assessmentsRouter);


app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});


app.use((err, _req, res, _next) => {
  console.error(err);
  res
    .status(err.status || 500)
    .json({ success: false, message: err.message || 'Internal Server Error' });
});


const PORT = process.env.PORT || 4000;

await testConnection(); 

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
