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

// @desc    Get lessons for a course
// @route   GET /api/lessons/course/:courseId
// @access  Public (for preview) / Private (for enrolled students)
router.get('/course/:courseId', async (req, res, next) => {
  try {
    const { courseId } = req.params;

    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Get lessons
    const lessons = await prisma.lesson.findMany({
      where: { 
        courseId,
        isPublished: true
      },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        videoDuration: true,
        order: true,
        isPreview: true,
        isPublished: true,
        createdAt: true
      }
    });

    res.status(200).json({
      success: true,
      data: { lessons }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get single lesson
// @route   GET /api/lessons/:id
// @access  Private (enrolled students/instructor)
router.get('/:id', protect, async (req, res, next) => {
  try {
    const { id } = req.params;

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            instructorId: true
          }
        }
      }
    });

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    // Check if user has access (instructor, enrolled student, or preview lesson)
    const isInstructor = lesson.course.instructorId === req.user.id;
    const isPreview = lesson.isPreview;
    
    let isEnrolled = false;
    if (!isInstructor && !isPreview) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          courseId_studentId: {
            courseId: lesson.courseId,
            studentId: req.user.id
          }
        }
      });
      isEnrolled = !!enrollment;
    }

    if (!isInstructor && !isPreview && !isEnrolled && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You must be enrolled in this course to access this lesson'
      });
    }

    res.status(200).json({
      success: true,
      data: { lesson }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Create lesson
// @route   POST /api/lessons
// @access  Private (Instructor/Admin)
router.post('/', protect, authorize('instructor', 'admin'), [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('courseId')
    .notEmpty()
    .withMessage('Course ID is required'),
  body('order')
    .isInt({ min: 1 })
    .withMessage('Order must be a positive integer'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const {
      title,
      description,
      content,
      videoUrl,
      videoDuration,
      attachments = [],
      order,
      isPreview = false,
      courseId,
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
        message: 'Not authorized to add lessons to this course'
      });
    }

    // Generate slug
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');

    const lesson = await prisma.lesson.create({
      data: {
        title,
        slug,
        description,
        content,
        videoUrl,
        videoDuration: videoDuration ? parseInt(videoDuration) : null,
        attachments,
        order: parseInt(order),
        isPreview,
        courseId,
        settings: {
          allowComments: true,
          allowNotes: true,
          allowDownloads: true,
          ...settings
        }
      }
    });

    // Update course lessons count
    await prisma.course.update({
      where: { id: courseId },
      data: {
        lessonsCount: {
          increment: 1
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Lesson created successfully',
      data: { lesson }
    });
  } catch (error) {
    next(error);
  }
});

export default router;