// routes/enrollments.js
import express from "express";
import { prisma } from "../config/prisma.js";
const router = express.Router();


const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_");

// --- guards ---
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const r = norm(req.user.role);
  if (r !== "ADMIN" && r !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}
const isUuid = (s) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);



router.get("/enrollments", async (req, res) => {
  try {
    const { studentId, courseId } = req.query;

    const where = {};
    if (studentId) {
      if (!isUuid(studentId)) {
        return res.status(400).json({ error: "Invalid studentId format" });
      }
      where.studentId = studentId;
    }
    if (courseId) {
      if (!isUuid(courseId)) {
        return res.status(400).json({ error: "Invalid courseId format" });
      }
      where.courseId = courseId;
    }

    const enrollments = await prisma.enrollment.findMany({ where });
    res.json(enrollments);
  } catch (err) {
    console.error("GET /enrollment error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/enrollments", async (req, res) => {
  try {
    const { studentId, courseId } = req.body;

    if (!studentId || !courseId) {
      return res.status(400).json({ error: "studentId and courseId are required" });
    }
    if (!isUuid(studentId) || !isUuid(courseId)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    const enrollment = await prisma.enrollment.create({
      data: { studentId, courseId },
    });

    res.status(201).json(enrollment);
  } catch (err) {
    console.error("POST /enrollment error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


router.get("/enrollments/self", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const rows = await prisma.enrollment.findMany({
      where: { studentId: String(req.user.id) },
      select: {
        id: true,
        courseId: true,
        studentId: true,
        status: true,
        progress: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(rows);
  } catch (e) {
    console.error("GET /api/enrollments/self error:", e);
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/courses/:courseId/enrollments", requireAdmin, async (req, res) => {
  try {
    const courseId = coerceId(req.params.courseId);
    const rows = await prisma.enrollment.findMany({
      where: { courseId },
      include: { student: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(rows.map(e => ({
      id: e.id,
      studentId: e.studentId,
      studentName: e.student?.fullName || null,
      status: e.status,
      progress: e.progress,
    })));
  } catch (e) {
    console.error("GET /api/courses/:courseId/enrollments error:", e);
    res.status(500).json({ error: "Internal error" });
  }
});



router.post("/courses/:courseId/enrollments", requireAdmin, async (req, res) => {
  const { courseId } = req.params;
  const { studentId } = req.body || {};
  if (!studentId) return res.status(400).json({ error: "studentId required" });

  const created = await prisma.enrollment.create({
    data: { courseId: String(courseId), studentId: String(studentId) },
  });
  res.json({ id: created.id });
});

// Unenroll (ADMIN/SA)
router.delete("/enrollments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) {
      return res.status(400).json({ error: "Invalid enrollment ID format" });
    }

    await prisma.enrollment.delete({ where: { id } });
    res.json({ message: "Enrollment deleted successfully" });
  } catch (err) {
    console.error("DELETE /enrollment/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
