// Simple test to trigger account lockout and email notification
const https = require('http');

async function triggerAccountLockout() {
  console.log('🧪 Testing Account Lockout Flow...');
  
  const loginData = {
    identifier: 'gff130170@gmail.com',
    password: 'wrongpassword123'
  };

  for (let i = 1; i <= 5; i++) {
    console.log(`\n🔄 Attempt ${i}/5 - Sending wrong password...`);
    
    try {
      const result = await makeLoginRequest(loginData);
      console.log(`❌ Attempt ${i} failed as expected:`, result.message || result.error);
    } catch (error) {
      console.log(`❌ Attempt ${i} error:`, error.message);
    }
    
    // Wait 1 second between attempts
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📧 If account lockout worked, you should receive an email alert at: gff130170@gmail.com');
  console.log('🔒 The account should now be locked for 5 minutes');
}

function makeLoginRequest(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'localhost',
      port: 4005,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 400) {
            reject(new Error(parsed.error || parsed.message || 'Login failed'));
          } else {
            resolve(parsed);
          }
        } catch (parseError) {
          reject(new Error(`Parse error: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

triggerAccountLockout().catch(console.error);
