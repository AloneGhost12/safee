// Test account lockout functionality with direct server API calls
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:4010/api';
const TEST_USER = {
  username: 'testlockout',
  email: 'gff130170@gmail.com',
  password: 'correct123',
  wrongPassword: 'wrong123'
};

async function testAccountLockout() {
  console.log('🧪 Testing account lockout email functionality...\n');

  try {
    // First, create test account
    console.log('1️⃣ Creating test account...');
    try {
      const registerResponse = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: TEST_USER.username,
          email: TEST_USER.email,
          phone: '+1234567890',
          password: TEST_USER.password,
          firstName: 'Test',
          lastName: 'User'
        })
      });
      
      if (registerResponse.status === 201) {
        console.log('✅ Test account created successfully');
      } else if (registerResponse.status === 409) {
        console.log('⚠️ Test account already exists, continuing...');
      } else {
        const errorData = await registerResponse.json();
        console.log('❌ Failed to create account:', errorData.message);
      }
    } catch (error) {
      console.log('⚠️ Account creation failed, but continuing test...');
    }
    
    // Now trigger 5 failed login attempts
    console.log('\n2️⃣ Triggering account lockout with 5 failed attempts...');
    
    for (let i = 1; i <= 5; i++) {
      try {
        console.log(`   Attempt ${i}/5: Making failed login request...`);
        
        const response = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: TEST_USER.username,
            password: TEST_USER.wrongPassword
          })
        });

        const responseData = await response.json();
        
        if (response.status === 401) {
          console.log(`   Attempt ${i}/5: ❌ Invalid credentials (Status: ${response.status})`);
        } else if (response.status === 423) {
          console.log(`   Attempt ${i}/5: 🔒 Account locked! (Status: ${response.status})`);
          console.log(`   Response: ${responseData.message}`);
          console.log('📧 Email alert should have been triggered!');
          break;
        } else {
          console.log(`   Attempt ${i}/5: ⚠️ Unexpected status: ${response.status}`);
          console.log(`   Response:`, responseData);
        }
      } catch (error) {
        console.log(`   Attempt ${i}/5: ❌ Request failed:`, error.message);
      }
      
      // Small delay between attempts
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n3️⃣ Verifying lockout with correct password...');
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: TEST_USER.username,
          password: TEST_USER.password // Correct password
        })
      });

      if (response.status === 423) {
        console.log('✅ Account is properly locked (even with correct password)');
        console.log('📧 Check your email at: gff130170@gmail.com');
        console.log('📋 Check both inbox and spam folder');
      } else {
        console.log('⚠️ Unexpected response:', response.status);
        const data = await response.json();
        console.log('Response:', data);
      }
    } catch (error) {
      console.log('❌ Verification failed:', error.message);
    }
    
    console.log('\n✅ Account lockout test completed!');
    console.log('📧 If emails are working, you should receive a security alert at: gff130170@gmail.com');
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

// Install node-fetch if not available
testAccountLockout().catch(console.error);
