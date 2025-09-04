import nodemailer from 'nodemailer';

export const sendEmail = async ({ email, subject, message }) => {
  const testAccount = await nodemailer.createTestAccount(); // creates throwaway SMTP
  const transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });

  const info = await transporter.sendMail({
    from: '"EduSphere LMS" <no-reply@edusphere.com>',
    to: email,
    subject,
    html: message
  });

  // View the email in the browser:
  console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
  return info;
};
