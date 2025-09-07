/**
 * QR Code Debugging Script
 * Run this in the browser console to diagnose QR code display issues
 */

async function debugQRCodeIssues() {
  console.log('🔍 Debugging QR Code Display Issues...')
  
  // Check if user is authenticated
  const userString = localStorage.getItem('user')
  if (!userString) {
    console.log('❌ No user found in localStorage - must be logged in')
    return
  }
  
  const user = JSON.parse(userString)
  console.log('👤 Current user:', {
    id: user.id,
    email: user.email,
    token: user.token ? 'Present' : 'Missing'
  })
  
  console.log('\n🔧 Testing QR Code Generation Process...')
  
  // 1. Test 2FA enable API call
  console.log('\n1. Testing 2FA enable API...')
  try {
    const enable2FAResponse = await fetch('/api/auth/2fa/enable', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: user.email })
    })
    
    console.log('API Response Status:', enable2FAResponse.status)
    
    if (enable2FAResponse.ok) {
      const data = await enable2FAResponse.json()
      console.log('✅ 2FA enable API successful')
      console.log('📋 Response data:', data)
      
      if (data.otpauth_url) {
        const otpauthUrl = data.otpauth_url
        console.log('🔗 OTPAUTH URL:', otpauthUrl)
        
        // Test QR code generation
        testQRCodeGeneration(otpauthUrl)
        
      } else {
        console.log('❌ No otpauth_url in response')
      }
    } else if (enable2FAResponse.status === 429) {
      console.log('❌ Rate limited - wait 15 minutes before trying again')
    } else if (enable2FAResponse.status === 401) {
      console.log('❌ Authentication failed - token may be expired')
      console.log('💡 Try logging out and logging back in')
    } else {
      const errorText = await enable2FAResponse.text()
      console.log('❌ API call failed:', errorText)
    }
  } catch (error) {
    console.error('❌ Network error:', error)
  }
}

function testQRCodeGeneration(otpauthUrl) {
  console.log('\n2. Testing QR Code Generation...')
  
  // Test the QR code service URL
  const qrServiceUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(otpauthUrl)}`
  console.log('🔲 QR Code Service URL:', qrServiceUrl)
  
  // Test if QR service is accessible
  console.log('\n3. Testing QR Code Service Accessibility...')
  
  // Create a test image to check if the service loads
  const testImg = new Image()
  testImg.onload = function() {
    console.log('✅ QR Code service is accessible and working')
    console.log('📏 Image dimensions:', this.naturalWidth, 'x', this.naturalHeight)
    
    // Display the QR code in console (if possible)
    displayQRCodeInfo(qrServiceUrl, otpauthUrl)
  }
  
  testImg.onerror = function() {
    console.log('❌ QR Code service failed to load')
    console.log('🚫 Possible causes:')
    console.log('   - Network connectivity issues')
    console.log('   - QR service blocked by firewall/adblocker')
    console.log('   - CORS issues with QR service')
    console.log('   - QR service is down')
    
    // Try alternative QR generation
    tryAlternativeQRGeneration(otpauthUrl)
  }
  
  testImg.src = qrServiceUrl
  
  // Also test if we can create a QR code element in the page
  testDOMInsertion(qrServiceUrl)
}

function displayQRCodeInfo(qrUrl, otpauthUrl) {
  console.log('\n4. QR Code Information:')
  console.log('🔗 Full QR URL:', qrUrl)
  console.log('📱 OTPAUTH Data:', otpauthUrl)
  
  // Parse the OTPAUTH URL
  try {
    const url = new URL(otpauthUrl)
    console.log('📋 Parsed OTPAUTH:')
    console.log('   Protocol:', url.protocol)
    console.log('   Service:', url.pathname)
    console.log('   Parameters:')
    for (const [key, value] of url.searchParams) {
      console.log(`     ${key}: ${value}`)
    }
  } catch (error) {
    console.log('❌ Failed to parse OTPAUTH URL:', error)
  }
}

function tryAlternativeQRGeneration(otpauthUrl) {
  console.log('\n5. Trying Alternative QR Code Services...')
  
  const alternatives = [
    `https://chart.googleapis.com/chart?chs=150x150&cht=qr&chl=${encodeURIComponent(otpauthUrl)}`,
    `https://qr-server.com/api/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(otpauthUrl)}`,
    `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`
  ]
  
  alternatives.forEach((altUrl, index) => {
    console.log(`\n   Testing alternative ${index + 1}:`)
    console.log(`   ${altUrl.substring(0, 50)}...`)
    
    const testImg = new Image()
    testImg.onload = function() {
      console.log(`   ✅ Alternative ${index + 1} works!`)
      console.log(`   📏 Size: ${this.naturalWidth}x${this.naturalHeight}`)
    }
    testImg.onerror = function() {
      console.log(`   ❌ Alternative ${index + 1} failed`)
    }
    testImg.src = altUrl
  })
}

function testDOMInsertion(qrUrl) {
  console.log('\n6. Testing DOM Insertion...')
  
  // Try to find the QR code container in the page
  const qrContainers = document.querySelectorAll('img[alt*="QR"]')
  console.log(`Found ${qrContainers.length} potential QR code containers`)
  
  if (qrContainers.length > 0) {
    const qrImg = qrContainers[0]
    console.log('🔲 Existing QR image element:', qrImg)
    console.log('   Current src:', qrImg.src)
    console.log('   CSS classes:', qrImg.className)
    console.log('   Computed style visible:', window.getComputedStyle(qrImg).display !== 'none')
  }
  
  // Create a test QR code element
  console.log('\n   Creating test QR code element...')
  const testDiv = document.createElement('div')
  testDiv.style.position = 'fixed'
  testDiv.style.top = '10px'
  testDiv.style.right = '10px'
  testDiv.style.zIndex = '9999'
  testDiv.style.background = 'white'
  testDiv.style.padding = '10px'
  testDiv.style.border = '2px solid red'
  testDiv.innerHTML = `
    <p style="color: black; margin: 0 0 10px 0;">Test QR Code:</p>
    <img src="${qrUrl}" alt="Test QR" style="display: block; width: 100px; height: 100px;">
  `
  
  document.body.appendChild(testDiv)
  console.log('📍 Test QR code added to top-right corner of page')
  
  // Remove it after 10 seconds
  setTimeout(() => {
    if (document.body.contains(testDiv)) {
      document.body.removeChild(testDiv)
      console.log('🗑️ Test QR code removed')
    }
  }, 10000)
}

// Quick fix function
function quickFixQRCode() {
  console.log('\n🔧 Applying Quick QR Code Fix...')
  
  // Find QR code images and try to reload them
  const qrImages = document.querySelectorAll('img[alt*="QR"], img[src*="qrserver"], img[src*="qr-code"]')
  
  qrImages.forEach((img, index) => {
    console.log(`🔄 Reloading QR image ${index + 1}`)
    const originalSrc = img.src
    img.src = ''
    setTimeout(() => {
      img.src = originalSrc
    }, 100)
  })
  
  if (qrImages.length === 0) {
    console.log('❌ No QR code images found to fix')
  }
}

// Export functions to global scope
window.debugQRCodeIssues = debugQRCodeIssues
window.quickFixQRCode = quickFixQRCode

// Auto-run the main diagnostic
debugQRCodeIssues()

console.log('\n🛠️ Available QR debug functions:')
console.log('  debugQRCodeIssues() - Run full QR diagnostic')
console.log('  quickFixQRCode() - Try to reload QR images')
