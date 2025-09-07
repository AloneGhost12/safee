/**
 * Test script to verify logout loading issue is fixed
 * 
 * Run this in browser console after logging in:
 * 1. Open http://localhost:5181/
 * 2. Login with valid credentials  
 * 3. Navigate to vault
 * 4. Open browser console and run: testLogout()
 * 5. Check if logout works without infinite loading
 */

function testLogout() {
  console.log('🧪 Testing logout functionality...')
  
  // Monitor loading states
  let loadingStates = []
  let redirections = []
  
  // Monitor for page changes
  const originalPushState = history.pushState
  const originalReplaceState = history.replaceState
  
  history.pushState = function(...args) {
    redirections.push({
      type: 'pushState',
      url: args[2],
      timestamp: new Date().toISOString()
    })
    console.log('📍 Navigation (pushState):', args[2])
    return originalPushState.apply(history, args)
  }
  
  history.replaceState = function(...args) {
    redirections.push({
      type: 'replaceState', 
      url: args[2],
      timestamp: new Date().toISOString()
    })
    console.log('📍 Navigation (replaceState):', args[2])
    return originalReplaceState.apply(history, args)
  }
  
  // Monitor DOM for loading indicators
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          const loadingElements = node.querySelectorAll ? 
            node.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="animate-spin"]') :
            []
          
          if (loadingElements.length > 0 || 
              (node.className && (node.className.includes('loading') || 
                                  node.className.includes('spinner') || 
                                  node.className.includes('animate-spin')))) {
            loadingStates.push({
              type: 'loading_shown',
              element: node.className || node.tagName,
              timestamp: new Date().toISOString()
            })
            console.log('⏳ Loading indicator shown:', node.className || node.tagName)
          }
        }
      })
    })
  })
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
  
  // Find and click logout button
  console.log('🔍 Looking for logout button...')
  
  // Try different selectors for logout button
  const logoutSelectors = [
    '[data-testid="logout-button"]',
    'button:contains("Sign Out")',
    'button:contains("Logout")',
    'button:contains("Log Out")',
    '[class*="logout"]',
    'button[onclick*="logout"]'
  ]
  
  let logoutButton = null
  
  // Check sidebar logout button specifically
  const sidebar = document.querySelector('[class*="sidebar"]') || 
                  document.querySelector('nav') ||
                  document.querySelector('aside')
  
  if (sidebar) {
    console.log('📋 Found sidebar, looking for logout button...')
    logoutButton = sidebar.querySelector('button') // Get first button in sidebar (might be logout)
    
    // Look for buttons with logout-like text
    const buttons = sidebar.querySelectorAll('button')
    for (const button of buttons) {
      if (button.textContent && 
          (button.textContent.toLowerCase().includes('sign out') ||
           button.textContent.toLowerCase().includes('logout') ||
           button.textContent.toLowerCase().includes('log out'))) {
        logoutButton = button
        break
      }
    }
  }
  
  if (!logoutButton) {
    // Fallback: look for any logout button on page
    const allButtons = document.querySelectorAll('button')
    for (const button of allButtons) {
      if (button.textContent && 
          (button.textContent.toLowerCase().includes('sign out') ||
           button.textContent.toLowerCase().includes('logout') ||
           button.textContent.toLowerCase().includes('log out'))) {
        logoutButton = button
        break
      }
    }
  }
  
  if (logoutButton) {
    console.log('✅ Found logout button:', logoutButton.textContent)
    
    // Set up a timeout to check for issues
    const timeoutId = setTimeout(() => {
      console.log('⚠️ Logout process taking longer than expected...')
      console.log('📊 Loading states detected:', loadingStates)
      console.log('🔄 Redirections detected:', redirections)
      
      if (loadingStates.length > 3) {
        console.error('❌ POTENTIAL INFINITE LOADING DETECTED!')
        console.log('💡 Too many loading states detected during logout')
      }
      
      if (redirections.length > 2) {
        console.error('❌ POTENTIAL REDIRECT LOOP DETECTED!')
        console.log('💡 Too many redirections during logout')
      }
    }, 5000)
    
    // Click the logout button
    console.log('🖱️ Clicking logout button...')
    logoutButton.click()
    
    // Check if logout was successful after a delay
    setTimeout(() => {
      clearTimeout(timeoutId)
      observer.disconnect()
      
      console.log('📊 Final Test Results:')
      console.log('   - Loading states:', loadingStates.length)
      console.log('   - Redirections:', redirections.length)
      console.log('   - Current URL:', window.location.href)
      console.log('   - Is on login page:', window.location.pathname.includes('/login'))
      
      if (window.location.pathname.includes('/login')) {
        console.log('✅ LOGOUT SUCCESS: Redirected to login page')
        
        if (loadingStates.length <= 2 && redirections.length <= 1) {
          console.log('🎉 LOADING ISSUE FIXED: Normal loading behavior detected')
        } else {
          console.warn('⚠️ Potential loading issues still present')
        }
      } else {
        console.error('❌ LOGOUT FAILED: Not redirected to login page')
      }
      
      // Restore original functions
      history.pushState = originalPushState
      history.replaceState = originalReplaceState
      
    }, 3000)
    
  } else {
    console.error('❌ Could not find logout button')
    console.log('💡 Make sure you are logged in and on the vault page')
    
    // Restore original functions
    history.pushState = originalPushState
    history.replaceState = originalReplaceState
    observer.disconnect()
  }
}

// Auto-run if on vault page
if (window.location.pathname.includes('/vault')) {
  console.log('🏠 Detected vault page, ready to test logout')
  console.log('💡 Run testLogout() to test the logout functionality')
} else {
  console.log('📍 Not on vault page. Navigate to /vault first, then run testLogout()')
}
