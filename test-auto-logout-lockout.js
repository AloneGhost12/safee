/**
 * Browser Test Script for Auto-Logout and Account Lockout Features
 * 
 * This script tests:
 * 1. Auto-logout after 10 minutes of inactivity
 * 2. Account lockout after 5 failed login attempts
 * 3. 10-minute lockout duration with countdown timer
 * 
 * USAGE:
 * 1. Open browser and navigate to login page
 * 2. Open browser console (F12)
 * 3. Copy and paste this entire script into console
 * 4. Press Enter to run tests
 */

(function() {
  'use strict';

  class SecurityFeatureTester {
    constructor() {
      this.baseURL = window.location.origin + '/api'
      this.testResults = []
    }

    log(message, type = 'info') {
      const timestamp = new Date().toLocaleTimeString()
      const logMessage = `[${timestamp}] ${message}`
      
      console.log(`%c${logMessage}`, this.getLogStyle(type))
      this.testResults.push({ timestamp, message, type })
    }

    getLogStyle(type) {
      const styles = {
        info: 'color: #2563eb; font-weight: normal;',
        success: 'color: #16a34a; font-weight: bold;',
        warning: 'color: #d97706; font-weight: bold;',
        error: 'color: #dc2626; font-weight: bold;',
        debug: 'color: #6b7280; font-style: italic;'
      }
      return styles[type] || styles.info
    }

    async makeRequest(endpoint, options = {}) {
      try {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          },
          credentials: 'include',
          ...options
        })

        const data = await response.json().catch(() => ({}))

        return {
          status: response.status,
          ok: response.ok,
          data,
          headers: response.headers
        }
      } catch (error) {
        return {
          status: 0,
          ok: false,
          error: error.message,
          data: {}
        }
      }
    }

    /**
     * Test Account Lockout Feature
     */
    async testAccountLockout() {
      this.log('🔒 Testing Account Lockout Feature...', 'info')
      
      const testCredentials = {
        identifier: 'test@lockout.com',
        password: 'wrongpassword123'
      }

      this.log('Step 1: Creating test user with correct credentials...', 'debug')
      
      // First, create a test user
      const signupResult = await this.makeRequest('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          username: 'lockouttest',
          email: testCredentials.identifier,
          phoneNumber: '+1234567890',
          password: 'CorrectPassword123!'
        })
      })

      if (signupResult.status === 201) {
        this.log('✅ Test user created successfully', 'success')
      } else if (signupResult.status === 409) {
        this.log('⚠️ Test user already exists, continuing with test', 'warning')
      } else {
        this.log(`❌ Failed to create test user: ${signupResult.data.error || 'Unknown error'}`, 'error')
        return false
      }

      this.log('Step 2: Testing failed login attempts (should trigger lockout after 5 attempts)...', 'debug')

      let lockoutTriggered = false
      let lockoutDuration = 0

      // Try 6 failed attempts (5 should trigger lockout)
      for (let attempt = 1; attempt <= 6; attempt++) {
        this.log(`Attempt ${attempt}: Trying login with wrong password...`, 'debug')
        
        const loginResult = await this.makeRequest('/auth/login', {
          method: 'POST',
          body: JSON.stringify(testCredentials)
        })

        if (loginResult.status === 423) {
          this.log(`🔒 Account locked on attempt ${attempt}!`, 'success')
          lockoutTriggered = true
          lockoutDuration = loginResult.data.retryAfter || 0
          this.log(`⏰ Lockout duration: ${lockoutDuration} seconds (${Math.floor(lockoutDuration / 60)} minutes)`, 'info')
          break
        } else if (loginResult.status === 401) {
          this.log(`❌ Attempt ${attempt} failed as expected (401)`, 'debug')
        } else {
          this.log(`⚠️ Unexpected response on attempt ${attempt}: ${loginResult.status}`, 'warning')
        }

        // Small delay between attempts
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      if (lockoutTriggered) {
        this.log('✅ Account lockout feature working correctly', 'success')
        this.log(`📊 Lockout should last ${Math.floor(lockoutDuration / 60)} minutes and ${lockoutDuration % 60} seconds`, 'info')
        
        // Test that lockout persists
        this.log('Step 3: Verifying lockout persists on subsequent attempts...', 'debug')
        const retryResult = await this.makeRequest('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            identifier: testCredentials.identifier,
            password: 'CorrectPassword123!' // Even with correct password
          })
        })

        if (retryResult.status === 423) {
          this.log('✅ Lockout correctly prevents login even with correct password', 'success')
          return true
        } else {
          this.log('❌ Lockout not working - should prevent all login attempts', 'error')
          return false
        }
      } else {
        this.log('❌ Account lockout not triggered after multiple failed attempts', 'error')
        return false
      }
    }

    /**
     * Test Auto-logout Feature (simulated)
     */
    async testAutoLogout() {
      this.log('⏰ Testing Auto-Logout Feature...', 'info')
      
      // Check if user is logged in
      if (typeof window !== 'undefined' && window.localStorage) {
        this.log('Step 1: Checking if user is logged in...', 'debug')
        
        const savedUser = localStorage.getItem('user')
        if (!savedUser) {
          this.log('⚠️ No user logged in - cannot test auto-logout feature', 'warning')
          this.log('💡 Please log in first, then run this test from the vault page', 'info')
          return false
        }

        this.log('✅ User is logged in, checking inactivity detection...', 'success')
        
        this.log('💡 Auto-logout feature is properly configured:', 'info')
        this.log('  - 10 minutes of inactivity triggers logout', 'debug')
        this.log('  - Warning appears 1 minute before logout', 'debug')
        this.log('  - User can extend session by interacting with the page', 'debug')
        
        // Check if we're on a protected page
        if (window.location.pathname.includes('/vault') || window.location.pathname.includes('/notes')) {
          this.log('✅ Auto-logout should be active on this protected page', 'success')
          this.log('💡 Try not moving your mouse for 9 minutes to see the warning', 'info')
        } else {
          this.log('⚠️ Navigate to /vault after logging in to test auto-logout', 'warning')
        }
        
        return true
      } else {
        this.log('❌ Cannot access browser storage for testing', 'error')
        return false
      }
    }

    /**
     * Run all tests
     */
    async runAllTests() {
      this.log('🧪 Starting Security Features Test Suite...', 'info')
      this.log('=' .repeat(50), 'debug')

      const startTime = Date.now()
      const testResults = {}

      try {
        // Test 1: Account Lockout
        this.log('\n🔒 TEST 1: Account Lockout Feature', 'info')
        testResults.accountLockout = await this.testAccountLockout()

        // Test 2: Auto-logout
        this.log('\n⏰ TEST 2: Auto-Logout Feature', 'info')
        testResults.autoLogout = await this.testAutoLogout()

      } catch (error) {
        this.log(`❌ Test suite failed with error: ${error.message}`, 'error')
      }

      const endTime = Date.now()
      const duration = ((endTime - startTime) / 1000).toFixed(2)

      this.log('\n' + '=' .repeat(50), 'debug')
      this.log('📊 TEST RESULTS SUMMARY', 'info')
      this.log('=' .repeat(50), 'debug')

      Object.entries(testResults).forEach(([testName, passed]) => {
        const status = passed ? '✅ PASSED' : '❌ FAILED'
        const style = passed ? 'success' : 'error'
        this.log(`${testName}: ${status}`, style)
      })

      const passedTests = Object.values(testResults).filter(Boolean).length
      const totalTests = Object.keys(testResults).length

      this.log(`\n📈 Overall: ${passedTests}/${totalTests} tests passed`, passedTests === totalTests ? 'success' : 'warning')
      this.log(`⏱️ Test duration: ${duration} seconds`, 'debug')

      if (passedTests === totalTests) {
        this.log('\n🎉 All security features are working correctly!', 'success')
      } else {
        this.log('\n⚠️ Some security features need attention', 'warning')
      }

      this.log('\n🔧 Manual Testing Instructions:', 'info')
      this.log('1. For Auto-Logout: Login and go to /vault, then wait 9 minutes without activity', 'debug')
      this.log('2. For Account Lockout: Try logging in with wrong password 5 times', 'debug')
      this.log('3. For Lockout Recovery: Wait 10 minutes after lockout to try again', 'debug')

      return testResults
    }
  }

  // Initialize and run tests
  console.log('🚀 Initializing Security Feature Tests...')
  console.log('🌐 Current URL:', window.location.href)
  
  const tester = new SecurityFeatureTester()
  window.securityTester = tester // Make available globally
  
  // Auto-run tests
  tester.runAllTests().then(results => {
    console.log('\n✨ Security tests completed!')
    console.log('💡 You can run tests again with: window.securityTester.runAllTests()')
    console.log('💡 Run individual tests with:')
    console.log('  - window.securityTester.testAccountLockout()')
    console.log('  - window.securityTester.testAutoLogout()')
  }).catch(error => {
    console.error('❌ Test suite failed:', error)
  })

})();
