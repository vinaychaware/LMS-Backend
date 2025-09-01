const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Course = sequelize.define('Course', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Course title is required' },
      len: { args: [5, 200], msg: 'Title must be between 5 and 200 characters' }
    }
  },
  slug: {
    type: DataTypes.STRING(250),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: { msg: 'Course slug is required' }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Course description is required' },
      len: { args: [20, 2000], msg: 'Description must be between 20 and 2000 characters' }
    }
  },
  shortDescription: {
    type: DataTypes.STRING(300),
    allowNull: true,
    validate: {
      len: { args: [0, 300], msg: 'Short description cannot exceed 300 characters' }
    }
  },
  thumbnail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    validate: {
      min: { args: [0], msg: 'Price cannot be negative' }
    }
  },
  originalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    validate: {
      min: { args: [0], msg: 'Original price cannot be negative' }
    }
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD',
    allowNull: false
  },
  level: {
    type: DataTypes.ENUM('beginner', 'intermediate', 'advanced'),
    defaultValue: 'beginner',
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Course category is required' }
    }
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  duration: {
    type: DataTypes.INTEGER, // in minutes
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: { args: [0], msg: 'Duration cannot be negative' }
    }
  },
  lessonsCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: { args: [0], msg: 'Lessons count cannot be negative' }
    }
  },
  studentsCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: { args: [0], msg: 'Students count cannot be negative' }
    }
  },
  rating: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0.00,
    validate: {
      min: { args: [0], msg: 'Rating cannot be negative' },
      max: { args: [5], msg: 'Rating cannot exceed 5' }
    }
  },
  reviewsCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: { args: [0], msg: 'Reviews count cannot be negative' }
    }
  },
  language: {
    type: DataTypes.STRING(50),
    defaultValue: 'English',
    allowNull: false
  },
  requirements: {
    type: DataTypes.ARRAY(DataTypes.TEXT),
    defaultValue: []
  },
  learningOutcomes: {
    type: DataTypes.ARRAY(DataTypes.TEXT),
    defaultValue: []
  },
  materials: {
    type: DataTypes.ARRAY(DataTypes.TEXT),
    defaultValue: []
  },
  instructorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('draft', 'published', 'archived', 'pending_review'),
    defaultValue: 'draft',
    allowNull: false
  },
  isFeatured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isFree: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  enrollmentLimit: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: { args: [1], msg: 'Enrollment limit must be at least 1' }
    }
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  certificateTemplate: {
    type: DataTypes.STRING,
    allowNull: true
  },
  settings: {
    type: DataTypes.JSON,
    defaultValue: {
      allowReviews: true,
      allowQuestions: true,
      allowDownloads: true,
      autoProgress: false,
      completionThreshold: 80
    }
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
      totalViews: 0,
      totalEnrollments: 0,
      completionRate: 0,
      averageTimeSpent: 0
    }
  }
}, {
  tableName: 'courses',
  indexes: [
    {
      fields: ['slug']
    },
    {
      fields: ['instructorId']
    },
    {
      fields: ['category']
    },
    {
      fields: ['status']
    },
    {
      fields: ['isFeatured']
    },
    {
      fields: ['price']
    }
  ]
});

// Instance methods
Course.prototype.getFormattedPrice = function() {
  return `${this.currency} ${this.price}`;
};

Course.prototype.getDiscountPercentage = function() {
  if (!this.originalPrice || this.originalPrice <= this.price) {
    return 0;
  }
  return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
};

Course.prototype.isEnrollmentOpen = function() {
  if (this.status !== 'published') return false;
  if (this.enrollmentLimit && this.studentsCount >= this.enrollmentLimit) return false;
  if (this.endDate && new Date() > this.endDate) return false;
  return true;
};

Course.prototype.getProgress = function(userId) {
  // This will be implemented when we add the enrollment relationship
  return 0;
};

// Class methods
Course.findPublished = function() {
  return this.findAll({ where: { status: 'published' } });
};

Course.findByCategory = function(category) {
  return this.findAll({ where: { category, status: 'published' } });
};

Course.findByInstructor = function(instructorId) {
  return this.findAll({ where: { instructorId } });
};

Course.findFeatured = function() {
  return this.findAll({ where: { isFeatured: true, status: 'published' } });
};

Course.search = function(query) {
  return this.findAll({
    where: {
      status: 'published',
      [sequelize.Op.or]: [
        { title: { [sequelize.Op.iLike]: `%${query}%` } },
        { description: { [sequelize.Op.iLike]: `%${query}%` } },
        { category: { [sequelize.Op.iLike]: `%${query}%` } },
        { tags: { [sequelize.Op.overlap]: [query] } }
      ]
    }
  });
};

module.exports = Course;
