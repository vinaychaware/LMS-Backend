import express from 'express';
import { body, validationResult } from 'express-validator';
import { protect, authorize } from '../middleware/auth.js';
import {
  enrollInCourse,
  getUserEnrollments,
  getEnrollment,
  updateEnrollmentProgress,
  cancelEnrollment,
  getCourseEnrollments
} from '../controllers/enrollmentsController.js';

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

// @desc    Get user enrollments
// @route   GET /api/enrollments
// @access  Private (Student)
router.get('/', protect, getUserEnrollments);

// @desc    Enroll in a course
// @route   POST /api/enrollments/:courseId
// @access  Private (Student)
router.post('/:courseId', protect, enrollInCourse);

// @desc    Get course enrollments (for instructors)
// @route   GET /api/enrollments/course/:courseId
// @access  Private (Instructor/Admin)
router.get('/course/:courseId', protect, authorize('instructor', 'admin'), getCourseEnrollments);

// @desc    Get single enrollment
// @route   GET /api/enrollments/:id
// @access  Private (Student/Admin)
router.get('/:id', protect, getEnrollment);

// @desc    Update enrollment progress
// @route   PUT /api/enrollments/:id/progress
// @access  Private (Student)
router.put('/:id/progress', protect, [
  body('progress')
    .isInt({ min: 0, max: 100 })
    .withMessage('Progress must be between 0 and 100'),
  handleValidationErrors,
  updateEnrollmentProgress
]);

// @desc    Cancel enrollment
// @route   DELETE /api/enrollments/:id
// @access  Private (Student/Admin)
router.delete('/:id', protect, cancelEnrollment);

export default router;