const express = require('express');
const { body, validationResult } = require('express-validator');
const Assignment = require('../models/Assignment');
const Course = require('../models/Course');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { createError } = require('../utils/errors');

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

// @desc    Get assignments by course
// @route   GET /api/assignments/course/:courseId
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

    const assignments = await Assignment.findByCourse(courseId, { status })
      .sort({ dueDate: 1 });

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
// @access  Public
router.get('/:id', async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('course', 'title instructor status')
      .populate('submissions.student', 'name avatar');

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Check if assignment is published
    if (assignment.status !== 'published') {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { assignment }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Create assignment
// @route   POST /api/assignments
// @access  Private/Instructor
router.post('/', [
  authorize('instructor', 'admin'),
  upload.fields([
    { name: 'attachments', maxCount: 5 }
  ]),
  body('title')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters'),
  body('course')
    .isMongoId()
    .withMessage('Valid course ID is required'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
  body('type')
    .isIn(['essay', 'project', 'quiz', 'presentation', 'code', 'other'])
    .withMessage('Invalid assignment type'),
  body('dueDate')
    .isISO8601()
    .withMessage('Valid due date is required'),
  body('points')
    .isInt({ min: 1 })
    .withMessage('Points must be a positive integer')
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
      lesson,
      description,
      instructions,
      type,
      dueDate,
      points,
      maxAttempts,
      isRequired,
      allowLateSubmission,
      latePenalty,
      plagiarismCheck
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
        message: 'Not authorized to create assignments for this course'
      });
    }

    // Handle file uploads
    let attachments = [];
    if (req.files.attachments) {
      attachments = req.files.attachments.map(file => ({
        name: file.originalname,
        url: file.path,
        type: file.mimetype,
        size: file.size
      }));
    }

    const assignment = await Assignment.create({
      title,
      course,
      lesson,
      description,
      instructions,
      type,
      dueDate,
      points: parseInt(points),
      maxAttempts: maxAttempts || 1,
      isRequired: isRequired !== false,
      attachments,
      allowLateSubmission: allowLateSubmission || false,
      latePenalty: latePenalty || 0,
      plagiarismCheck: plagiarismCheck || false
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

// @desc    Update assignment
// @route   PUT /api/assignments/:id
// @access  Private/Instructor
router.put('/:id', [
  authorize('instructor', 'admin'),
  upload.fields([
    { name: 'attachments', maxCount: 5 }
  ]),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Valid due date is required')
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

    const assignment = await Assignment.findById(req.params.id);
    
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Check if user is the instructor or admin
    const course = await Course.findById(assignment.course);
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this assignment'
      });
    }

    // Handle file uploads
    if (req.files.attachments) {
      assignment.attachments = req.files.attachments.map(file => ({
        name: file.originalname,
        url: file.path,
        type: file.mimetype,
        size: file.size
      }));
    }

    // Update fields
    const updateFields = [
      'title', 'description', 'instructions', 'type', 'dueDate', 'points',
      'maxAttempts', 'isRequired', 'allowLateSubmission', 'latePenalty',
      'plagiarismCheck', 'rubric', 'status'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'points' || field === 'maxAttempts' || field === 'latePenalty') {
          assignment[field] = parseInt(req.body[field]);
        } else if (field === 'dueDate') {
          assignment[field] = new Date(req.body[field]);
        } else if (field === 'rubric') {
          assignment[field] = JSON.parse(req.body[field]);
        } else {
          assignment[field] = req.body[field];
        }
      }
    });

    await assignment.save();

    res.status(200).json({
      success: true,
      message: 'Assignment updated successfully',
      data: { assignment }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Delete assignment
// @route   DELETE /api/assignments/:id
// @access  Private/Instructor
router.delete('/:id', authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Check if user is the instructor or admin
    const course = await Course.findById(assignment.course);
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this assignment'
      });
    }

    // Check if assignment has submissions
    if (assignment.submissions.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete assignment with existing submissions'
      });
    }

    await assignment.remove();

    res.status(200).json({
      success: true,
      message: 'Assignment deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Submit assignment
// @route   POST /api/assignments/:id/submit
// @access  Private/Student
router.post('/:id/submit', [
  authorize('student'),
  upload.fields([
    { name: 'attachments', maxCount: 5 }
  ]),
  body('content')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Content is required')
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

    const { content } = req.body;
    const assignment = await Assignment.findById(req.params.id);
    
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Check if assignment is published
    if (assignment.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Assignment is not available for submission'
      });
    }

    // Handle file uploads
    let attachments = [];
    if (req.files.attachments) {
      attachments = req.files.attachments.map(file => ({
        name: file.originalname,
        url: file.path,
        type: file.mimetype,
        size: file.size
      }));
    }

    // Submit assignment
    await assignment.submitAssignment(req.user.id, content, attachments);

    res.status(200).json({
      success: true,
      message: 'Assignment submitted successfully',
      data: { assignment }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Grade assignment submission
// @route   PUT /api/assignments/:id/grade
// @access  Private/Instructor
router.put('/:id/grade', [
  authorize('instructor', 'admin'),
  body('studentId')
    .isMongoId()
    .withMessage('Valid student ID is required'),
  body('score')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Score must be between 0 and 100'),
  body('feedback')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Feedback cannot be more than 1000 characters')
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

    const { studentId, score, feedback } = req.body;
    const assignment = await Assignment.findById(req.params.id);
    
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Check if user is the instructor or admin
    const course = await Course.findById(assignment.course);
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to grade this assignment'
      });
    }

    // Grade the submission
    await assignment.gradeSubmission(studentId, score, feedback, req.user.id);

    res.status(200).json({
      success: true,
      message: 'Assignment graded successfully',
      data: { assignment }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get student submission
// @route   GET /api/assignments/:id/submission
// @access  Private
router.get('/:id/submission', async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Get student's submission
    const submission = assignment.getStudentSubmission(req.user.id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'No submission found for this assignment'
      });
    }

    res.status(200).json({
      success: true,
      data: { submission }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get assignment analytics (Instructor only)
// @route   GET /api/assignments/:id/analytics
// @access  Private/Instructor
router.get('/:id/analytics', authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Check if user is the instructor or admin
    const course = await Course.findById(assignment.course);
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view analytics for this assignment'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        assignment,
        analytics: assignment.analytics,
        submissions: assignment.submissions
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
