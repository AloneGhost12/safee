const nodemailer = require('nodemailer');

async function quickTest() {
  console.log('🚀 Quick Email Test Starting...');
  
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
    socketTimeout: 15000      // 15 seconds
  });

  try {
    console.log('⏱️  Testing connection with timeout...');
    await transporter.verify();
    console.log('✅ Connection OK');

    console.log('📧 Sending test email with timeout...');
    const result = await Promise.race([
      transporter.sendMail({
        from: '"Tridex Test" <gff130170@gmail.com>',
        to: 'gff130170@gmail.com',
        subject: '🧪 Quick Test',
        text: 'Test email from recovery debug'
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Email send timeout after 30 seconds')), 30000)
      )
    ]);

    console.log('✅ Email sent! Message ID:', result.messageId);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) console.error('Error Code:', error.code);
    if (error.errno) console.error('Error Number:', error.errno);
  }
}

quickTest();
