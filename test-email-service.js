// Test the email service directly
const nodemailer = require('nodemailer');

console.log('🧪 Testing email service configuration...');

// Test the exact same configuration as the server
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE !== 'false', // Use SSL
  auth: {
    user: process.env.SMTP_USER || '93c1d4002@smtp-brevo.com',
    pass: process.env.SMTP_PASS || 'byQ4dHOJkNEaMGYh'
  },
  connectionTimeout: 15000,
  greetingTimeout: 10000,  
  socketTimeout: 20000,
  pool: true,
  maxConnections: 5,
  maxMessages: 100
});

async function testEmailService() {
  try {
    console.log('📧 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!');
    
    console.log('📬 Sending test email...');
    const result = await transporter.sendMail({
      from: '"Tridex Security Team" <security@tridex.com>',
      replyTo: 'support@tridex.com',
      to: 'gff130170@gmail.com',
      subject: 'Test Email - Tridex Account Security Notice',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #007bff;">Tridex Email Test</h2>
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
          <p>If you received this email, the email service is configured correctly!</p>
          <hr>
          <p style="color: #666; font-size: 14px;">
            <strong>Tridex Security Team</strong><br>
            This is an automated test email.
          </p>
        </div>
      `,
      text: 'This is a test email to verify the Tridex email service is working properly.',
      headers: {
        'Message-ID': `<${Date.now()}-${Math.random().toString(36)}@tridex.com>`,
        'X-Mailer': 'Tridex Security System v1.0',
        'X-Auto-Response-Suppress': 'All'
      }
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('📧 Message ID:', result.messageId);
    console.log('📬 Check your email: gff130170@gmail.com');
    
  } catch (error) {
    console.error('❌ Email service test failed:');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    console.error('Command:', error.command);
    
    if (error.response) {
      console.error('Response:', error.response);
    }
  } finally {
    transporter.close();
  }
}

testEmailService();
