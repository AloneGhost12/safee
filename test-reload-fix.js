/**
 * Test script to verify reload issue is fixed
 * Run this in browser console after the fixes are applied
 */

function testReloadFix() {
  console.log('🧪 Testing reload issue fix...')
  console.log('📍 Current URL:', window.location.href)
  
  // Track initialization attempts
  let initCount = 0
  let refreshCount = 0
  let errorCount = 0
  
  // Monitor console for AppProvider initialization
  const originalLog = console.log
  console.log = function(...args) {
    const message = args.join(' ')
    
    if (message.includes('AppProvider initializing')) {
      initCount++
      console.warn(`🔄 INIT COUNT: ${initCount}`)
      
      if (initCount > 2) {
        console.error('❌ MULTIPLE INITIALIZATIONS DETECTED!')
        console.error('💡 This indicates the reload issue may still exist')
      }
    }
    
    if (message.includes('Token refresh')) {
      refreshCount++
      console.warn(`🔄 REFRESH COUNT: ${refreshCount}`)
    }
    
    originalLog.apply(console, args)
  }
  
  // Monitor errors
  const originalError = console.error
  console.error = function(...args) {
    errorCount++
    console.warn(`❌ ERROR COUNT: ${errorCount}`)
    originalError.apply(console, args)
  }
  
  // Test page refresh behavior
  console.log('🔄 Testing page refresh behavior...')
  console.log('💡 About to reload page - watch for initialization count')
  
  // Give user time to read the message
  setTimeout(() => {
    console.log('🔄 Reloading page in 3 seconds...')
    setTimeout(() => {
      console.log('🔄 Reloading page in 2 seconds...')
      setTimeout(() => {
        console.log('🔄 Reloading page in 1 second...')
        setTimeout(() => {
          console.log('🔄 Reloading page now...')
          window.location.reload()
        }, 1000)
      }, 1000)
    }, 1000)
  }, 2000)
  
  // Monitor for 10 seconds before reload
  setTimeout(() => {
    console.log('📊 Pre-reload statistics:')
    console.log(`   - Initializations: ${initCount}`)
    console.log(`   - Refreshes: ${refreshCount}`)
    console.log(`   - Errors: ${errorCount}`)
    
    if (initCount <= 1 && errorCount === 0) {
      console.log('✅ App appears stable before reload test')
    } else {
      console.warn('⚠️ App showing signs of instability')
    }
  }, 7000)
}

// Quick diagnostic function
function diagnoseProblem() {
  console.log('🔍 Diagnosing potential reload issues...')
  
  // Check user data
  const user = localStorage.getItem('user')
  if (user) {
    try {
      const parsed = JSON.parse(user)
      console.log('👤 User data check:')
      console.log('   - Has ID:', !!parsed.id)
      console.log('   - Has Email:', !!parsed.email)
      console.log('   - Has Token:', !!parsed.token)
      console.log('   - Token format valid:', parsed.token?.split('.').length === 3)
    } catch (e) {
      console.error('❌ User data is corrupted:', e)
    }
  } else {
    console.log('👤 No user data found')
  }
  
  // Check for stuck flags
  const redirectFlag = sessionStorage.getItem('redirecting-to-login')
  const refreshFailure = sessionStorage.getItem('last-refresh-failure')
  
  console.log('🏃 Session flags:')
  console.log('   - Redirecting flag:', redirectFlag)
  console.log('   - Last refresh failure:', refreshFailure)
  
  if (redirectFlag) {
    console.warn('⚠️ Redirect flag is stuck - clearing it')
    sessionStorage.removeItem('redirecting-to-login')
  }
  
  if (refreshFailure) {
    const failureTime = parseInt(refreshFailure)
    const timeSince = Date.now() - failureTime
    console.log('   - Time since failure:', Math.round(timeSince / 1000), 'seconds')
    
    if (timeSince > 30000) {
      console.log('🧹 Clearing old refresh failure flag')
      sessionStorage.removeItem('last-refresh-failure')
    }
  }
  
  // Test API connectivity
  console.log('🔗 Testing API connectivity...')
  fetch('/api/health')
    .then(response => {
      if (response.ok) {
        console.log('✅ API health check passed')
        return response.json()
      } else {
        console.warn('⚠️ API health check failed:', response.status)
      }
    })
    .then(data => {
      if (data) {
        console.log('📊 API health data:', data)
      }
    })
    .catch(error => {
      console.error('❌ API connectivity error:', error)
    })
}

// Function to manually fix common issues
function quickFix() {
  console.log('🔧 Applying quick fixes for reload issues...')
  
  // Clear problematic flags
  sessionStorage.removeItem('redirecting-to-login')
  sessionStorage.removeItem('last-refresh-failure')
  
  // Validate and fix user data
  const user = localStorage.getItem('user')
  if (user) {
    try {
      const parsed = JSON.parse(user)
      if (!parsed.id || !parsed.email || !parsed.token) {
        console.log('🧹 Clearing invalid user data')
        localStorage.removeItem('user')
      } else if (parsed.token.split('.').length !== 3) {
        console.log('🧹 Clearing user with invalid token format')
        localStorage.removeItem('user')
      }
    } catch (e) {
      console.log('🧹 Clearing corrupted user data')
      localStorage.removeItem('user')
    }
  }
  
  console.log('✅ Quick fixes applied - try refreshing the page')
}

// Export functions
window.testReloadFix = testReloadFix
window.diagnoseProblem = diagnoseProblem
window.quickFix = quickFix

console.log('🛠️ Reload Fix Test Tools Loaded:')
console.log('  testReloadFix() - Test if reload issue is fixed')
console.log('  diagnoseProblem() - Diagnose current issues')
console.log('  quickFix() - Apply quick fixes')

// Auto-run diagnosis
console.log('🔍 Running automatic diagnosis...')
diagnoseProblem()
