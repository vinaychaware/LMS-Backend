
import express from "express";
import { prisma } from "../config/prisma.js";  
const router = express.Router();

const up = (s) => String(s || "").toUpperCase();
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const r = up(req.user.role);
  if (r !== "ADMIN" && r !== "SUPER_ADMIN") return res.status(403).json({ error: "Forbidden" });
  next();
}

// Overview scoped to admin’s courses
router.get("/overview", requireAdmin, async (req, res) => {
  const adminId = req.user.id;
  const courses = await prisma.course.findMany({
    where: { OR: [{ creatorId: adminId }, { managerId: adminId }] },
    include: { enrollments: true, instructors: true },
  });
  res.json({
    totals: {
      courses: courses.length,
      students: courses.reduce((a, c) => a + c.enrollments.length, 0),
      instructors: courses.reduce((a, c) => a + c.instructors.length, 0),
    },
    courseIds: courses.map((c) => c.id),
  });
});

// Admin can grant/revoke instructor permissions
router.patch("/instructors/:id/permissions", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || up(user.role) !== "INSTRUCTOR") return res.status(404).json({ error: "Instructor not found" });
  const updated = await prisma.user.update({ where: { id }, data: { permissions: req.body || {} } });
  res.json({ id: updated.id, permissions: updated.permissions });
});

// Admin courses (only theirs)
router.get("/courses", requireAdmin, async (req, res) => {
  const adminId = req.user.id;
  const rows = await prisma.course.findMany({
    where: { OR: [{ creatorId: adminId }, { managerId: adminId }] },
    include: { enrollments: true, instructors: { include: { instructor: { select: { fullName: true } } } } },
  });
  res.json(rows.map((c) => ({
    id: c.id, title: c.title, thumbnail: c.thumbnail, status: c.status,
    studentCount: c.enrollments.length,
    instructorNames: c.instructors.map((i) => i.instructor.fullName),
  })));
});

// Create course (admin always allowed)
router.post("/courses", requireAdmin, async (req, res) => {
  const { title, thumbnail, status = "draft", managerId } = req.body || {};
  const creatorId = req.user.id;
  if (!title) return res.status(400).json({ error: "title required" });
  const created = await prisma.course.create({ data: { title, thumbnail, status, creatorId, managerId } });
  res.json({ id: created.id });
});

export default router;
