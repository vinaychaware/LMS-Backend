// middleware/auth.js
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import email from "../utils/sendEmail.js";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

/** Normalize to UPPER_SNAKE_CASE so comparisons are consistent */
export const norm = (s) =>
  String(s || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");

/** Try to extract a bearer token from header, cookie, or query param */
const getToken = (req) => {
  // 1) Authorization: Bearer <token>
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);

  // 2) Cookie (common names)
  if (req.cookies?.token) return req.cookies.token;
  if (req.cookies?.access_token) return req.cookies.access_token;
  if (req.cookies?.jwt) return req.cookies.jwt;

  // 3) Query param (useful for webhooks/tools)
  if (req.query?.token) return String(req.query.token);

  return null;
};

export async function protect(req, res, next) {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Be flexible with common JWT claim keys
    const userId =
      decoded.id || decoded.userId || decoded.uid || decoded.sub || null;
    const userEmail = decoded.email || decoded.user?.email || null;
    if (!userId && !userEmail)
      return res.status(401).json({ error: "Unauthorized" });

    const where = userId
      ? { id: String(userId) }
      : { email: String(userEmail) };

    const user = await prisma.user.findUnique({
      where,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        permissions: true,
        // expose new fields you added
        year: true,
        branch: true,
        mobile: true,
        mustChangePassword: true,
      },
    });

    if (!user || !user.isActive)
      return res.status(401).json({ error: "Unauthorized" });

    // Normalize role once; keep raw too if you need it
    const rawRole = user.role || "";
    const role = norm(rawRole);

    // Standardize common admin variants, e.g. SUPERADMIN vs SUPER_ADMIN
    const isAdmin =
      role === "ADMIN" || role === "SUPER_ADMIN" || role === "SUPERADMIN";

    // Attach to req for downstream handlers
    req.user = {
      ...user,
      role, // normalized
      rawRole, // original from DB
      isAdmin,
      permissions: user.permissions || {},
    };

    next();
  } catch (err) {
    console.error("protect error:", err);
    return res.status(401).json({ error: "Unauthorized" });
  }
}

/**
 * Role-based guard
 * Usage: router.get("/admin-only", protect, authorize("ADMIN","SUPER_ADMIN"), handler)
 */
export const authorize = (...roles) => {
  // Normalize input roles once (support both ADMIN and SUPERADMIN variants)
  const allowed = roles.map((r) => norm(r));

  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({
          success: false,
          message: "Not authorized to access this route",
        });
    }

    // permit SUPERADMIN when SUPER_ADMIN was requested (and vice versa)
    const userRole = req.user.role; // already normalized
    const userRoleCompat = userRole === "SUPERADMIN" ? "SUPER_ADMIN" : userRole;

    if (!allowed.includes(userRole) && !allowed.includes(userRoleCompat)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

/** Admin-only helper */
export const requireAdminOnly = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });
  // role is already normalized by protect()
  const r = req.user.role;
  if (r === "ADMIN" || r === "SUPER_ADMIN" || r === "SUPERADMIN") return next();
  return res.status(403).json({ message: "Admins only" });
};

// controllers/auth.js

export const register = async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;
    const user = await prisma.user.create({
      data: { fullName, email, passwordHash: hash(password), role },
    });

    // trigger email after save
    await sendEmail({
      to: user.email,
      subject: "Welcome to the Platform",
      html: `
        <h1>Hi ${user.fullName},</h1>
        <p>Your account has been created successfully.</p>
        <p>Email: ${user.email}</p>
        <p>Password: (the one you set)</p>
        <a href="${process.env.FRONTEND_URL}/login">Login here</a>
      `,
    });

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
