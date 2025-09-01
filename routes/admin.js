import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { prisma } from '../config/prisma.js';

const router = express.Router();

// Apply admin authorization to all routes
router.use(protect);
router.use(authorize('admin'));

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private/Admin
router.get('/dashboard', async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalCourses,
      totalEnrollments,
      activeUsers,
      publishedCourses,
      recentUsers,
      recentCourses,
      topCategories
    ] = await Promise.all([
      // Total counts
      prisma.user.count(),
      prisma.course.count(),
      prisma.enrollment.count(),
      
      // Active counts
      prisma.user.count({ where: { isActive: true } }),
      prisma.course.count({ where: { status: 'published' } }),
      
      // Recent data (last 30 days)
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      prisma.course.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Top categories
      prisma.course.groupBy({
        by: ['category'],
        where: { status: 'published' },
        _count: { _all: true },
        orderBy: { _count: { _all: 'desc' } },
        take: 5
      })
    ]);

    // Get user distribution by role
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: { _all: true }
    });

    // Get course distribution by status
    const coursesByStatus = await prisma.course.groupBy({
      by: ['status'],
      _count: { _all: true }
    });

    // Get monthly growth data for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyData = await Promise.all([
      // Users
      prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', "createdAt") as month,
          COUNT(*) as count
        FROM "users" 
        WHERE "createdAt" >= ${sixMonthsAgo}
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY month
      `,
      
      // Courses
      prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', "createdAt") as month,
          COUNT(*) as count
        FROM "courses" 
        WHERE "createdAt" >= ${sixMonthsAgo}
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY month
      `,
      
      // Enrollments
      prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', "enrolledAt") as month,
          COUNT(*) as count
        FROM "enrollments" 
        WHERE "enrolledAt" >= ${sixMonthsAgo}
        GROUP BY DATE_TRUNC('month', "enrolledAt")
        ORDER BY month
      `
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalCourses,
          totalEnrollments,
          activeUsers,
          publishedCourses,
          recentUsers,
          recentCourses
        },
        distributions: {
          usersByRole: usersByRole.reduce((acc, item) => {
            acc[item.role] = Number(item._count._all);
            return acc;
          }, {}),
          coursesByStatus: coursesByStatus.reduce((acc, item) => {
            acc[item.status] = Number(item._count._all);
            return acc;
          }, {}),
          topCategories: topCategories.map(cat => ({
            category: cat.category,
            count: cat._count._all
          }))
        },
        growth: {
          users: monthlyData[0],
          courses: monthlyData[1],
          enrollments: monthlyData[2]
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get system status
// @route   GET /api/admin/system
// @access  Private/Admin
router.get('/system', async (req, res, next) => {
  try {
    // Basic system information
    const systemInfo = {
      nodejs: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    };

    // Database connection test
    let databaseStatus = 'connected';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      databaseStatus = 'disconnected';
    }

    res.status(200).json({
      success: true,
      data: {
        system: systemInfo,
        database: {
          status: databaseStatus,
          provider: 'postgresql'
        },
        features: {
          emailService: !!process.env.EMAIL_HOST,
          fileUploads: !!process.env.CLOUDINARY_CLOUD_NAME || !!process.env.AWS_S3_BUCKET,
          emailVerification: process.env.ENABLE_EMAIL_VERIFICATION === 'true'
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Bulk operations on users
// @route   POST /api/admin/users/bulk
// @access  Private/Admin
router.post('/users/bulk', async (req, res, next) => {
  try {
    const { action, userIds } = req.body;

    if (!action || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Action and userIds array are required'
      });
    }

    let result;
    switch (action) {
      case 'activate':
        result = await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: { isActive: true }
        });
        break;
        
      case 'deactivate':
        result = await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: { isActive: false }
        });
        break;
        
      case 'delete':
        // Prevent deleting the current admin
        const filteredIds = userIds.filter(id => id !== req.user.id);
        result = await prisma.user.deleteMany({
          where: { id: { in: filteredIds } }
        });
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action. Supported actions: activate, deactivate, delete'
        });
    }

    res.status(200).json({
      success: true,
      message: `Bulk ${action} completed successfully`,
      data: { affected: result.count }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Bulk operations on courses
// @route   POST /api/admin/courses/bulk
// @access  Private/Admin
router.post('/courses/bulk', async (req, res, next) => {
  try {
    const { action, courseIds } = req.body;

    if (!action || !Array.isArray(courseIds) || courseIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Action and courseIds array are required'
      });
    }

    let result;
    switch (action) {
      case 'publish':
        result = await prisma.course.updateMany({
          where: { id: { in: courseIds } },
          data: { status: 'published' }
        });
        break;
        
      case 'unpublish':
        result = await prisma.course.updateMany({
          where: { id: { in: courseIds } },
          data: { status: 'draft' }
        });
        break;
        
      case 'archive':
        result = await prisma.course.updateMany({
          where: { id: { in: courseIds } },
          data: { status: 'archived' }
        });
        break;
        
      case 'feature':
        result = await prisma.course.updateMany({
          where: { id: { in: courseIds } },
          data: { isFeatured: true }
        });
        break;
        
      case 'unfeature':
        result = await prisma.course.updateMany({
          where: { id: { in: courseIds } },
          data: { isFeatured: false }
        });
        break;
        
      case 'delete':
        result = await prisma.course.deleteMany({
          where: { id: { in: courseIds } }
        });
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action. Supported actions: publish, unpublish, archive, feature, unfeature, delete'
        });
    }

    res.status(200).json({
      success: true,
      message: `Bulk ${action} completed successfully`,
      data: { affected: result.count }
    });
  } catch (error) {
    next(error);
  }
});

export default router;