#!/usr/bin/env node

/**
 * Script to verify CORS configuration and provide deployment guidance
 */

const https = require('https');

const API_BASE_URL = 'https://safee-y8iw.onrender.com';
const CLIENT_ORIGINS = [
  'https://tridex.app',
  'https://aloneghost12.github.io',
  'https://aloneghost12.netlify.app'
];

async function checkCORSConfig() {
  console.log('🔍 Checking CORS configuration...\n');
  
  // Check if the API is responding
  console.log('1. Testing API health...');
  try {
    const healthResponse = await makeRequest(`${API_BASE_URL}/api/health`);
    console.log('✅ API is responding');
    console.log(`   Status: ${healthResponse.status}`);
  } catch (error) {
    console.log('❌ API health check failed:', error.message);
    return;
  }
  
  // Test CORS for each origin
  console.log('\n2. Testing CORS for each origin...');
  
  for (const origin of CLIENT_ORIGINS) {
    console.log(`\n   Testing origin: ${origin}`);
    try {
      const corsResult = await testCORS(origin);
      if (corsResult.success) {
        console.log('   ✅ CORS allowed');
      } else {
        console.log('   ❌ CORS blocked');
        console.log(`   Error: ${corsResult.error}`);
      }
    } catch (error) {
      console.log('   ❌ CORS test failed:', error.message);
    }
  }
  
  console.log('\n3. Recommendations:');
  console.log('   📋 Expected ALLOWED_ORIGINS in Render environment:');
  console.log(`   ${CLIENT_ORIGINS.join(',')}`);
  
  console.log('\n   🔧 If CORS is failing:');
  console.log('   1. Go to Render Dashboard → Your Service → Environment');
  console.log('   2. Update ALLOWED_ORIGINS to include all origins listed above');
  console.log('   3. Redeploy the service');
  console.log('   4. Wait 2-3 minutes for changes to take effect');
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

function testCORS(origin) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'safee-y8iw.onrender.com',
      port: 443,
      path: '/api/health',
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
        resolve({ success: true, allowOrigin, allowMethods });
      } else {
        resolve({ 
          success: false, 
          error: `Origin not allowed. Got: ${allowOrigin}, Expected: ${origin}` 
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

if (require.main === module) {
  checkCORSConfig().catch(console.error);
}

module.exports = { checkCORSConfig };
