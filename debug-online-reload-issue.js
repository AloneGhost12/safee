/**
 * Online/Production Reload Issue Debugger
 * 
 * Run this in browser console when testing online to identify the specific issue:
 * 1. Open your deployed app (tridex.app/safee/ or wherever it's hosted)
 * 2. Open browser console (F12)
 * 3. Run: debugOnlineReloadIssue()
 */

function debugOnlineReloadIssue() {
  console.log('🌐 Debugging ONLINE reload issue...')
  console.log('📍 Current URL:', window.location.href)
  console.log('📍 Hostname:', window.location.hostname)
  console.log('📍 Pathname:', window.location.pathname)
  
  // Check environment detection
  const isProduction = !window.location.hostname.includes('localhost')
  const hasViteApiUrl = typeof import !== 'undefined' && import.meta && import.meta.env && import.meta.env.VITE_API_URL
  
  console.log('🔧 Environment Analysis:')
  console.log(`   - Is Production: ${isProduction}`)
  console.log(`   - Has VITE_API_URL: ${hasViteApiUrl}`)
  
  if (hasViteApiUrl) {
    console.log(`   - VITE_API_URL: ${import.meta.env.VITE_API_URL}`)
  } else {
    console.log(`   - VITE_API_URL: NOT SET (will use fallback)`)
  }
  
  // Determine what API base URL is being used
  let expectedApiBase
  if (isProduction && hasViteApiUrl) {
    expectedApiBase = `${import.meta.env.VITE_API_URL}/api`
  } else if (!isProduction) {
    expectedApiBase = '/api'
  } else {
    expectedApiBase = 'https://safee-y8iw.onrender.com/api'
  }
  
  console.log(`🎯 Expected API Base: ${expectedApiBase}`)
  
  // Check user authentication state
  const savedUser = localStorage.getItem('user')
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser)
      console.log('👤 User Analysis:')
      console.log(`   - User ID: ${user.id}`)
      console.log(`   - Email: ${user.email}`)
      console.log(`   - Has Token: ${!!user.token}`)
      
      if (user.token) {
        const tokenParts = user.token.split('.')
        console.log(`   - Token Format: ${tokenParts.length === 3 ? 'Valid JWT' : 'Invalid JWT'}`)
        console.log(`   - Token Length: ${user.token.length}`)
      }
    } catch (error) {
      console.error('❌ Failed to parse user from localStorage:', error)
    }
  } else {
    console.log('🚫 No user found in localStorage')
  }
  
  // Test API connectivity
  console.log('🌐 Testing API connectivity...')
  
  // Test 1: Health endpoint
  const healthUrl = `${expectedApiBase}/health`
  console.log(`🏥 Testing health endpoint: ${healthUrl}`)
  
  fetch(healthUrl)
    .then(response => {
      console.log(`✅ Health check status: ${response.status}`)
      if (response.ok) {
        return response.json()
      } else {
        console.log(`❌ Health check failed: ${response.status} ${response.statusText}`)
        return response.text().then(text => {
          console.log(`❌ Health check error body: ${text}`)
        })
      }
    })
    .then(data => {
      if (data) {
        console.log('✅ Health check data:', data)
      }
    })
    .catch(error => {
      console.error('❌ Health check network error:', error)
      console.log('💡 This suggests API connectivity issues')
    })
  
  // Test 2: CORS preflight
  console.log('🔒 Testing CORS configuration...')
  const corsTestUrl = `${expectedApiBase}/auth/refresh`
  
  fetch(corsTestUrl, {
    method: 'OPTIONS'
  })
    .then(response => {
      console.log(`✅ CORS preflight status: ${response.status}`)
      console.log(`   - Access-Control-Allow-Origin: ${response.headers.get('Access-Control-Allow-Origin')}`)
      console.log(`   - Access-Control-Allow-Credentials: ${response.headers.get('Access-Control-Allow-Credentials')}`)
    })
    .catch(error => {
      console.error('❌ CORS preflight failed:', error)
      console.log('💡 This suggests CORS configuration issues')
    })
  
  // Test 3: Token refresh (if user exists)
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser)
      if (user.token) {
        console.log('🔄 Testing token refresh...')
        
        fetch(`${expectedApiBase}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        })
          .then(response => {
            console.log(`🔄 Token refresh status: ${response.status}`)
            if (response.ok) {
              return response.json()
            } else {
              return response.text().then(text => {
                console.log(`❌ Token refresh error: ${text}`)
              })
            }
          })
          .then(data => {
            if (data) {
              console.log('✅ Token refresh success:', data)
            }
          })
          .catch(error => {
            console.error('❌ Token refresh failed:', error)
            console.log('💡 This could be causing the reload issue')
          })
      }
    } catch (error) {
      console.error('❌ Error testing token refresh:', error)
    }
  }
  
  // Monitor for reload behaviors
  console.log('🔍 Setting up reload monitoring...')
  
  let reloadCount = 0
  let initCount = 0
  
  // Override console.log to track initializations
  const originalLog = console.log
  console.log = function(...args) {
    const message = args.join(' ')
    
    if (message.includes('AppProvider initializing')) {
      initCount++
      console.warn(`🔄 INIT #${initCount}: AppProvider initializing`)
    }
    
    if (message.includes('page reload') || message.includes('refresh')) {
      reloadCount++
      console.warn(`🔄 RELOAD #${reloadCount}: ${message}`)
    }
    
    originalLog.apply(console, args)
  }
  
  // Check for infinite loops after 10 seconds
  setTimeout(() => {
    console.log('📊 Final Analysis:')
    console.log(`   - Initializations: ${initCount}`)
    console.log(`   - Page Reloads: ${reloadCount}`)
    
    if (initCount > 2) {
      console.error('❌ PROBLEM: Multiple initializations detected')
      console.log('💡 This suggests the reload issue is still present online')
    } else if (initCount === 1) {
      console.log('✅ SUCCESS: Single initialization detected')
    }
    
    if (reloadCount > 0) {
      console.warn('⚠️ WARNING: Page reloads detected')
    }
    
    // Provide specific solutions
    console.log('\n🔧 SOLUTIONS:')
    
    if (!hasViteApiUrl) {
      console.log('1. Set VITE_API_URL environment variable in your deployment:')
      console.log('   VITE_API_URL=https://safee-y8iw.onrender.com')
    }
    
    console.log('2. Verify CORS configuration on server includes your domain')
    console.log('3. Check that cookies are being sent with requests (credentials: "include")')
    console.log('4. Ensure server is responding correctly to health checks')
    
  }, 10000)
  
  console.log('🔍 Monitoring for 10 seconds...')
}

// Quick fix for online issues
function fixOnlineReloadIssue() {
  console.log('🔧 Applying online reload fixes...')
  
  // Fix 1: Clear potentially corrupted storage
  console.log('1. Clearing localStorage and sessionStorage...')
  localStorage.clear()
  sessionStorage.clear()
  
  // Fix 2: Force a specific redirect pattern
  console.log('2. Redirecting to login...')
  if (window.location.pathname !== '/login' && !window.location.pathname.includes('/login')) {
    // Handle base path (like /safee/)
    const basePath = window.location.pathname.split('/')[1]
    const loginPath = basePath && basePath !== 'login' ? `/${basePath}/login` : '/login'
    window.location.href = window.location.origin + loginPath
  } else {
    window.location.reload()
  }
}

// Test specific online scenarios
function testOnlineScenarios() {
  console.log('🧪 Testing specific online scenarios...')
  
  // Test 1: Environment variable access
  console.log('1. Testing environment variables...')
  try {
    if (typeof import !== 'undefined' && import.meta && import.meta.env) {
      console.log('✅ import.meta.env is available')
      console.log('   Environment:', import.meta.env.MODE)
      console.log('   Production:', import.meta.env.PROD)
      console.log('   Development:', import.meta.env.DEV)
    } else {
      console.log('❌ import.meta.env is not available')
    }
  } catch (error) {
    console.error('❌ Error accessing environment:', error)
  }
  
  // Test 2: Cross-origin requests
  console.log('2. Testing cross-origin requests...')
  const currentOrigin = window.location.origin
  const expectedBackend = 'https://safee-y8iw.onrender.com'
  
  if (currentOrigin === expectedBackend) {
    console.log('✅ Same origin - no CORS issues expected')
  } else {
    console.log(`⚠️ Cross-origin detected: ${currentOrigin} → ${expectedBackend}`)
    console.log('   CORS configuration is critical')
  }
  
  // Test 3: Cookie handling
  console.log('3. Testing cookie handling...')
  console.log('   Current cookies:', document.cookie)
  console.log('   Cookie count:', document.cookie.split(';').filter(c => c.trim()).length)
  
  // Test 4: Network conditions
  console.log('4. Testing network conditions...')
  if ('connection' in navigator) {
    const connection = (navigator as any).connection
    console.log('   Connection type:', connection?.effectiveType)
    console.log('   Downlink:', connection?.downlink)
  }
  
  // Test 5: Service workers
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      if (registrations.length > 0) {
        console.log(`⚠️ ${registrations.length} service worker(s) found`)
        console.log('   Service workers might interfere with requests')
      } else {
        console.log('✅ No service workers found')
      }
    })
  }
}

// Export functions to global scope
window.debugOnlineReloadIssue = debugOnlineReloadIssue
window.fixOnlineReloadIssue = fixOnlineReloadIssue
window.testOnlineScenarios = testOnlineScenarios

console.log('🛠️ Online Reload Debug Tools Loaded:')
console.log('  debugOnlineReloadIssue() - Comprehensive online debugging')
console.log('  fixOnlineReloadIssue() - Apply fixes for online issues')
console.log('  testOnlineScenarios() - Test specific online scenarios')

// Auto-detect if this is an online environment
if (!window.location.hostname.includes('localhost')) {
  console.log('🌐 Online environment detected!')
  console.log('💡 Run debugOnlineReloadIssue() to start debugging')
} else {
  console.log('🏠 Local environment detected')
  console.log('💡 These tools are designed for online debugging')
}
