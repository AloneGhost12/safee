/**
 * Current Reload Issue Debugger
 * Run this in browser console to identify the specific reload problem
 */

function debugCurrentReloadIssue() {
  console.log('🔍 Debugging Current Reload Issue...')
  console.log('📍 Current URL:', window.location.href)
  console.log('📍 Current Path:', window.location.pathname)
  
  // Check localStorage state
  const user = localStorage.getItem('user')
  console.log('👤 User in localStorage:', user ? JSON.parse(user) : null)
  
  // Check if there are any console errors
  let errorCount = 0
  const originalError = console.error
  console.error = function(...args) {
    errorCount++
    console.warn(`❌ ERROR #${errorCount}:`, ...args)
    originalError.apply(console, args)
  }
  
  // Monitor React component lifecycle
  let mountCount = 0
  let unmountCount = 0
  
  // Override console.log to track AppProvider lifecycle
  const originalLog = console.log
  console.log = function(...args) {
    const message = args.join(' ')
    
    if (message.includes('AppProvider initializing')) {
      mountCount++
      console.warn(`🔄 MOUNT #${mountCount}: AppProvider initializing`)
    }
    
    if (message.includes('AppProvider initialized')) {
      console.warn(`✅ MOUNT COMPLETE #${mountCount}: AppProvider initialized`)
    }
    
    originalLog.apply(console, args)
  }
  
  // Check for duplicate React renders in development
  const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost'
  if (isDevelopment) {
    console.log('⚠️ Development mode detected - expect some double-rendering due to React StrictMode')
  }
  
  // Monitor network requests
  let requestCount = 0
  const originalFetch = window.fetch
  window.fetch = function(url, options) {
    requestCount++
    console.log(`🌐 REQUEST #${requestCount}:`, typeof url === 'string' ? url : url.toString())
    
    return originalFetch.apply(this, arguments)
      .then(response => {
        console.log(`✅ RESPONSE #${requestCount}:`, response.status, typeof url === 'string' ? url : url.toString())
        return response
      })
      .catch(error => {
        console.error(`❌ REQUEST FAILED #${requestCount}:`, error, typeof url === 'string' ? url : url.toString())
        throw error
      })
  }
  
  // Monitor page navigation
  const originalPushState = history.pushState
  const originalReplaceState = history.replaceState
  
  history.pushState = function(...args) {
    console.warn('🧭 NAVIGATION: pushState to', args[2])
    return originalPushState.apply(this, args)
  }
  
  history.replaceState = function(...args) {
    console.warn('🧭 NAVIGATION: replaceState to', args[2])
    return originalReplaceState.apply(this, args)
  }
  
  // Check for infinite refresh loops
  let refreshCount = 0
  const originalReload = window.location.reload
  window.location.reload = function(...args) {
    refreshCount++
    console.warn(`🔄 PAGE RELOAD #${refreshCount}`)
    if (refreshCount > 3) {
      console.error('🚨 MULTIPLE RELOADS DETECTED - POSSIBLE INFINITE LOOP!')
      console.error('💡 This might indicate a reload loop bug')
      return // Prevent the reload to stop the loop
    }
    return originalReload.apply(this, args)
  }
  
  // Report status every 2 seconds
  const statusInterval = setInterval(() => {
    console.log('📊 Status Update:')
    console.log(`   - Mounts: ${mountCount}`)
    console.log(`   - Errors: ${errorCount}`)
    console.log(`   - Requests: ${requestCount}`)
    console.log(`   - Refreshes: ${refreshCount}`)
    console.log(`   - Current Path: ${window.location.pathname}`)
    
    // Check for problems
    if (mountCount > 2) {
      console.warn('⚠️ Multiple app initializations detected')
    }
    if (errorCount > 0) {
      console.warn('⚠️ JavaScript errors detected')
    }
    if (refreshCount > 1) {
      console.warn('⚠️ Multiple page refreshes detected')
    }
  }, 2000)
  
  // Auto-stop monitoring after 30 seconds
  setTimeout(() => {
    clearInterval(statusInterval)
    console.log('🏁 Debug monitoring stopped after 30 seconds')
    console.log('📊 Final Report:')
    console.log(`   - Total Mounts: ${mountCount}`)
    console.log(`   - Total Errors: ${errorCount}`)
    console.log(`   - Total Requests: ${requestCount}`)
    console.log(`   - Total Refreshes: ${refreshCount}`)
    
    // Diagnosis
    if (mountCount === 1 && errorCount === 0 && refreshCount <= 1) {
      console.log('✅ DIAGNOSIS: App appears to be working normally')
    } else if (mountCount > 2) {
      console.log('❌ DIAGNOSIS: Multiple initializations - possible component mounting issue')
    } else if (refreshCount > 1) {
      console.log('❌ DIAGNOSIS: Multiple page refreshes - possible infinite reload loop')
    } else if (errorCount > 0) {
      console.log('❌ DIAGNOSIS: JavaScript errors detected - check console above')
    }
  }, 30000)
  
  console.log('🔍 Monitoring started for 30 seconds...')
  console.log('💡 Watch for patterns and warnings above')
}

// Quick fixes for common reload issues
function fixReloadIssues() {
  console.log('🔧 Applying common reload issue fixes...')
  
  // Fix 1: Clear potentially corrupted storage
  console.log('1. Clearing localStorage and sessionStorage...')
  localStorage.clear()
  sessionStorage.clear()
  
  // Fix 2: Reset location without triggering navigation
  console.log('2. Resetting page state...')
  if (window.location.pathname !== '/login') {
    window.history.replaceState({}, '', '/login')
  }
  
  // Fix 3: Force a clean page reload
  console.log('3. Performing clean reload...')
  setTimeout(() => {
    window.location.href = window.location.origin + '/login'
  }, 1000)
}

// Test specific reload scenarios
function testReloadScenarios() {
  console.log('🧪 Testing reload scenarios...')
  
  // Test 1: Check if user data is valid
  const user = localStorage.getItem('user')
  if (user) {
    try {
      const parsed = JSON.parse(user)
      console.log('👤 User data structure:')
      console.log('   - Has ID:', !!parsed.id)
      console.log('   - Has Email:', !!parsed.email)
      console.log('   - Has Token:', !!parsed.token)
      console.log('   - Token length:', parsed.token?.length || 0)
      
      if (!parsed.id || !parsed.email || !parsed.token) {
        console.warn('⚠️ User data is incomplete - this could cause reload issues')
      }
    } catch (e) {
      console.error('❌ User data is corrupted JSON:', e)
    }
  }
  
  // Test 2: Check API connectivity
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
      console.log('📊 API health data:', data)
    })
    .catch(error => {
      console.error('❌ API connection failed:', error)
      console.log('💡 This could cause authentication issues on reload')
    })
  
  // Test 3: Check for React development mode issues
  if (window.React) {
    console.log('⚛️ React detected in global scope')
  }
  
  // Test 4: Check for service workers
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      if (registrations.length > 0) {
        console.log(`🔄 ${registrations.length} service worker(s) found`)
        console.log('💡 Service workers might cache old versions and cause issues')
      } else {
        console.log('✅ No service workers found')
      }
    })
  }
}

// Export functions to global scope
window.debugCurrentReloadIssue = debugCurrentReloadIssue
window.fixReloadIssues = fixReloadIssues
window.testReloadScenarios = testReloadScenarios

console.log('🛠️ Reload Issue Debug Tools Loaded:')
console.log('  debugCurrentReloadIssue() - Monitor current behavior')
console.log('  fixReloadIssues() - Apply common fixes')
console.log('  testReloadScenarios() - Test specific scenarios')

// Auto-start if this is the current issue
console.log('🎯 Ready to debug reload issue!')
console.log('💡 Run debugCurrentReloadIssue() and then refresh the page to see what happens')
