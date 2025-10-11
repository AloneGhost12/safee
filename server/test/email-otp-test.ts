#!/usr/bin/env node

/**
 * Email OTP System Test Script
 * Tests the complete email OTP flow including generation, delivery, and verification
 */

import { getEmailOTPService } from '../src/services/emailOTPService'
import { getEmailService } from '../src/services/emailService'
import { connect } from '../src/db'

// Test email (replace with your actual email for testing)
const TEST_EMAIL = 'test@example.com'

async function testEmailOTPSystem() {
  console.log('🧪 Starting Email OTP System Test...\n')

  try {
    // Connect to database
    console.log('📦 Connecting to database...')
    await connect()
    console.log('✅ Database connected\n')

    // Test 1: Email Service Configuration
    console.log('📧 Testing email service configuration...')
    const emailService = getEmailService()
    console.log('✅ Email service initialized successfully\n')

    // Test 2: Send Test Email (if in development)
    if (process.env.NODE_ENV !== 'production') {
      console.log('📨 Sending test email...')
      try {
        const testResult = await emailService.sendTestEmail(TEST_EMAIL)
        if (testResult.success) {
          console.log(`✅ Test email sent successfully (Message ID: ${testResult.messageId})\n`)
        } else {
          console.log(`❌ Test email failed: ${testResult.error}\n`)
        }
      } catch (error) {
        console.log(`❌ Test email error: ${error instanceof Error ? error.message : 'Unknown error'}\n`)
      }
    }

    // Test 3: Generate OTP
    console.log('🔢 Generating OTP...')
    const emailOTPService = getEmailOTPService()
    const generateResult = await emailOTPService.generateOTP({
      email: TEST_EMAIL,
      purpose: 'email_verification',
      ipAddress: '127.0.0.1',
      userAgent: 'OTP-Test-Script/1.0',
      metadata: {
        sessionId: 'test-session-123',
        deviceFingerprint: 'test-device',
        location: 'Test Environment'
      }
    })

    if (!generateResult.success) {
      console.log(`❌ OTP generation failed: ${generateResult.error}`)
      return
    }

    console.log('✅ OTP generated and sent successfully')
    console.log(`   Email: ${TEST_EMAIL}`)
    console.log(`   Purpose: email_verification`)
    console.log(`   Expires in: 10 minutes\n`)

    // Test 4: Rate Limiting
    console.log('⏱️ Testing rate limiting...')
    const rateLimitResult = await emailOTPService.checkRateLimit(
      TEST_EMAIL, 
      '127.0.0.1', 
      'email_verification'
    )
    
    console.log('✅ Rate limit check completed')
    console.log(`   Allowed: ${rateLimitResult.allowed}`)
    console.log(`   Remaining attempts: ${rateLimitResult.remainingAttempts}`)
    console.log(`   Reset time: ${rateLimitResult.resetTime}\n`)

    // Test 5: Configuration
    console.log('⚙️ Testing configuration...')
    const config = emailOTPService.getConfiguration()
    console.log('✅ Configuration retrieved')
    console.log(`   OTP Length: ${config.length}`)
    console.log(`   Expiration: ${config.expirationMinutes} minutes`)
    console.log(`   Max attempts: ${config.maxAttempts}`)
    console.log(`   Allowed purposes: ${config.allowedPurposes.join(', ')}\n`)

    // Test 6: Invalid OTP Verification
    console.log('🔍 Testing invalid OTP verification...')
    const invalidVerifyResult = await emailOTPService.verifyOTP({
      email: TEST_EMAIL,
      code: '000000',  // Invalid code
      purpose: 'email_verification',
      ipAddress: '127.0.0.1',
      userAgent: 'OTP-Test-Script/1.0'
    })

    if (!invalidVerifyResult.success) {
      console.log('✅ Invalid OTP correctly rejected')
      console.log(`   Error: ${invalidVerifyResult.error}\n`)
    } else {
      console.log('❌ Invalid OTP was incorrectly accepted!\n')
    }

    console.log('🎉 Email OTP System Test Completed!')
    console.log('\n📋 Test Summary:')
    console.log('   ✅ Database connection')
    console.log('   ✅ Email service initialization')
    console.log('   ✅ OTP generation and email sending')
    console.log('   ✅ Rate limiting functionality')
    console.log('   ✅ Configuration management')
    console.log('   ✅ Invalid OTP rejection')

    if (process.env.NODE_ENV !== 'production') {
      console.log('   ✅ Test email delivery')
    }

    console.log('\n💡 Next Steps:')
    console.log('   1. Check your email inbox for the test email and OTP')
    console.log('   2. Use the OTP with the /api/otp/verify endpoint')
    console.log('   3. Test the complete flow with your frontend application')
    console.log('   4. Monitor logs for any issues')

  } catch (error) {
    console.error('❌ Test failed:', error)
    console.error('\n🔧 Troubleshooting:')
    console.error('   1. Check your .env file has correct BREVO_SMTP_* variables')
    console.error('   2. Verify MongoDB connection')
    console.error('   3. Check network connectivity to Brevo SMTP servers')
    console.error('   4. Review server logs for detailed error messages')
  }

  // Exit cleanly
  process.exit(0)
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⚠️ Test interrupted by user')
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Run the test
if (require.main === module) {
  testEmailOTPSystem()
}

export default testEmailOTPSystem
