const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  // For development, use ethereal email
  if (process.env.NODE_ENV === 'development') {
    return nodemailer.createTransporter({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: process.env.ETHEREAL_USER || 'test@ethereal.email',
        pass: process.env.ETHEREAL_PASS || 'test123'
      }
    });
  }

  // For production, use real email service
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Send email
const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@edusphere.com',
      to: options.email,
      subject: options.subject,
      html: options.message
    };

    const info = await transporter.sendMail(mailOptions);

    if (process.env.NODE_ENV === 'development') {
      console.log('Email sent:', info.messageId);
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    }

    return info;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
};

// Send welcome email
const sendWelcomeEmail = async (user) => {
  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">Welcome to EduSphere LMS!</h2>
      <p>Hi ${user.name},</p>
      <p>Thank you for joining EduSphere LMS. We're excited to have you on board!</p>
      <p>Here's what you can do next:</p>
      <ul>
        <li>Complete your profile</li>
        <li>Browse available courses</li>
        <li>Start learning</li>
      </ul>
      <p>If you have any questions, feel free to contact our support team.</p>
      <p>Best regards,<br>The EduSphere Team</p>
    </div>
  `;

  return sendEmail({
    email: user.email,
    subject: 'Welcome to EduSphere LMS',
    message
  });
};

// Send course enrollment confirmation
const sendEnrollmentConfirmation = async (user, course) => {
  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">Course Enrollment Confirmed</h2>
      <p>Hi ${user.name},</p>
      <p>Your enrollment in <strong>${course.title}</strong> has been confirmed!</p>
      <p>Course Details:</p>
      <ul>
        <li><strong>Title:</strong> ${course.title}</li>
        <li><strong>Instructor:</strong> ${course.instructor}</li>
        <li><strong>Duration:</strong> ${course.totalDuration} minutes</li>
        <li><strong>Lessons:</strong> ${course.totalLessons}</li>
      </ul>
      <p>You can now access your course content and start learning.</p>
      <p>Happy learning!<br>The EduSphere Team</p>
    </div>
  `;

  return sendEmail({
    email: user.email,
    subject: `Enrollment Confirmed - ${course.title}`,
    message
  });
};

// Send course completion certificate
const sendCompletionCertificate = async (user, course, certificateId) => {
  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">🎉 Course Completed!</h2>
      <p>Congratulations ${user.name}!</p>
      <p>You have successfully completed <strong>${course.title}</strong>!</p>
      <p>Your certificate ID is: <strong>${certificateId}</strong></p>
      <p>You can download your certificate from your dashboard.</p>
      <p>Keep up the great work and continue learning!</p>
      <p>Best regards,<br>The EduSphere Team</p>
    </div>
  `;

  return sendEmail({
    email: user.email,
    subject: `Course Completed - ${course.title}`,
    message
  });
};

// Send assignment reminder
const sendAssignmentReminder = async (user, assignment, course) => {
  const dueDate = new Date(assignment.dueDate).toLocaleDateString();
  
  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #FF6B6B;">Assignment Reminder</h2>
      <p>Hi ${user.name},</p>
      <p>This is a reminder that you have an upcoming assignment:</p>
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p><strong>Assignment:</strong> ${assignment.title}</p>
        <p><strong>Course:</strong> ${course.title}</p>
        <p><strong>Due Date:</strong> ${dueDate}</p>
        <p><strong>Points:</strong> ${assignment.points}</p>
      </div>
      <p>Please make sure to submit your assignment on time.</p>
      <p>Good luck!<br>The EduSphere Team</p>
    </div>
  `;

  return sendEmail({
    email: user.email,
    subject: `Assignment Reminder - ${assignment.title}`,
    message
  });
};

// Send password reset email
const sendPasswordResetEmail = async (user, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">Password Reset Request</h2>
      <p>Hi ${user.name},</p>
      <p>You requested a password reset for your EduSphere LMS account.</p>
      <p>Click the button below to reset your password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">${resetUrl}</p>
      <p>This link will expire in 10 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <p>Best regards,<br>The EduSphere Team</p>
    </div>
  `;

  return sendEmail({
    email: user.email,
    subject: 'Password Reset Request - EduSphere LMS',
    message
  });
};

// Send email verification email
const sendVerificationEmail = async (user, verificationToken) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
  
  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">Verify Your Email</h2>
      <p>Hi ${user.name},</p>
      <p>Please verify your email address to complete your EduSphere LMS registration.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Verify Email
        </a>
      </div>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
      <p>This link will expire in 24 hours.</p>
      <p>Best regards,<br>The EduSphere Team</p>
    </div>
  `;

  return sendEmail({
    email: user.email,
    subject: 'Verify Your Email - EduSphere LMS',
    message
  });
};

// Send course announcement
const sendCourseAnnouncement = async (students, course, announcement) => {
  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">Course Announcement</h2>
      <p>Hi there,</p>
      <p>There's a new announcement in your course <strong>${course.title}</strong>:</p>
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h3>${announcement.title}</h3>
        <p>${announcement.content}</p>
        <p><small>Posted on: ${new Date(announcement.createdAt).toLocaleDateString()}</small></p>
      </div>
      <p>Please check your course dashboard for more details.</p>
      <p>Best regards,<br>The EduSphere Team</p>
    </div>
  `;

  // Send to all enrolled students
  const emailPromises = students.map(student => 
    sendEmail({
      email: student.email,
      subject: `Course Announcement - ${course.title}`,
      message
    })
  );

  return Promise.all(emailPromises);
};

// Send payment confirmation
const sendPaymentConfirmation = async (user, payment, course) => {
  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10B981;">Payment Confirmed</h2>
      <p>Hi ${user.name},</p>
      <p>Your payment has been confirmed successfully!</p>
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p><strong>Course:</strong> ${course.title}</p>
        <p><strong>Amount:</strong> $${payment.amount}</p>
        <p><strong>Transaction ID:</strong> ${payment.transactionId}</p>
        <p><strong>Date:</strong> ${new Date(payment.processedAt).toLocaleDateString()}</p>
      </div>
      <p>You now have full access to the course content.</p>
      <p>Happy learning!<br>The EduSphere Team</p>
    </div>
  `;

  return sendEmail({
    email: user.email,
    subject: `Payment Confirmed - ${course.title}`,
    message
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendEnrollmentConfirmation,
  sendCompletionCertificate,
  sendAssignmentReminder,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendCourseAnnouncement,
  sendPaymentConfirmation
};
