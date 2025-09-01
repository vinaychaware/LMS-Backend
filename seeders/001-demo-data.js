'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create demo users
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    const users = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        first_name: 'Admin',
        last_name: 'User',
        email: 'admin@edusphere.com',
        password: hashedPassword,
        role: 'admin',
        bio: 'System administrator for EduSphere LMS',
        is_email_verified: true,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        first_name: 'John',
        last_name: 'Instructor',
        email: 'instructor@edusphere.com',
        password: hashedPassword,
        role: 'instructor',
        bio: 'Experienced instructor in web development and programming',
        is_email_verified: true,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        first_name: 'Jane',
        last_name: 'Student',
        email: 'student@edusphere.com',
        password: hashedPassword,
        role: 'student',
        bio: 'Passionate learner interested in technology and programming',
        is_email_verified: true,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('users', users, {});

    // Create demo courses
    const courses = [
      {
        id: '550e8400-e29b-41d4-a716-446655440010',
        title: 'Complete Web Development Bootcamp',
        slug: 'complete-web-development-bootcamp',
        description: 'Learn web development from scratch with this comprehensive bootcamp covering HTML, CSS, JavaScript, and modern frameworks.',
        short_description: 'Master web development with hands-on projects',
        price: 99.99,
        original_price: 149.99,
        currency: 'USD',
        level: 'beginner',
        category: 'Programming',
        tags: ['web development', 'javascript', 'html', 'css', 'react'],
        duration: 1200,
        lessons_count: 0,
        students_count: 0,
        rating: 4.8,
        reviews_count: 0,
        language: 'English',
        requirements: ['Basic computer knowledge', 'Willingness to learn'],
        learning_outcomes: [
          'Build responsive websites',
          'Master JavaScript fundamentals',
          'Create modern web applications',
          'Deploy websites to production'
        ],
        materials: ['Video lectures', 'Code examples', 'Project files', 'Quizzes'],
        instructor_id: '550e8400-e29b-41d4-a716-446655440002',
        status: 'published',
        is_featured: true,
        is_free: false,
        settings: {
          allowReviews: true,
          allowQuestions: true,
          allowDownloads: true,
          autoProgress: false,
          completionThreshold: 80
        },
        seo: {
          metaTitle: 'Complete Web Development Bootcamp - Learn to Code',
          metaDescription: 'Master web development with this comprehensive bootcamp. Learn HTML, CSS, JavaScript, and modern frameworks.',
          keywords: ['web development', 'coding', 'programming', 'javascript']
        },
        analytics: {
          totalViews: 0,
          totalEnrollments: 0,
          completionRate: 0,
          averageTimeSpent: 0
        },
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440011',
        title: 'Advanced JavaScript Concepts',
        slug: 'advanced-javascript-concepts',
        description: 'Deep dive into advanced JavaScript concepts including closures, prototypes, async programming, and design patterns.',
        short_description: 'Master advanced JavaScript programming concepts',
        price: 79.99,
        original_price: 99.99,
        currency: 'USD',
        level: 'advanced',
        category: 'Programming',
        tags: ['javascript', 'advanced', 'closures', 'prototypes', 'async'],
        duration: 600,
        lessons_count: 0,
        students_count: 0,
        rating: 4.9,
        reviews_count: 0,
        language: 'English',
        requirements: ['Intermediate JavaScript knowledge', 'Understanding of basic programming concepts'],
        learning_outcomes: [
          'Master JavaScript closures and scope',
          'Understand prototype inheritance',
          'Implement async programming patterns',
          'Apply design patterns in JavaScript'
        ],
        materials: ['Video lectures', 'Code examples', 'Practice exercises', 'Real-world projects'],
        instructor_id: '550e8400-e29b-41d4-a716-446655440002',
        status: 'published',
        is_featured: false,
        is_free: false,
        settings: {
          allowReviews: true,
          allowQuestions: true,
          allowDownloads: true,
          autoProgress: false,
          completionThreshold: 85
        },
        seo: {
          metaTitle: 'Advanced JavaScript Concepts - Master JS Programming',
          metaDescription: 'Learn advanced JavaScript concepts including closures, prototypes, and async programming.',
          keywords: ['javascript', 'advanced programming', 'closures', 'prototypes']
        },
        analytics: {
          totalViews: 0,
          totalEnrollments: 0,
          completionRate: 0,
          averageTimeSpent: 0
        },
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('courses', courses, {});

    // Create demo lessons
    const lessons = [
      {
        id: '550e8400-e29b-41d4-a716-446655440020',
        title: 'Introduction to HTML',
        slug: 'introduction-to-html',
        description: 'Learn the basics of HTML markup language and create your first web page.',
        content: 'HTML (HyperText Markup Language) is the standard markup language for creating web pages...',
        type: 'video',
        duration: 45,
        order: 1,
        course_id: '550e8400-e29b-41d4-a716-446655440010',
        instructor_id: '550e8400-e29b-41d4-a716-446655440002',
        video_url: 'https://example.com/videos/html-intro.mp4',
        video_thumbnail: 'https://example.com/thumbnails/html-intro.jpg',
        video_duration: 2700,
        video_quality: '720p',
        is_free: true,
        is_required: true,
        status: 'published',
        completion_criteria: {
          watchPercentage: 90,
          requireQuiz: false,
          requireAssignment: false,
          minScore: 70
        },
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440021',
        title: 'CSS Fundamentals',
        slug: 'css-fundamentals',
        description: 'Learn CSS styling to make your HTML pages look beautiful and responsive.',
        content: 'CSS (Cascading Style Sheets) is a style sheet language used for describing the presentation...',
        type: 'video',
        duration: 60,
        order: 2,
        course_id: '550e8400-e29b-41d4-a716-446655440010',
        instructor_id: '550e8400-e29b-41d4-a716-446655440002',
        video_url: 'https://example.com/videos/css-fundamentals.mp4',
        video_thumbnail: 'https://example.com/thumbnails/css-fundamentals.jpg',
        video_duration: 3600,
        video_quality: '720p',
        is_free: false,
        is_required: true,
        status: 'published',
        completion_criteria: {
          watchPercentage: 90,
          requireQuiz: true,
          requireAssignment: false,
          minScore: 75
        },
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440022',
        title: 'JavaScript Basics',
        slug: 'javascript-basics',
        description: 'Introduction to JavaScript programming language and basic concepts.',
        content: 'JavaScript is a high-level, interpreted programming language that conforms to the ECMAScript specification...',
        type: 'video',
        duration: 75,
        order: 3,
        course_id: '550e8400-e29b-41d4-a716-446655440010',
        instructor_id: '550e8400-e29b-41d4-a716-446655440002',
        video_url: 'https://example.com/videos/javascript-basics.mp4',
        video_thumbnail: 'https://example.com/thumbnails/javascript-basics.jpg',
        video_duration: 4500,
        video_quality: '720p',
        is_free: false,
        is_required: true,
        status: 'published',
        completion_criteria: {
          watchPercentage: 90,
          requireQuiz: true,
          requireAssignment: true,
          minScore: 80
        },
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('lessons', lessons, {});

    // Update course lesson counts
    await queryInterface.sequelize.query(`
      UPDATE courses 
      SET lessons_count = (
        SELECT COUNT(*) 
        FROM lessons 
        WHERE course_id = courses.id AND status = 'published'
      )
      WHERE id IN ('550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440011')
    `);

    // Create demo assignments
    const assignments = [
      {
        id: '550e8400-e29b-41d4-a716-446655440030',
        title: 'Build Your First Website',
        course_id: '550e8400-e29b-41d4-a716-446655440010',
        lesson_id: '550e8400-e29b-41d4-a716-446655440021',
        description: 'Create a simple personal website using HTML and CSS. Include a header, navigation, main content, and footer.',
        instructions: 'Use semantic HTML tags and CSS styling to create a responsive layout. Submit your HTML and CSS files.',
        type: 'project',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        points: 100,
        max_attempts: 3,
        is_required: true,
        status: 'published',
        allow_late_submission: true,
        late_penalty: 10,
        visibility: 'visible',
        analytics: {
          totalSubmissions: 0,
          averageScore: 0,
          submissionRate: 0,
          averageTimeSpent: 0,
          onTimeSubmissions: 0,
          lateSubmissions: 0
        },
        settings: {
          allowResubmission: true,
          requireApproval: false,
          anonymousGrading: false,
          showRubric: true,
          showSampleSolution: false
        },
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('assignments', assignments, {});

    // Create demo enrollment
    const enrollments = [
      {
        id: '550e8400-e29b-41d4-a716-446655440040',
        student_id: '550e8400-e29b-41d4-a716-446655440003',
        course_id: '550e8400-e29b-41d4-a716-446655440010',
        enrolled_at: new Date(),
        status: 'active',
        progress: 0,
        completed_lessons: [],
        last_accessed: new Date(),
        certificate: {
          issued: false,
          issuedAt: null,
          certificateId: null
        },
        payment: {
          amount: 99.99,
          currency: 'USD',
          method: 'stripe',
          transactionId: 'txn_demo_123',
          status: 'completed'
        },
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('enrollments', enrollments, {});

    // Update course student counts
    await queryInterface.sequelize.query(`
      UPDATE courses 
      SET students_count = (
        SELECT COUNT(*) 
        FROM enrollments 
        WHERE course_id = courses.id AND status = 'active'
      )
      WHERE id IN ('550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440011')
    `);

    // Create demo payment
    const payments = [
      {
        id: '550e8400-e29b-41d4-a716-446655440050',
        user_id: '550e8400-e29b-41d4-a716-446655440003',
        course_id: '550e8400-e29b-41d4-a716-446655440010',
        amount: 99.99,
        currency: 'USD',
        method: 'stripe',
        status: 'completed',
        transaction_id: 'txn_demo_123',
        external_payment_id: 'pi_demo_123',
        description: 'Payment for Complete Web Development Bootcamp',
        metadata: {
          course_title: 'Complete Web Development Bootcamp',
          user_email: 'student@edusphere.com'
        },
        billing_details: {
          name: 'Jane Student',
          email: 'student@edusphere.com'
        },
        payment_method: {
          type: 'card',
          brand: 'visa',
          last4: '4242'
        },
        fees: {
          amount: 3.99,
          currency: 'USD'
        },
        processed_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('payments', payments, {});
  },

  down: async (queryInterface, Sequelize) => {
    // Remove demo data in reverse order
    await queryInterface.bulkDelete('payments', null, {});
    await queryInterface.bulkDelete('enrollments', null, {});
    await queryInterface.bulkDelete('assignments', null, {});
    await queryInterface.bulkDelete('lessons', null, {});
    await queryInterface.bulkDelete('courses', null, {});
    await queryInterface.bulkDelete('users', null, {});
  }
};
