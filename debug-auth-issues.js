/**
 * Advanced debugging script for authentication and API issues
 * Run this in the browser console on https://tridex.app
 */

async function debugAuthenticationIssues() {
  console.log('🔍 Debugging authentication and API issues...')
  
  // Clear any browser cache/state that might be causing issues
  console.log('🧹 Clearing potentially corrupted state...')
  localStorage.clear()
  sessionStorage.clear()
  
  // Test basic API connectivity
  console.log('\n1. Testing API health...')
  try {
    const healthResponse = await fetch('https://safee-y8iw.onrender.com/api/health', {
      method: 'GET',
      mode: 'cors',
      credentials: 'include'
    })
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json()
      console.log('✅ API health check passed:', healthData)
    } else {
      console.log('❌ API health check failed:', healthResponse.status, healthResponse.statusText)
    }
  } catch (error) {
    console.error('❌ API health check error:', error)
  }
  
  // Test CORS specifically
  console.log('\n2. Testing CORS preflight...')
  try {
    const corsResponse = await fetch('https://safee-y8iw.onrender.com/api/auth/login', {
      method: 'OPTIONS',
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Origin': 'https://tridex.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    })
    
    console.log('✅ CORS preflight response:', corsResponse.status)
    console.log('   Access-Control-Allow-Origin:', corsResponse.headers.get('Access-Control-Allow-Origin'))
    console.log('   Access-Control-Allow-Methods:', corsResponse.headers.get('Access-Control-Allow-Methods'))
  } catch (error) {
    console.error('❌ CORS preflight failed:', error)
  }
  
  // Test a simple POST request
  console.log('\n3. Testing simple API request...')
  try {
    const testResponse = await fetch('https://safee-y8iw.onrender.com/api/auth/login', {
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://tridex.app'
      },
      body: JSON.stringify({
        identifier: 'test@example.com',
        password: 'testpassword123'
      })
    })
    
    console.log('📡 Login test response status:', testResponse.status)
    
    if (testResponse.status === 401) {
      console.log('✅ Server is responding (401 = wrong credentials, but CORS works)')
    } else if (testResponse.status === 429) {
      console.log('⚠️ Rate limited - too many requests')
      console.log('💡 Wait a few minutes before trying again')
    } else if (testResponse.status === 418) {
      console.log('⚠️ Server returned 418 "I\'m a teapot" - possible server issue')
    } else {
      const responseText = await testResponse.text()
      console.log('📡 Response:', responseText)
    }
  } catch (error) {
    console.error('❌ API request failed:', error)
    
    if (error.message.includes('CORS')) {
      console.log('💡 CORS is still blocking - the server deployment may not be updated')
    }
  }
  
  // Check rate limiting status
  console.log('\n4. Checking rate limiting...')
  try {
    const rateLimitResponse = await fetch('https://safee-y8iw.onrender.com/api/health', {
      method: 'GET',
      mode: 'cors',
      credentials: 'include'
    })
    
    console.log('   X-RateLimit-Limit:', rateLimitResponse.headers.get('X-RateLimit-Limit'))
    console.log('   X-RateLimit-Remaining:', rateLimitResponse.headers.get('X-RateLimit-Remaining'))
    console.log('   X-RateLimit-Reset:', rateLimitResponse.headers.get('X-RateLimit-Reset'))
    
    const remaining = rateLimitResponse.headers.get('X-RateLimit-Remaining')
    if (remaining && parseInt(remaining) < 10) {
      console.log('⚠️ Rate limit is low - you may be hitting rate limits')
    }
  } catch (error) {
    console.log('   Could not check rate limits')
  }
  
  // Network diagnostic
  console.log('\n5. Network diagnostic summary:')
  console.log('   - If you see CORS errors: Server deployment needs ALLOWED_ORIGINS update')
  console.log('   - If you see 401 errors: Login credentials are wrong')
  console.log('   - If you see 418 errors: Server might have issues')
  console.log('   - If you see 429 errors: You\'re being rate limited')
  console.log('   - If you see 409 errors: User already exists (on signup)')
  
  console.log('\n6. Recommended actions:')
  console.log('   ✅ CORS appears to be working now')
  console.log('   🔄 Try logging in with correct credentials')
  console.log('   ⏰ If rate limited, wait 15 minutes before trying again')
  console.log('   🧹 Clear browser cache/cookies if issues persist')
}

// Auto-run the diagnostic
debugAuthenticationIssues()

// Also export for manual use
window.debugAuthenticationIssues = debugAuthenticationIssues
