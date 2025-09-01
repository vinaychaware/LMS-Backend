const User = require('./User');
const Course = require('./Course');
const Lesson = require('./Lesson');
const Enrollment = require('./Enrollment');
const Assignment = require('./Assignment');
const Payment = require('./Payment');

// Define associations
const setupAssociations = () => {
  // User associations
  User.hasMany(Course, { 
    foreignKey: 'instructorId', 
    as: 'instructedCourses' 
  });
  
  User.hasMany(Lesson, { 
    foreignKey: 'instructorId', 
    as: 'instructedLessons' 
  });
  
  User.hasMany(Enrollment, { 
    foreignKey: 'studentId', 
    as: 'enrollments' 
  });
  
  User.hasMany(Payment, { 
    foreignKey: 'userId', 
    as: 'payments' 
  });

  // Course associations
  Course.belongsTo(User, { 
    foreignKey: 'instructorId', 
    as: 'instructor' 
  });
  
  Course.hasMany(Lesson, { 
    foreignKey: 'courseId', 
    as: 'lessons' 
  });
  
  Course.hasMany(Enrollment, { 
    foreignKey: 'courseId', 
    as: 'enrollments' 
  });
  
  Course.hasMany(Assignment, { 
    foreignKey: 'courseId', 
    as: 'assignments' 
  });
  
  Course.hasMany(Payment, { 
    foreignKey: 'courseId', 
    as: 'payments' 
  });

  // Lesson associations
  Lesson.belongsTo(Course, { 
    foreignKey: 'courseId', 
    as: 'course' 
  });
  
  Lesson.belongsTo(User, { 
    foreignKey: 'instructorId', 
    as: 'instructor' 
  });
  
  Lesson.hasMany(Assignment, { 
    foreignKey: 'lessonId', 
    as: 'assignments' 
  });

  // Enrollment associations
  Enrollment.belongsTo(User, { 
    foreignKey: 'studentId', 
    as: 'student' 
  });
  
  Enrollment.belongsTo(Course, { 
    foreignKey: 'courseId', 
    as: 'course' 
  });

  // Assignment associations
  Assignment.belongsTo(Course, { 
    foreignKey: 'courseId', 
    as: 'course' 
  });
  
  Assignment.belongsTo(Lesson, { 
    foreignKey: 'lessonId', 
    as: 'lesson' 
  });

  // Payment associations
  Payment.belongsTo(User, { 
    foreignKey: 'userId', 
    as: 'user' 
  });
  
  Payment.belongsTo(Course, { 
    foreignKey: 'courseId', 
    as: 'course' 
  });
};

// Export models and setup function
module.exports = {
  User,
  Course,
  Lesson,
  Enrollment,
  Assignment,
  Payment,
  setupAssociations
};
