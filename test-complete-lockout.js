// Test account lockout with proper user creation
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:4010/api';
const TEST_USER = {
  username: 'testlockout123',
  email: 'gff130170@gmail.com',
  phoneNumber: '+1234567890',
  password: 'TestPassword123!',
  wrongPassword: 'WrongPassword123!',
  firstName: 'Test',
  lastName: 'User'
};

async function testAccountLockoutComplete() {
  console.log('🧪 Complete Account Lockout Test with Email Alerts...\n');

  try {
    // Step 1: Create test account with proper data
    console.log('1️⃣ Creating test account with complete registration...');
    
    const registerResponse = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER)
    });
    
    if (registerResponse.status === 201) {
      console.log('✅ Test account created successfully');
      const registerData = await registerResponse.json();
      console.log('   Account details:', registerData.user?.username, registerData.user?.email);
    } else if (registerResponse.status === 409) {
      console.log('⚠️ Test account already exists, continuing...');
    } else {
      const errorData = await registerResponse.json();
      console.log('❌ Registration failed:', registerResponse.status, errorData);
      return;
    }
    
    // Small delay to ensure account is created
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 2: Test that login works with correct password first
    console.log('\n2️⃣ Testing successful login first...');
    try {
      const goodLoginResponse = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: TEST_USER.username,
          password: TEST_USER.password
        })
      });
      
      if (goodLoginResponse.status === 200) {
        console.log('✅ Successful login confirmed - account exists and works');
      } else {
        const errorData = await goodLoginResponse.json();
        console.log('⚠️ Login test failed:', goodLoginResponse.status, errorData);
      }
    } catch (error) {
      console.log('⚠️ Login test error:', error.message);
    }
    
    // Step 3: Now trigger failed login attempts
    console.log('\n3️⃣ Triggering account lockout with 5 consecutive failed attempts...');
    
    for (let i = 1; i <= 6; i++) { // Try 6 attempts to be sure
      try {
        console.log(`   Attempt ${i}/6: Sending wrong password...`);
        
        const response = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: TEST_USER.username,
            password: TEST_USER.wrongPassword
          })
        });

        const responseData = await response.json();
        
        console.log(`   Response ${i}: Status ${response.status}`);
        console.log(`   Message: ${responseData.error || responseData.message}`);
        
        if (response.status === 401) {
          console.log(`   Attempt ${i}/6: ❌ Invalid credentials (expected)`);
        } else if (response.status === 423) {
          console.log(`   Attempt ${i}/6: 🔒 ACCOUNT LOCKED! (Status: ${response.status})`);
          console.log(`   Lockout details:`, responseData);
          console.log('📧 EMAIL ALERT SHOULD HAVE BEEN SENT!');
          break;
        } else {
          console.log(`   Attempt ${i}/6: ⚠️ Unexpected status: ${response.status}`);
          console.log(`   Response:`, responseData);
        }
        
        // Show if there's a lockout message even in 401 responses
        if (responseData.lockoutMessage) {
          console.log(`   🔒 Lockout warning: ${responseData.lockoutMessage}`);
        }
        
      } catch (error) {
        console.log(`   Attempt ${i}/6: ❌ Request failed:`, error.message);
      }
      
      // Small delay between attempts
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Step 4: Verify lockout with correct password
    console.log('\n4️⃣ Final verification - trying with CORRECT password...');
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: TEST_USER.username,
          password: TEST_USER.password // CORRECT password
        })
      });

      const responseData = await response.json();
      console.log(`Final test - Status: ${response.status}`);
      console.log(`Final test - Response:`, responseData);

      if (response.status === 423) {
        console.log('✅ PERFECT! Account is locked even with correct password');
        console.log('📧 Security email alert should be in your inbox: gff130170@gmail.com');
        console.log('📋 Check both inbox and spam folder');
      } else if (response.status === 200) {
        console.log('❌ FAILED! Account should be locked but login succeeded');
      } else {
        console.log('⚠️ Unexpected final response:', response.status);
      }
    } catch (error) {
      console.log('❌ Final verification failed:', error.message);
    }
    
    console.log('\n🎯 LOCKOUT TEST COMPLETED!');
    console.log('📧 If everything worked correctly, check your email at: gff130170@gmail.com');
    console.log('🔔 Subject should be: "Tridex Account Security Notice - Temporary Access Restriction"');
    
  } catch (error) {
    console.error('💥 Test completely failed:', error.message);
  }
}

testAccountLockoutComplete().catch(console.error);
