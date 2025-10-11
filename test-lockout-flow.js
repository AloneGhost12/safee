// Test script to trigger account lockout and verify email alerts
const axios = require('axios');

const API_BASE = 'http://localhost:4010/api';
const TEST_USER = {
  username: 'testlockout',
  email: 'gff130170@gmail.com', // The email where we want to receive alerts
  password: 'correct123',
  wrongPassword: 'wrong123'
};

async function testAccountLockoutFlow() {
  console.log('🧪 Testing account lockout email alerts...\n');

  try {
    // Step 1: Create a test account first
    console.log('1️⃣ Creating test account...');
    try {
      const registerResponse = await axios.post(`${API_BASE}/auth/register`, {
        username: TEST_USER.username,
        email: TEST_USER.email,
        phone: '+1234567890',
        password: TEST_USER.password,
        firstName: 'Test',
        lastName: 'User'
      });
      
      if (registerResponse.status === 201) {
        console.log('✅ Test account created successfully');
      }
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('⚠️ Test account already exists, continuing...');
      } else {
        console.log('❌ Failed to create test account:', error.response?.data?.message || error.message);
        // Continue anyway, account might exist
      }
    }
    
    // Step 2: Clear any existing lockout by waiting
    console.log('\n2️⃣ Waiting 2 seconds to ensure clean state...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 3: Attempt 5 failed logins to trigger lockout
    console.log('\n3️⃣ Attempting 5 failed logins to trigger account lockout...');
    
    for (let i = 1; i <= 5; i++) {
      try {
        await axios.post(`${API_BASE}/auth/login`, {
          identifier: TEST_USER.username,
          password: TEST_USER.wrongPassword
        });
      } catch (error) {
        if (error.response?.status === 401) {
          console.log(`   Attempt ${i}/5: ❌ Invalid credentials (expected)`);
        } else if (error.response?.status === 423) {
          console.log(`   Attempt ${i}/5: 🔒 Account locked! (Status: ${error.response.status})`);
          break;
        } else {
          console.log(`   Attempt ${i}/5: ⚠️ Unexpected response: ${error.response?.status} - ${error.response?.data?.message}`);
        }
      }
      
      // Small delay between attempts
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Step 4: Verify account is locked
    console.log('\n4️⃣ Verifying account lockout status...');
    try {
      await axios.post(`${API_BASE}/auth/login`, {
        identifier: TEST_USER.username,
        password: TEST_USER.password // Using correct password now
      });
      console.log('❌ Account should be locked but login succeeded!');
    } catch (error) {
      if (error.response?.status === 423) {
        console.log('✅ Account is properly locked (Status 423)');
        console.log('📧 Email alert should have been sent to:', TEST_USER.email);
        console.log('\n🎯 Check your email inbox for the security alert!');
      } else {
        console.log('⚠️ Unexpected lockout verification response:', error.response?.status, error.response?.data?.message);
      }
    }
    
    console.log('\n✅ Account lockout test completed!');
    console.log('📬 If email alerts are working, you should receive a security notification at:', TEST_USER.email);
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

// Run the test
testAccountLockoutFlow();
