import express from "express";
import { prisma } from "../config/prisma.js";

const router = express.Router();

const up = (s) => String(s || "").toUpperCase();

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const r = up(req.user.role);
  if (r !== "ADMIN" && r !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

async function getAdminCourseIds(adminId) {
  const cs = await prisma.course.findMany({
    where: { OR: [{ creatorId: adminId }, { managerId: adminId }] },
    select: { id: true },
  });
  return cs.map((c) => c.id);
}

router.get("/overview", requireAdmin, async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const courseIds = await getAdminCourseIds(adminId);

    if (courseIds.length === 0) {
      return res.json({
        totals: { courses: 0, students: 0, instructors: 0 },
        courseIds: [],
      });
    }

    const [enrollments, courseInstructors] = await Promise.all([
      prisma.enrollment.findMany({
        where: { courseId: { in: courseIds } },
        select: { studentId: true },
      }),
      prisma.courseInstructor.findMany({
        where: { courseId: { in: courseIds } },
        select: { instructorId: true },
      }),
    ]);

    const uniqueStudents = new Set(enrollments.map((e) => e.studentId));
    const uniqueInstructors = new Set(
      courseInstructors.map((ci) => ci.instructorId)
    );

    res.json({
      totals: {
        courses: courseIds.length,
        students: uniqueStudents.size,
        instructors: uniqueInstructors.size,
      },
      courseIds,
    });
  } catch (err) {
    next(err);
  }
});


// GET /api/admin/courses
router.get("/courses", requireAdmin, async (req, res, next) => {
  try {
    const adminId = req.user.id;

    const rows = await prisma.course.findMany({
      where: { OR: [{ creatorId: adminId }, { managerId: adminId }] },
      select: {
        id: true,
        title: true,
        description: true,
        thumbnail: true,
        status: true,                 // keep only fields that actually exist
        enrollments: { select: { id: true } }, // for studentCount
        instructors: {
          select: {
            instructor: { select: { fullName: true } },
          },
        },
      },
      // If your schema doesn't have createdAt, remove orderBy or switch to a field that exists.
      // orderBy: { createdAt: "desc" },
      // Safer default (works in almost all schemas):
      orderBy: { id: "desc" },
    });

    const mapped = rows.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description || "",
      thumbnail: c.thumbnail || null,
      status: c.status || "draft",

      // Frontend compatibility: provide defaults even if DB has no columns for these:
      level: null,
      totalModules: 0,
      totalChapters: 0,

      studentCount: c.enrollments.length,
      instructorNames: c.instructors.map((i) => i.instructor.fullName),
    }));

    res.json(mapped);
  } catch (err) {
    next(err);
  }
});


router.get("/students", requireAdmin, async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const wantFallbackAll = String(req.query.fallback || "").toLowerCase() === "all";

    // Courses this admin owns/manages
    const myCourses = await prisma.course.findMany({
      where: { OR: [{ creatorId: adminId }, { managerId: adminId }] },
      select: { id: true },
    });
    const courseIds = myCourses.map(c => c.id);

    if (courseIds.length === 0) {
      if (!wantFallbackAll) return res.json([]); // no courses, scoped = empty

      // fallback: all students
      const allStudents = await prisma.user.findMany({
        where: { role: "STUDENT" },
        select: { id: true, fullName: true, email: true, isActive: true, lastLogin: true },
        orderBy: { id: "desc" },
      });
      return res.json(allStudents.map(s => ({
        ...s,
        assignedCourses: [], // none within this admin's scope
      })));
    }

    // scoped: students enrolled in the admin's courses
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId: { in: courseIds } },
      select: {
        courseId: true,
        student: {
          select: { id: true, fullName: true, email: true, isActive: true, lastLogin: true },
        },
      },
    });

    if (enrollments.length === 0 && wantFallbackAll) {
      const allStudents = await prisma.user.findMany({
        where: { role: "STUDENT" },
        select: { id: true, fullName: true, email: true, isActive: true, lastLogin: true },
        orderBy: { id: "desc" },
      });
      return res.json(allStudents.map(s => ({ ...s, assignedCourses: [] })));
    }

    // de-dup + assigned courses within this admin scope
    const byId = new Map();             // studentId -> user
    const assigned = new Map();         // studentId -> Set(courseId)
    for (const e of enrollments) {
      const s = e.student;
      if (!byId.has(s.id)) byId.set(s.id, s);
      if (!assigned.has(s.id)) assigned.set(s.id, new Set());
      assigned.get(s.id).add(e.courseId);
    }
    const out = Array.from(byId.values()).map(s => ({
      ...s,
      assignedCourses: Array.from(assigned.get(s.id) || []),
    }));
    res.json(out);
  } catch (err) {
    next(err);
  }
});

router.get("/instructors", requireAdmin, async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const wantFallbackAll = String(req.query.fallback || "").toLowerCase() === "all";

    // Courses this admin owns/manages
    const myCourses = await prisma.course.findMany({
      where: { OR: [{ creatorId: adminId }, { managerId: adminId }] },
      select: { id: true },
    });
    const courseIds = myCourses.map(c => c.id);

    if (courseIds.length === 0) {
      if (!wantFallbackAll) return res.json([]); // no courses, scoped = empty

      // fallback: all instructors
      const allInstructors = await prisma.user.findMany({
        where: { role: "INSTRUCTOR" },
        select: { id: true, fullName: true, email: true, isActive: true, lastLogin: true },
        orderBy: { id: "desc" },
      });
      return res.json(allInstructors.map(i => ({
        ...i,
        assignedCourses: [], // none within this admin's scope
      })));
    }

    // scoped: instructors linked to the admin's courses
    const links = await prisma.courseInstructor.findMany({
      where: { courseId: { in: courseIds } },
      select: {
        courseId: true,
        instructor: {
          select: { id: true, fullName: true, email: true, isActive: true, lastLogin: true },
        },
      },
    });

    if (links.length === 0 && wantFallbackAll) {
      const allInstructors = await prisma.user.findMany({
        where: { role: "INSTRUCTOR" },
        select: { id: true, fullName: true, email: true, isActive: true, lastLogin: true },
        orderBy: { id: "desc" },
      });
      return res.json(allInstructors.map(i => ({ ...i, assignedCourses: [] })));
    }

    // de-dup + assigned courses within this admin scope
    const byId = new Map();              // instructorId -> user
    const assigned = new Map();          // instructorId -> Set(courseId)
    for (const l of links) {
      const i = l.instructor;
      if (!byId.has(i.id)) byId.set(i.id, i);
      if (!assigned.has(i.id)) assigned.set(i.id, new Set());
      assigned.get(i.id).add(l.courseId);
    }
    const out = Array.from(byId.values()).map(i => ({
      ...i,
      assignedCourses: Array.from(assigned.get(i.id) || []),
    }));
    res.json(out);
  } catch (err) {
    next(err);
  }
});


router.patch(
  "/instructors/:id/permissions",
  requireAdmin,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true },
      });
      if (!user || up(user.role) !== "INSTRUCTOR") {
        return res.status(404).json({ error: "Instructor not found" });
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { permissions: req.body || {} },
        select: { id: true, permissions: true },
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
