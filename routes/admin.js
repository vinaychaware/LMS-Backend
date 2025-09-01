const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Payment = require('../models/Payment');
const { protect, authorize } = require('../middleware/auth');
const { createError } = require('../utils/errors');

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);
router.use(authorize('admin'));

// @desc    Get admin dashboard overview
// @route   GET /api/admin/dashboard
// @access  Private/Admin
router.get('/dashboard', async (req, res, next) => {
  try {
    // Get user statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const students = await User.countDocuments({ role: 'student' });
    const instructors = await User.countDocuments({ role: 'instructor' });
    const admins = await User.countDocuments({ role: 'admin' });

    // Get course statistics
    const totalCourses = await Course.countDocuments();
    const publishedCourses = await Course.countDocuments({ status: 'published' });
    const draftCourses = await Course.countDocuments({ status: 'draft' });
    const featuredCourses = await Course.countDocuments({ isFeatured: true });

    // Get enrollment statistics
    const totalEnrollments = await Enrollment.countDocuments();
    const activeEnrollments = await Enrollment.countDocuments({ status: 'active' });
    const completedEnrollments = await Enrollment.countDocuments({ status: 'completed' });

    // Get payment statistics
    const totalPayments = await Payment.countDocuments();
    const completedPayments = await Payment.countDocuments({ status: 'completed' });
    const pendingPayments = await Payment.countDocuments({ status: 'pending' });

    // Calculate revenue
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

    // Get recent activities
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role createdAt');

    const recentCourses = await Course.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title instructor status createdAt')
      .populate('instructor', 'name');

    const recentEnrollments = await Enrollment.find()
      .sort({ enrolledAt: -1 })
      .limit(5)
      .populate('student', 'name')
      .populate('course', 'title');

    // Get monthly statistics (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyStats = await User.aggregate([
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
          userCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          verified: verifiedUsers,
          students,
          instructors,
          admins
        },
        courses: {
          total: totalCourses,
          published: publishedCourses,
          draft: draftCourses,
          featured: featuredCourses
        },
        enrollments: {
          total: totalEnrollments,
          active: activeEnrollments,
          completed: completedEnrollments
        },
        payments: {
          total: totalPayments,
          completed: completedPayments,
          pending: pendingPayments,
          totalRevenue,
          averagePayment
        },
        recentActivities: {
          users: recentUsers,
          courses: recentCourses,
          enrollments: recentEnrollments
        },
        monthlyStats
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get system analytics
// @route   GET /api/admin/analytics
// @access  Private/Admin
router.get('/analytics', async (req, res, next) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // User growth
    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Course creation
    const courseCreation = await Course.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Revenue trends
    const revenueTrends = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Top performing courses
    const topCourses = await Course.aggregate([
      { $match: { status: 'published' } },
      {
        $project: {
          title: 1,
          totalEnrollments: 1,
          'rating.average': 1,
          'rating.count': 1,
          price: 1,
          totalRevenue: { $multiply: ['$price', '$totalEnrollments'] }
        }
      },
      { $sort: { totalEnrollments: -1 } },
      { $limit: 10 }
    ]);

    // Top instructors
    const topInstructors = await Course.aggregate([
      { $match: { status: 'published' } },
      {
        $group: {
          _id: '$instructor',
          totalCourses: { $sum: 1 },
          totalEnrollments: { $sum: '$totalEnrollments' },
          totalRevenue: { $sum: { $multiply: ['$price', '$totalEnrollments'] } },
          averageRating: { $avg: '$rating.average' }
        }
      },
      { $sort: { totalEnrollments: -1 } },
      { $limit: 10 }
    ]);

    // Populate instructor names
    const instructorIds = topInstructors.map(instructor => instructor._id);
    const instructors = await User.find({ _id: { $in: instructorIds } }).select('name email');
    
    const topInstructorsWithNames = topInstructors.map(instructor => {
      const instructorInfo = instructors.find(i => i._id.toString() === instructor._id.toString());
      return {
        ...instructor,
        instructorName: instructorInfo ? instructorInfo.name : 'Unknown',
        instructorEmail: instructorInfo ? instructorInfo.email : 'Unknown'
      };
    });

    res.status(200).json({
      success: true,
      data: {
        period,
        userGrowth,
        courseCreation,
        revenueTrends,
        topCourses,
        topInstructors: topInstructorsWithNames
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Update system settings
// @route   PUT /api/admin/settings
// @access  Private/Admin
router.put('/settings', [
  body('settings')
    .isObject()
    .withMessage('Settings must be an object')
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

    const { settings } = req.body;

    // Here you would update system settings in a database or config file
    // For now, we'll just return success

    res.status(200).json({
      success: true,
      message: 'System settings updated successfully',
      data: { settings }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Bulk operations
// @route   POST /api/admin/bulk-operations
// @access  Private/Admin
router.post('/bulk-operations', [
  body('operation')
    .isIn(['activate', 'deactivate', 'delete', 'verify', 'unverify'])
    .withMessage('Valid operation is required'),
  body('type')
    .isIn(['users', 'courses', 'enrollments'])
    .withMessage('Valid type is required'),
  body('ids')
    .isArray({ min: 1 })
    .withMessage('IDs array is required')
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

    const { operation, type, ids } = req.body;

    let result;
    let model;

    // Select model based on type
    switch (type) {
      case 'users':
        model = User;
        break;
      case 'courses':
        model = Course;
        break;
      case 'enrollments':
        model = Enrollment;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid type'
        });
    }

    // Perform bulk operation
    switch (operation) {
      case 'activate':
        result = await model.updateMany(
          { _id: { $in: ids } },
          { $set: { isActive: true } }
        );
        break;
      case 'deactivate':
        result = await model.updateMany(
          { _id: { $in: ids } },
          { $set: { isActive: false } }
        );
        break;
      case 'delete':
        result = await model.deleteMany({ _id: { $in: ids } });
        break;
      case 'verify':
        if (type === 'users') {
          result = await model.updateMany(
            { _id: { $in: ids } },
            { $set: { isVerified: true } }
          );
        } else {
          return res.status(400).json({
            success: false,
            message: 'Verify operation only available for users'
          });
        }
        break;
      case 'unverify':
        if (type === 'users') {
          result = await model.updateMany(
            { _id: { $in: ids } },
            { $set: { isVerified: false } }
          );
        } else {
          return res.status(400).json({
            success: false,
            message: 'Unverify operation only available for users'
          });
        }
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid operation'
        });
    }

    res.status(200).json({
      success: true,
      message: `Bulk ${operation} operation completed successfully`,
      data: {
        operation,
        type,
        processedCount: result.modifiedCount || result.deletedCount,
        totalCount: ids.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get system health
// @route   GET /api/admin/health
// @access  Private/Admin
router.get('/health', async (req, res, next) => {
  try {
    // Check database connection
    const dbStatus = 'healthy'; // In real app, check actual DB connection
    
    // Check file system
    const fsStatus = 'healthy'; // In real app, check disk space, etc.
    
    // Check external services
    const externalServices = {
      email: 'healthy', // In real app, check email service
      storage: 'healthy', // In real app, check cloud storage
      payment: 'healthy' // In real app, check payment gateways
    };

    // Get system info
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    };

    res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: dbStatus,
        fileSystem: fsStatus,
        externalServices,
        systemInfo
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
