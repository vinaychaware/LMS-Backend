// routes/courses.js
import express from "express";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const router = express.Router();

const up = (s) => String(s || "").toUpperCase();
function requireAdminOrAllowedInstructor(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const r = up(req.user.role);
  if (r === "SUPER_ADMIN" || r === "ADMIN") return next();
  if (r === "INSTRUCTOR" && req.user.permissions?.canCreateCourses) return next();
  return res.status(403).json({ error: "Forbidden" });
}

// List all courses (admins/SA)
router.get("/", async (_req, res) => {
  const rows = await prisma.course.findMany({
    include: { enrollments: true, instructors: { include: { instructor: { select: { fullName: true } } } } },
  });
  res.json(rows.map((c) => ({
    id: c.id, title: c.title, thumbnail: c.thumbnail, status: c.status,
    studentCount: c.enrollments.length,
    instructorNames: c.instructors.map((i) => i.instructor.fullName),
  })));
});

// Create (admin/SA or permitted instructor)
router.post("/", requireAdminOrAllowedInstructor, async (req, res) => {
  const { title, thumbnail, status = "draft", managerId } = req.body || {};
  const creatorId = req.user.id;
  if (!title) return res.status(400).json({ error: "title required" });
  const created = await prisma.course.create({ data: { title, thumbnail, status, creatorId, managerId } });
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
  const { id } = req.params; const { instructorIds = [] } = req.body || {};
  await prisma.courseInstructor.deleteMany({ where: { courseId: id } });
  if (instructorIds.length) {
    await prisma.courseInstructor.createMany({ data: instructorIds.map((x) => ({ courseId: id, instructorId: x })), skipDuplicates: true });
  }
  res.json({ ok: true, count: instructorIds.length });
});

export default router;
