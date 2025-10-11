require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('🧪 Testing email service...');

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 465,
  secure: true,
  auth: {
    user: '93c1d4002@smtp-brevo.com',
    pass: 'byQ4dHOJkNEaMGYh'
  },
  connectionTimeout: 15000,
  greetingTimeout: 10000,
  socketTimeout: 20000
});

async function testEmail() {
  try {
    console.log('📧 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified!');
    
    console.log('📬 Sending test email...');
    const result = await transporter.sendMail({
      from: '"Tridex Test" <security@tridex.com>',
      to: 'gff130170@gmail.com',
      subject: 'Test Email from Tridex - Account Security System',
      text: 'This is a test email to check if the Tridex email service works.',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #007bff;">🧪 Tridex Email Test</h2>
          <p>This is a test email to verify the email service is working properly.</p>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h4>Test Details:</h4>
            <ul>
              <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
              <li><strong>SMTP Host:</strong> smtp-relay.brevo.com</li>
              <li><strong>Port:</strong> 465 (SSL)</li>
              <li><strong>Service:</strong> Brevo SMTP</li>
            </ul>
          </div>
          <p>✅ If you received this email, the email service is configured correctly!</p>
          <hr>
          <p style="color: #666; font-size: 14px;">
            <strong>Tridex Security Team</strong><br>
            This is an automated test email.
          </p>
        </div>
      `
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('📧 Message ID:', result.messageId);
    console.log('📬 Check your email: gff130170@gmail.com');
    console.log('📋 Check both inbox and spam folder');
    
  } catch (error) {
    console.error('❌ Email service test failed:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    if (error.response) {
      console.error('Server response:', error.response);
    }
  } finally {
    transporter.close();
  }
}

testEmail();
