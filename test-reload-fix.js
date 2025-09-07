/**
 * Test script to verify tridex.app URL routing fix
 * Run this in browser console after the fixes are applied
 */

function testTridexRoutingFix() {
  console.log('🧪 Testing tridex.app URL routing fix...')
  console.log('📍 Current URL:', window.location.href)
  console.log('📍 Expected base path: /safee/')
  
  // Check if we're on tridex.app
  const isTridex = window.location.hostname.includes('tridex.app')
  console.log('🌐 Is tridex.app?', isTridex)
  
  // Check base path configuration
  const basePath = import.meta?.env?.VITE_BASE_PATH || 'Not defined'
  console.log('🔧 Configured base path:', basePath)
  
  // Check if React Router has basename set
  const routerBasename = window.history?.state?.__navigatorBasename || 'Not detected'
  console.log('🧭 React Router basename:', routerBasename)
  
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
    
    originalLog.apply(console, args)
  }
  
  // Test URL patterns
  console.log('� URL Pattern Analysis:')
  const currentPath = window.location.pathname
  console.log('   - Current path:', currentPath)
  console.log('   - Starts with /safee/?', currentPath.startsWith('/safee/'))
  console.log('   - Is root path?', currentPath === '/')
  console.log('   - Is safee root?', currentPath === '/safee/' || currentPath === '/safee')
  
  // Check if URL handling is working
  if (isTridex) {
    if (currentPath.startsWith('/safee/')) {
      console.log('✅ URL structure looks correct for tridex.app')
    } else if (currentPath === '/') {
      console.log('⚠️ At root path - should redirect to /safee/')
    } else {
      console.log('❌ Unexpected URL structure for tridex.app')
    }
  }
  
  // Monitor for refresh loops (check if page reloads rapidly)
  let lastLoad = performance.now()
  const checkRefreshLoop = () => {
    const currentLoad = performance.now()
    const timeSinceLoad = currentLoad - lastLoad
    
    if (timeSinceLoad < 1000) {
      console.error('❌ RAPID REFRESH DETECTED! Time since last load:', timeSinceLoad, 'ms')
      console.error('💡 This indicates a refresh loop issue')
    } else {
      console.log('✅ No rapid refresh detected')
    }
  }
  
  // Schedule refresh loop check
  setTimeout(checkRefreshLoop, 100)
  
  return {
    isTridex,
    basePath,
    currentPath,
    initCount,
    routerBasename
  }
}

// Test specific URL scenarios
function testTridexURLScenarios() {
  console.log('🧪 Testing specific tridex.app URL scenarios...')
  
  const testCases = [
    'https://tridex.app/',
    'https://tridex.app/safee/',
    'https://tridex.app/safee/vault',
    'https://tridex.app/safee/files',
    'https://tridex.app/safee/login'
  ]
  
  console.log('🎯 Test cases that should work:')
  testCases.forEach((url, index) => {
    console.log(`   ${index + 1}. ${url}`)
  })
  
  // Test current URL
  const currentURL = window.location.href
  const shouldWork = testCases.some(testCase => currentURL.startsWith(testCase.replace(/\/$/, '')))
  
  if (shouldWork) {
    console.log('✅ Current URL is in supported test cases')
  } else {
    console.log('⚠️ Current URL is not in expected test cases')
  }
  
  // Test navigation
  console.log('🧭 Testing internal navigation...')
  if (window.history && window.history.pushState) {
    console.log('✅ History API available for testing')
    
    // Test if we can navigate programmatically
    const testNavigation = () => {
      try {
        const basePath = window.location.pathname.includes('/safee/') ? '/safee' : ''
        console.log('🔄 Testing navigation to:', basePath + '/vault')
        
        // This should work without causing a refresh
        window.history.pushState(null, '', basePath + '/vault')
        console.log('✅ Navigation test successful')
        
        // Navigate back
        setTimeout(() => {
          window.history.back()
          console.log('✅ Back navigation test successful')
        }, 1000)
        
      } catch (error) {
        console.error('❌ Navigation test failed:', error)
      }
    }
    
    // Run navigation test after a short delay
    setTimeout(testNavigation, 2000)
  }
}

// Quick diagnostic function
function diagnoseTridexProblem() {
  console.log('🔍 Diagnosing tridex.app specific issues...')
  
  // Check base path configuration
  console.log('🔧 Configuration Check:')
  console.log('   - VITE_BASE_PATH:', import.meta?.env?.VITE_BASE_PATH || 'undefined')
  console.log('   - VITE_API_URL:', import.meta?.env?.VITE_API_URL || 'undefined')
  console.log('   - Current hostname:', window.location.hostname)
  console.log('   - Current pathname:', window.location.pathname)
  
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
  const redirectFlag = sessionStorage.getItem('redirectPath')
  console.log('🏃 Session flags:')
  console.log('   - Redirect path:', redirectFlag)
  
  // Test API connectivity with correct base path
  console.log('🔗 Testing API connectivity...')
  const apiBase = import.meta?.env?.VITE_API_URL || 'https://safee-y8iw.onrender.com'
  
  fetch(apiBase + '/api/health')
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

// Export functions for global access
window.testTridexRoutingFix = testTridexRoutingFix
window.testTridexURLScenarios = testTridexURLScenarios
window.diagnoseTridexProblem = diagnoseTridexProblem

// Legacy function names for compatibility
window.testReloadFix = testTridexRoutingFix
window.diagnoseProblem = diagnoseTridexProblem

console.log('🛠️ Tridex.app Routing Fix Test Tools Loaded:')
console.log('  testTridexRoutingFix() - Test if tridex routing is fixed')
console.log('  testTridexURLScenarios() - Test specific URL scenarios')
console.log('  diagnoseTridexProblem() - Diagnose tridex-specific issues')

// Auto-run diagnosis if on tridex.app
if (window.location.hostname.includes('tridex.app')) {
  console.log('🌐 Detected tridex.app - running automatic diagnosis...')
  diagnoseTridexProblem()
  
  // Auto-run full test after page loads
  setTimeout(() => {
    console.log('� Running automatic routing test...')
    testTridexRoutingFix()
  }, 1000)
} else {
  console.log('🏠 Not on tridex.app - tools available for manual testing')
}
