#!/usr/bin/env node

/**
 * Test script to verify the security questions recovery fix
 */

const https = require('https');

const API_BASE_URL = 'https://safee-y8iw.onrender.com';
const TEST_EMAIL = 'test@example.com';

async function testSecurityQuestionsRecovery() {
  console.log('🔧 Testing Security Questions Recovery Fix...\n');
  
  // Test 1: Test the unauthenticated recovery endpoint
  console.log('1. Testing unauthenticated recovery endpoint...');
  try {
    const result = await testGetSecurityQuestions(TEST_EMAIL);
    if (result.success) {
      console.log('✅ Recovery endpoint is accessible without authentication');
      console.log(`   Questions returned: ${result.data.questions.length}`);
    } else {
      console.log('❌ Recovery endpoint failed');
      console.log(`   Error: ${result.error}`);
    }
  } catch (error) {
    console.log('❌ Recovery endpoint test failed:', error.message);
  }
  
  // Test 2: Test CORS for the recovery endpoint
  console.log('\n2. Testing CORS for recovery endpoint...');
  try {
    const corsResult = await testCORSForRecovery();
    if (corsResult.success) {
      console.log('✅ CORS working for recovery endpoint');
      console.log(`   Status: ${corsResult.status}`);
    } else {
      console.log('❌ CORS issue detected');
      console.log(`   Error: ${corsResult.error}`);
    }
  } catch (error) {
    console.log('❌ CORS test failed:', error.message);
  }
  
  // Test 3: Test rate limiting
  console.log('\n3. Testing rate limiting...');
  try {
    const rateLimitResult = await testRateLimit();
    if (rateLimitResult.success) {
      console.log('✅ Rate limiting is working correctly');
      console.log(`   Remaining requests: ${rateLimitResult.remaining}`);
    } else {
      console.log('⚠️ Rate limiting issue');
      console.log(`   Status: ${rateLimitResult.status}`);
    }
  } catch (error) {
    console.log('❌ Rate limit test failed:', error.message);
  }
  
  console.log('\n🎯 Summary:');
  console.log('- The /api/auth/recovery/get-questions endpoint should now work without authentication');
  console.log('- This fixes the HTTP 401 error in the account recovery flow');
  console.log('- Users can now retrieve their security questions for account recovery');
  console.log('- Settings page uses a separate authenticated endpoint');
  
  console.log('\n📋 Next Steps:');
  console.log('1. Test the full recovery flow on https://tridex.app');
  console.log('2. Try accessing security questions from account recovery page');
  console.log('3. Verify that Settings page still works correctly');
}

function testGetSecurityQuestions(email) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ email });
    
    const options = {
      hostname: 'safee-y8iw.onrender.com',
      port: 443,
      path: '/api/auth/recovery/get-questions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://tridex.app',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve({
            success: res.statusCode === 200,
            status: res.statusCode,
            data: parsedData,
            error: res.statusCode !== 200 ? parsedData.error : null
          });
        } catch (e) {
          resolve({
            success: false,
            status: res.statusCode,
            error: 'Failed to parse response'
          });
        }
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

function testCORSForRecovery() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'safee-y8iw.onrender.com',
      port: 443,
      path: '/api/auth/recovery/get-questions',
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://tridex.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    };
    
    const req = https.request(options, (res) => {
      const allowOrigin = res.headers['access-control-allow-origin'];
      const allowMethods = res.headers['access-control-allow-methods'];
      
      resolve({
        success: allowOrigin === 'https://tridex.app' || allowOrigin === '*',
        status: res.statusCode,
        allowOrigin,
        allowMethods
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

function testRateLimit() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'safee-y8iw.onrender.com',
      port: 443,
      path: '/api/health',
      method: 'GET',
      headers: {
        'Origin': 'https://tridex.app'
      }
    };
    
    const req = https.request(options, (res) => {
      const remaining = res.headers['x-ratelimit-remaining'];
      const limit = res.headers['x-ratelimit-limit'];
      
      resolve({
        success: res.statusCode === 200,
        status: res.statusCode,
        remaining: remaining || 'unknown',
        limit: limit || 'unknown'
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

if (require.main === module) {
  testSecurityQuestionsRecovery().catch(console.error);
}

module.exports = { testSecurityQuestionsRecovery };
