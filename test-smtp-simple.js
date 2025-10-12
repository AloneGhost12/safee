/**
 * SMTP Configuration Test
 * Tests SMTP connection with enhanced timeout handling
 */

const nodemailer = require('nodemailer')

async function testSMTPConnections() {
  console.log('🧪 Testing SMTP Configurations for Cloud Environments...')
  console.log('=' .repeat(60))
  
  const configurations = [
    {
      name: 'Brevo Production (Port 587)',
      config: {
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER || '93c1d4002@smtp-brevo.com',
          pass: process.env.SMTP_PASS || 'byQ4dHOJkNEaMGYh'
        },
        connectionTimeout: 45000,
        greetingTimeout: 20000,
        socketTimeout: 45000,
        tls: {
          rejectUnauthorized: false,
          ciphers: 'ALL'
        },
        requireTLS: true
      }
    },
    {
      name: 'Brevo Alternative (Port 2525)', 
      config: {
        host: 'smtp-relay.brevo.com',
        port: 2525,
        secure: false,
        auth: {
          user: process.env.SMTP_USER || '93c1d4002@smtp-brevo.com',
          pass: process.env.SMTP_PASS || 'byQ4dHOJkNEaMGYh'
        },
        connectionTimeout: 30000,
        greetingTimeout: 15000,
        socketTimeout: 30000,
        tls: {
          rejectUnauthorized: false
        },
        requireTLS: false
      }
    },
    {
      name: 'Gmail Fallback (if configured)',
      config: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.GMAIL_USER || 'test@gmail.com',
          pass: process.env.GMAIL_PASS || 'test-pass'
        },
        connectionTimeout: 30000,
        greetingTimeout: 15000,
        socketTimeout: 30000,
        tls: {
          rejectUnauthorized: false
        },
        requireTLS: true
      }
    }
  ]

  for (const { name, config } of configurations) {
    console.log(`\n📧 Testing: ${name}`)
    console.log(`   Host: ${config.host}:${config.port}`)
    console.log(`   Timeout: ${config.connectionTimeout}ms`)
    
    try {
      const transporter = nodemailer.createTransport(config)
      
      console.log('   🔍 Verifying connection...')
      const startTime = Date.now()
      
      await transporter.verify()
      
      const duration = Date.now() - startTime
      console.log(`   ✅ Connection successful! (${duration}ms)`)
      
      // Test sending a simple email
      if (process.env.TEST_EMAIL && config.auth.user !== 'test@gmail.com') {
        console.log(`   📮 Sending test email to ${process.env.TEST_EMAIL}...`)
        
        const testResult = await transporter.sendMail({
          from: `"Tridex Test" <${config.auth.user}>`,
          to: process.env.TEST_EMAIL,
          subject: `✅ SMTP Test Success - ${name}`,
          html: `
            <h2>SMTP Test Successful!</h2>
            <p><strong>Provider:</strong> ${name}</p>
            <p><strong>Host:</strong> ${config.host}:${config.port}</p>
            <p><strong>Duration:</strong> ${duration}ms</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <p>This confirms your SMTP configuration is working correctly.</p>
          `
        })
        
        console.log(`   📬 Email sent successfully! Message ID: ${testResult.messageId}`)
      }
      
    } catch (error) {
      const startTime = Date.now()
      const duration = Date.now() - startTime || 0
      console.log(`   ❌ Connection failed (${duration}ms):`, error.message)
      
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        console.log('   ⏰ Timeout detected - this is common in cloud environments')
      }
      
      if (error.message.includes('Invalid login')) {
        console.log('   🔑 Authentication failed - check credentials')
      }
    }
  }
  
  console.log('\n' + '=' .repeat(60))
  console.log('🏁 SMTP Configuration Test Complete')
  
  // Environment recommendations
  console.log('\n💡 Recommendations for Production:')
  console.log('1. ✅ Set shorter timeouts (30-45s) for faster failure detection')
  console.log('2. 🔄 Implement multiple SMTP providers for redundancy') 
  console.log('3. 📝 Log failed emails for manual retry')
  console.log('4. 🛡️ Use Gmail as backup (set GMAIL_USER and GMAIL_PASS)')
  console.log('5. 🔍 Monitor SMTP connection success rates')
}

function checkEnvironment() {
  console.log('🔍 Environment Check:')
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`)
  console.log(`SMTP_HOST: ${process.env.SMTP_HOST || 'smtp-relay.brevo.com (default)'}`)
  console.log(`SMTP_PORT: ${process.env.SMTP_PORT || '587 (default)'}`)
  console.log(`SMTP_USER: ${process.env.SMTP_USER ? '✓ configured' : '❌ using default'}`)
  console.log(`SMTP_PASS: ${process.env.SMTP_PASS ? '✓ configured' : '❌ using default'}`)
  console.log(`GMAIL_USER: ${process.env.GMAIL_USER ? '✓ fallback available' : '❌ no Gmail fallback'}`)
  console.log(`TEST_EMAIL: ${process.env.TEST_EMAIL || '❌ not set (won\'t send test emails)'}`)
  console.log('')
}

// Run the test
async function main() {
  try {
    checkEnvironment()
    await testSMTPConnections()
  } catch (error) {
    console.error('💥 Test failed:', error)
  }
}

if (require.main === module) {
  main()
}

module.exports = { testSMTPConnections, checkEnvironment }