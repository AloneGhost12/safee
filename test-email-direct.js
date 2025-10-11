const nodemailer = require('nodemailer');

// Direct email test using the same configuration as the server
async function testEmailDirect() {
  console.log('🧪 Testing Brevo SMTP connection directly...');
  
  // Create SMTP transporter using the same configuration as in emailService.ts
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false, // Use STARTTLS
    auth: {
      user: '93c1d4002@smtp-brevo.com',
      pass: 'byQ4dHOJkNEaMGYh' // Master Password from your config
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  try {
    // Verify connection
    console.log('🔍 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully');

    // Send test email
    console.log('📧 Sending test email...');
    const info = await transporter.sendMail({
      from: '"Tridex Support" <gff130170@gmail.com>',
      to: 'gff130170@gmail.com', // Send to yourself for testing
      subject: '🧪 Direct Email Test - Tridex',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
          <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #007bff;">✅ Direct Email Test Successful!</h2>
            <p>This email was sent directly using the Brevo SMTP configuration.</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <p><strong>Service:</strong> Brevo SMTP (smtp-relay.brevo.com:587)</p>
            <p><strong>From:</strong> Tridex Support &lt;gff130170@gmail.com&gt;</p>
            <p><strong>Test Purpose:</strong> Account Recovery Email Debug</p>
            <hr style="margin: 20px 0;">
            <p style="color: #666; font-size: 14px;"><em>This is a direct test email to verify SMTP functionality.</em></p>
          </div>
        </div>
      `,
      text: 'Direct Email Test Successful! This email was sent to verify SMTP functionality.'
    });

    console.log('✅ Test email sent successfully!');
    console.log('📧 Message ID:', info.messageId);
    console.log('📬 Check your email inbox:', 'gff130170@gmail.com');
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    if (error.code) {
      console.error('Error Code:', error.code);
    }
    if (error.response) {
      console.error('SMTP Response:', error.response);
    }
  } finally {
    console.log('🔚 Test completed');
  }
}

// Run the test
testEmailDirect().catch(console.error);
