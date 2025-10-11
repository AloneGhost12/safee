const nodemailer = require('nodemailer');

async function testGmailSMTP() {
  console.log('🧪 Testing Gmail SMTP as alternative...');
  
  // Using Gmail SMTP to test if SMTP works at all
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'gff130170@gmail.com',
      pass: 'your-app-password' // You'll need to set up an app password
    }
  });

  try {
    console.log('🔍 Testing Gmail SMTP...');
    await transporter.verify();
    console.log('✅ Gmail SMTP connection OK');
  } catch (error) {
    console.error('❌ Gmail SMTP failed:', error.message);
  }
}

async function testBrevoAlternativePort() {
  console.log('🧪 Testing Brevo SMTP on port 465 (SSL)...');
  
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 465,
    secure: true, // SSL
    auth: {
      user: '93c1d4002@smtp-brevo.com',
      pass: 'byQ4dHOJkNEaMGYh'
    },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 15000
  });

  try {
    console.log('🔍 Testing Brevo SSL connection...');
    await transporter.verify();
    console.log('✅ Brevo SSL connection OK');
    
    console.log('📧 Trying to send via SSL...');
    const result = await Promise.race([
      transporter.sendMail({
        from: '"Tridex Test" <gff130170@gmail.com>',
        to: 'gff130170@gmail.com',
        subject: '🧪 SSL Test',
        text: 'Test email via SSL'
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 30000)
      )
    ]);

    console.log('✅ SSL Email sent! Message ID:', result.messageId);
  } catch (error) {
    console.error('❌ Brevo SSL failed:', error.message);
  }
}

async function runAllTests() {
  await testBrevoAlternativePort();
  console.log('\n' + '='.repeat(40) + '\n');
  await testGmailSMTP();
}

runAllTests();
