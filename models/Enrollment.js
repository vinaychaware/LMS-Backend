const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Enrollment = sequelize.define('Enrollment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  studentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  courseId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'courses',
      key: 'id'
    }
  },
  enrolledAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  status: {
    type: DataTypes.ENUM('active', 'completed', 'cancelled', 'expired'),
    defaultValue: 'active',
    allowNull: false
  },
  progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: { args: [0], msg: 'Progress cannot be negative' },
      max: { args: [100], msg: 'Progress cannot exceed 100' }
    }
  },
  completedLessons: {
    type: DataTypes.ARRAY(DataTypes.JSON),
    defaultValue: []
  },
  lastAccessed: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  certificate: {
    type: DataTypes.JSON,
    defaultValue: {
      issued: false,
      issuedAt: null,
      certificateId: null
    }
  },
  payment: {
    type: DataTypes.JSON,
    defaultValue: {
      amount: 0,
      currency: 'USD',
      method: null,
      transactionId: null,
      status: 'pending'
    }
  },
  accessExpiry: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completionDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  timeSpent: {
    type: DataTypes.INTEGER, // in minutes
    defaultValue: 0,
    validate: {
      min: { args: [0], msg: 'Time spent cannot be negative' }
    }
  },
  assessmentScores: {
    type: DataTypes.ARRAY(DataTypes.JSON),
    defaultValue: []
  },
  feedback: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: { args: [1], msg: 'Rating must be at least 1' },
      max: { args: [5], msg: 'Rating cannot exceed 5' }
    }
  },
  review: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: { args: [0, 1000], msg: 'Review cannot exceed 1000 characters' }
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'enrollments',
  indexes: [
    {
      fields: ['studentId']
    },
    {
      fields: ['courseId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['enrolledAt']
    },
    {
      unique: true,
      fields: ['studentId', 'courseId']
    }
  ]
});

// Instance methods
Enrollment.prototype.updateProgress = function() {
  if (this.completedLessons && this.completedLessons.length > 0) {
    // This will be calculated based on the course's total lessons
    // Implementation will be added when relationships are set up
    return this.progress;
  }
  return 0;
};

Enrollment.prototype.isCompleted = function() {
  return this.status === 'completed';
};

Enrollment.prototype.isActive = function() {
  return this.status === 'active' && this.isActive;
};

Enrollment.prototype.canAccess = function() {
  if (!this.isActive) return false;
  if (this.accessExpiry && new Date() > this.accessExpiry) return false;
  return true;
};

Enrollment.prototype.markLessonComplete = function(lessonId, timeSpent = 0, score = null) {
  const existingLesson = this.completedLessons.find(
    lesson => lesson.lessonId === lessonId
  );

  if (existingLesson) {
    existingLesson.completedAt = new Date();
    existingLesson.timeSpent = timeSpent;
    if (score !== null) existingLesson.score = score;
  } else {
    this.completedLessons.push({
      lessonId,
      completedAt: new Date(),
      timeSpent,
      score
    });
  }

  this.lastAccessed = new Date();
  return this.save();
};

Enrollment.prototype.getCompletionCertificate = function() {
  if (this.certificate.issued) {
    return {
      certificateId: this.certificate.certificateId,
      issuedAt: this.certificate.issuedAt,
      courseId: this.courseId,
      studentId: this.studentId
    };
  }
  return null;
};

// Class methods
Enrollment.findByStudent = function(studentId) {
  return this.findAll({
    where: { studentId },
    order: [['enrolledAt', 'DESC']]
  });
};

Enrollment.findByCourse = function(courseId) {
  return this.findAll({
    where: { courseId },
    order: [['enrolledAt', 'ASC']]
  });
};

Enrollment.findActive = function() {
  return this.findAll({
    where: { status: 'active', isActive: true }
  });
};

Enrollment.findCompleted = function() {
  return this.findAll({
    where: { status: 'completed' }
  });
};

Enrollment.findByStatus = function(status) {
  return this.findAll({
    where: { status }
  });
};

Enrollment.getStudentProgress = function(studentId, courseId) {
  return this.findOne({
    where: { studentId, courseId }
  });
};

Enrollment.getCourseStats = function(courseId) {
  return this.findAll({
    where: { courseId },
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('AVG', sequelize.col('progress')), 'avgProgress'],
      [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating']
    ],
    group: ['status']
  });
};

module.exports = Enrollment;
