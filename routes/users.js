// routes/users.js (ESM)
import express from "express";
import bcrypt from "bcryptjs";
import { body, validationResult } from "express-validator";
import { protect } from "../middleware/auth.js";
import { prisma } from "../config/prisma.js";

const router = express.Router();
const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};
const normalizeEmail = (e) => (typeof e === "string" ? e.trim().toLowerCase() : e);

router.use(protect);
router.get("/me", async (req, res, next) => {
  try {
    const me = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isEmailVerified: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        permissions: true,
      },
    });
    if (!me) return res.status(404).json({ success: false, message: "User not found" });
    res.status(200).json({ success: true, data: { user: me } });
  } catch (err) {
    next(err);
  }
});

router.put(
  "/me",
  [
    body("fullName").optional().trim().isLength({ min: 2, max: 100 }).withMessage("Full name must be between 2 and 100 characters"),
    body("email").optional().isEmail().withMessage("Provide a valid email"),
    body("currentPassword").optional().isLength({ min: 6 }),
    body("newPassword").optional().isLength({ min: 6 }),
    body(["currentPassword", "newPassword"]).custom((_, { req }) => {
      const { currentPassword, newPassword } = req.body;
      if ((currentPassword && !newPassword) || (!currentPassword && newPassword)) {
        throw new Error("Provide both currentPassword and newPassword to change password");
      }
      if (currentPassword && newPassword && currentPassword === newPassword) {
        throw new Error("New password must differ from current password");
      }
      return true;
    }),
    handleValidationErrors,
  ],
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { fullName, email, currentPassword, newPassword } = req.body;

      const me = await prisma.user.findUnique({ where: { id: userId } });
      if (!me) return res.status(404).json({ success: false, message: "User not found" });

      const data = {};

      if (typeof fullName === "string" && fullName.trim() && fullName !== me.fullName) {
        data.fullName = fullName.trim();
      }

      if (email) {
        const normalized = normalizeEmail(email);
        if (normalized !== normalizeEmail(me.email)) {
          const exists = await prisma.user.findUnique({ where: { email: normalized } });
          if (exists) return res.status(400).json({ success: false, message: "Email already in use" });
          data.email = normalized;
          // Optionally: data.isEmailVerified = false;
        }
      }

      if (currentPassword && newPassword) {
        const ok = await bcrypt.compare(currentPassword, me.password);
        if (!ok) return res.status(400).json({ success: false, message: "Current password is incorrect" });
        const salt = await bcrypt.genSalt(10);
        data.password = await bcrypt.hash(newPassword, salt);
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ success: false, message: "No changes provided" });
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isEmailVerified: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          permissions: true,
        },
      });

      res.status(200).json({ success: true, message: "Profile updated", data: { user: updated } });
    } catch (err) {
      if (err.code === "P2002") {
        return res.status(400).json({ success: false, message: "Email already in use" });
      }
      next(err);
    }
  }
);

router.delete(
  "/me",
  [
    body("password").exists().withMessage("Password is required to delete your account").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    handleValidationErrors,
  ],
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { password } = req.body;

      const me = await prisma.user.findUnique({ where: { id: userId } });
      if (!me) return res.status(404).json({ success: false, message: "User not found" });

      const ok = await bcrypt.compare(password, me.password);
      if (!ok) return res.status(400).json({ success: false, message: "Password is incorrect" });

      const [createdCount, managedCount] = await Promise.all([
        prisma.course.count({ where: { creatorId: userId } }),
        prisma.course.count({ where: { managerId: userId } }),
      ]);
      if (createdCount > 0) {
        return res.status(409).json({
          success: false,
          message: "You are creator of courses. Reassign or delete those courses before deleting your account.",
        });
      }
      if (managedCount > 0) {
        return res.status(409).json({
          success: false,
          message: "You manage courses. Reassign manager before deleting your account.",
        });
      }

      // Atomic cleanup + delete
      await prisma.$transaction(async (tx) => {
        await tx.assessmentAttempt.deleteMany({ where: { studentId: userId } });
        await tx.chapterProgress.deleteMany({ where: { studentId: userId } });
        await tx.courseReview.deleteMany({ where: { studentId: userId } });
        await tx.enrollment.deleteMany({ where: { studentId: userId } });
        await tx.courseInstructor.deleteMany({ where: { instructorId: userId } });
        await tx.user.delete({ where: { id: userId } });
      });

      res.status(200).json({ success: true, message: "Account deleted successfully" });
    } catch (err) {
      if (err.code === "P2003") {
        return res.status(409).json({
          success: false,
          message: "Cannot delete account due to related data. Consider a soft delete (set isActive=false) or reassign related records.",
        });
      }
      next(err);
    }
  }
);


router.post(
  '/register',
  [
    body('fullName').exists().trim().isLength({ min: 2, max: 100 }).withMessage('fullName is required (2–100 chars)'),
    body('email').exists().isEmail().withMessage('Valid email required'),
    body('password').exists().isLength({ min: 6 }).withMessage('Password must be at least 6 chars'),
    // DO NOT restrict role here; decide in handler (so we can allow SUPER_ADMIN for the 1st user).
    body('role').optional().isString(),
    handleValidationErrors,
  ],
  async (req, res, next) => {
    try {
      const fullName = String(req.body.fullName).trim();
      const email = normalizeEmail(req.body.email);
      const password = req.body.password;
      const requested = String(req.body.role || 'STUDENT').toUpperCase();

      // Fail if email exists
      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) return res.status(400).json({ success: false, message: 'Email already in use' });

      // Count users to decide bootstrap
      const userCount = await prisma.user.count();

      let finalRole;
      if (userCount === 0) {
        // Bootstrap: allow SUPER_ADMIN for the very first account
        finalRole = requested === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'STUDENT';
      } else {
        const allowed = ['STUDENT', 'INSTRUCTOR', 'ADMIN'];
        if (!allowed.includes(requested)) {
          return res.status(400).json({
            success: false,
            message: 'Role must be student, instructor, or admin (SUPER_ADMIN only allowed for first registered user)',
          });
        }
        finalRole = requested;
      }

      const hash = await bcrypt.hash(password, 10);
      const created = await prisma.user.create({
        data: {
          fullName,
          email,
          password: hash,
          role: finalRole,
          isActive: true,
          permissions: req.body.permissions ?? {},
        },
        select: {
          id: true, fullName: true, email: true, role: true, isActive: true, permissions: true,
        },
      });

      const token = signToken(created);
      return res.status(201).json({ success: true, data: { user: created, token } });
    } catch (err) {
      if (err.code === 'P2002') {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
      next(err);
    }
  }
);

router.post('/login', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'email and password are required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = signToken(user);
    const payload = {
      id: user.id, fullName: user.fullName, email: user.email,
      role: user.role, isActive: user.isActive, permissions: user.permissions || {},
    };

    res.json({ success: true, data: { user: payload, token } });
  } catch (err) {
    next(err);
  }
});

export default router;