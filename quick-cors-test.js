#!/usr/bin/env node

const https = require('https');

async function testCORSQuick() {
  console.log('🔍 Quick CORS Test for https://tridex.app\n');
  
  const origin = 'https://tridex.app';
  const apiUrl = 'https://safee-y8iw.onrender.com';
  
  // Test 1: Health check
  console.log('1. Testing API health...');
  try {
    const healthResponse = await makeRequest(`${apiUrl}/api/health`);
    console.log('✅ API is responding:', healthResponse.status);
  } catch (error) {
    console.log('❌ API health failed:', error.message);
    return;
  }
  
  // Test 2: CORS preflight
  console.log('\n2. Testing CORS preflight...');
  try {
    const corsResult = await testCORSPreflight(origin);
    if (corsResult.success) {
      console.log('✅ CORS preflight successful');
      console.log('   Allow-Origin:', corsResult.allowOrigin);
      console.log('   Allow-Methods:', corsResult.allowMethods);
    } else {
      console.log('❌ CORS preflight failed');
      console.log('   Error:', corsResult.error);
      console.log('\n🔧 SOLUTION: The ALLOWED_ORIGINS environment variable may not be updated on Render');
      console.log('   1. Go to: https://dashboard.render.com');
      console.log('   2. Find your service: vault-api');
      console.log('   3. Go to Environment tab');
      console.log('   4. Update ALLOWED_ORIGINS to include: https://tridex.app');
      console.log('   5. Manually redeploy the service');
    }
  } catch (error) {
    console.log('❌ CORS test error:', error.message);
  }
  
  // Test 3: Actual API call
  console.log('\n3. Testing actual API call...');
  try {
    const loginResult = await testLoginCall(origin);
    console.log('📡 Login call status:', loginResult.status);
    
    if (loginResult.status === 418) {
      console.log('⚠️  HTTP 418 "I\'m a teapot" detected');
      console.log('   This suggests a server-side configuration issue');
    } else if (loginResult.status === 401) {
      console.log('✅ Expected 401 (wrong credentials) - CORS is working');
    } else if (loginResult.status === 423) {
      console.log('⚠️  HTTP 423 "Locked" - account or endpoint locked');
    } else if (loginResult.status === 500) {
      console.log('❌ HTTP 500 - internal server error');
    }
  } catch (error) {
    if (error.message.includes('CORS')) {
      console.log('❌ CORS is still blocking requests');
    } else {
      console.log('❌ API call failed:', error.message);
    }
  }
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function testCORSPreflight(origin) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'safee-y8iw.onrender.com',
      port: 443,
      path: '/api/auth/login',
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    };
    
    const req = https.request(options, (res) => {
      const allowOrigin = res.headers['access-control-allow-origin'];
      const allowMethods = res.headers['access-control-allow-methods'];
      
      if (allowOrigin === origin || allowOrigin === '*') {
        resolve({ 
          success: true, 
          allowOrigin, 
          allowMethods,
          status: res.statusCode 
        });
      } else {
        resolve({ 
          success: false, 
          error: `Origin not allowed. Got: ${allowOrigin}, Expected: ${origin}`,
          status: res.statusCode
        });
      }
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

function testLoginCall(origin) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      identifier: 'test@example.com',
      password: 'testpassword123'
    });
    
    const options = {
      hostname: 'safee-y8iw.onrender.com',
      port: 443,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin,
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.write(postData);
    req.end();
  });
}

if (require.main === module) {
  testCORSQuick().catch(console.error);
}

module.exports = { testCORSQuick };
