import express from 'express';
import { body, validationResult } from 'express-validator';
import { protect, authorize } from '../middleware/auth.js';
import { prisma } from '../config/prisma.js';

const router = express.Router();

// Validation middleware helper
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// @desc    Get assignments for a course
// @route   GET /api/assignments/course/:courseId
// @access  Private (enrolled students/instructor)
router.get('/course/:courseId', protect, async (req, res, next) => {
  try {
    const { courseId } = req.params;

    // Check if user has access to the course
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const isInstructor = course.instructorId === req.user.id;
    let isEnrolled = false;

    if (!isInstructor && req.user.role !== 'admin') {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          courseId_studentId: {
            courseId,
            studentId: req.user.id
          }
        }
      });
      isEnrolled = !!enrollment;

      if (!isEnrolled) {
        return res.status(403).json({
          success: false,
          message: 'You must be enrolled in this course to view assignments'
        });
      }
    }

    const assignments = await prisma.assignment.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
      include: {
        lesson: {
          select: {
            id: true,
            title: true
          }
        },
        _count: {
          select: {
            submissions: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: { assignments }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get single assignment
// @route   GET /api/assignments/:id
// @access  Private (enrolled students/instructor)
router.get('/:id', protect, async (req, res, next) => {
  try {
    const { id } = req.params;

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            instructorId: true
          }
        },
        lesson: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Check access permissions
    const isInstructor = assignment.course.instructorId === req.user.id;
    let isEnrolled = false;

    if (!isInstructor && req.user.role !== 'admin') {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          courseId_studentId: {
            courseId: assignment.courseId,
            studentId: req.user.id
          }
        }
      });
      isEnrolled = !!enrollment;

      if (!isEnrolled) {
        return res.status(403).json({
          success: false,
          message: 'You must be enrolled in this course to view this assignment'
        });
      }
    }

    // Get user's submission if they're a student
    let userSubmission = null;
    if (req.user.role === 'student') {
      userSubmission = await prisma.assignmentSubmission.findFirst({
        where: {
          assignmentId: id,
          studentId: req.user.id
        },
        orderBy: {
          attempt: 'desc'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: { 
        assignment,
        userSubmission
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Create assignment
// @route   POST /api/assignments
// @access  Private (Instructor/Admin)
router.post('/', protect, authorize('instructor', 'admin'), [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Description must be at least 10 characters'),
  body('type')
    .isIn(['quiz', 'essay', 'project', 'file_upload', 'peer_review'])
    .withMessage('Invalid assignment type'),
  body('courseId')
    .notEmpty()
    .withMessage('Course ID is required'),
  body('maxScore')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max score must be a positive integer'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const {
      title,
      description,
      type,
      instructions,
      dueDate,
      maxScore = 100,
      isRequired = true,
      allowLateSubmission = false,
      courseId,
      lessonId,
      settings = {}
    } = req.body;

    // Check if user owns the course
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (course.instructorId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to create assignments for this course'
      });
    }

    const assignment = await prisma.assignment.create({
      data: {
        title,
        description,
        type,
        instructions,
        dueDate: dueDate ? new Date(dueDate) : null,
        maxScore: parseInt(maxScore),
        isRequired,
        allowLateSubmission,
        courseId,
        lessonId: lessonId || null,
        settings: {
          allowMultipleAttempts: false,
          maxAttempts: 1,
          timeLimit: null,
          ...settings
        }
      },
      include: {
        course: {
          select: {
            id: true,
            title: true
          }
        },
        lesson: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Assignment created successfully',
      data: { assignment }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Submit assignment
// @route   POST /api/assignments/:id/submit
// @access  Private (Student)
router.post('/:id/submit', protect, [
  body('content')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Content cannot be empty'),
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content, attachments = [] } = req.body;

    // Check if assignment exists
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        course: true
      }
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Check if user is enrolled
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        courseId_studentId: {
          courseId: assignment.courseId,
          studentId: req.user.id
        }
      }
    });

    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'You must be enrolled in this course to submit assignments'
      });
    }

    // Check if assignment is past due
    if (assignment.dueDate && new Date() > assignment.dueDate && !assignment.allowLateSubmission) {
      return res.status(400).json({
        success: false,
        message: 'Assignment submission deadline has passed'
      });
    }

    // Check existing submissions
    const existingSubmissions = await prisma.assignmentSubmission.findMany({
      where: {
        assignmentId: id,
        studentId: req.user.id
      }
    });

    const maxAttempts = assignment.settings?.maxAttempts || 1;
    const allowMultipleAttempts = assignment.settings?.allowMultipleAttempts || false;

    if (!allowMultipleAttempts && existingSubmissions.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Multiple submissions are not allowed for this assignment'
      });
    }

    if (existingSubmissions.length >= maxAttempts) {
      return res.status(400).json({
        success: false,
        message: `Maximum number of attempts (${maxAttempts}) reached`
      });
    }

    const submission = await prisma.assignmentSubmission.create({
      data: {
        content,
        attachments,
        assignmentId: id,
        studentId: req.user.id,
        attempt: existingSubmissions.length + 1,
        status: 'submitted'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Assignment submitted successfully',
      data: { submission }
    });
  } catch (error) {
    next(error);
  }
});

export default router;