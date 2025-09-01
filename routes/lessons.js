const express = require('express');
const { body, validationResult } = require('express-validator');
const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { createError } = require('../utils/errors');

const router = express.Router();

// @desc    Get lessons by course
// @route   GET /api/lessons/course/:courseId
// @access  Public
router.get('/course/:courseId', async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { status = 'published' } = req.query;

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const lessons = await Lesson.findByCourse(courseId, { status })
      .sort({ order: 1 });

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
// @access  Public
router.get('/:id', async (req, res, next) => {
  try {
    const lesson = await Lesson.findById(req.params.id)
      .populate('course', 'title instructor status');

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    // Check if lesson is published
    if (lesson.status !== 'published') {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    // Increment view count
    lesson.analytics.views += 1;
    await lesson.save();

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
// @access  Private/Instructor
router.post('/', [
  protect,
  authorize('instructor', 'admin'),
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'attachments', maxCount: 5 }
  ]),
  body('title')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters'),
  body('course')
    .isMongoId()
    .withMessage('Valid course ID is required'),
  body('order')
    .isInt({ min: 1 })
    .withMessage('Order must be a positive integer'),
  body('type')
    .isIn(['video', 'text', 'quiz', 'assignment', 'download', 'interactive'])
    .withMessage('Invalid lesson type'),
  body('content')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Content must be at least 10 characters'),
  body('duration')
    .isInt({ min: 1 })
    .withMessage('Duration must be a positive integer')
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

    const {
      title,
      course,
      order,
      type,
      content,
      duration,
      isFree,
      isPreview,
      completionCriteria
    } = req.body;

    // Check if course exists and user is the instructor
    const courseDoc = await Course.findById(course);
    if (!courseDoc) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (courseDoc.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to create lessons for this course'
      });
    }

    // Handle file uploads
    let video = {};
    let attachments = [];

    if (req.files.video) {
      const videoFile = req.files.video[0];
      video = {
        url: videoFile.path,
        thumbnail: videoFile.path.replace(/\.[^/.]+$/, '.jpg'), // Generate thumbnail path
        transcript: ''
      };
    }

    if (req.files.attachments) {
      attachments = req.files.attachments.map(file => ({
        name: file.originalname,
        url: file.path,
        type: file.mimetype,
        size: file.size
      }));
    }

    const lesson = await Lesson.create({
      title,
      course,
      order,
      type,
      content,
      duration,
      video,
      attachments,
      isFree: isFree || false,
      isPreview: isPreview || false,
      completionCriteria
    });

    // Add lesson to course
    courseDoc.lessons.push(lesson._id);
    await courseDoc.save();

    res.status(201).json({
      success: true,
      message: 'Lesson created successfully',
      data: { lesson }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Update lesson
// @route   PUT /api/lessons/:id
// @access  Private/Instructor
router.put('/:id', [
  protect,
  authorize('instructor', 'admin'),
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'attachments', maxCount: 5 }
  ]),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters'),
  body('order')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Order must be a positive integer')
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

    const lesson = await Lesson.findById(req.params.id);
    
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    // Check if user is the instructor or admin
    const course = await Course.findById(lesson.course);
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this lesson'
      });
    }

    // Handle file uploads
    if (req.files.video) {
      const videoFile = req.files.video[0];
      lesson.video = {
        url: videoFile.path,
        thumbnail: videoFile.path.replace(/\.[^/.]+$/, '.jpg'),
        transcript: lesson.video.transcript || ''
      };
    }

    if (req.files.attachments) {
      lesson.attachments = req.files.attachments.map(file => ({
        name: file.originalname,
        url: file.path,
        type: file.mimetype,
        size: file.size
      }));
    }

    // Update fields
    const updateFields = [
      'title', 'order', 'type', 'content', 'duration', 'isFree', 
      'isPreview', 'completionCriteria', 'resources', 'seo'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        lesson[field] = req.body[field];
      }
    });

    await lesson.save();

    res.status(200).json({
      success: true,
      message: 'Lesson updated successfully',
      data: { lesson }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Delete lesson
// @route   DELETE /api/lessons/:id
// @access  Private/Instructor
router.delete('/:id', [protect, authorize('instructor', 'admin')], async (req, res, next) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    // Check if user is the instructor or admin
    const course = await Course.findById(lesson.course);
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this lesson'
      });
    }

    // Remove lesson from course
    course.lessons = course.lessons.filter(
      lessonId => lessonId.toString() !== lesson._id.toString()
    );
    await course.save();

    // Delete lesson
    await lesson.remove();

    res.status(200).json({
      success: true,
      message: 'Lesson deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Reorder lessons
// @route   PUT /api/lessons/reorder
// @access  Private/Instructor
router.put('/reorder', [
  protect,
  authorize('instructor', 'admin'),
  body('courseId')
    .isMongoId()
    .withMessage('Valid course ID is required'),
  body('lessonOrders')
    .isArray({ min: 1 })
    .withMessage('Lesson orders array is required')
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

    const { courseId, lessonOrders } = req.body;

    // Check if course exists and user is the instructor
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reorder lessons for this course'
      });
    }

    // Update lesson orders
    const updatePromises = lessonOrders.map(({ lessonId, order }) => {
      return Lesson.findByIdAndUpdate(lessonId, { order }, { new: true });
    });

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: 'Lessons reordered successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Mark lesson as completed
// @route   PUT /api/lessons/:id/complete
// @access  Private/Student
router.put('/:id/complete', [
  protect,
  authorize('student'),
  body('timeSpent')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Time spent must be a positive integer')
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

    const { timeSpent } = req.body;
    const lesson = await Lesson.findById(req.params.id);
    
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    // Update lesson analytics
    await lesson.updateAnalytics(true, true, timeSpent || 0);

    res.status(200).json({
      success: true,
      message: 'Lesson marked as completed',
      data: { lesson }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get lesson analytics (Instructor only)
// @route   GET /api/lessons/:id/analytics
// @access  Private/Instructor
router.get('/:id/analytics', [protect, authorize('instructor', 'admin')], async (req, res, next) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    // Check if user is the instructor or admin
    const course = await Course.findById(lesson.course);
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view analytics for this lesson'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        lesson,
        analytics: lesson.analytics
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
