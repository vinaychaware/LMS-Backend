const express = require('express');
const { body, validationResult } = require('express-validator');
const Payment = require('../models/Payment');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const { protect, authorize } = require('../middleware/auth');
const { createError } = require('../utils/errors');

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

// @desc    Get all payments (Admin only)
// @route   GET /api/payments
// @access  Private/Admin
router.get('/', authorize('admin'), async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, method, course, user } = req.query;
    
    // Build query
    const query = {};
    if (status) query.status = status;
    if (method) query.method = method;
    if (course) query.course = course;
    if (user) query.user = user;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      populate: [
        { path: 'user', select: 'name email' },
        { path: 'course', select: 'title instructor' }
      ],
      sort: { createdAt: -1 }
    };

    const payments = await Payment.paginate(query, options);

    res.status(200).json({
      success: true,
      data: payments
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get user payments
// @route   GET /api/payments/my
// @access  Private
router.get('/my', async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    // Build query
    const query = { user: req.user.id };
    if (status) query.status = status;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      populate: [
        { path: 'course', select: 'title thumbnail instructor' },
        { path: 'course.instructor', select: 'name avatar' }
      ],
      sort: { createdAt: -1 }
    };

    const payments = await Payment.paginate(query, options);

    res.status(200).json({
      success: true,
      data: payments
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get single payment
// @route   GET /api/payments/:id
// @access  Private
router.get('/:id', async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('user', 'name email avatar')
      .populate('course', 'title thumbnail instructor');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if user can access this payment
    if (req.user.role !== 'admin' && payment.user._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this payment'
      });
    }

    res.status(200).json({
      success: true,
      data: { payment }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Create payment intent
// @route   POST /api/payments/create-intent
// @access  Private/Student
router.post('/create-intent', [
  authorize('student'),
  body('courseId')
    .isMongoId()
    .withMessage('Valid course ID is required'),
  body('paymentMethod')
    .isIn(['stripe', 'paypal', 'bank_transfer', 'crypto'])
    .withMessage('Valid payment method is required'),
  body('billingDetails')
    .optional()
    .isObject()
    .withMessage('Billing details must be an object')
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

    const { courseId, paymentMethod, billingDetails } = req.body;

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
        message: 'Course is not available for purchase'
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
      amount: course.price,
      currency: course.currency,
      method: paymentMethod,
      description: `Enrollment in ${course.title}`,
      billingDetails,
      metadata: {
        courseTitle: course.title,
        courseId: courseId
      }
    });

    // Generate payment intent (this would integrate with Stripe/PayPal)
    let paymentIntent = null;
    if (paymentMethod === 'stripe') {
      // Stripe integration would go here
      paymentIntent = {
        id: `pi_${payment._id.toString().slice(-24)}`,
        client_secret: `pi_${payment._id.toString().slice(-24)}_secret_${Math.random().toString(36).substr(2, 9)}`
      };
    }

    res.status(201).json({
      success: true,
      message: 'Payment intent created successfully',
      data: {
        payment,
        paymentIntent,
        requiresAction: paymentMethod === 'stripe'
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Confirm payment
// @route   PUT /api/payments/:id/confirm
// @access  Private/Student
router.put('/:id/confirm', [
  authorize('student'),
  body('transactionId')
    .notEmpty()
    .withMessage('Transaction ID is required'),
  body('externalPaymentId')
    .optional()
    .notEmpty()
    .withMessage('External payment ID is required if provided')
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

    const { transactionId, externalPaymentId } = req.body;
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if user owns this payment
    if (payment.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to confirm this payment'
      });
    }

    // Check if payment can be confirmed
    if (payment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Payment cannot be confirmed in current status'
      });
    }

    // Confirm payment
    await payment.complete(transactionId, externalPaymentId);

    // Create enrollment
    const enrollment = await Enrollment.create({
      student: req.user.id,
      course: payment.course,
      payment: {
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        transactionId: payment.transactionId,
        status: 'completed'
      }
    });

    // Update course enrollment count
    const course = await Course.findById(payment.course);
    course.totalEnrollments += 1;
    await course.save();

    res.status(200).json({
      success: true,
      message: 'Payment confirmed and enrollment created successfully',
      data: {
        payment,
        enrollment
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Cancel payment
// @route   PUT /api/payments/:id/cancel
// @access  Private/Student
router.put('/:id/cancel', authorize('student'), async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if user owns this payment
    if (payment.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this payment'
      });
    }

    // Cancel payment
    await payment.cancel();

    res.status(200).json({
      success: true,
      message: 'Payment cancelled successfully',
      data: { payment }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Process refund (Admin only)
// @route   PUT /api/payments/:id/refund
// @access  Private/Admin
router.put('/:id/refund', [
  authorize('admin'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Valid refund amount is required'),
  body('reason')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Reason must be between 5 and 200 characters')
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

    const { amount, reason } = req.body;
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Process refund
    await payment.processRefund(amount, reason, req.user.id);

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      data: { payment }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get payment analytics (Admin only)
// @route   GET /api/payments/analytics/overview
// @access  Private/Admin
router.get('/analytics/overview', authorize('admin'), async (req, res, next) => {
  try {
    const totalPayments = await Payment.countDocuments();
    const completedPayments = await Payment.countDocuments({ status: 'completed' });
    const pendingPayments = await Payment.countDocuments({ status: 'pending' });
    const failedPayments = await Payment.countDocuments({ status: 'failed' });
    const refundedPayments = await Payment.countDocuments({ status: 'refunded' });

    // Calculate total revenue
    const revenueData = await Payment.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          averagePayment: { $avg: '$amount' }
        }
      }
    ]);

    const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;
    const averagePayment = revenueData.length > 0 ? revenueData[0].averagePayment : 0;

    // Get recent payments
    const recentPayments = await Payment.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'name email')
      .populate('course', 'title');

    // Get payments by month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyStats = await Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          revenue: { $sum: '$amount' }
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
          totalPayments,
          completedPayments,
          pendingPayments,
          failedPayments,
          refundedPayments,
          totalRevenue,
          averagePayment
        },
        recentPayments,
        monthlyStats
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Webhook for payment gateway updates
// @route   POST /api/payments/webhook
// @access  Public
router.post('/webhook', async (req, res, next) => {
  try {
    // This would handle webhooks from Stripe/PayPal
    // Verify webhook signature and process the event
    
    const { type, data } = req.body;
    
    switch (type) {
      case 'payment_intent.succeeded':
        // Handle successful payment
        break;
      case 'payment_intent.payment_failed':
        // Handle failed payment
        break;
      default:
        console.log(`Unhandled event type: ${type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
