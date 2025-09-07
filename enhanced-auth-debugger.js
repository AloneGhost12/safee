/**
 * 🛡️ Comprehensive Authentication Debug Script
 * 
 * This script provides complete testing and troubleshooting for all authentication scenarios.
 * Run this in your browser console at https://tridex.app for best results.
 */

class AuthDebugger {
  constructor() {
    this.apiUrl = 'https://safee-y8iw.onrender.com'
    this.clientUrl = 'https://tridex.app'
    this.results = []
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString()
    const emoji = {
      'info': 'ℹ️',
      'success': '✅',
      'warning': '⚠️',
      'error': '❌',
      'debug': '🔍'
    }[type] || 'ℹ️'
    
    const formattedMessage = `${emoji} [${timestamp}] ${message}`
    console.log(formattedMessage)
    this.results.push({ timestamp, type, message })
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.apiUrl}${endpoint}`
    const config = {
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Origin': this.clientUrl,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    }

    try {
      const response = await fetch(url, config)
      return {
        ok: response.ok,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data: await response.json().catch(() => ({}))
      }
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: error.message,
        headers: {}
      }
    }
  }

  async testConnectivity() {
    this.log('🌐 Testing API Connectivity...', 'info')
    
    const health = await this.makeRequest('/api/health')
    if (health.ok) {
      this.log('API is responding correctly', 'success')
    } else {
      this.log(`API health check failed: ${health.status} ${health.error}`, 'error')
      return false
    }
    return true
  }

  async testCORS() {
    this.log('🔗 Testing CORS Configuration...', 'info')
    
    // Test preflight
    const preflight = await this.makeRequest('/api/auth/login', {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    })

    if (preflight.status === 200 || preflight.status === 204) {
      const allowOrigin = preflight.headers['access-control-allow-origin']
      if (allowOrigin === this.clientUrl || allowOrigin === '*') {
        this.log('CORS is configured correctly', 'success')
        return true
      } else {
        this.log(`CORS misconfigured. Allow-Origin: ${allowOrigin}`, 'error')
        return false
      }
    } else {
      this.log(`CORS preflight failed: ${preflight.status}`, 'error')
      return false
    }
  }

  async testRateLimits() {
    this.log('⏱️ Testing Rate Limit Status...', 'info')
    
    const response = await this.makeRequest('/api/health')
    if (response.headers) {
      const limit = response.headers['x-ratelimit-limit']
      const remaining = response.headers['x-ratelimit-remaining']
      const reset = response.headers['x-ratelimit-reset']
      
      if (limit && remaining) {
        this.log(`Rate limit: ${remaining}/${limit} remaining`, 'info')
        if (parseInt(remaining) < 10) {
          this.log('Rate limit is low - you may hit limits soon', 'warning')
        }
      } else {
        this.log('Rate limit headers not found', 'debug')
      }
      
      if (reset) {
        const resetTime = new Date(parseInt(reset) * 1000)
        this.log(`Rate limit resets at: ${resetTime.toLocaleTimeString()}`, 'debug')
      }
    }
  }

  async testAuthentication() {
    this.log('🔑 Testing Authentication Flow...', 'info')
    
    // Test with dummy credentials to see server behavior
    const testLogin = await this.makeRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'test@example.com',
        password: 'testpassword123'
      })
    })

    this.analyzeAuthResponse(testLogin)
  }

  analyzeAuthResponse(response) {
    const status = response.status
    const data = response.data

    switch (status) {
      case 200:
        this.log('Login successful (unexpected for test credentials)', 'success')
        break
        
      case 401:
        this.log('401 Unauthorized - Normal response for wrong credentials', 'success')
        this.log('This indicates the server is working correctly', 'info')
        break
        
      case 418:
        this.log('418 "I\'m a teapot" - Unusual Activity Detected', 'warning')
        this.log('Security system triggered. Emergency verification required.', 'info')
        if (data.requiresEmergencyVerification) {
          this.log('Emergency verification fields required:', 'info')
          data.verificationRequired?.forEach(field => {
            this.log(`  - ${field}`, 'debug')
          })
        }
        this.showEmergencyVerificationGuide()
        break
        
      case 423:
        this.log('423 Locked - Account Lockout Active', 'warning')
        this.log('Account locked due to failed attempts. Wait 30 minutes.', 'info')
        this.showAccountLockoutGuide()
        break
        
      case 429:
        this.log('429 Too Many Requests - Rate Limited', 'warning')
        this.log('Too many requests. Wait for rate limit to reset.', 'info')
        break
        
      case 500:
        this.log('500 Internal Server Error - Server Issue', 'error')
        this.log('Server-side problem. Try again later or contact support.', 'info')
        break
        
      default:
        this.log(`Unexpected response: ${status}`, 'error')
        if (data.error) {
          this.log(`Error: ${data.error}`, 'error')
        }
    }
  }

  showEmergencyVerificationGuide() {
    this.log('📋 Emergency Verification Guide:', 'info')
    this.log('1. The system detected unusual activity (new device/IP)', 'info')
    this.log('2. Use the emergency verification endpoint:', 'info')
    this.log('   POST /api/auth/verify-emergency', 'debug')
    this.log('3. Provide exact registration details:', 'info')
    this.log('   - email, username, phoneNumber, password', 'debug')
    this.log('4. After verification, try login again', 'info')
  }

  showAccountLockoutGuide() {
    this.log('🔒 Account Lockout Guide:', 'info')
    this.log('1. Account locked after 5 failed attempts', 'info')
    this.log('2. Automatic unlock after 30 minutes', 'info')
    this.log('3. OR use emergency verification to unlock immediately', 'info')
    this.log('4. Check your credentials are correct', 'info')
  }

  async testSecurityFeatures() {
    this.log('🛡️ Testing Security System...', 'info')
    
    // Test if emergency verification endpoint exists
    const emergencyTest = await this.makeRequest('/api/auth/verify-emergency', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        username: 'testuser',
        phoneNumber: '1234567890',
        password: 'testpass'
      })
    })

    if (emergencyTest.status === 401) {
      this.log('Emergency verification endpoint is active', 'success')
    } else if (emergencyTest.status === 404) {
      this.log('Emergency verification endpoint not found', 'error')
    } else {
      this.log(`Emergency verification test: ${emergencyTest.status}`, 'debug')
    }
  }

  async checkBrowserState() {
    this.log('🧹 Checking Browser State...', 'info')
    
    // Check localStorage
    const userKeys = Object.keys(localStorage).filter(key => 
      key.includes('user') || key.includes('auth') || key.includes('token')
    )
    
    if (userKeys.length > 0) {
      this.log(`Found ${userKeys.length} auth-related localStorage items`, 'debug')
      userKeys.forEach(key => this.log(`  - ${key}`, 'debug'))
    } else {
      this.log('No auth data in localStorage', 'success')
    }

    // Check sessionStorage
    const sessionKeys = Object.keys(sessionStorage).filter(key => 
      key.includes('user') || key.includes('auth') || key.includes('token')
    )
    
    if (sessionKeys.length > 0) {
      this.log(`Found ${sessionKeys.length} auth-related sessionStorage items`, 'debug')
    } else {
      this.log('No auth data in sessionStorage', 'success')
    }
  }

  clearBrowserState() {
    this.log('🧽 Clearing Browser State...', 'info')
    localStorage.clear()
    sessionStorage.clear()
    this.log('Browser state cleared', 'success')
    this.log('Consider refreshing the page', 'info')
  }

  generateReport() {
    this.log('📊 Generating Diagnostic Report...', 'info')
    
    const report = {
      timestamp: new Date().toISOString(),
      client: this.clientUrl,
      api: this.apiUrl,
      userAgent: navigator.userAgent,
      results: this.results,
      summary: this.generateSummary()
    }

    console.log('📋 DIAGNOSTIC REPORT:', report)
    return report
  }

  generateSummary() {
    const errors = this.results.filter(r => r.type === 'error')
    const warnings = this.results.filter(r => r.type === 'warning')
    const successes = this.results.filter(r => r.type === 'success')

    return {
      totalTests: this.results.length,
      errors: errors.length,
      warnings: warnings.length,
      successes: successes.length,
      status: errors.length === 0 ? 'healthy' : 'issues_detected',
      recommendations: this.generateRecommendations(errors, warnings)
    }
  }

  generateRecommendations(errors, warnings) {
    const recommendations = []

    if (errors.some(e => e.message.includes('CORS'))) {
      recommendations.push('Check CORS configuration on server')
    }

    if (warnings.some(w => w.message.includes('418'))) {
      recommendations.push('Use emergency verification for unusual activity')
    }

    if (warnings.some(w => w.message.includes('423'))) {
      recommendations.push('Wait for account lockout to expire or use emergency verification')
    }

    if (warnings.some(w => w.message.includes('429'))) {
      recommendations.push('Wait for rate limits to reset, avoid rapid requests')
    }

    if (errors.some(e => e.message.includes('500'))) {
      recommendations.push('Server issue - contact support or try again later')
    }

    if (recommendations.length === 0) {
      recommendations.push('System appears healthy - try normal authentication')
    }

    return recommendations
  }

  async runFullDiagnostic() {
    this.log('🚀 Starting Full Authentication Diagnostic...', 'info')
    this.log('=' .repeat(50), 'debug')

    await this.testConnectivity()
    await this.testCORS()
    await this.testRateLimits()
    await this.testAuthentication()
    await this.testSecurityFeatures()
    await this.checkBrowserState()

    this.log('=' .repeat(50), 'debug')
    this.log('🏁 Diagnostic Complete', 'info')

    return this.generateReport()
  }
}

// Auto-instantiate and run
const authDebugger = new AuthDebugger()

// Export for manual use
window.authDebugger = authDebugger
window.clearAuthState = () => authDebugger.clearBrowserState()
window.runAuthDiagnostic = () => authDebugger.runFullDiagnostic()

// Auto-run diagnostic
console.log('🛡️ Auth Debugger Loaded - Running automatic diagnostic...')
authDebugger.runFullDiagnostic().then(report => {
  console.log('✅ Diagnostic complete! Use window.runAuthDiagnostic() to run again.')
  console.log('🧹 Use window.clearAuthState() to clear browser data.')
  console.log('📋 Full report available in console above.')
})

/**
 * Quick usage examples:
 * 
 * // Run full diagnostic
 * await runAuthDiagnostic()
 * 
 * // Clear browser state
 * clearAuthState()
 * 
 * // Manual testing
 * authDebugger.testAuthentication()
 * authDebugger.testCORS()
 */
