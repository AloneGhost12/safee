// Test script for login with different identifiers
const API_BASE = 'http://localhost:4008/api'

async function testAPI(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    }
    
    if (body) {
      options.body = JSON.stringify(body)
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, options)
    const data = await response.json()
    
    console.log(`${method} ${endpoint}:`, response.status, data)
    return { status: response.status, data }
  } catch (error) {
    console.error(`Error with ${method} ${endpoint}:`, error.message)
    return { error: error.message }
  }
}

async function runTests() {
  console.log('🧪 Testing Login with Different Identifiers')
  console.log('='.repeat(50))
  
  // Test 1: Create a test user
  console.log('\n1. Creating test user...')
  const signupResult = await testAPI('/auth/signup', 'POST', {
    username: 'testuser123',
    email: 'test@example.com',
    phoneNumber: '+1234567890',
    password: 'TestPassword123!'
  })
  
  if (signupResult.status === 201) {
    console.log('✅ User created successfully!')
    
    // Test 2: Login with email
    console.log('\n2. Testing login with email...')
    await testAPI('/auth/login', 'POST', {
      identifier: 'test@example.com',
      password: 'TestPassword123!'
    })
    
    // Test 3: Login with username
    console.log('\n3. Testing login with username...')
    await testAPI('/auth/login', 'POST', {
      identifier: 'testuser123',
      password: 'TestPassword123!'
    })
    
    // Test 4: Login with phone number
    console.log('\n4. Testing login with phone number...')
    await testAPI('/auth/login', 'POST', {
      identifier: '+1234567890',
      password: 'TestPassword123!'
    })
    
    // Test 5: Invalid identifier
    console.log('\n5. Testing with invalid identifier...')
    await testAPI('/auth/login', 'POST', {
      identifier: 'nonexistent@example.com',
      password: 'TestPassword123!'
    })
    
  } else {
    console.log('❌ Failed to create user:', signupResult.data)
  }
}

runTests().catch(console.error)
