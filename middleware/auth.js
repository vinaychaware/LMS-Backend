// middleware/auth.js
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';

// ---- Protect (named export)
export const protect = async (req, res, next) => {
  try {
    let token;

    // Prefer Authorization header: Bearer <token>
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Optional cookie fallback (requires cookie-parser)
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized: missing token' });
    }

    // ⚠️ Use the same secret fallback used when signing
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');

    // Support multiple possible payload keys, but prefer `sub`
    const userId = decoded.userId || decoded.id || decoded.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Invalid token payload' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true, role: true, isActive: true, isEmailVerified: true }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'User account is deactivated' });
    }

    // Attach to request for downstream routes (e.g., requireSuperAdmin)
    req.user = user;
    next();
  } catch (err) {
    // Helpful diagnostics during dev
    // console.error('protect error:', err);

    // Differentiate common JWT errors (optional)
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }
};

// ---- Authorize (named export)
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};
