/**
 * 2FA Debugging Script
 * Run this in the browser console to diagnose 2FA issues
 */

async function debug2FAIssues() {
  console.log('🔍 Debugging 2FA Issues...')
  
  // Check if user is authenticated
  const userString = localStorage.getItem('user')
  if (!userString) {
    console.log('❌ No user found in localStorage - must be logged in to use 2FA')
    return
  }
  
  const user = JSON.parse(userString)
  console.log('👤 Current user:', {
    id: user.id,
    email: user.email,
    twoFactorEnabled: user.twoFactorEnabled
  })
  
  console.log('\n📋 2FA Diagnostic Checklist:')
  
  // 1. Test API connectivity with auth
  console.log('\n1. Testing authenticated API connectivity...')
  try {
    const healthResponse = await fetch('/api/health', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (healthResponse.ok) {
      console.log('✅ Authenticated API calls working')
    } else {
      console.log('❌ API authentication failed:', healthResponse.status)
      if (healthResponse.status === 429) {
        console.log('⚠️ Rate limited - wait 15 minutes before trying again')
      }
    }
  } catch (error) {
    console.error('❌ API connectivity error:', error)
  }
  
  // 2. Test 2FA enable endpoint
  console.log('\n2. Testing 2FA enable endpoint...')
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
    
    console.log('Enable 2FA response status:', enable2FAResponse.status)
    
    if (enable2FAResponse.ok) {
      const data = await enable2FAResponse.json()
      console.log('✅ 2FA enable working - QR URL generated')
      console.log('🔗 QR Code URL format:', data.otpauth_url.substring(0, 50) + '...')
      
      // Test generating QR code
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data.otpauth_url)}`
      console.log('🔲 QR Code Image URL:', qrUrl)
      
    } else if (enable2FAResponse.status === 429) {
      console.log('❌ Rate limited - wait 15 minutes before trying again')
    } else if (enable2FAResponse.status === 401) {
      console.log('❌ Authentication failed - token may be expired')
    } else {
      const errorText = await enable2FAResponse.text()
      console.log('❌ 2FA enable failed:', errorText)
    }
  } catch (error) {
    console.error('❌ 2FA enable error:', error)
  }
  
  // 3. Check if 2FA is already enabled
  console.log('\n3. Checking current 2FA status...')
  if (user.twoFactorEnabled) {
    console.log('✅ 2FA is already enabled for this user')
    
    // Test backup codes info
    try {
      const backupResponse = await fetch('/api/auth/2fa/backup-codes', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: user.email })
      })
      
      if (backupResponse.ok) {
        const backupData = await backupResponse.json()
        console.log('✅ Backup codes info:', backupData)
      } else {
        console.log('❌ Backup codes check failed:', backupResponse.status)
      }
    } catch (error) {
      console.log('❌ Backup codes error:', error)
    }
  } else {
    console.log('⚠️ 2FA is not enabled for this user')
  }
  
  // 4. Test code verification (if user has a code)
  console.log('\n4. Testing 2FA verification...')
  console.log('💡 To test verification, run:')
  console.log('   debug2FAVerification("123456") // Replace with actual 6-digit code')
  
  // 5. Common issues checklist
  console.log('\n🔧 Common 2FA Issues and Solutions:')
  console.log('   📱 App not generating codes:')
  console.log('     - Check phone time synchronization')
  console.log('     - Rescan QR code in authenticator app')
  console.log('     - Try different authenticator app')
  console.log('   ⏰ Codes not working:')
  console.log('     - Codes change every 30 seconds')
  console.log('     - Enter code quickly after generation')
  console.log('     - Check for time sync issues')
  console.log('   🚫 Rate limiting:')
  console.log('     - Wait 15 minutes between attempts')
  console.log('     - Clear browser data and try again')
  console.log('   🔐 Authentication errors:')
  console.log('     - Log out and log back in')
  console.log('     - Check token expiration')
}

// Helper function to test 2FA verification
async function debug2FAVerification(code) {
  const userString = localStorage.getItem('user')
  if (!userString) {
    console.log('❌ No user found - must be logged in')
    return
  }
  
  const user = JSON.parse(userString)
  
  console.log(`🔢 Testing 2FA verification with code: ${code}`)
  
  try {
    const verifyResponse = await fetch('/api/auth/2fa/verify', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        email: user.email,
        code: code 
      })
    })
    
    console.log('Verification response status:', verifyResponse.status)
    
    if (verifyResponse.ok) {
      const data = await verifyResponse.json()
      console.log('✅ 2FA verification successful!')
      console.log('📋 Response:', data)
      
      if (data.backupCodes) {
        console.log('🔑 Backup codes generated - SAVE THESE SECURELY:')
        data.backupCodes.forEach((code, index) => {
          console.log(`   ${index + 1}: ${code}`)
        })
      }
    } else {
      const errorText = await verifyResponse.text()
      console.log('❌ 2FA verification failed:', errorText)
      
      if (verifyResponse.status === 400) {
        console.log('💡 Common causes: Invalid code, expired code, or code already used')
      } else if (verifyResponse.status === 429) {
        console.log('💡 Rate limited - wait 15 minutes before trying again')
      }
    }
  } catch (error) {
    console.error('❌ 2FA verification error:', error)
  }
}

// Helper function to test 2FA login
async function debug2FALogin(identifier, password, code) {
  console.log(`🔐 Testing 2FA login with identifier: ${identifier}`)
  
  try {
    const loginResponse = await fetch('/api/auth/2fa/login', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        identifier: identifier,
        password: password,
        code: code 
      })
    })
    
    console.log('2FA login response status:', loginResponse.status)
    
    if (loginResponse.ok) {
      const data = await loginResponse.json()
      console.log('✅ 2FA login successful!')
      console.log('👤 User data:', data.user)
    } else {
      const errorText = await loginResponse.text()
      console.log('❌ 2FA login failed:', errorText)
    }
  } catch (error) {
    console.error('❌ 2FA login error:', error)
  }
}

// Export functions to global scope
window.debug2FAIssues = debug2FAIssues
window.debug2FAVerification = debug2FAVerification
window.debug2FALogin = debug2FALogin

// Auto-run the main diagnostic
debug2FAIssues()

console.log('\n🛠️ Available debug functions:')
console.log('  debug2FAIssues() - Run full diagnostic')
console.log('  debug2FAVerification("123456") - Test code verification')
console.log('  debug2FALogin("email", "password", "123456") - Test 2FA login')
