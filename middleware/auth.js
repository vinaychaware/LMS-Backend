import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  let token;

  // Check for token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Check for token in cookies
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account is deactivated'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
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

// Grant access to students only
const authorizeStudent = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  if (req.user.role !== 'student') {
    return res.status(403).json({
      success: false,
      message: 'Only students can access this route'
    });
  }

  next();
};

// Grant access to instructors only
const authorizeInstructor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  if (req.user.role !== 'instructor') {
    return res.status(403).json({
      success: false,
      message: 'Only instructors can access this route'
    });
  }

  next();
};

// Grant access to admins only
const authorizeAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Only admins can access this route'
    });
  }

  next();
};

// Grant access to instructors and admins
const authorizeInstructorOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  if (!['instructor', 'admin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Only instructors and admins can access this route'
    });
  }

  next();
};

// Grant access to students and instructors
const authorizeStudentOrInstructor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  if (!['student', 'instructor'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Only students and instructors can access this route'
    });
  }

  next();
};

// Check if user owns the resource (for courses, lessons, etc.)
const checkOwnership = (modelName) => {
  return async (req, res, next) => {
    try {
      const Model = require(`../models/${modelName}`);
      const resource = await Model.findById(req.params.id);

      if (!resource) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found'
        });
      }

      // Check if user owns the resource
      if (resource.instructor && resource.instructor.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this resource'
        });
      }

      // Check if user owns the course (for lessons)
      if (resource.course) {
        const Course = require('../models/Course');
        const course = await Course.findById(resource.course);
        
        if (course && course.instructor.toString() !== req.user.id) {
          return res.status(403).json({
            success: false,
            message: 'Not authorized to access this resource'
          });
        }
      }

      req.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Check if user is enrolled in course
const checkEnrollment = async (req, res, next) => {
  try {
    const Course = require('../models/Course');
    const course = await Course.findById(req.params.courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user is enrolled
    const isEnrolled = course.enrolledStudents.some(
      enrollment => enrollment.student.toString() === req.user.id
    );

    if (!isEnrolled && req.user.role !== 'instructor' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You must be enrolled in this course to access this resource'
      });
    }

    req.course = course;
    next();
  } catch (error) {
    next(error);
  }
};

// Check if user can access lesson
const checkLessonAccess = async (req, res, next) => {
  try {
    const Lesson = require('../models/Lesson');
    const lesson = await Lesson.findById(req.params.lessonId).populate('course');

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    // Check if user is enrolled in the course
    const isEnrolled = lesson.course.enrolledStudents.some(
      enrollment => enrollment.student.toString() === req.user.id
    );

    // Check if lesson is free or user is enrolled
    if (!lesson.isFree && !isEnrolled && req.user.role !== 'instructor' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You must be enrolled in this course to access this lesson'
      });
    }

    req.lesson = lesson;
    next();
  } catch (error) {
    next(error);
  }
};

export {
  protect,
  authorize,
  authorizeStudent,
  authorizeInstructor,
  authorizeAdmin,
  authorizeInstructorOrAdmin,
  authorizeStudentOrInstructor,
  checkOwnership,
  checkEnrollment,
  checkLessonAccess
};
