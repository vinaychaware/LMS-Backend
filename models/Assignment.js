const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Assignment = sequelize.define('Assignment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Please provide an assignment title' },
      len: { args: [3, 100], msg: 'Title must be between 3 and 100 characters' }
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
  lessonId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'lessons',
      key: 'id'
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Please provide assignment description' },
      len: { args: [10, 2000], msg: 'Description must be between 10 and 2000 characters' }
    }
  },
  instructions: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: { args: [0, 1000], msg: 'Instructions cannot exceed 1000 characters' }
    }
  },
  type: {
    type: DataTypes.ENUM('essay', 'project', 'quiz', 'presentation', 'code', 'other'),
    defaultValue: 'essay',
    allowNull: false
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      isDate: { msg: 'Please provide a valid due date' }
    }
  },
  points: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 100,
    validate: {
      min: { args: [1], msg: 'Points must be at least 1' }
    }
  },
  maxAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: { args: [1], msg: 'Max attempts must be at least 1' }
    }
  },
  isRequired: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  attachments: {
    type: DataTypes.ARRAY(DataTypes.JSON),
    defaultValue: []
  },
  rubric: {
    type: DataTypes.ARRAY(DataTypes.JSON),
    defaultValue: []
  },
  submissions: {
    type: DataTypes.ARRAY(DataTypes.JSON),
    defaultValue: []
  },
  status: {
    type: DataTypes.ENUM('draft', 'published', 'closed', 'archived'),
    defaultValue: 'draft',
    allowNull: false
  },
  allowLateSubmission: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  latePenalty: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: { args: [0], msg: 'Late penalty cannot be negative' },
      max: { args: [100], msg: 'Late penalty cannot exceed 100' }
    }
  },
  plagiarismCheck: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  timeLimit: {
    type: DataTypes.INTEGER, // in minutes
    allowNull: true,
    validate: {
      min: { args: [1], msg: 'Time limit must be at least 1 minute' }
    }
  },
  isGroupAssignment: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  maxGroupSize: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: { args: [2], msg: 'Max group size must be at least 2' }
    }
  },
  visibility: {
    type: DataTypes.ENUM('visible', 'hidden', 'scheduled'),
    defaultValue: 'visible'
  },
  visibleFrom: {
    type: DataTypes.DATE,
    allowNull: true
  },
  visibleUntil: {
    type: DataTypes.DATE,
    allowNull: true
  },
  analytics: {
    type: DataTypes.JSON,
    defaultValue: {
      totalSubmissions: 0,
      averageScore: 0,
      submissionRate: 0,
      averageTimeSpent: 0,
      onTimeSubmissions: 0,
      lateSubmissions: 0
    }
  },
  settings: {
    type: DataTypes.JSON,
    defaultValue: {
      allowResubmission: false,
      requireApproval: false,
      anonymousGrading: false,
      showRubric: true,
      showSampleSolution: false
    }
  }
}, {
  tableName: 'assignments',
  indexes: [
    {
      fields: ['courseId']
    },
    {
      fields: ['lessonId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['dueDate']
    },
    {
      fields: ['type']
    }
  ]
});

// Instance methods
Assignment.prototype.isOverdue = function() {
  return new Date() > this.dueDate;
};

Assignment.prototype.isVisible = function() {
  if (this.visibility === 'hidden') return false;
  if (this.visibility === 'scheduled') {
    const now = new Date();
    if (this.visibleFrom && now < this.visibleFrom) return false;
    if (this.visibleUntil && now > this.visibleUntil) return false;
  }
  return true;
};

Assignment.prototype.canSubmit = function() {
  if (this.status !== 'published') return false;
  if (!this.isVisible()) return false;
  if (this.isOverdue() && !this.allowLateSubmission) return false;
  return true;
};

Assignment.prototype.getLatePenaltyAmount = function() {
  if (!this.isOverdue()) return 0;
  return Math.round((this.points * this.latePenalty) / 100);
};

Assignment.prototype.updateAnalytics = function() {
  if (this.submissions && this.submissions.length > 0) {
    const totalSubmissions = this.submissions.length;
    const scores = this.submissions
      .filter(sub => sub.score !== null && sub.score !== undefined)
      .map(sub => sub.score);
    
    const averageScore = scores.length > 0 
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
      : 0;
    
    const onTimeSubmissions = this.submissions.filter(sub => 
      new Date(sub.submittedAt) <= this.dueDate
    ).length;
    
    const lateSubmissions = totalSubmissions - onTimeSubmissions;
    
    this.analytics = {
      totalSubmissions,
      averageScore: Math.round(averageScore * 100) / 100,
      submissionRate: 0, // This will be calculated based on course enrollment
      averageTimeSpent: 0, // This will be calculated when time tracking is implemented
      onTimeSubmissions,
      lateSubmissions
    };
  }
  return this.analytics;
};

// Class methods
Assignment.findByCourse = function(courseId) {
  return this.findAll({
    where: { courseId, status: 'published' },
    order: [['dueDate', 'ASC']]
  });
};

Assignment.findByLesson = function(lessonId) {
  return this.findAll({
    where: { lessonId, status: 'published' }
  });
};

Assignment.findPublished = function() {
  return this.findAll({
    where: { status: 'published' },
    order: [['dueDate', 'ASC']]
  });
};

Assignment.findOverdue = function() {
  return this.findAll({
    where: {
      status: 'published',
      dueDate: { [sequelize.Op.lt]: new Date() }
    }
  });
};

Assignment.findByType = function(type) {
  return this.findAll({
    where: { type, status: 'published' }
  });
};

Assignment.getUpcoming = function(days = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.findAll({
    where: {
      status: 'published',
      dueDate: {
        [sequelize.Op.between]: [new Date(), futureDate]
      }
    },
    order: [['dueDate', 'ASC']]
  });
};

Assignment.search = function(query) {
  return this.findAll({
    where: {
      status: 'published',
      [sequelize.Op.or]: [
        { title: { [sequelize.Op.iLike]: `%${query}%` } },
        { description: { [sequelize.Op.iLike]: `%${query}%` } },
        { instructions: { [sequelize.Op.iLike]: `%${query}%` } }
      ]
    }
  });
};

module.exports = Assignment;
