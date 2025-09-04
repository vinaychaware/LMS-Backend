// routes/assessments.js
import express from 'express';
import { prisma } from '../config/prisma.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const up = (s) => String(s || '').toUpperCase();

/* ---------- permissions ---------- */
function requireTestCreator(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const role = up(req.user.role);
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return next();
  if (role === 'INSTRUCTOR' && req.user?.permissions?.canCreateTests) return next();
  return res.status(403).json({ success: false, message: 'Not allowed to create or edit tests' });
}

/* ---------- question helpers ---------- */
function validateQuestions(questions = []) {
  if (!Array.isArray(questions) || questions.length === 0) return 'questions array is required';
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i] || {};
    // Accept prompt or text from client, but we must have at least one
    const prompt = (q.prompt ?? q.text ?? '').trim();
    if (!prompt) return `questions[${i}].prompt (or text) is required`;
    if (!q.type || typeof q.type !== 'string') return `questions[${i}].type is required`;
    if (q.options && !Array.isArray(q.options)) return `questions[${i}].options must be an array`;
    if (q.correctOptionIndex !== undefined && typeof q.correctOptionIndex !== 'number') {
      return `questions[${i}].correctOptionIndex must be a number`;
    }
  }
  return null;
}

function mapQuestionToDB(q, idx) {
  return {
    // Prisma requires `prompt` – map from prompt or text
    prompt: (q.prompt ?? q.text)?.toString() ?? '',
    type: up(q.type),
    options: Array.isArray(q.options) ? q.options : [],
    correctOptionIndex: typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : null,
    points: typeof q.points === 'number' ? q.points : 1,
    order: typeof q.order === 'number' ? q.order : (idx + 1),
    // If your schema has more fields (e.g., explanation), map them here:
    // explanation: q.explanation ?? null,
  };
}

/* ---------- all routes here are auth-protected ---------- */
router.use(protect);

/**
 * GET /api/assessments/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: 'asc' } },
      },
    });

    if (!assessment) return res.status(404).json({ success: false, message: 'Assessment not found' });
    res.json({ success: true, data: { assessment } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/assessments
 * Body:
 * {
 *   title, type: "QUIZ"|"FINAL", courseId, chapterId?, timeLimitSeconds?,
 *   isPublished?, maxAttempts?, order?,
 *   questions: [{ prompt|text, type, options?, correctOptionIndex?, points?, order? }, ...]
 * }
 */
router.post('/', requireTestCreator, async (req, res, next) => {
  try {
    const {
      title,
      type,
      courseId,
      chapterId,
      timeLimit,
      timeLimitSeconds,
      isPublished,
      maxAttempts,
      order,
      questions = [],
    } = req.body || {};

    if (!title) return res.status(400).json({ success: false, message: 'title is required' });
    const T = up(type);
    if (!['QUIZ', 'FINAL'].includes(T)) return res.status(400).json({ success: false, message: 'type must be QUIZ or FINAL' });
    if (!courseId) return res.status(400).json({ success: false, message: 'courseId is required' });
    if (T === 'QUIZ' && !chapterId) return res.status(400).json({ success: false, message: 'chapterId is required for QUIZ' });

    // existence checks
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(400).json({ success: false, message: 'Invalid courseId' });

    if (T === 'QUIZ') {
      const ch = await prisma.chapter.findUnique({ where: { id: chapterId } });
      if (!ch || ch.courseId !== courseId) {
        return res.status(400).json({ success: false, message: 'Invalid chapterId for this course' });
      }
    }

    const qErr = validateQuestions(questions);
    if (qErr) return res.status(400).json({ success: false, message: qErr });

    const result = await prisma.$transaction(async (tx) => {
      const assessment = await tx.assessment.create({
        data: {
          title,
          type: T,
          courseId,
          chapterId: T === 'QUIZ' ? chapterId : null,
          timeLimitSeconds: (timeLimitSeconds ?? timeLimit) ?? null,
          // optional fields if present in your schema:
          // scope: T === 'FINAL' ? 'COURSE' : 'CHAPTER',
          isPublished: typeof isPublished === 'boolean' ? isPublished : undefined,
          maxAttempts: typeof maxAttempts === 'number' ? maxAttempts : undefined,
          order: typeof order === 'number' ? order : undefined,
        },
      });

      if (questions.length > 0) {
        await tx.assessmentQuestion.createMany({
          data: questions.map((q, idx) => ({
            assessmentId: assessment.id,
            ...mapQuestionToDB(q, idx),
          })),
          skipDuplicates: true,
        });
      }

      return tx.assessment.findUnique({
        where: { id: assessment.id },
        include: { questions: { orderBy: { order: 'asc' } } },
      });
    });

    res.status(201).json({ success: true, message: 'Assessment created', data: { assessment: result } });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/assessments/:id
 * Body (any subset): { title?, type?, chapterId?, timeLimitSeconds?, isPublished?, maxAttempts?, order? }
 */
router.put('/:id', requireTestCreator, async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      type,
      chapterId,
      timeLimit,
      timeLimitSeconds,
      isPublished,
      maxAttempts,
      order,
      scope,
    } = req.body || {};

    const data = {};
    if (title !== undefined) data.title = title;
    if (type !== undefined) {
      const T = up(type);
      if (!['QUIZ', 'FINAL'].includes(T)) return res.status(400).json({ success: false, message: 'type must be QUIZ or FINAL' });
      data.type = T;
      // if you want to auto-set scope:
      // data.scope = T === 'FINAL' ? 'COURSE' : 'CHAPTER';
    }
    if (chapterId !== undefined) data.chapterId = chapterId;
    if (timeLimit !== undefined || timeLimitSeconds !== undefined) {
      data.timeLimitSeconds = (timeLimitSeconds ?? timeLimit) ?? null;
    }
    if (isPublished !== undefined) data.isPublished = !!isPublished;
    if (maxAttempts !== undefined) data.maxAttempts = Number(maxAttempts);
    if (order !== undefined) data.order = Number(order);
    if (scope !== undefined) data.scope = scope;

    const updated = await prisma.assessment.update({
      where: { id },
      data,
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    res.json({ success: true, message: 'Assessment updated', data: { assessment: updated } });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/assessments/:id/questions
 * Body: { questions: [...] }  (uses prompt|text mapping)
 */
router.put('/:id/questions', requireTestCreator, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { questions = [] } = req.body || {};

    const qErr = validateQuestions(questions);
    if (qErr) return res.status(400).json({ success: false, message: qErr });

    const updated = await prisma.$transaction(async (tx) => {
      const assess = await tx.assessment.findUnique({ where: { id } });
      if (!assess) throw Object.assign(new Error('Assessment not found'), { status: 404 });

      await tx.assessmentQuestion.deleteMany({ where: { assessmentId: id } });

      await tx.assessmentQuestion.createMany({
        data: questions.map((q, idx) => ({
          assessmentId: id,
          ...mapQuestionToDB(q, idx),
        })),
        skipDuplicates: true,
      });

      return tx.assessment.findUnique({
        where: { id },
        include: { questions: { orderBy: { order: 'asc' } } },
      });
    });

    res.json({ success: true, message: 'Questions replaced', data: { assessment: updated } });
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ success: false, message: err.message });
    next(err);
  }
});

/**
 * DELETE /api/assessments/:id
 */
router.delete('/:id', requireTestCreator, async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.$transaction(async (tx) => {
      await tx.assessmentQuestion.deleteMany({ where: { assessmentId: id } });
      await tx.assessment.delete({ where: { id } });
    });

    res.json({ success: true, message: 'Assessment deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
