const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Lesson = sequelize.define('Lesson', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Lesson title is required' },
      len: { args: [3, 200], msg: 'Title must be between 3 and 200 characters' }
    }
  },
  slug: {
    type: DataTypes.STRING(250),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: { msg: 'Lesson slug is required' }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: { args: [0, 1000], msg: 'Description cannot exceed 1000 characters' }
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('video', 'text', 'quiz', 'assignment', 'discussion', 'file'),
    defaultValue: 'video',
    allowNull: false
  },
  duration: {
    type: DataTypes.INTEGER, // in minutes
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: { args: [0], msg: 'Duration cannot be negative' }
    }
  },
  order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: { args: [0], msg: 'Order cannot be negative' }
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
  instructorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  videoUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isUrl: { msg: 'Please provide a valid video URL' }
    }
  },
  videoThumbnail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  videoDuration: {
    type: DataTypes.INTEGER, // in seconds
    allowNull: true,
    validate: {
      min: { args: [0], msg: 'Video duration cannot be negative' }
    }
  },
  videoQuality: {
    type: DataTypes.ENUM('360p', '480p', '720p', '1080p', '4k'),
    defaultValue: '720p'
  },
  attachments: {
    type: DataTypes.ARRAY(DataTypes.JSON),
    defaultValue: []
  },
  resources: {
    type: DataTypes.ARRAY(DataTypes.JSON),
    defaultValue: []
  },
  isFree: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isRequired: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  status: {
    type: DataTypes.ENUM('draft', 'published', 'archived'),
    defaultValue: 'draft',
    allowNull: false
  },
  completionCriteria: {
    type: DataTypes.JSON,
    defaultValue: {
      watchPercentage: 90,
      requireQuiz: false,
      requireAssignment: false,
      minScore: 70
    }
  },
  quiz: {
    type: DataTypes.JSON,
    allowNull: true
  },
  assignment: {
    type: DataTypes.JSON,
    allowNull: true
  },
  discussion: {
    type: DataTypes.JSON,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  seo: {
    type: DataTypes.JSON,
    defaultValue: {
      metaTitle: '',
      metaDescription: '',
      keywords: []
    }
  },
  analytics: {
    type: DataTypes.JSON,
    defaultValue: {
      views: 0,
      completions: 0,
      averageTimeSpent: 0,
      dropOffRate: 0
    }
  }
}, {
  tableName: 'lessons',
  indexes: [
    {
      fields: ['courseId']
    },
    {
      fields: ['instructorId']
    },
    {
      fields: ['slug']
    },
    {
      fields: ['order']
    },
    {
      fields: ['status']
    }
  ]
});

// Instance methods
Lesson.prototype.getFormattedDuration = function() {
  const hours = Math.floor(this.duration / 60);
  const minutes = this.duration % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

Lesson.prototype.isCompleted = function(userId) {
  // This will be implemented when we add the enrollment relationship
  return false;
};

Lesson.prototype.getNextLesson = function() {
  // This will be implemented when we add the course relationship
  return null;
};

Lesson.prototype.getPreviousLesson = function() {
  // This will be implemented when we add the course relationship
  return null;
};

// Class methods
Lesson.findByCourse = function(courseId) {
  return this.findAll({
    where: { courseId, status: 'published' },
    order: [['order', 'ASC']]
  });
};

Lesson.findByInstructor = function(instructorId) {
  return this.findAll({
    where: { instructorId },
    order: [['createdAt', 'DESC']]
  });
};

Lesson.findPublished = function() {
  return this.findAll({
    where: { status: 'published' },
    order: [['order', 'ASC']]
  });
};

Lesson.findByType = function(type) {
  return this.findAll({
    where: { type, status: 'published' }
  });
};

Lesson.search = function(query) {
  return this.findAll({
    where: {
      status: 'published',
      [sequelize.Op.or]: [
        { title: { [sequelize.Op.iLike]: `%${query}%` } },
        { description: { [sequelize.Op.iLike]: `%${query}%` } },
        { content: { [sequelize.Op.iLike]: `%${query}%` } }
      ]
    }
  });
};

module.exports = Lesson;
