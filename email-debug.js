const nodemailer = require('nodemailer');

async function comprehensiveEmailTest() {
  console.log('🧪 Starting comprehensive email diagnostic...\n');
  
  try {
    // Test 1: Basic SMTP connection
    console.log('1️⃣ Testing SMTP connection...');
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: '93c1d4002@smtp-brevo.com',
        pass: 'byQ4dHOJkNEaMGYh'
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 5000,    // 5 seconds
      socketTimeout: 10000      // 10 seconds
    });

    await transporter.verify();
    console.log('✅ SMTP connection verified\n');

    // Test 2: Send simple test email
    console.log('2️⃣ Sending test email...');
    const testResult = await transporter.sendMail({
      from: '"Tridex Test" <gff130170@gmail.com>',
      to: 'gff130170@gmail.com',
      subject: '🧪 Diagnostic Email Test',
      text: 'This is a test email to diagnose email delivery issues.',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>🧪 Email Diagnostic Test</h2>
          <p>This email confirms that the SMTP configuration is working correctly.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>Test ID:</strong> ${Math.random().toString(36).substring(7)}</p>
        </div>
      `
    });

    console.log('✅ Test email sent successfully!');
    console.log('📧 Message ID:', testResult.messageId);
    console.log('📨 Response:', testResult.response);
    
    // Close the transporter
    transporter.close();
    
    console.log('\n🎉 All tests passed! Email service is working correctly.');
    console.log('📬 Check your inbox at: gff130170@gmail.com');
    
  } catch (error) {
    console.error('\n❌ Email test failed:');
    console.error('Error Message:', error.message);
    console.error('Error Code:', error.code);
    console.error('Error Command:', error.command);
    
    if (error.response) {
      console.error('SMTP Response:', error.response);
    }
    
    if (error.responseCode) {
      console.error('Response Code:', error.responseCode);
    }
    
    // Suggest common fixes
    console.log('\n🔧 Troubleshooting suggestions:');
    console.log('   • Check internet connection');
    console.log('   • Verify Brevo account is active');
    console.log('   • Check if SMTP credentials are correct');
    console.log('   • Ensure firewall allows outbound SMTP connections');
  }
}

// Run the test
comprehensiveEmailTest();
