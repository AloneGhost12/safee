const nodemailer = require('nodemailer');

// Email diagnostic test with detailed logging
async function diagnoseEmailIssue() {
  console.log('🔍 Starting comprehensive email diagnostic...');
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  // Create SMTP transporter with debug logging
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false, // Use STARTTLS
    auth: {
      user: '93c1d4002@smtp-brevo.com',
      pass: 'byQ4dHOJkNEaMGYh'
    },
    tls: {
      rejectUnauthorized: false
    },
    debug: true,  // Enable debug logging
    logger: true  // Enable logger
  });

  try {
    console.log('\n📡 Step 1: Testing SMTP connection...');
    console.log('Host: smtp-relay.brevo.com');
    console.log('Port: 587');
    console.log('Security: STARTTLS');
    
    // Set a timeout for verification
    const verifyPromise = transporter.verify();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout after 30 seconds')), 30000);
    });
    
    await Promise.race([verifyPromise, timeoutPromise]);
    console.log('✅ SMTP connection verified successfully');

    console.log('\n📧 Step 2: Preparing test email...');
    const mailOptions = {
      from: '"Tridex Support Test" <gff130170@gmail.com>',
      to: 'gff130170@gmail.com',
      subject: '🧪 Email Diagnostic Test - ' + new Date().toLocaleString(),
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
          <div style="background: white; padding: 30px; border-radius: 8px; max-width: 600px;">
            <h2 style="color: #007bff; margin-top: 0;">🧪 Email Diagnostic Test</h2>
            <p><strong>Status:</strong> <span style="color: green;">SUCCESS</span></p>
            <p><strong>Test Type:</strong> Direct SMTP Test</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <p><strong>Purpose:</strong> Account Recovery Email Debug</p>
            <hr style="margin: 20px 0; border: 1px solid #eee;">
            <h3>Configuration Details:</h3>
            <ul>
              <li><strong>SMTP Host:</strong> smtp-relay.brevo.com</li>
              <li><strong>Port:</strong> 587 (STARTTLS)</li>
              <li><strong>Auth User:</strong> 93c1d4002@smtp-brevo.com</li>
              <li><strong>From Email:</strong> gff130170@gmail.com</li>
            </ul>
            <hr style="margin: 20px 0; border: 1px solid #eee;">
            <p style="color: #666; font-size: 14px;">
              <em>If you received this email, the SMTP configuration is working correctly!</em>
            </p>
          </div>
        </div>
      `,
      text: 'Email Diagnostic Test - If you received this, SMTP is working correctly!'
    };

    console.log('To:', mailOptions.to);
    console.log('From:', mailOptions.from);
    console.log('Subject:', mailOptions.subject);

    console.log('\n📤 Step 3: Sending test email...');
    console.log('⏳ Please wait, this may take 10-30 seconds...');
    
    // Set timeout for sending
    const sendPromise = transporter.sendMail(mailOptions);
    const sendTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email send timeout after 60 seconds')), 60000);
    });
    
    const info = await Promise.race([sendPromise, sendTimeoutPromise]);
    
    console.log('\n✅ EMAIL SENT SUCCESSFULLY!');
    console.log('📬 Message ID:', info.messageId);
    console.log('📧 Response:', info.response);
    console.log('🔍 Check your email inbox: gff130170@gmail.com');
    
    // Additional info if available
    if (info.envelope) {
      console.log('📮 Envelope:', info.envelope);
    }
    if (info.accepted) {
      console.log('✅ Accepted recipients:', info.accepted);
    }
    if (info.rejected) {
      console.log('❌ Rejected recipients:', info.rejected);
    }
    
  } catch (error) {
    console.log('\n❌ EMAIL DIAGNOSTIC FAILED');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    
    if (error.code) {
      console.error('Error Code:', error.code);
    }
    if (error.response) {
      console.error('SMTP Response:', error.response);
    }
    if (error.responseCode) {
      console.error('Response Code:', error.responseCode);
    }
    if (error.command) {
      console.error('SMTP Command:', error.command);  
    }
    
    // Provide troubleshooting hints
    console.log('\n🛠️ Troubleshooting Hints:');
    if (error.message.includes('timeout')) {
      console.log('- Network connectivity issue or slow connection');
      console.log('- Try checking your internet connection');
      console.log('- Firewall might be blocking SMTP port 587');
    }
    if (error.message.includes('authentication')) {
      console.log('- Check SMTP credentials');
      console.log('- Verify Brevo account is active');
    }
    if (error.message.includes('refused') || error.message.includes('connect')) {
      console.log('- SMTP server might be unreachable');
      console.log('- Check if smtp-relay.brevo.com is accessible');
    }
  }
  
  console.log('\n🔚 Diagnostic complete');
}

// Run the diagnostic
diagnoseEmailIssue().catch(console.error);
