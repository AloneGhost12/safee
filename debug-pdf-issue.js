const fs = require('fs');
const path = require('path');

// Test script to debug PDF preview issues
console.log('🔍 PDF Preview Issue Debug Script');
console.log('=================================');

// Check if test PDF exists
const testPdfPath = path.join(__dirname, 'test-files', 'sample.pdf');
console.log('\n📁 Checking test PDF file:');
console.log(`Path: ${testPdfPath}`);

if (fs.existsSync(testPdfPath)) {
    const stats = fs.statSync(testPdfPath);
    console.log(`✅ Sample PDF exists (${(stats.size / 1024).toFixed(2)} KB)`);
} else {
    console.log('❌ Sample PDF not found');
}

// Test different viewer URLs that might be causing issues
console.log('\n🌐 Testing viewer URL patterns:');

const sampleUrl = 'https://example.com/sample.pdf';
const encodedUrl = encodeURIComponent(sampleUrl);

console.log('1. Direct URL:', sampleUrl);
console.log('2. Google Docs Viewer:', `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`);
console.log('3. PDF.js Viewer:', `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodedUrl}`);

console.log('\n⚠️  Common issues that cause "400 Bad Request" in Google Docs Viewer:');
console.log('- URL encoding problems');
console.log('- CORS restrictions on the PDF URL');
console.log('- PDF file is password protected');
console.log('- PDF file is corrupted or malformed');
console.log('- PDF file is too large (Google has size limits)');
console.log('- The PDF URL requires authentication headers');
console.log('- The PDF URL is a blob: or data: URL (not supported by Google Docs)');

console.log('\n🔧 Solutions implemented in your app:');
console.log('✅ Multi-method fallback (Direct → Google Docs → PDF.js)');
console.log('✅ Automatic retry on failure');
console.log('✅ Timeout protection (15 seconds)');
console.log('✅ Smart initial method selection based on URL type');
console.log('✅ User controls for manual method switching');
console.log('✅ Clear error messages with troubleshooting tips');

console.log('\n🎯 Next steps to resolve your specific issue:');
console.log('1. Check browser console for specific error messages');
console.log('2. Verify the PDF URL is publicly accessible');
console.log('3. Test with different PDF files to isolate the issue');
console.log('4. Try the manual "Try Different Viewer" button');
console.log('5. Use "Open in New Tab" to test direct browser PDF handling');

console.log('\nDebug complete! 🚀');
