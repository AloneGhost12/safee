#!/usr/bin/env node

/**
 * Test script for the comprehensive security system
 * Tests account lockout, emergency verification, and enhanced registration
 */

const SERVER_URL = 'http://localhost:4006'

const api = {
  async signup(email, username, phoneNumber, password) {
    const response = await fetch(`${SERVER_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, phoneNumber, password })
    })
    return { status: response.status, data: await response.json().catch(() => ({})) }
  },

  async login(email, password) {
    const response = await fetch(`${SERVER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    return { status: response.status, data: await response.json().catch(() => ({})) }
  },

  async verifyEmergency(email, username, phoneNumber, password) {
    const response = await fetch(`${SERVER_URL}/api/auth/verify-emergency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, phoneNumber, password })
    })
    return { status: response.status, data: await response.json().catch(() => ({})) }
  }
}

async function testSecurityFeatures() {
  console.log('🔒 Testing Comprehensive Security System')
  console.log('==========================================\n')

  const testUser = {
    email: 'security.test@example.com',
    username: 'securitytester',
    phoneNumber: '+1234567890',
    password: 'SecurePassword123!'
  }

  try {
    // Test 1: Enhanced Registration
    console.log('1️⃣ Testing Enhanced Registration (username + email + phone)...')
    const signupResult = await api.signup(
      testUser.email, 
      testUser.username, 
      testUser.phoneNumber, 
      testUser.password
    )
    
    if (signupResult.status === 201) {
      console.log('✅ Enhanced registration successful!')
      console.log(`   - User created with username: ${testUser.username}`)
      console.log(`   - Email: ${testUser.email}`)
      console.log(`   - Phone: ${testUser.phoneNumber}`)
    } else {
      console.log('❌ Registration failed:', signupResult.data.error)
      if (signupResult.data.error.includes('already exists')) {
        console.log('ℹ️ User already exists, continuing with tests...')
      }
    }

    console.log('\n2️⃣ Testing Account Lockout (5 failed attempts)...')
    
    // Test 2: Account Lockout after 5 failed attempts
    for (let i = 1; i <= 6; i++) {
      console.log(`   Attempt ${i}/6: Testing with wrong password...`)
      
      const loginResult = await api.login(testUser.email, 'WrongPassword123')
      
      if (loginResult.status === 423) {
        console.log('✅ Account locked after failed attempts!')
        console.log(`   - Status: ${loginResult.status}`)
        console.log(`   - Message: ${loginResult.data.error}`)
        break
      } else if (loginResult.status === 401) {
        if (loginResult.data.lockoutMessage) {
          console.log(`✅ Account locked after attempt ${i}`)
          console.log(`   - Lockout message: ${loginResult.data.lockoutMessage}`)
          break
        } else {
          console.log(`   ❌ Failed attempt ${i}, not locked yet`)
        }
      } else {
        console.log(`   ⚠️ Unexpected response: ${loginResult.status}`)
      }
      
      // Small delay between attempts
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log('\n3️⃣ Testing Emergency Verification...')
    
    // Test 3: Emergency Verification
    const emergencyResult = await api.verifyEmergency(
      testUser.email,
      testUser.username,
      testUser.phoneNumber,
      testUser.password
    )
    
    if (emergencyResult.status === 200) {
      console.log('✅ Emergency verification successful!')
      console.log('   - All identity fields verified correctly')
      console.log('   - Account access restored')
    } else if (emergencyResult.status === 401) {
      console.log('❌ Emergency verification failed:', emergencyResult.data.error)
    } else {
      console.log(`⚠️ Unexpected emergency verification response: ${emergencyResult.status}`)
    }

    console.log('\n4️⃣ Testing Normal Login After Emergency Verification...')
    
    // Test 4: Normal login should work after emergency verification
    const finalLoginResult = await api.login(testUser.email, testUser.password)
    
    if (finalLoginResult.status === 200) {
      console.log('✅ Normal login successful after emergency verification!')
      console.log('   - Account lockout has been cleared')
      console.log('   - Security system functioning correctly')
    } else if (finalLoginResult.status === 418) {
      console.log('⚠️ Unusual activity still detected - this may be expected')
      console.log('   - Status: 418 (Unusual Activity)')
      console.log('   - Emergency verification may be required again')
    } else {
      console.log(`❌ Login failed: ${finalLoginResult.status}`)
      console.log('   Error:', finalLoginResult.data.error)
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message)
    console.error('💡 Make sure the server is running on port 4005')
  }

  console.log('\n🔒 Security Test Complete!')
  console.log('==========================================')
}

// Run the tests
testSecurityFeatures().catch(console.error)
