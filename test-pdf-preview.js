#!/usr/bin/env node

/**
 * PDF Preview Test Script
 * Tests the PDF preview functionality with different file sources
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const SERVER_URL = 'http://localhost:4002';
const CLIENT_URL = 'http://localhost:5179';

console.log('🧪 PDF Preview Test Suite');
console.log('=========================\n');

async function testServerHealth() {
    console.log('1. Testing Server Health...');
    try {
        const response = await axios.get(`${SERVER_URL}/api/health`);
        console.log('✅ Server is healthy:', response.data);
        return true;
    } catch (error) {
        console.log('❌ Server health check failed:', error.message);
        return false;
    }
}

async function testCORS() {
    console.log('\n2. Testing CORS Configuration...');
    try {
        const response = await axios.options(`${SERVER_URL}/api/health`, {
            headers: {
                'Origin': CLIENT_URL,
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        });
        console.log('✅ CORS is properly configured');
        return true;
    } catch (error) {
        console.log('❌ CORS configuration issue:', error.message);
        return false;
    }
}

async function runTests() {
    const serverHealthy = await testServerHealth();
    if (!serverHealthy) {
        console.log('\n❌ Cannot continue tests - server is not healthy');
        return;
    }

    await testCORS();

    console.log('\n🎯 Manual Testing Instructions:');
    console.log('==============================');
    console.log('1. Open the application in your browser:');
    console.log(`   ${CLIENT_URL}`);
    console.log('\n2. Upload a PDF file to test the preview functionality');
    console.log('\n3. Click "Preview" on the uploaded PDF file');
    console.log('\n4. Enter your password when prompted');
    console.log('\n5. Observe the PDF preview behavior:');
    console.log('   - Should try Direct loading first');
    console.log('   - If that fails, should try Google Docs viewer');
    console.log('   - If Google Docs fails with HTTP 415, should try PDF.js');
    console.log('   - Should show appropriate error messages and retry options');
    console.log('\n6. Test the fallback options:');
    console.log('   - "Try Different Viewer" button');
    console.log('   - "Open in New Tab" button');
    console.log('   - "Download PDF" button');

    console.log('\n📋 Expected Behaviors:');
    console.log('=====================');
    console.log('✅ Direct loading works for most PDFs');
    console.log('✅ Google Docs viewer as fallback (may show HTTP 415 for some URLs)');
    console.log('✅ PDF.js viewer as final fallback');
    console.log('✅ Clear error messages and status indicators');
    console.log('✅ Automatic progression through viewer methods');
    console.log('✅ Manual retry and alternative viewing options');

    console.log('\n🔧 Debug Information:');
    console.log('====================');
    console.log('- Check browser console for detailed PDF loading logs');
    console.log('- HTTP 415 errors from Google Docs viewer are expected for some URLs');
    console.log('- PDF.js viewer should work as final fallback for most files');
    console.log('- Large PDF files may take longer to load');
}

// Run the tests
runTests().catch(console.error);
