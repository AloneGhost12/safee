// Direct test of the lockout email functionality
const nodemailer = require('nodemailer');

// Simulate the email service
class TestEmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 465,
      secure: true,
      auth: {
        user: '93c1d4002@smtp-brevo.com',
        pass: 'byQ4dHOJkNEaMGYh'
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 15000
    });
  }

  async sendAccountLockoutAlert(email, userName, lockoutDurationMinutes, clientInfo) {
    console.log('📧 Sending account lockout alert...');
    console.log('- Email:', email);
    console.log('- Username:', userName);
    console.log('- Duration:', lockoutDurationMinutes, 'minutes');
    console.log('- Client Info:', JSON.stringify(clientInfo, null, 2));

    const currentYear = new Date().getFullYear();
    const timestamp = new Date().toLocaleString('en-US', { 
      timeZone: 'UTC',
      dateStyle: 'full',
      timeStyle: 'long'
    });

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account Security Alert</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4; }
        .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border-top: 4px solid #dc3545; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 28px; font-weight: bold; color: #dc3545; margin-bottom: 10px; }
        .alert-box { background: linear-gradient(135deg, #dc3545, #c82333); color: white; padding: 20px; margin: 30px 0; border-radius: 8px; text-align: center; }
        .alert-title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .info-box { background: #f8f9fa; border: 1px solid #dee2e6; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107; }
        .security-tips { background: #e8f4fd; border: 1px solid #bee5eb; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #17a2b8; }
        .security-tips h4 { margin-top: 0; color: #0c5460; }
        .security-tips ul { margin-bottom: 0; padding-left: 20px; }
        .security-tips li { margin-bottom: 5px; color: #0c5460; }
        .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #666; border-top: 1px solid #eee; padding-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🚨 TRIDEX</div>
            <h2>Account Security Alert</h2>
        </div>
        
        <div class="alert-box">
            <div class="alert-title">Account Temporarily Locked</div>
            <p>Your account has been temporarily locked due to multiple failed login attempts.</p>
        </div>
        
        <p>Hello ${userName || 'User'},</p>
        <p>We detected <strong>5 consecutive failed login attempts</strong> on your Tridex account and have temporarily locked it for security purposes.</p>
        
        <div class="info-box">
            <h4>🔒 Lockout Details:</h4>
            <ul>
                <li><strong>Duration:</strong> ${lockoutDurationMinutes} minutes</li>
                <li><strong>Reason:</strong> Multiple failed login attempts</li>
                <li><strong>Time:</strong> ${timestamp}</li>
                ${clientInfo?.ipAddress ? `<li><strong>IP Address:</strong> ${clientInfo.ipAddress}</li>` : ''}
                ${clientInfo?.userAgent ? `<li><strong>Device:</strong> ${clientInfo.userAgent}</li>` : ''}
            </ul>
        </div>
        
        <div class="warning">
            <h4>⏰ What happens next:</h4>
            <ul>
                <li>Your account will automatically unlock after <strong>${lockoutDurationMinutes} minutes</strong></li>
                <li>You can then try logging in again with the correct credentials</li>
                <li>If you continue having issues, use the account recovery option</li>
            </ul>
        </div>

        <div class="security-tips">
            <h4>🛡️ Security Tips:</h4>
            <ul>
                <li><strong>If this was you:</strong> Wait for the lockout to expire, then try again with correct credentials</li>
                <li><strong>If this wasn't you:</strong> Someone may be trying to access your account</li>
                <li>Make sure you're using the correct username/email and password</li>
                <li>Check if Caps Lock is enabled</li>
                <li>Consider using account recovery if you've forgotten your password</li>
                <li>Enable two-factor authentication for additional security</li>
            </ul>
        </div>

        <p><strong>Didn't attempt to log in?</strong><br>
        If you didn't try to access your account, this could indicate someone is attempting to gain unauthorized access. Consider changing your password immediately after the lockout expires.</p>
        
        <div class="footer">
            <p><strong>Tridex Security Team</strong></p>
            <p>This is an automated security alert. Please do not reply to this email.</p>
            <p>If you need assistance, contact our support team.</p>
            <p>&copy; ${currentYear} Tridex. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

    try {
      const result = await this.transporter.sendMail({
        from: '"Tridex Security" <gff130170@gmail.com>',
        to: email,
        subject: '🚨 Account Security Alert - Account Temporarily Locked - Tridex',
        html: html,
        text: `Your Tridex account has been temporarily locked due to multiple failed login attempts. Please wait ${lockoutDurationMinutes} minutes before trying again.`
      });

      console.log('✅ Account lockout alert sent successfully!');
      console.log('📧 Message ID:', result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Failed to send account lockout alert:', error.message);
      throw error;
    }
  }
}

// Test the lockout email
async function testLockoutEmail() {
  const emailService = new TestEmailService();
  
  try {
    await emailService.sendAccountLockoutAlert(
      'gff130170@gmail.com',
      'TestUser',
      5,
      {
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    );
    
    console.log('\n🎉 Test completed successfully!');
    console.log('📬 Check your email inbox: gff130170@gmail.com');
  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
  }
}

testLockoutEmail();
