/**
 * Refresh Loop Bug Debugging Script
 * Run this in browser console to identify what's causing the infinite refresh loop
 */

function debugRefreshLoop() {
  console.log('🔍 Debugging Refresh Loop Bug...')
  
  // Track state changes
  let stateChangeCount = 0
  let navigationCount = 0
  let tokenRefreshCount = 0
  let authInitCount = 0
  
  // Monitor localStorage changes
  let lastUserString = localStorage.getItem('user')
  
  // Override console.log to track authentication-related logs
  const originalLog = console.log
  console.log = function(...args) {
    const message = args.join(' ')
    
    if (message.includes('AppProvider initializing')) {
      authInitCount++
      console.warn(`🔄 AUTH INIT #${authInitCount}: AppProvider initializing`)
    }
    
    if (message.includes('Token refresh')) {
      tokenRefreshCount++
      console.warn(`🔄 TOKEN REFRESH #${tokenRefreshCount}: ${message}`)
    }
    
    if (message.includes('Redirecting to login')) {
      navigationCount++
      console.warn(`🔄 NAVIGATION #${navigationCount}: ${message}`)
    }
    
    originalLog.apply(console, args)
  }
  
  // Monitor localStorage changes
  const originalSetItem = localStorage.setItem
  const originalRemoveItem = localStorage.removeItem
  
  localStorage.setItem = function(key, value) {
    if (key === 'user') {
      console.warn('💾 STORAGE SET:', { key, value: value.substring(0, 100) + '...' })
      if (lastUserString !== value) {
        stateChangeCount++
        console.warn(`🔄 USER STATE CHANGE #${stateChangeCount}`)
        lastUserString = value
      }
    }
    originalSetItem.call(this, key, value)
  }
  
  localStorage.removeItem = function(key) {
    if (key === 'user') {
      console.warn('🗑️ STORAGE REMOVE:', key)
      if (lastUserString !== null) {
        stateChangeCount++
        console.warn(`🔄 USER STATE CHANGE #${stateChangeCount} (cleared)`)
        lastUserString = null
      }
    }
    originalRemoveItem.call(this, key)
  }
  
  // Monitor fetch requests
  const originalFetch = window.fetch
  window.fetch = function(url, options) {
    if (typeof url === 'string' && url.includes('/auth/refresh')) {
      console.warn('🔄 FETCH: Token refresh request', { url, options })
    }
    
    return originalFetch.apply(this, arguments).then(response => {
      if (typeof url === 'string' && url.includes('/auth/refresh')) {
        console.warn('🔄 FETCH RESPONSE: Token refresh', {
          status: response.status,
          ok: response.ok
        })
      }
      return response
    })
  }
  
  // Monitor React navigation
  const originalPushState = history.pushState
  const originalReplaceState = history.replaceState
  
  history.pushState = function(...args) {
    console.warn('🧭 NAVIGATION: pushState', args[2])
    return originalPushState.apply(this, args)
  }
  
  history.replaceState = function(...args) {
    console.warn('🧭 NAVIGATION: replaceState', args[2])
    return originalReplaceState.apply(this, args)
  }
  
  // Monitor window location changes
  let lastLocation = window.location.href
  setInterval(() => {
    if (window.location.href !== lastLocation) {
      console.warn('🧭 LOCATION CHANGE:', {
        from: lastLocation,
        to: window.location.href
      })
      lastLocation = window.location.href
    }
  }, 100)
  
  // Check for infinite loops
  let warningThreshold = 5
  setInterval(() => {
    if (authInitCount > warningThreshold) {
      console.error(`🚨 INFINITE LOOP DETECTED: AppProvider initialized ${authInitCount} times!`)
    }
    if (tokenRefreshCount > warningThreshold) {
      console.error(`🚨 INFINITE LOOP DETECTED: Token refresh called ${tokenRefreshCount} times!`)
    }
    if (navigationCount > warningThreshold) {
      console.error(`🚨 INFINITE LOOP DETECTED: Navigation triggered ${navigationCount} times!`)
    }
    if (stateChangeCount > warningThreshold) {
      console.error(`🚨 INFINITE LOOP DETECTED: User state changed ${stateChangeCount} times!`)
    }
  }, 2000)
  
  // Report current state
  setTimeout(() => {
    console.log('📊 Refresh Loop Analysis Report:')
    console.log(`   Auth Initializations: ${authInitCount}`)
    console.log(`   Token Refreshes: ${tokenRefreshCount}`)
    console.log(`   Navigations: ${navigationCount}`)
    console.log(`   State Changes: ${stateChangeCount}`)
    console.log(`   Current Path: ${window.location.pathname}`)
    console.log(`   User in Storage: ${localStorage.getItem('user') ? 'Yes' : 'No'}`)
    
    const user = localStorage.getItem('user')
    if (user) {
      try {
        const parsed = JSON.parse(user)
        console.log(`   User Token: ${parsed.token ? 'Present' : 'Missing'}`)
        console.log(`   User Email: ${parsed.email || 'Missing'}`)
      } catch (e) {
        console.log(`   User Data: Invalid JSON`)
      }
    }
  }, 3000)
  
  console.log('🔍 Monitoring started. Watch for patterns in the console...')
  console.log('💡 If you see repeated "AppProvider initializing" messages, that\'s the loop!')
}

// Function to identify the specific cause
function analyzeRefreshLoop() {
  console.log('🔬 Analyzing potential causes...')
  
  // Check 1: Token validation
  const user = localStorage.getItem('user')
  if (user) {
    try {
      const parsed = JSON.parse(user)
      if (!parsed.token) {
        console.error('❌ CAUSE: User in storage but missing token')
      } else if (!parsed.id || !parsed.email) {
        console.error('❌ CAUSE: User in storage but missing required fields')
      } else {
        console.log('✅ User data appears valid')
      }
    } catch (e) {
      console.error('❌ CAUSE: Invalid user JSON in localStorage')
    }
  }
  
  // Check 2: API base URL
  console.log('🔗 API Base URL check...')
  fetch('/api/health')
    .then(response => {
      if (response.ok) {
        console.log('✅ API endpoint reachable')
      } else {
        console.error('❌ CAUSE: API endpoint not reachable')
      }
    })
    .catch(error => {
      console.error('❌ CAUSE: API connection failed', error)
    })
  
  // Check 3: React StrictMode double rendering
  console.log('⚠️ Check: Are you in development mode with React StrictMode?')
  console.log('   This can cause double rendering and initialization')
  
  // Check 4: Multiple AppProvider instances
  const appProviders = document.querySelectorAll('[data-react-component*="AppProvider"]')
  if (appProviders.length > 1) {
    console.error(`❌ CAUSE: Multiple AppProvider instances detected (${appProviders.length})`)
  }
}

// Quick fix function
function quickFixRefreshLoop() {
  console.log('🔧 Applying quick fixes...')
  
  // Fix 1: Clear potentially corrupted auth state
  console.log('1. Clearing auth state...')
  localStorage.removeItem('user')
  
  // Fix 2: Clear any stuck refresh flags
  console.log('2. Clearing any stuck flags...')
  sessionStorage.clear()
  
  // Fix 3: Force reload to clean state
  console.log('3. Forcing clean reload...')
  setTimeout(() => {
    window.location.reload()
  }, 1000)
}

// Export functions
window.debugRefreshLoop = debugRefreshLoop
window.analyzeRefreshLoop = analyzeRefreshLoop  
window.quickFixRefreshLoop = quickFixRefreshLoop

console.log('🛠️ Refresh Loop Debug Tools Loaded:')
console.log('  debugRefreshLoop() - Monitor for infinite loops')
console.log('  analyzeRefreshLoop() - Check potential causes')
console.log('  quickFixRefreshLoop() - Apply quick fixes')

// Auto-start monitoring
debugRefreshLoop()
