/**
 * Mobile Email OTP Debug Tool
 * Comprehensive troubleshooting for mobile OTP issues
 */

const axios = require('axios')

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:4004'
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com'

class MobileOTPDebugger {
  constructor() {
    this.issues = []
    this.solutions = []
  }

  async runDiagnostics() {
    console.log('🔍 Mobile Email OTP Diagnostic Tool')
    console.log('=====================================')
    
    await this.checkServerHealth()
    await this.checkEmailService()
    await this.checkOTPEndpoints()
    await this.checkCORSConfiguration()
    await this.checkRateLimiting()
    await this.checkMobileSpecificIssues()
    
    this.printReport()
  }

  async checkServerHealth() {
    console.log('\n1. 🏥 Checking Server Health...')
    try {
      const response = await axios.get(`${BASE_URL}/api/health`, {
        timeout: 10000
      })
      
      if (response.status === 200) {
        console.log('   ✅ Server is healthy')
      }
    } catch (error) {
      console.log('   ❌ Server health check failed')
      this.issues.push('Server is not responding or unhealthy')
      this.solutions.push('Check server logs and restart if necessary')
    }
  }

  async checkEmailService() {
    console.log('\n2. 📧 Checking Email Service...')
    try {
      const response = await axios.post(`${BASE_URL}/api/otp/test-email`, {
        email: TEST_EMAIL
      }, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (response.status === 200) {
        console.log('   ✅ Email service is working')
      }
    } catch (error) {
      console.log('   ❌ Email service test failed:', error.response?.data?.error || error.message)
      
      if (error.response?.status === 403) {
        this.issues.push('Email test endpoint is disabled in production')
        this.solutions.push('Test email functionality in development environment')
      } else {
        this.issues.push('Email service configuration issue')
        this.solutions.push('Check SMTP credentials and Brevo configuration')
      }
    }
  }

  async checkOTPEndpoints() {
    console.log('\n3. 🔐 Checking OTP Endpoints...')
    
    // Check OTP config endpoint
    try {
      const configResponse = await axios.get(`${BASE_URL}/api/otp/config`)
      console.log('   ✅ OTP config endpoint accessible')
      console.log('   📊 OTP Config:', configResponse.data)
    } catch (error) {
      console.log('   ❌ OTP config endpoint failed')
      this.issues.push('OTP configuration endpoint not accessible')
    }

    // Test OTP send endpoint
    try {
      const sendResponse = await axios.post(`${BASE_URL}/api/otp/send`, {
        email: TEST_EMAIL,
        purpose: 'login'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
        }
      })
      
      if (sendResponse.status === 200) {
        console.log('   ✅ OTP send endpoint working')
      }
    } catch (error) {
      console.log('   ❌ OTP send failed:', error.response?.data?.error || error.message)
      
      if (error.response?.status === 429) {
        this.issues.push('Rate limiting is blocking OTP requests')
        this.solutions.push('Wait for rate limit reset or check rate limiting configuration')
      } else if (error.response?.status === 400) {
        this.issues.push('Invalid request format for OTP send')
        this.solutions.push('Check request body format and required fields')
      } else {
        this.issues.push('OTP send endpoint not working')
        this.solutions.push('Check server logs for detailed error information')
      }
    }
  }

  async checkCORSConfiguration() {
    console.log('\n4. 🌐 Checking CORS Configuration...')
    
    // Simulate mobile app request (no origin header)
    try {
      const response = await axios.post(`${BASE_URL}/api/otp/send`, {
        email: TEST_EMAIL,
        purpose: 'login'
      }, {
        headers: {
          'Content-Type': 'application/json',
          // No origin header (simulates mobile app)
        }
      })
      
      console.log('   ✅ Mobile requests (no origin) are allowed')
    } catch (error) {
      if (error.message.includes('CORS')) {
        console.log('   ❌ CORS is blocking mobile requests')
        this.issues.push('CORS configuration blocking mobile app requests')
        this.solutions.push('Update CORS to allow requests without origin header (mobile apps)')
      }
    }

    // Check specific mobile origins
    const mobileOrigins = [
      'capacitor://localhost',
      'ionic://localhost',
      'http://localhost',
      'https://localhost'
    ]

    for (const origin of mobileOrigins) {
      try {
        const response = await axios.post(`${BASE_URL}/api/otp/send`, {
          email: TEST_EMAIL,
          purpose: 'login'
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Origin': origin
          }
        })
        
        console.log(`   ✅ Origin ${origin} is allowed`)
      } catch (error) {
        if (error.message.includes('CORS')) {
          console.log(`   ❌ Origin ${origin} is blocked by CORS`)
          this.issues.push(`Mobile origin ${origin} is blocked`)
          this.solutions.push(`Add ${origin} to ALLOWED_ORIGINS environment variable`)
        }
      }
    }
  }

  async checkRateLimiting() {
    console.log('\n5. ⏱️ Checking Rate Limiting...')
    
    const requests = []
    for (let i = 0; i < 5; i++) {
      requests.push(
        axios.post(`${BASE_URL}/api/otp/send`, {
          email: `test${i}@example.com`,
          purpose: 'login'
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        }).catch(err => err.response)
      )
    }

    const responses = await Promise.all(requests)
    const rateLimited = responses.filter(r => r?.status === 429)
    
    if (rateLimited.length > 0) {
      console.log(`   ⚠️  Rate limiting triggered after ${5 - rateLimited.length} requests`)
      this.issues.push('Aggressive rate limiting may block legitimate mobile users')
      this.solutions.push('Consider relaxing rate limits for OTP endpoints or implement user-based rate limiting')
    } else {
      console.log('   ✅ Rate limiting is reasonable')
    }
  }

  async checkMobileSpecificIssues() {
    console.log('\n6. 📱 Checking Mobile-Specific Issues...')
    
    // Test with mobile User-Agent strings
    const mobileUserAgents = [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36',
      'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
    ]

    for (const userAgent of mobileUserAgents) {
      try {
        const response = await axios.post(`${BASE_URL}/api/otp/send`, {
          email: TEST_EMAIL,
          purpose: 'login'
        }, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': userAgent
          }
        })
        
        console.log(`   ✅ Mobile User-Agent working: ${userAgent.substring(0, 50)}...`)
      } catch (error) {
        console.log(`   ❌ Mobile User-Agent failed: ${userAgent.substring(0, 50)}...`)
        this.issues.push('Server rejecting requests from mobile User-Agents')
        this.solutions.push('Check if server has User-Agent filtering enabled')
      }
    }

    // Check for network timeout issues
    try {
      const start = Date.now()
      await axios.post(`${BASE_URL}/api/otp/send`, {
        email: TEST_EMAIL,
        purpose: 'login'
      }, {
        timeout: 5000 // Mobile networks often have shorter timeouts
      })
      const duration = Date.now() - start
      
      if (duration > 3000) {
        console.log(`   ⚠️  Slow response time: ${duration}ms (mobile networks prefer <3s)`)
        this.issues.push('Slow server response times may cause mobile timeouts')
        this.solutions.push('Optimize server performance and consider implementing retry logic')
      } else {
        console.log(`   ✅ Good response time: ${duration}ms`)
      }
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        console.log('   ❌ Request timed out (5s limit)')
        this.issues.push('Server response too slow for mobile networks')
        this.solutions.push('Optimize server performance and increase mobile app timeout values')
      }
    }
  }

  printReport() {
    console.log('\n📋 DIAGNOSTIC REPORT')
    console.log('====================')
    
    if (this.issues.length === 0) {
      console.log('✅ No issues detected! Your mobile email OTP should be working.')
      return
    }

    console.log('❌ ISSUES FOUND:')
    this.issues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`)
    })

    console.log('\n💡 RECOMMENDED SOLUTIONS:')
    this.solutions.forEach((solution, index) => {
      console.log(`   ${index + 1}. ${solution}`)
    })

    console.log('\n🔧 QUICK FIXES FOR MOBILE OTP ISSUES:')
    console.log('=====================================')
    
    // Environment variables check
    console.log('\n1. Environment Variables:')
    console.log('   - Check ALLOWED_ORIGINS includes mobile app origins')
    console.log('   - Verify SMTP_* credentials are correct')
    console.log('   - Ensure NODE_ENV is set properly')

    // Server configuration
    console.log('\n2. Server Configuration:')
    console.log('   - CORS allows requests without origin header')
    console.log('   - Rate limiting is not too aggressive')
    console.log('   - Email service is properly configured')

    // Mobile app configuration
    console.log('\n3. Mobile App Configuration:')
    console.log('   - Use correct API base URL')
    console.log('   - Set appropriate request timeouts (>10s)')
    console.log('   - Handle network errors gracefully')
    console.log('   - Implement retry logic for failed requests')

    // Network troubleshooting
    console.log('\n4. Network Troubleshooting:')
    console.log('   - Test on different networks (WiFi vs cellular)')
    console.log('   - Check if corporate/school firewalls block requests')
    console.log('   - Try VPN to rule out regional blocking')

    console.log('\n📱 MOBILE-SPECIFIC DEBUGGING:')
    console.log('============================')
    console.log('- Check mobile app console logs')
    console.log('- Test API endpoints directly with curl/Postman')
    console.log('- Verify mobile app has internet permissions')
    console.log('- Check if app is using HTTPS in production')
    console.log('- Test on both iOS and Android if applicable')
  }
}

// Run diagnostics
async function main() {
  const diagnosticTool = new MobileOTPDebugger()
  await diagnosticTool.runDiagnostics()
}

if (require.main === module) {
  main().catch(console.error)
}

module.exports = { MobileOTPDebugger }