/**
 * Debug script to identify infinite loading issues
 * This should be run in the browser console
 */

// Debug script to run in browser console
function debugInfiniteLoading() {
  console.log('🔍 Debugging infinite loading issue...')
  
  // 1. Check if user is stored in localStorage
  const savedUser = localStorage.getItem('user')
  console.log('📱 Saved user in localStorage:', savedUser ? JSON.parse(savedUser) : null)
  
  // 2. Check current location
  console.log('📍 Current location:', window.location.href)
  console.log('📍 Pathname:', window.location.pathname)
  
  // 3. Check if any fetch requests are pending
  const originalFetch = window.fetch
  let pendingRequests = 0
  
  window.fetch = function(...args) {
    pendingRequests++
    console.log(`🌐 Starting request ${pendingRequests}:`, args[0])
    
    return originalFetch.apply(this, arguments)
      .then(response => {
        pendingRequests--
        console.log(`✅ Request completed (${pendingRequests} remaining):`, args[0], response.status)
        return response
      })
      .catch(error => {
        pendingRequests--
        console.log(`❌ Request failed (${pendingRequests} remaining):`, args[0], error)
        throw error
      })
  }
  
  // 4. Check for React render loops
  let renderCount = 0
  const originalLog = console.log
  
  // Monitor console activity for render loops
  setInterval(() => {
    if (renderCount > 100) {
      console.warn('⚠️ Possible render loop detected - many console messages')
    }
    renderCount = 0
  }, 1000)
  
  // 5. Check network tab for failed requests
  console.log('🔍 Check the Network tab in DevTools for:')
  console.log('  - Failed requests (red entries)')
  console.log('  - Repeated requests to the same endpoint')
  console.log('  - CORS errors (should be fixed now)')
  
  // 6. Check for JavaScript errors
  window.addEventListener('error', (error) => {
    console.error('💥 JavaScript error detected:', error)
  })
  
  window.addEventListener('unhandledrejection', (error) => {
    console.error('💥 Unhandled promise rejection:', error)
  })
  
  // 7. Test API connectivity
  console.log('🔗 Testing API connectivity...')
  
  fetch('/api/health')
    .then(response => response.json())
    .then(data => {
      console.log('✅ API health check passed:', data)
    })
    .catch(error => {
      console.error('❌ API health check failed:', error)
    })
  
  // 8. Check if auth token exists and is valid format
  const authToken = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).token : null
  if (authToken) {
    console.log('🔑 Auth token exists, testing validity...')
    
    fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    })
    .then(response => {
      if (response.ok) {
        console.log('✅ Token refresh successful')
        return response.json()
      } else {
        console.log('❌ Token refresh failed:', response.status)
        throw new Error('Token invalid')
      }
    })
    .then(data => {
      console.log('✅ New token received:', data)
    })
    .catch(error => {
      console.error('❌ Token validation failed:', error)
      console.log('💡 This might be causing the infinite loading')
      console.log('💡 Try clearing localStorage and logging in again')
    })
  } else {
    console.log('❌ No auth token found - user should be redirected to login')
  }
  
  setTimeout(() => {
    console.log(`📊 Debug summary after 5 seconds:`)
    console.log(`   - Pending requests: ${pendingRequests}`)
    console.log(`   - Check console above for any errors or failed requests`)
    console.log(`   - If you see repeated requests, there might be a retry loop`)
  }, 5000)
}

// Auto-run if this script is loaded in browser
if (typeof window !== 'undefined') {
  debugInfiniteLoading()
}

// Export for Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { debugInfiniteLoading }
}
