// middleware/auth.js
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';

// Normalize to UPPER_SNAKE_CASE so comparisons are consistent
const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');

const getBearer = (req) => {
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
};

export async function protect(req, res, next) {
  try {
    const token = getBearer(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = decoded.id || decoded.userId || decoded.uid || decoded.sub || null;
    const userEmail = decoded.email || decoded.user?.email || null;
    if (!userId && !userEmail) return res.status(401).json({ error: 'Unauthorized' });

    const where = userId ? { id: String(userId) } : { email: String(userEmail) };

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
      },
    });

    if (!user || !user.isActive) return res.status(401).json({ error: 'Unauthorized' });

    // Normalize role once
    req.user = { ...user, role: norm(user.role) };
    next();
  } catch (err) {
    console.error('protect error:', err);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

export const authorize = (...roles) => {
  // Normalize input roles once
  const allowed = roles.map((r) => norm(r));
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

// Option A: implement directly with normalized comparison
export const requireAdminOnly = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  const r = req.user.role; // already normalized by protect()
  if (r === 'ADMIN' || r === 'SUPERADMIN') return next();
  return res.status(403).json({ message: 'Admins only' });
};

// Option B (cleaner): just reuse authorize()
// export const requireAdminOnly = authorize('ADMIN', 'SUPERADMIN');

export { norm };
