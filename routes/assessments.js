// routes/assessments.js
import express from 'express';
import { prisma } from '../config/prisma.js';

const router = express.Router();

const up = (s) => String(s || '').toUpperCase();
const isAdmin = (req) => ['ADMIN', 'SUPER_ADMIN'].includes(up(req.user?.role));


router.get('/', async (req, res) => {
  try {
    const { chapterId, courseId } = req.query;
    if (!chapterId && !courseId) {
      return res.status(400).json({ error: 'chapterId or courseId required' });
    }

    const where = chapterId
      ? { chapterId: String(chapterId), isPublished: true }
      : { courseId: String(courseId), isPublished: true };

    const rows = await prisma.assessment.findMany({
      where,
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        title: true,
        type: true,    
        scope: true,   
        timeLimitSeconds: true,
        maxAttempts: true,
        isPublished: true,
        order: true,
        chapterId: true,
        courseId: true,
      }
    });

    res.json(rows);
  } catch (e) {
    console.error('GET /assessments error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});


router.get('/:id', async (req, res) => {
  try {
    const a = await prisma.assessment.findUnique({
      where: { id: String(req.params.id) },
      include: {
        questions: {
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!a) return res.status(404).json({ error: 'Not found' });

  
    if (!a.isPublished && !isAdmin(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(a);
  } catch (e) {
    console.error('GET /assessments/:id error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});


router.post('/:id/attempts', async (req, res) => {
  try {
    const assessmentId = String(req.params.id);
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { questions: true },
    });
    if (!assessment) return res.status(404).json({ error: 'Not found' });
    if (!assessment.isPublished && !isAdmin(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const answers = req.body?.answers || {};
    let score = 0;
    let maxScore = 0;

    for (const q of assessment.questions) {
      const pts = typeof q.points === 'number' ? q.points : 1;
      maxScore += pts;

      const ans = answers[q.id];

      if (typeof q.correctOptionIndex === 'number') {
   
        if (Number(ans) === q.correctOptionIndex) score += pts;
        continue;
      }

      if (Array.isArray(q.correctOptionIndexes)) {
       
        const normalized = Array.isArray(ans) ? ans.map(Number).sort() : [];
        const correct = [...q.correctOptionIndexes].sort();
        if (
          normalized.length === correct.length &&
          normalized.every((v, i) => v === correct[i])
        ) {
          score += pts;
        }
        continue;
      }

  
    }

    const attempt = await prisma.assessmentAttempt.create({
      data: {
        assessmentId,
        studentId: userId,
        status: 'submitted',
        submittedAt: new Date(),
        score,
        maxScore,
        answers, 
      },
    });

    res.json({ attemptId: attempt.id, score, maxScore });
  } catch (e) {
    console.error('POST /assessments/:id/attempts error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;