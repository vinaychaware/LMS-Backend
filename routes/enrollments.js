// routes/enrollments.js
import express from "express";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const r = String(req.user.role || "").toUpperCase();
  if (r !== "ADMIN" && r !== "SUPER_ADMIN") return res.status(403).json({ error: "Forbidden" });
  next();
}

// List students in a course
router.get("/courses/:courseId/enrollments", requireAdmin, async (req, res) => {
  const { courseId } = req.params;
  const rows = await prisma.enrollment.findMany({
    where: { courseId },
    include: { student: { select: { id: true, fullName: true, email: true } } },
  });
  res.json(rows.map((e) => ({ id: e.id, studentId: e.studentId, studentName: e.student.fullName, status: e.status, progress: e.progress })));
});

// Enroll
router.post("/courses/:courseId/enrollments", requireAdmin, async (req, res) => {
  const { courseId } = req.params; const { studentId } = req.body || {};
  if (!studentId) return res.status(400).json({ error: "studentId required" });
  const created = await prisma.enrollment.create({ data: { courseId, studentId } });
  res.json({ id: created.id });
});

// Unenroll
router.delete("/enrollments/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  await prisma.enrollment.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
