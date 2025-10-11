// Simple lockout test with existing user
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:4010/api';
const TEST_USER = {
  username: 'testlockout123',
  wrongPassword: 'WrongPassword123!',
  correctPassword: 'TestPassword123!'
};

async function simpleLockoutTest() {
  console.log('🔒 Simple Account Lockout Test...\n');

  try {
    console.log('Testing with username:', TEST_USER.username);
    
    // Test 5 failed login attempts
    for (let i = 1; i <= 5; i++) {
      console.log(`\n--- Attempt ${i}/5 ---`);
      
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: TEST_USER.username,
          password: TEST_USER.wrongPassword
        })
      });

      const data = await response.json();
      
      console.log(`Status: ${response.status}`);
      console.log(`Response:`, data);
      
      if (response.status === 423) {
        console.log('🔒 ACCOUNT LOCKED! EMAIL SHOULD BE SENT!');
        break;
      }
      
      // Wait 1 second between attempts
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\nTest completed! Check email: gff130170@gmail.com');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

simpleLockoutTest();
