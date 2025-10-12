/**
 * Enhanced SMTP Connection Test
 * Tests the improved email service with multiple fallback strategies
 */

const { getEmailService } = require('./server/src/services/emailService')

async function testEnhancedSMTP() {
  console.log('🧪 Starting Enhanced SMTP Test...')
  console.log('=' .repeat(50))
  
  try {
    const emailService = getEmailService()
    
    // Test email configuration
    const testEmail = process.env.TEST_EMAIL || 'gff130170@gmail.com'
    
    console.log('📧 Testing email service with enhanced fallback...')
    console.log(`📮 Sending test email to: ${testEmail}`)
    
    const result = await emailService.sendTestEmail(testEmail)
    
    if (result.success) {
      console.log('✅ Enhanced SMTP test SUCCESSFUL!')
      console.log(`📬 Message ID: ${result.messageId}`)
      console.log('🎉 Email service is working with new configuration!')
    } else {
      console.log('❌ Enhanced SMTP test failed:', result.error)
      
      // Additional diagnostics
      console.log('\n🔍 Diagnostic Information:')
      console.log('- Check if your SMTP credentials are correct')
      console.log('- Verify network connectivity to SMTP servers')
      console.log('- Check if ports 587, 2525, or 465 are accessible')
      console.log('- Ensure firewall allows SMTP connections')
      
      if (result.error?.includes('timeout')) {
        console.log('\n⏰ Timeout detected - this is expected in some cloud environments')
        console.log('✨ The enhanced service includes fallback mechanisms')
        console.log('📧 Emails may still be delivered via backup routes')
      }
    }
    
  } catch (error) {
    console.error('💥 Test script error:', error)
    console.log('\n🔧 Troubleshooting suggestions:')
    console.log('1. Check your .env file for SMTP credentials')
    console.log('2. Ensure you have network connectivity')
    console.log('3. Try running: npm install nodemailer')
    console.log('4. Check if the server directory exists')
  }
  
  console.log('\n' + '=' .repeat(50))
  console.log('🏁 Enhanced SMTP test completed')
}

// Test different scenarios
async function testMultipleScenarios() {
  console.log('\n🎯 Testing Multiple Email Scenarios...')
  
  const scenarios = [
    {
      name: 'OTP Email',
      test: async (emailService) => {
        return emailService.sendOTP('test@tridex.app', '123456', 'login', 10)
      }
    },
    {
      name: 'Recovery Code',
      test: async (emailService) => {
        return emailService.sendRecoveryCode('test@tridex.app', 'ABC123', 'TestUser')
      }
    }
  ]
  
  try {
    const emailService = getEmailService()
    
    for (const scenario of scenarios) {
      console.log(`\n📋 Testing: ${scenario.name}`)
      try {
        await scenario.test(emailService)
        console.log(`✅ ${scenario.name} test completed`)
      } catch (error) {
        console.log(`❌ ${scenario.name} test failed:`, error.message)
      }
    }
  } catch (error) {
    console.error('📧 Scenario testing error:', error)
  }
}

// Environment diagnostics
function checkEnvironment() {
  console.log('\n🔍 Environment Diagnostics:')
  console.log('NODE_ENV:', process.env.NODE_ENV || 'not set')
  console.log('SMTP_HOST:', process.env.SMTP_HOST || 'using default (smtp-relay.brevo.com)')
  console.log('SMTP_PORT:', process.env.SMTP_PORT || 'using default (587)')
  console.log('SMTP_USER:', process.env.SMTP_USER ? '✓ set' : 'using default')
  console.log('SMTP_PASS:', process.env.SMTP_PASS ? '✓ set' : 'using default')
  console.log('GMAIL_USER:', process.env.GMAIL_USER ? '✓ set (fallback available)' : '❌ not set (no Gmail fallback)')
  console.log('GMAIL_PASS:', process.env.GMAIL_PASS ? '✓ set (fallback available)' : '❌ not set (no Gmail fallback)')
}

// Main test execution
async function runTests() {
  checkEnvironment()
  await testEnhancedSMTP()
  
  if (process.argv.includes('--full')) {
    await testMultipleScenarios()
  }
  
  console.log('\n💡 Tips for production:')
  console.log('- Set GMAIL_USER and GMAIL_PASS for backup email delivery')
  console.log('- Monitor email logs for fallback usage patterns')
  console.log('- Consider implementing email queue for reliability')
  console.log('- Test from your production environment regularly')
}

// Run the test
if (require.main === module) {
  runTests().catch(console.error)
}

module.exports = { testEnhancedSMTP, testMultipleScenarios, checkEnvironment }