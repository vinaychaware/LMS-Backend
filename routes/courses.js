const express = require('express');
const { body, validationResult } = require('express-validator');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { createError } = require('../utils/errors');

const router = express.Router();

// @desc    Get all courses
// @route   GET /api/courses
// @access  Public
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      level,
      instructor,
      search,
      minPrice,
      maxPrice,
      isFree,
      isFeatured,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = { status: 'published' };
    
    if (category) query.category = category;
    if (level) query.level = level;
    if (instructor) query.instructor = instructor;
    if (isFree !== undefined) query.isFree = isFree === 'true';
    if (isFeatured !== undefined) query.isFeatured = isFeatured === 'true';
    
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) query.price.$gte = parseFloat(minPrice);
      if (maxPrice !== undefined) query.price.$lte = parseFloat(maxPrice);
    }
    
    if (search) {
      query.$text = { $search: search };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: [
        { path: 'instructor', select: 'name avatar' },
        { path: 'lessons', select: 'title duration type' }
      ]
    };

    const courses = await Course.paginate(query, options);

    res.status(200).json({
      success: true,
      data: courses
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get single course
// @route   GET /api/courses/:id
// @access  Public
router.get('/:id', async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('instructor', 'name avatar bio')
      .populate('lessons', 'title order type duration isPreview')
      .populate('enrolledStudents.student', 'name avatar');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Increment view count
    course.analytics.views += 1;
    await course.save();

    res.status(200).json({
      success: true,
      data: { course }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Create course
// @route   POST /api/courses
// @access  Private/Instructor
router.post('/', [
  protect,
  authorize('instructor', 'admin'),
  upload.single('thumbnail'),
  body('title')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters'),
  body('description')
    .trim()
    .isLength({ min: 20, max: 2000 })
    .withMessage('Description must be between 20 and 2000 characters'),
  body('category')
    .isIn(['programming', 'design', 'business', 'marketing', 'music', 'photography', 'health', 'fitness', 'language', 'academic', 'other'])
    .withMessage('Invalid category'),
  body('level')
    .isIn(['beginner', 'intermediate', 'advanced', 'all-levels'])
    .withMessage('Invalid level'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('requirements')
    .optional()
    .isArray()
    .withMessage('Requirements must be an array'),
  body('learningOutcomes')
    .optional()
    .isArray()
    .withMessage('Learning outcomes must be an array')
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
      description,
      shortDescription,
      category,
      subcategory,
      tags,
      level,
      price,
      originalPrice,
      currency,
      requirements,
      learningOutcomes,
      materials,
      language,
      subtitles
    } = req.body;

    // Handle thumbnail upload
    let thumbnail = '';
    if (req.file) {
      thumbnail = req.file.path;
    }

    const course = await Course.create({
      title,
      description,
      shortDescription,
      category,
      subcategory,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      level,
      price: parseFloat(price),
      originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
      currency,
      instructor: req.user.id,
      thumbnail,
      requirements: requirements ? requirements.split(',').map(req => req.trim()) : [],
      learningOutcomes: learningOutcomes ? learningOutcomes.split(',').map(outcome => outcome.trim()) : [],
      materials: materials ? materials.split(',').map(material => material.trim()) : [],
      language,
      subtitles: subtitles ? subtitles.split(',').map(subtitle => subtitle.trim()) : []
    });

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: { course }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Update course
// @route   PUT /api/courses/:id
// @access  Private/Instructor
router.put('/:id', [
  protect,
  authorize('instructor', 'admin'),
  upload.single('thumbnail'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 20, max: 2000 })
    .withMessage('Description must be between 20 and 2000 characters')
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

    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user is the instructor or admin
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this course'
      });
    }

    // Handle thumbnail upload
    if (req.file) {
      course.thumbnail = req.file.path;
    }

    // Update fields
    const updateFields = [
      'title', 'description', 'shortDescription', 'category', 'subcategory',
      'tags', 'level', 'price', 'originalPrice', 'currency', 'requirements',
      'learningOutcomes', 'materials', 'language', 'subtitles'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'tags' || field === 'requirements' || field === 'learningOutcomes' || field === 'materials' || field === 'subtitles') {
          course[field] = req.body[field].split(',').map(item => item.trim());
        } else if (field === 'price' || field === 'originalPrice') {
          course[field] = parseFloat(req.body[field]);
        } else {
          course[field] = req.body[field];
        }
      }
    });

    await course.save();

    res.status(200).json({
      success: true,
      message: 'Course updated successfully',
      data: { course }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Delete course
// @route   DELETE /api/courses/:id
// @access  Private/Instructor
router.delete('/:id', [protect, authorize('instructor', 'admin')], async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user is the instructor or admin
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this course'
      });
    }

    // Check if course has enrollments
    if (course.totalEnrollments > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete course with active enrollments'
      });
    }

    await course.remove();

    res.status(200).json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Publish course
// @route   PUT /api/courses/:id/publish
// @access  Private/Instructor
router.put('/:id/publish', [protect, authorize('instructor', 'admin')], async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user is the instructor or admin
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to publish this course'
      });
    }

    // Check if course has lessons
    if (!course.lessons || course.lessons.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Course must have at least one lesson to be published'
      });
    }

    course.status = 'published';
    await course.save();

    res.status(200).json({
      success: true,
      message: 'Course published successfully',
      data: { course }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Add review to course
// @route   POST /api/courses/:id/reviews
// @access  Private/Student
router.post('/:id/reviews', [
  protect,
  authorize('student'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Comment cannot be more than 500 characters')
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

    const { rating, comment } = req.body;
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if student is enrolled
    const isEnrolled = course.enrolledStudents.some(
      enrollment => enrollment.student.toString() === req.user.id
    );

    if (!isEnrolled) {
      return res.status(403).json({
        success: false,
        message: 'You must be enrolled in this course to leave a review'
      });
    }

    // Add review
    await course.addReview(req.user.id, rating, comment);

    res.status(200).json({
      success: true,
      message: 'Review added successfully',
      data: { course }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get course analytics (Instructor only)
// @route   GET /api/courses/:id/analytics
// @access  Private/Instructor
router.get('/:id/analytics', [protect, authorize('instructor', 'admin')], async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user is the instructor or admin
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view analytics for this course'
      });
    }

    // Calculate additional analytics
    const totalRevenue = course.totalRevenue;
    const averageRating = course.rating.average;
    const totalReviews = course.rating.count;
    const completionRate = course.analytics.completionRate;

    res.status(200).json({
      success: true,
      data: {
        course,
        analytics: {
          totalRevenue,
          averageRating,
          totalReviews,
          completionRate,
          views: course.analytics.views,
          uniqueViews: course.analytics.uniqueViews,
          totalEnrollments: course.totalEnrollments,
          totalLessons: course.totalLessons,
          totalDuration: course.totalDuration
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
