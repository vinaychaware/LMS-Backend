'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create users table
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      first_name: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      last_name: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      role: {
        type: Sequelize.ENUM('student', 'instructor', 'admin'),
        defaultValue: 'student',
        allowNull: false
      },
      avatar: {
        type: Sequelize.STRING,
        allowNull: true
      },
      bio: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      date_of_birth: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      address: {
        type: Sequelize.JSON,
        allowNull: true
      },
      is_email_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      email_verification_token: {
        type: Sequelize.STRING,
        allowNull: true
      },
      email_verification_expires: {
        type: Sequelize.DATE,
        allowNull: true
      },
      password_reset_token: {
        type: Sequelize.STRING,
        allowNull: true
      },
      password_reset_expires: {
        type: Sequelize.DATE,
        allowNull: true
      },
      last_login: {
        type: Sequelize.DATE,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      preferences: {
        type: Sequelize.JSON,
        defaultValue: {}
      },
      social_links: {
        type: Sequelize.JSON,
        defaultValue: {}
      },
      stripe_customer_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      paypal_email: {
        type: Sequelize.STRING,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create courses table
    await queryInterface.createTable('courses', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      slug: {
        type: Sequelize.STRING(250),
        allowNull: false,
        unique: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      short_description: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      thumbnail: {
        type: Sequelize.STRING,
        allowNull: true
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      original_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      currency: {
        type: Sequelize.STRING(3),
        defaultValue: 'USD',
        allowNull: false
      },
      level: {
        type: Sequelize.ENUM('beginner', 'intermediate', 'advanced'),
        defaultValue: 'beginner',
        allowNull: false
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      tags: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: []
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      lessons_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      students_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      rating: {
        type: Sequelize.DECIMAL(3, 2),
        defaultValue: 0.00
      },
      reviews_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      language: {
        type: Sequelize.STRING(50),
        defaultValue: 'English',
        allowNull: false
      },
      requirements: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        defaultValue: []
      },
      learning_outcomes: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        defaultValue: []
      },
      materials: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        defaultValue: []
      },
      instructor_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      status: {
        type: Sequelize.ENUM('draft', 'published', 'archived', 'pending_review'),
        defaultValue: 'draft',
        allowNull: false
      },
      is_featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      is_free: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      enrollment_limit: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      start_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      end_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      certificate_template: {
        type: Sequelize.STRING,
        allowNull: true
      },
      settings: {
        type: Sequelize.JSON,
        defaultValue: {}
      },
      seo: {
        type: Sequelize.JSON,
        defaultValue: {}
      },
      analytics: {
        type: Sequelize.JSON,
        defaultValue: {}
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create lessons table
    await queryInterface.createTable('lessons', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      slug: {
        type: Sequelize.STRING(250),
        allowNull: false,
        unique: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      type: {
        type: Sequelize.ENUM('video', 'text', 'quiz', 'assignment', 'discussion', 'file'),
        defaultValue: 'video',
        allowNull: false
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      course_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'courses',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      instructor_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      video_url: {
        type: Sequelize.STRING,
        allowNull: true
      },
      video_thumbnail: {
        type: Sequelize.STRING,
        allowNull: true
      },
      video_duration: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      video_quality: {
        type: Sequelize.ENUM('360p', '480p', '720p', '1080p', '4k'),
        defaultValue: '720p'
      },
      attachments: {
        type: Sequelize.ARRAY(Sequelize.JSON),
        defaultValue: []
      },
      resources: {
        type: Sequelize.ARRAY(Sequelize.JSON),
        defaultValue: []
      },
      is_free: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      is_required: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      status: {
        type: Sequelize.ENUM('draft', 'published', 'archived'),
        defaultValue: 'draft',
        allowNull: false
      },
      completion_criteria: {
        type: Sequelize.JSON,
        defaultValue: {}
      },
      quiz: {
        type: Sequelize.JSON,
        allowNull: true
      },
      assignment: {
        type: Sequelize.JSON,
        allowNull: true
      },
      discussion: {
        type: Sequelize.JSON,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      seo: {
        type: Sequelize.JSON,
        defaultValue: {}
      },
      analytics: {
        type: Sequelize.JSON,
        defaultValue: {}
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create enrollments table
    await queryInterface.createTable('enrollments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      student_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      course_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'courses',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      enrolled_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      status: {
        type: Sequelize.ENUM('active', 'completed', 'cancelled', 'expired'),
        defaultValue: 'active',
        allowNull: false
      },
      progress: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      completed_lessons: {
        type: Sequelize.ARRAY(Sequelize.JSON),
        defaultValue: []
      },
      last_accessed: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      certificate: {
        type: Sequelize.JSON,
        defaultValue: {}
      },
      payment: {
        type: Sequelize.JSON,
        defaultValue: {}
      },
      access_expiry: {
        type: Sequelize.DATE,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      start_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      completion_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      time_spent: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      assessment_scores: {
        type: Sequelize.ARRAY(Sequelize.JSON),
        defaultValue: []
      },
      feedback: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      rating: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      review: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create assignments table
    await queryInterface.createTable('assignments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      title: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      course_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'courses',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      lesson_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'lessons',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      instructions: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      type: {
        type: Sequelize.ENUM('essay', 'project', 'quiz', 'presentation', 'code', 'other'),
        defaultValue: 'essay',
        allowNull: false
      },
      due_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      points: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 100
      },
      max_attempts: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      is_required: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      attachments: {
        type: Sequelize.ARRAY(Sequelize.JSON),
        defaultValue: []
      },
      rubric: {
        type: Sequelize.ARRAY(Sequelize.JSON),
        defaultValue: []
      },
      submissions: {
        type: Sequelize.ARRAY(Sequelize.JSON),
        defaultValue: []
      },
      status: {
        type: Sequelize.ENUM('draft', 'published', 'closed', 'archived'),
        defaultValue: 'draft',
        allowNull: false
      },
      allow_late_submission: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      late_penalty: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      plagiarism_check: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      time_limit: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      is_group_assignment: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      max_group_size: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      visibility: {
        type: Sequelize.ENUM('visible', 'hidden', 'scheduled'),
        defaultValue: 'visible'
      },
      visible_from: {
        type: Sequelize.DATE,
        allowNull: true
      },
      visible_until: {
        type: Sequelize.DATE,
        allowNull: true
      },
      analytics: {
        type: Sequelize.JSON,
        defaultValue: {}
      },
      settings: {
        type: Sequelize.JSON,
        defaultValue: {}
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create payments table
    await queryInterface.createTable('payments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      course_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'courses',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING(3),
        defaultValue: 'USD',
        allowNull: false
      },
      method: {
        type: Sequelize.ENUM('stripe', 'paypal', 'bank_transfer', 'crypto', 'other'),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'),
        defaultValue: 'pending',
        allowNull: false
      },
      transaction_id: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: true
      },
      external_payment_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      payment_intent_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      refund_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSON,
        defaultValue: {}
      },
      billing_details: {
        type: Sequelize.JSON,
        defaultValue: {}
      },
      payment_method: {
        type: Sequelize.JSON,
        defaultValue: {}
      },
      fees: {
        type: Sequelize.JSON,
        defaultValue: {}
      },
      refund: {
        type: Sequelize.JSON,
        defaultValue: {}
      },
      error: {
        type: Sequelize.JSON,
        allowNull: true
      },
      processed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      is_recurring: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      recurring_interval: {
        type: Sequelize.ENUM('monthly', 'quarterly', 'yearly'),
        allowNull: true
      },
      next_billing_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      subscription_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      invoice_url: {
        type: Sequelize.STRING,
        allowNull: true
      },
      receipt_url: {
        type: Sequelize.STRING,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for better performance
    await queryInterface.addIndex('users', ['email']);
    await queryInterface.addIndex('users', ['role']);
    await queryInterface.addIndex('users', ['is_active']);

    await queryInterface.addIndex('courses', ['slug']);
    await queryInterface.addIndex('courses', ['instructor_id']);
    await queryInterface.addIndex('courses', ['category']);
    await queryInterface.addIndex('courses', ['status']);
    await queryInterface.addIndex('courses', ['is_featured']);

    await queryInterface.addIndex('lessons', ['course_id']);
    await queryInterface.addIndex('lessons', ['instructor_id']);
    await queryInterface.addIndex('lessons', ['order']);
    await queryInterface.addIndex('lessons', ['status']);

    await queryInterface.addIndex('enrollments', ['student_id']);
    await queryInterface.addIndex('enrollments', ['course_id']);
    await queryInterface.addIndex('enrollments', ['status']);
    await queryInterface.addIndex('enrollments', ['enrolled_at']);

    await queryInterface.addIndex('assignments', ['course_id']);
    await queryInterface.addIndex('assignments', ['lesson_id']);
    await queryInterface.addIndex('assignments', ['due_date']);
    await queryInterface.addIndex('assignments', ['status']);

    await queryInterface.addIndex('payments', ['user_id']);
    await queryInterface.addIndex('payments', ['course_id']);
    await queryInterface.addIndex('payments', ['status']);
    await queryInterface.addIndex('payments', ['transaction_id']);

    // Add unique constraints
    await queryInterface.addConstraint('enrollments', {
      fields: ['student_id', 'course_id'],
      type: 'unique',
      name: 'enrollments_student_course_unique'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Drop tables in reverse order
    await queryInterface.dropTable('payments');
    await queryInterface.dropTable('assignments');
    await queryInterface.dropTable('enrollments');
    await queryInterface.dropTable('lessons');
    await queryInterface.dropTable('courses');
    await queryInterface.dropTable('users');
  }
};
