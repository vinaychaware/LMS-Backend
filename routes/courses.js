// routes/courses.js
import express from "express";
import { prisma } from "../config/prisma.js";  
const router = express.Router();

// ---------- helpers & guards ----------
const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_')

function requireAdminOrAllowedInstructor(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  const r = norm(req.user.role)
  if (r === 'SUPER_ADMIN' || r === 'ADMIN') return next()
  if (r === 'INSTRUCTOR' && req.user.permissions?.canCreateCourses) return next()
  return res.status(403).json({ error: 'Forbidden' })
}


// simple per-course slug maker that avoids (courseId, slug) unique conflicts
async function uniqueChapterSlug(tx, courseId, base, attempt = 0) {
  const baseSlug = String(base || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 250) || "chapter";

  const slug = attempt ? `${baseSlug}-${attempt}` : baseSlug;
  const exists = await tx.chapter.findFirst({ where: { courseId, slug }, select: { id: true } });
  if (!exists) return slug;
  return uniqueChapterSlug(tx, courseId, baseSlug, attempt + 1);
}




// router.get("/", async (_req, res) => {
//   const rows = await prisma.course.findMany({
//     include: {
//       enrollments: true,
//       instructors: { include: { instructor: { select: { fullName: true } } } },
//     },
//   });
//   res.json(
//     rows.map((c) => ({
//       id: c.id,
//       title: c.title,
//       thumbnail: c.thumbnail,
//       status: c.status,
//       studentCount: c.enrollments.length,
//       instructorNames: c.instructors.map((i) => i.instructor.fullName),
//     })),
//   );
// });

// List courses (backwards-compatible for Super Admin) + optional filters:
//   ?instructorId=<id>   -> courses taught by instructor
//   ?studentId=<id>      -> courses where student is enrolled
//   ?ids=c1,c2,c3        -> only these ids
router.get("/", async (req, res) => {
  const { instructorId, studentId, ids } = req.query || {};

  // base where
  const where = {};

  // filter by explicit ids, if provided
  if (ids) {
    const list = String(ids)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (list.length) where.id = { in: list };
  }

  // filter by instructor via join table (courseInstructor)
  if (instructorId) {
    where.instructors = { some: { instructorId: String(instructorId) } };
  }

  try {
    let courses;

    if (studentId) {
      // limit to courses the student is enrolled in, then intersect other filters
      const enrolls = await prisma.enrollment.findMany({
        where: { studentId: String(studentId) },
        select: { courseId: true },
      });
      const courseIds = enrolls.map((e) => e.courseId);
      if (!courseIds.length) return res.json([]);

      const whereWithStudent = {
        ...where,
        id: where.id
          ? { in: courseIds.filter((id) => where.id.in?.includes(id)) }
          : { in: courseIds },
      };

      courses = await prisma.course.findMany({
        where: whereWithStudent,
        include: {
          enrollments: true,
          instructors: { include: { instructor: { select: { fullName: true } } } },
        },
        orderBy: { updatedAt: "desc" },
      });
    } else {
      // default (Super Admin view) or instructorId/ids filtering only
      courses = await prisma.course.findMany({
        where,
        include: {
          enrollments: true,
          instructors: { include: { instructor: { select: { fullName: true } } } },
        },
        orderBy: { updatedAt: "desc" },
      });
    }

    // ⬇︎ Keep the exact fields Super Admin already uses
    res.json(
      courses.map((c) => ({
        id: c.id,
        title: c.title,
        thumbnail: c.thumbnail,
        status: c.status,
        studentCount: c.enrollments.length,
        instructorNames: c.instructors.map((i) => i.instructor.fullName),

        // (extra fields below are additive/safe if other pages want them)
        // category: c.category || "—",
        // level: c.level || "—",
        // estimatedDuration: c.estimatedDuration || "—",
        // updatedAt: c.updatedAt,
        // totalModules: c.totalModules ?? 0,
        // totalChapters: c.totalChapters ?? 0,
      })),
    );
  } catch (e) {
    console.error("GET /api/courses error:", e);
    res.status(500).json({ error: "Internal error" });
  }
});



router.post("/", requireAdminOrAllowedInstructor, async (req, res) => {
  const { title, thumbnail, status = "draft", managerId } = req.body || {};
  const creatorId = req.user.id;
  if (!title) return res.status(400).json({ error: "title required" });

  const created = await prisma.course.create({
    data: { title, thumbnail, status, creatorId, managerId },
  });
  res.json({ id: created.id });
});

// Update course (admin/SA)
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const updated = await prisma.course.update({ where: { id }, data: req.body || {} });
  res.json({ id: updated.id });
});

// Replace instructors set
router.post("/:id/instructors", async (req, res) => {
  const { id } = req.params;
  const { instructorIds = [] } = req.body || {};
  await prisma.courseInstructor.deleteMany({ where: { courseId: id } });
  if (instructorIds.length) {
    await prisma.courseInstructor.createMany({
      data: instructorIds.map((x) => ({ courseId: id, instructorId: x })),
      skipDuplicates: true,
    });
  }
  res.json({ ok: true, count: instructorIds.length });
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const c = await prisma.course.findUnique({
      where: { id },
      include: {
        enrollments: true,
        instructors: {
          include: { instructor: { select: { fullName: true } } }
        },
      },
    })
    if (!c) return res.status(404).json({ error: 'Not found' })
    res.json({
      id: c.id,
      title: c.title,
      thumbnail: c.thumbnail,
      status: c.status,
      studentCount: c.enrollments.length,
      instructorNames: c.instructors.map(i => i.instructor.fullName),
      createdAt: c.createdAt,
    })
  } catch (e) {
    console.error('GET /api/courses/:id error:', e)
    res.status(500).json({ error: 'Internal error' })
  }
})


// ---------- NEW: create full course with chapters & quizzes ----------
/**
 * POST /api/courses/full
 * Body:
 * {
 *   course: { title, thumbnail?, status?, managerId? },
 *   lessons: [
 *     // Text chapter
 *     { type: 'text', title, content? },
 *     // Quiz chapter
 *     {
 *       type: 'test',
 *       title?: (ignored; backend uses quizTitle as chapter title),
 *       quizTitle: string,
 *       quizDurationMinutes: number,            // minutes -> timeLimitSeconds
 *       questions: [
 *         // single/multiple
 *         { type: 'single'|'multiple', text, options: [{text, correct}, ...] }
 *         // numerical
 *         { type: 'numerical', text, correctText: string }
 *         // match
 *         { type: 'match', text, pairs: [{left, right}, ...] }
 *         // subjective
 *         { type: 'subjective', text, sampleAnswer?: string }
 *       ]
 *     }
 *   ]
 * }
 */
router.post("/full", requireAdminOrAllowedInstructor, async (req, res) => {
  const { course = {}, lessons = [] } = req.body || {};
  if (!course?.title?.trim()) return res.status(400).json({ error: "course.title required" });

  try {
    const createdCourse = await prisma.$transaction(async (tx) => {
      // 1) Create course
      const courseRow = await tx.course.create({
        data: {
          title: course.title.trim(),
          thumbnail: course.thumbnail || null,
          status: course.status || "draft",
          creatorId: req.user.id,
          managerId: course.managerId || null,
        },
      });

      // 2) Chapters (+ optional assessments)
      for (let idx = 0; idx < lessons.length; idx++) {
        const L = lessons[idx] || {};
        const isQuiz = String(L.type) === "test";

        const chapterTitle = isQuiz
          ? (L.quizTitle?.trim() || `Quiz ${idx + 1}`)
          : (L.title?.trim() || `Chapter ${idx + 1}`);

        const slug = await uniqueChapterSlug(tx, courseRow.id, `${idx + 1}-${chapterTitle}`);

        const chapter = await tx.chapter.create({
          data: {
            title: chapterTitle,
            slug,
            description: isQuiz ? (L.quizTitle || null) : (L.content?.slice(0, 180) || null),
            content: isQuiz ? null : (L.content || null),
            attachments: [],
            order: idx + 1,
            isPreview: false,
            isPublished: true,
            courseId: courseRow.id,
            // no duration on chapter
          },
        });

        if (!isQuiz) continue;

        // 3) Assessment for quiz chapter
        const minutes = Number(L.quizDurationMinutes || 0);
        const timeLimitSeconds = minutes > 0 ? minutes * 60 : null;

        const assess = await tx.assessment.create({
          data: {
            title: L.quizTitle?.trim() || `Quiz for ${chapter.title}`,
            type: "quiz",
            scope: "chapter",
            timeLimitSeconds,
            maxAttempts: 1,
            isPublished: true,
            order: 1,
            chapterId: chapter.id,
          },
        });

    
        for (let qIdx = 0; qIdx < (L.questions || []).length; qIdx++) {
          const Q = L.questions[qIdx] || {};
          const qType = String(Q.type || "").toLowerCase();

          if (qType === "single" || qType === "multiple") {
            const options = (Q.options || []).map((o) => o.text || "");
            const correctIdxs = (Q.options || [])
              .map((o, i) => (o?.correct ? i : -1))
              .filter((i) => i >= 0);

            await tx.assessmentQuestion.create({
              data: {
                assessmentId: assess.id,
                prompt: Q.text || "",
                type: qType,                 // plain string field in Prisma
                options,
                correctOptionIndex: qType === "single" ? (correctIdxs[0] ?? null) : null,
                correctOptionIndexes: qType === "multiple" ? correctIdxs : [], // Int[] with default []
                points: 1,
                order: qIdx + 1,
              },
            });
            continue;
          }

          if (qType === "numerical") {
            await tx.assessmentQuestion.create({
              data: {
                assessmentId: assess.id,
                prompt: Q.text || "",
                type: "numerical",
                options: [],
                correctText: Q.correctText ?? "",
                points: 1,
                order: qIdx + 1,
              },
            });
            continue;
          }

          if (qType === "match") {
          
            const pairs = (Q.pairs || []).map((p) => ({
              left: p?.left ?? "",
              right: p?.right ?? "",
            }));
            await tx.assessmentQuestion.create({
              data: {
                assessmentId: assess.id,
                prompt: Q.text || "",
                type: "match",
                options: [],
                pairs, // Json
                points: 1,
                order: qIdx + 1,
              },
            });
            continue;
          }

          await tx.assessmentQuestion.create({
            data: {
              assessmentId: assess.id,
              prompt: Q.text || "",
              type: "subjective",
              options: [],
              sampleAnswer: Q.sampleAnswer || "",
              points: 1,
              order: qIdx + 1,
            },
          });
        }
      }

      return courseRow;
    });

    res.json({ id: createdCourse.id });
  } catch (err) {
    console.error("Create full course failed:", err);
    res.status(500).json({ error: "Failed to create course with content" });
  }
});




export default router;