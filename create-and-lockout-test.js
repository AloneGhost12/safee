// Create test user and test lockout
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:4004/api';
const TEST_USER = {
  username: 'lockouttest456',
  email: 'gff130170@gmail.com',
  phoneNumber: '+1234567890',
  password: 'TestPassword123!',
  wrongPassword: 'WrongPassword123!'
};

async function createUserAndTestLockout() {
  console.log('🔒 Creating User and Testing Lockout...\n');

  try {
    // Step 1: Create the test user
    console.log('1. Creating test user...');
    const createResponse = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: TEST_USER.username,
        email: TEST_USER.email,
        phoneNumber: TEST_USER.phoneNumber,
        password: TEST_USER.password
      })
    });

    const createData = await createResponse.json();
    console.log(`Create Status: ${createResponse.status}`);
    console.log(`Create Response:`, createData);

    if (createResponse.status !== 201 && createResponse.status !== 409) {
      console.log('❌ Failed to create user');
      return;
    }
    
    console.log('✅ User ready for testing\n');

    // Step 2: Test 6 failed login attempts
    console.log('2. Testing failed login attempts...');
    
    for (let i = 1; i <= 6; i++) {
      console.log(`\n--- Failed Attempt ${i}/6 ---`);
      
      const loginResponse = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: TEST_USER.username,
          password: TEST_USER.wrongPassword
        })
      });

      const loginData = await loginResponse.json();
      
      console.log(`Status: ${loginResponse.status}`);
      console.log(`Response:`, loginData);
      
      if (loginResponse.status === 423) {
        console.log('🔒 ACCOUNT LOCKED! EMAIL SHOULD BE SENT!');
        console.log('📧 Check email: gff130170@gmail.com');
        break;
      }
      
      // Wait 1 second between attempts
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

createUserAndTestLockout();
