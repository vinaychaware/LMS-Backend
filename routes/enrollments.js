const express = require('express');
const { body, validationResult } = require('express-validator');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const Payment = require('../models/Payment');
const { protect, authorize } = require('../middleware/auth');
const { createError } = require('../utils/errors');

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

// @desc    Get all enrollments (Admin only)
// @route   GET /api/enrollments
// @access  Private/Admin
router.get('/', authorize('admin'), async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, course, student } = req.query;
    
    // Build query
    const query = {};
    if (status) query.status = status;
    if (course) query.course = course;
    if (student) query.student = student;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      populate: [
        { path: 'student', select: 'name email' },
        { path: 'course', select: 'title instructor' }
      ],
      sort: { enrolledAt: -1 }
    };

    const enrollments = await Enrollment.paginate(query, options);

    res.status(200).json({
      success: true,
      data: enrollments
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get user enrollments
// @route   GET /api/enrollments/my
// @access  Private
router.get('/my', async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    // Build query
    const query = { student: req.user.id };
    if (status) query.status = status;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      populate: [
        { path: 'course', select: 'title thumbnail instructor totalLessons totalDuration' },
        { path: 'course.instructor', select: 'name avatar' }
      ],
      sort: { enrolledAt: -1 }
    };

    const enrollments = await Enrollment.paginate(query, options);

    res.status(200).json({
      success: true,
      data: enrollments
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get single enrollment
// @route   GET /api/enrollments/:id
// @access  Private
router.get('/:id', async (req, res, next) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id)
      .populate('student', 'name email avatar')
      .populate('course', 'title thumbnail instructor totalLessons totalDuration')
      .populate('course.instructor', 'name avatar bio')
      .populate('completedLessons.lesson', 'title order type duration');

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    // Check if user can access this enrollment
    if (req.user.role !== 'admin' && enrollment.student._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this enrollment'
      });
    }

    res.status(200).json({
      success: true,
      data: { enrollment }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Enroll in course
// @route   POST /api/enrollments
// @access  Private/Student
router.post('/', [
  authorize('student'),
  body('courseId')
    .isMongoId()
    .withMessage('Valid course ID is required'),
  body('paymentMethod')
    .isIn(['stripe', 'paypal', 'bank_transfer', 'crypto'])
    .withMessage('Valid payment method is required')
], async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { courseId, paymentMethod } = req.body;

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if course is published
    if (course.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Course is not available for enrollment'
      });
    }

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      student: req.user.id,
      course: courseId
    });

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: 'You are already enrolled in this course'
      });
    }

    // Create payment record
    const payment = await Payment.create({
      user: req.user.id,
      course: courseId,
      amount: course.isFree ? 0 : course.price,
      currency: course.currency,
      method: paymentMethod,
      description: `Enrollment in ${course.title}`,
      metadata: {
        courseTitle: course.title,
        courseId: courseId
      }
    });

    // Create enrollment
    const enrollment = await Enrollment.create({
      student: req.user.id,
      course: courseId,
      payment: {
        amount: course.isFree ? 0 : course.price,
        currency: course.currency,
        method: paymentMethod,
        transactionId: payment._id.toString(),
        status: course.isFree ? 'completed' : 'pending'
      }
    });

    // Update course enrollment count
    course.totalEnrollments += 1;
    await course.save();

    // If course is free, mark payment as completed
    if (course.isFree) {
      payment.status = 'completed';
      payment.transactionId = `FREE-${enrollment._id.toString().slice(-8).toUpperCase()}`;
      payment.processedAt = new Date();
      await payment.save();
    }

    res.status(201).json({
      success: true,
      message: course.isFree ? 'Enrolled successfully' : 'Enrollment created. Please complete payment.',
      data: {
        enrollment,
        payment: course.isFree ? null : payment,
        requiresPayment: !course.isFree
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Complete lesson
// @route   PUT /api/enrollments/:id/complete-lesson
// @access  Private/Student
router.put('/:id/complete-lesson', [
  authorize('student'),
  body('lessonId')
    .isMongoId()
    .withMessage('Valid lesson ID is required'),
  body('timeSpent')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Time spent must be a positive integer'),
  body('score')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Score must be between 0 and 100')
], async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { lessonId, timeSpent, score } = req.body;

    const enrollment = await Enrollment.findById(req.params.id);
    
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    // Check if user owns this enrollment
    if (enrollment.student.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this enrollment'
      });
    }

    // Complete the lesson
    await enrollment.completeLesson(lessonId, timeSpent, score);

    // Get course to calculate progress
    const course = await Course.findById(enrollment.course);
    if (course) {
      await enrollment.calculateProgress(course.totalLessons);
    }

    res.status(200).json({
      success: true,
      message: 'Lesson completed successfully',
      data: { enrollment }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Cancel enrollment
// @route   PUT /api/enrollments/:id/cancel
// @access  Private/Student
router.put('/:id/cancel', authorize('student'), async (req, res, next) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);
    
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    // Check if user owns this enrollment
    if (enrollment.student.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this enrollment'
      });
    }

    // Check if enrollment can be cancelled
    if (enrollment.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Enrollment cannot be cancelled in current status'
      });
    }

    // Update enrollment status
    enrollment.status = 'cancelled';
    await enrollment.save();

    // Update course enrollment count
    const course = await Course.findById(enrollment.course);
    if (course && course.totalEnrollments > 0) {
      course.totalEnrollments -= 1;
      await course.save();
    }

    res.status(200).json({
      success: true,
      message: 'Enrollment cancelled successfully',
      data: { enrollment }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get enrollment progress
// @route   GET /api/enrollments/:id/progress
// @access  Private
router.get('/:id/progress', async (req, res, next) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id)
      .populate('course', 'title totalLessons totalDuration')
      .populate('completedLessons.lesson', 'title order type duration');

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    // Check if user can access this enrollment
    if (req.user.role !== 'admin' && enrollment.student.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this enrollment'
      });
    }

    // Calculate progress statistics
    const totalLessons = enrollment.course.totalLessons;
    const completedLessons = enrollment.completedLessons.length;
    const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    
    const totalDuration = enrollment.course.totalDuration;
    const completedDuration = enrollment.completedLessons.reduce((total, completion) => {
      return total + (completion.lesson.duration || 0);
    }, 0);

    res.status(200).json({
      success: true,
      data: {
        enrollment,
        progress: {
          percentage: progress,
          completedLessons,
          totalLessons,
          completedDuration,
          totalDuration,
          remainingLessons: totalLessons - completedLessons,
          remainingDuration: totalDuration - completedDuration
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get enrollment analytics (Admin/Instructor only)
// @route   GET /api/enrollments/analytics/overview
// @access  Private/Admin/Instructor
router.get('/analytics/overview', authorize('admin', 'instructor'), async (req, res, next) => {
  try {
    const { courseId } = req.query;
    
    // Build query
    const query = {};
    if (courseId) query.course = courseId;
    
    // If instructor, only show their courses
    if (req.user.role === 'instructor') {
      const instructorCourses = await Course.find({ instructor: req.user.id }).select('_id');
      query.course = { $in: instructorCourses.map(c => c._id) };
    }

    const totalEnrollments = await Enrollment.countDocuments(query);
    const activeEnrollments = await Enrollment.countDocuments({ ...query, status: 'active' });
    const completedEnrollments = await Enrollment.countDocuments({ ...query, status: 'completed' });
    const cancelledEnrollments = await Enrollment.countDocuments({ ...query, status: 'cancelled' });

    // Get recent enrollments
    const recentEnrollments = await Enrollment.find(query)
      .sort({ enrolledAt: -1 })
      .limit(5)
      .populate('student', 'name email')
      .populate('course', 'title');

    // Get enrollments by month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyStats = await Enrollment.aggregate([
      {
        $match: {
          ...query,
          enrolledAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$enrolledAt' },
            month: { $month: '$enrolledAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalEnrollments,
          activeEnrollments,
          completedEnrollments,
          cancelledEnrollments
        },
        recentEnrollments,
        monthlyStats
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
