// routes/chapter.js
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

// List chapters for a course
router.get("/courses/:courseId/chapters", requireAdmin, async (req, res) => {
  const { courseId } = req.params;
  const rows = await prisma.chapter.findMany({
    where: { courseId }, orderBy: { order: "asc" },
    select: { id: true, title: true, slug: true, order: true, isPreview: true, isPublished: true },
  });
  res.json(rows);
});

// Create chapter
router.post("/courses/:courseId/chapters", requireAdmin, async (req, res) => {
  const { courseId } = req.params;
  const { title, slug, order = 1, isPreview = false, isPublished = true, description, content } = req.body || {};
  if (!title || !slug) return res.status(400).json({ error: "title and slug required" });
  const created = await prisma.chapter.create({ data: { courseId, title, slug, order, isPreview, isPublished, description, content } });
  res.json({ id: created.id });
});

// Update / Delete
router.patch("/chapters/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const updated = await prisma.chapter.update({ where: { id }, data: req.body || {} });
  res.json({ id: updated.id });
});
router.delete("/chapters/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  await prisma.chapterProgress.deleteMany({ where: { chapterId: id } });
  await prisma.assessment.deleteMany({ where: { chapterId: id } });
  await prisma.chapter.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
