// Test email through server API
const https = require('http');

async function testServerEmail() {
  console.log('🧪 Testing email through server API...');
  
  const data = JSON.stringify({
    email: 'gff130170@gmail.com'
  });

  const options = {
    hostname: 'localhost',
    port: 4004,
    path: '/api/auth/recovery/email-code',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      console.log('📡 Response status:', res.statusCode);
      console.log('📧 Response headers:', res.headers);
      
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log('📨 Response body:', responseData);
        try {
          const parsed = JSON.parse(responseData);
          console.log('✅ Parsed response:', parsed);
          resolve(parsed);
        } catch (error) {
          console.log('📄 Raw response:', responseData);
          resolve(responseData);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

// Also test a simpler endpoint first
async function testServerHealth() {
  console.log('🏥 Testing server health...');
  
  const options = {
    hostname: 'localhost',
    port: 4004,
    path: '/api/health',
    method: 'GET'
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      console.log('📡 Health check status:', res.statusCode);
      
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log('💚 Health response:', responseData);
        resolve(responseData);
      });
    });

    req.on('error', (error) => {
      console.error('❌ Health check error:', error.message);
      reject(error);
    });

    req.end();
  });
}

async function runTests() {
  try {
    await testServerHealth();
    console.log('\n' + '='.repeat(50) + '\n');
    await testServerEmail();
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTests();
