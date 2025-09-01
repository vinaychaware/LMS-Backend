# EduSphere LMS Backend API

A comprehensive Learning Management System (LMS) backend built with Node.js, Express, and PostgreSQL. This API provides all the necessary endpoints for managing courses, users, enrollments, assignments, and payments in an educational platform.

## 🚀 Features

### Core LMS Features
- **User Management**: Student, instructor, and admin roles with comprehensive authentication
- **Course Management**: Create, update, and manage courses with rich content
- **Lesson System**: Structured lessons with various content types (video, text, quiz, etc.)
- **Enrollment System**: Student enrollment tracking with progress monitoring
- **Assignment Management**: Create and grade assignments with submission tracking
- **Payment Processing**: Integrated payment gateways (Stripe, PayPal)
- **File Management**: Secure file uploads for course materials and assignments

### Advanced Features
- **Role-Based Access Control**: Granular permissions for different user types
- **Progress Tracking**: Monitor student progress through courses and lessons
- **Analytics Dashboard**: Comprehensive insights for instructors and admins
- **Email Notifications**: Automated emails for various system events
- **Search & Filtering**: Advanced search capabilities across all entities
- **API Rate Limiting**: Built-in protection against abuse
- **File Upload Security**: Secure file handling with type validation

## 🛠️ Tech Stack

### Backend Framework
- **Node.js**: JavaScript runtime environment
- **Express.js**: Web application framework
- **PostgreSQL**: Primary database with Sequelize ORM
- **Sequelize**: Object-Relational Mapping (ORM) for database operations

### Authentication & Security
- **JWT**: JSON Web Tokens for stateless authentication
- **bcryptjs**: Password hashing and verification
- **Helmet**: Security middleware for Express
- **CORS**: Cross-Origin Resource Sharing configuration
- **Rate Limiting**: Express rate limiting for API protection

### File Handling
- **Multer**: Multipart form data handling for file uploads
- **File Validation**: Type, size, and content validation
- **Secure Storage**: Local file storage with path security

### Payment Integration
- **Stripe**: Primary payment gateway integration
- **PayPal**: Alternative payment method
- **Payment Webhooks**: Real-time payment status updates

### Email Services
- **Nodemailer**: Email sending functionality
- **Ethereal**: Development email testing service
- **SMTP**: Production email configuration

### Development Tools
- **Nodemon**: Development server with auto-restart
- **ESLint**: Code linting and formatting
- **Jest**: Testing framework
- **Sequelize CLI**: Database migration and seeding tools

## 📁 Project Structure

```
backend/
├── config/
│   └── database.js          # Database configuration
├── middleware/
│   ├── auth.js              # Authentication middleware
│   ├── errorHandler.js      # Global error handling
│   ├── notFound.js          # 404 error handling
│   └── upload.js            # File upload middleware
├── models/
│   ├── index.js             # Model associations
│   ├── User.js              # User model
│   ├── Course.js            # Course model
│   ├── Lesson.js            # Lesson model
│   ├── Enrollment.js        # Enrollment model
│   ├── Assignment.js        # Assignment model
│   └── Payment.js           # Payment model
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── users.js             # User management routes
│   ├── courses.js           # Course management routes
│   ├── lessons.js           # Lesson management routes
│   ├── enrollments.js       # Enrollment routes
│   ├── assignments.js       # Assignment routes
│   ├── payments.js          # Payment routes
│   └── admin.js             # Admin routes
├── utils/
│   ├── errors.js            # Error handling utilities
│   └── email.js             # Email service utilities
├── scripts/
│   └── setup.js             # Project setup script
├── uploads/                  # File upload directory
├── logs/                     # Application logs
├── .sequelizerc             # Sequelize CLI configuration
├── server.js                # Main application entry point
├── package.json             # Dependencies and scripts
└── env.example              # Environment variables template
```

## 🚀 Getting Started

### Prerequisites

- **Node.js**: Version 16 or higher
- **PostgreSQL**: Version 12 or higher
- **npm**: Node package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Set up PostgreSQL database**
   ```bash
   # Create database
   createdb edusphere_lms
   
   # Or use psql
   psql -U postgres
   CREATE DATABASE edusphere_lms;
   ```

5. **Run the setup script**
   ```bash
   npm run setup
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

### Environment Variables

Create a `.env` file in the backend directory with the following variables:

```env
# Database Configuration (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=edusphere_lms
DB_USER=postgres
DB_PASSWORD=your_password_here

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=7d

# Server Configuration
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
```

## 🗄️ Database Setup

### PostgreSQL Installation

**Windows:**
- Download from [PostgreSQL official website](https://www.postgresql.org/download/windows/)
- Use the installer with default settings

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Database Creation

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE edusphere_lms;
CREATE USER edusphere_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE edusphere_lms TO edusphere_user;
\q
```

### Database Migration

The application will automatically create tables on first run. For manual control:

```bash
# Create tables
npm run db:migrate

# Seed with sample data
npm run db:seed

# Reset database
npm run db:reset
```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Password reset request
- `PUT /api/auth/reset-password` - Reset password

### Users
- `GET /api/users` - Get all users (Admin)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (Admin)

### Courses
- `GET /api/courses` - Get all courses
- `GET /api/courses/:id` - Get course by ID
- `POST /api/courses` - Create course (Instructor/Admin)
- `PUT /api/courses/:id` - Update course (Instructor/Admin)
- `DELETE /api/courses/:id` - Delete course (Instructor/Admin)

### Lessons
- `GET /api/lessons/course/:courseId` - Get lessons by course
- `GET /api/lessons/:id` - Get lesson by ID
- `POST /api/lessons` - Create lesson (Instructor/Admin)
- `PUT /api/lessons/:id` - Update lesson (Instructor/Admin)
- `DELETE /api/lessons/:id` - Delete lesson (Instructor/Admin)

### Enrollments
- `GET /api/enrollments/my` - Get user enrollments
- `POST /api/enrollments` - Enroll in course
- `PUT /api/enrollments/:id/complete-lesson` - Complete lesson
- `GET /api/enrollments/:id/progress` - Get enrollment progress

### Assignments
- `GET /api/assignments/course/:courseId` - Get assignments by course
- `POST /api/assignments/:id/submit` - Submit assignment
- `PUT /api/assignments/:id/grade` - Grade assignment (Instructor)

### Payments
- `POST /api/payments/create-intent` - Create payment intent
- `PUT /api/payments/:id/confirm` - Confirm payment
- `GET /api/payments/my` - Get user payments

### Admin
- `GET /api/admin/dashboard` - Admin dashboard overview
- `GET /api/admin/analytics` - System analytics
- `PUT /api/admin/settings` - Update system settings

## 🔐 Authentication & Authorization

### JWT Tokens
- Access tokens with configurable expiration
- Secure token storage and validation
- Automatic token refresh mechanism

### Role-Based Access Control
- **Student**: Access to enrolled courses, submit assignments
- **Instructor**: Manage own courses, grade assignments
- **Admin**: Full system access and management

### Protected Routes
All routes except authentication endpoints require valid JWT tokens. Role-specific routes check user permissions.

## 📁 File Uploads

### Supported File Types
- **Images**: JPEG, PNG, GIF, WebP
- **Videos**: MP4, WebM, MOV
- **Documents**: PDF, DOC, DOCX
- **Archives**: ZIP, RAR

### Security Features
- File type validation
- Size limits (configurable)
- Secure file naming
- Path traversal protection

## 📧 Email System

### Email Types
- Welcome emails
- Password reset
- Course enrollment confirmations
- Assignment reminders
- Payment confirmations

### Configuration
- Development: Ethereal email service
- Production: SMTP configuration
- Template-based email content

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Test Structure
- Unit tests for models and utilities
- Integration tests for API endpoints
- Mock data for testing scenarios

## 🚀 Deployment

### Production Considerations
- Set `NODE_ENV=production`
- Use strong JWT secrets
- Configure SSL/TLS
- Set up proper database backups
- Configure production email service
- Set up monitoring and logging

### Environment Variables
Ensure all production environment variables are properly configured:
- Database credentials
- JWT secrets
- Email configuration
- Payment gateway keys
- File storage configuration

## 🔒 Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: API abuse prevention
- **Input Validation**: Request data sanitization
- **SQL Injection Protection**: Parameterized queries via Sequelize
- **XSS Protection**: Content Security Policy headers

## 📊 Monitoring & Logging

- **Morgan**: HTTP request logging
- **Error Tracking**: Centralized error handling
- **Performance Monitoring**: Response time tracking
- **File Logging**: Structured log files

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code Style
- Use ESLint configuration
- Follow existing code patterns
- Add JSDoc comments for functions
- Maintain consistent formatting

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the documentation
- Review existing issues
- Create a new issue with detailed information
- Contact the development team

## 🔄 Version History

### v1.0.0
- Initial release with PostgreSQL support
- Complete LMS functionality
- Role-based access control
- File upload system
- Payment integration
- Email notifications

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [Sequelize Documentation](https://sequelize.org/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [JWT.io](https://jwt.io/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
