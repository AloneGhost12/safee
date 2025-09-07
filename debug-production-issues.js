/**
 * Production Debug Script for Personal Vault
 * 
 * Run this in browser console on https://tridex.app/safee/ to diagnose issues:
 * 1. Open https://tridex.app/safee/
 * 2. Open browser console (F12)
 * 3. Run: debugProductionIssues()
 */

function debugProductionIssues() {
  console.log('🔍 Starting production debugging...')
  
  // Check current URL and base path
  console.log('📍 Current URL:', window.location.href)
  console.log('📍 Expected URL pattern: https://tridex.app/safee/*')
  console.log('📍 Base path issue?', !window.location.pathname.startsWith('/safee'))
  
  // Check user authentication state
  const savedUser = localStorage.getItem('user')
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser)
      console.log('👤 User in localStorage:', {
        id: user.id,
        email: user.email,
        hasToken: !!user.token,
        tokenLength: user.token ? user.token.length : 0
      })
      
      // Test if token is valid format (JWT should have 3 parts separated by dots)
      if (user.token) {
        const tokenParts = user.token.split('.')
        console.log('🔑 Token analysis:', {
          parts: tokenParts.length,
          isJWT: tokenParts.length === 3,
          firstPart: tokenParts[0]?.substring(0, 20) + '...'
        })
      }
    } catch (error) {
      console.error('❌ Failed to parse user from localStorage:', error)
    }
  } else {
    console.log('🚫 No user found in localStorage')
  }
  
  // Test API connectivity
  console.log('🌐 Testing API connectivity...')
  
  // Test health endpoint first
  fetch('https://safee-y8iw.onrender.com/api/health')
    .then(response => {
      console.log('✅ Health check response:', response.status)
      return response.json()
    })
    .then(data => {
      console.log('✅ Health check data:', data)
    })
    .catch(error => {
      console.error('❌ Health check failed:', error)
    })
  
  // Test notes endpoint with current token
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser)
      if (user.token) {
        console.log('🔍 Testing /api/notes with current token...')
        
        fetch('https://safee-y8iw.onrender.com/api/notes', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        })
        .then(response => {
          console.log(`📝 Notes API response: ${response.status} ${response.statusText}`)
          if (!response.ok) {
            return response.text().then(text => {
              console.log('📝 Notes API error body:', text)
            })
          }
          return response.json()
        })
        .then(data => {
          if (data) {
            console.log('📝 Notes API success:', data)
          }
        })
        .catch(error => {
          console.error('❌ Notes API failed:', error)
        })
      }
    } catch (error) {
      console.error('❌ Error testing notes API:', error)
    }
  }
  
  // Test token refresh endpoint
  console.log('🔄 Testing token refresh...')
  fetch('https://safee-y8iw.onrender.com/api/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include'
  })
  .then(response => {
    console.log(`🔄 Refresh response: ${response.status} ${response.statusText}`)
    if (!response.ok) {
      return response.text().then(text => {
        console.log('🔄 Refresh error body:', text)
      })
    }
    return response.json()
  })
  .then(data => {
    if (data) {
      console.log('🔄 Refresh success:', data)
    }
  })
  .catch(error => {
    console.error('❌ Refresh failed:', error)
  })
  
  // Check for CORS issues
  console.log('🔒 Checking CORS configuration...')
  
  // Check navigation and routing
  console.log('🧭 Navigation state:')
  console.log('  - Current pathname:', window.location.pathname)
  console.log('  - Current search:', window.location.search)
  console.log('  - Current hash:', window.location.hash)
  console.log('  - Document title:', document.title)
  
  // Check for React app state
  setTimeout(() => {
    console.log('⚛️ React app state check:')
    const reactRoot = document.getElementById('root')
    if (reactRoot) {
      console.log('  - React root found')
      console.log('  - Has content:', reactRoot.innerHTML.length > 100)
    } else {
      console.error('  - React root not found!')
    }
    
    // Check for error messages
    const errorElements = document.querySelectorAll('[class*="error"], [class*="alert"]')
    if (errorElements.length > 0) {
      console.warn('⚠️ Error elements found:', Array.from(errorElements).map(el => el.textContent))
    }
    
  }, 2000)
  
  // Summary
  setTimeout(() => {
    console.log('📊 Debug Summary:')
    console.log('  1. Check console messages above for specific issues')
    console.log('  2. Verify URL starts with /safee/')
    console.log('  3. Check if 500 errors are auth-related')
    console.log('  4. Clear localStorage if needed: localStorage.clear()')
    console.log('  5. Try fresh login if auth is broken')
    
    console.log('💡 Quick fixes:')
    console.log('  - Clear auth: localStorage.removeItem("user")')
    console.log('  - Force refresh: window.location.reload()')
    console.log('  - Go to login: window.location.href = "/safee/login"')
  }, 3000)
}

// Auto-run on tridex.app
if (window.location.hostname.includes('tridex.app')) {
  console.log('🌐 Detected tridex.app, debugging tools ready')
  console.log('💡 Run debugProductionIssues() to start debugging')
  
  // Check if URL is correct
  if (!window.location.pathname.startsWith('/safee')) {
    console.warn('⚠️ URL may be incorrect. Expected path to start with /safee/')
    console.log('💡 Try navigating to: https://tridex.app/safee/')
  }
} else {
  console.log('🏠 Not on tridex.app, debugging tools available for any environment')
  console.log('💡 Run debugProductionIssues() to start debugging')
}
