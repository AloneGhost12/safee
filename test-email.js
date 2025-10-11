const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('🧪 Testing Brevo SMTP connection...');
  
  // Create SMTP transporter using Brevo credentials
  const transporter = nodemailer.createTransporter({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false, // Use STARTTLS
    auth: {
      user: '93c1d4002@smtp-brevo.com',
      pass: 'byQ4dHOJkNEaMGYh' // Master Password
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  try {
    // Verify SMTP connection configuration
    console.log('🔍 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully');

    // Send test email
    console.log('📧 Sending test email...');
    const info = await transporter.sendMail({
      from: '"Tridex Support" <gff130170@gmail.com>',
      to: 'test@example.com', // Replace with a real email to test
      subject: '🧪 Email Test - ' + new Date().toISOString(),
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
          <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #007bff;">✅ Email Test Successful!</h2>
            <p>Your Brevo SMTP configuration is working correctly.</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <p><strong>Service:</strong> Brevo SMTP</p>
            <p><strong>From:</strong> Tridex Support</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 14px;"><em>This is a test email from Tridex Support System.</em></p>
          </div>
        </div>
      `
    });

    console.log('✅ Test email sent successfully!');
    console.log('📬 Message ID:', info.messageId);
    console.log('📊 Response:', info.response);
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    console.error('🔍 Full error:', error);
  }
}

testEmail();
