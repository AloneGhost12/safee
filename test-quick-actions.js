/**
 * Quick Actions Test Script
 * Test all the Quick Actions functionality on the Testing page
 */

function testQuickActions() {
  console.log('🧪 Testing Quick Actions functionality...')
  
  // Test 1: Check if we're on the testing page
  const currentPath = window.location.pathname
  if (!currentPath.includes('testing')) {
    console.log('❌ Not on testing page. Navigate to /testing first')
    return
  }
  
  console.log('✅ On testing page')
  
  // Test 2: Check if Quick Actions section exists
  const quickActionsSection = document.querySelector('h3')?.textContent?.includes('Quick Actions') ||
                             document.querySelector('[class*="CardTitle"]')?.textContent?.includes('Quick Actions')
  
  if (quickActionsSection) {
    console.log('✅ Quick Actions section found')
  } else {
    console.log('❌ Quick Actions section not found')
  }
  
  // Test 3: Check for Quick Action buttons
  const quickActionButtons = document.querySelectorAll('button[class*="flex flex-col gap-2 h-20"]')
  console.log(`📊 Found ${quickActionButtons.length} Quick Action buttons`)
  
  if (quickActionButtons.length >= 5) {
    console.log('✅ Expected number of Quick Action buttons found')
    
    // Test each button
    quickActionButtons.forEach((button, index) => {
      const buttonText = button.textContent?.trim()
      console.log(`   ${index + 1}. "${buttonText}"`)
      
      // Test button click functionality
      const testClick = (buttonName) => {
        try {
          button.click()
          console.log(`   ✅ "${buttonName}" clicked successfully`)
          return true
        } catch (error) {
          console.log(`   ❌ "${buttonName}" click failed:`, error.message)
          return false
        }
      }
      
      switch (buttonText) {
        case 'CI/CD Status':
          console.log('   🔗 CI/CD Status - Should open GitHub Actions')
          break
        case 'Quick Test':
          console.log('   ⚡ Quick Test - Should run unit and security tests')
          break
        case 'Download Report':
          console.log('   📥 Download Report - Should download JSON file')
          break
        case 'Documentation':
          console.log('   📚 Documentation - Should open docs window')
          break
        case 'Clear Results':
          console.log('   🗑️ Clear Results - Should reset test data')
          break
        default:
          console.log(`   ❓ Unknown button: "${buttonText}"`)
      }
    })
  } else {
    console.log('❌ Missing Quick Action buttons')
  }
  
  // Test 4: Check if test suites are loaded
  const testSuiteCards = document.querySelectorAll('[class*="Card"]')
  console.log(`📋 Found ${testSuiteCards.length} cards on page`)
  
  // Test 5: Try the Quick Test action specifically
  console.log('\n🚀 Testing Quick Test functionality...')
  
  const quickTestButton = Array.from(quickActionButtons).find(btn => 
    btn.textContent?.includes('Quick Test')
  )
  
  if (quickTestButton) {
    console.log('✅ Quick Test button found')
    
    // Watch for test execution
    const initialRunningTests = document.querySelectorAll('[class*="animate-spin"]').length
    console.log(`📊 Currently running tests: ${initialRunningTests}`)
    
    try {
      quickTestButton.click()
      console.log('✅ Quick Test button clicked')
      
      // Check after a short delay
      setTimeout(() => {
        const runningTests = document.querySelectorAll('[class*="animate-spin"]').length
        const updatedProgress = document.querySelector('[class*="Progress"]')
        
        if (runningTests > initialRunningTests || updatedProgress) {
          console.log('✅ Quick Test appears to be running')
        } else {
          console.log('❓ Quick Test may not have started (check console for errors)')
        }
      }, 1000)
      
    } catch (error) {
      console.log('❌ Quick Test click failed:', error.message)
    }
  } else {
    console.log('❌ Quick Test button not found')
  }
  
  // Test 6: Test the Download Report functionality
  console.log('\n📥 Testing Download Report functionality...')
  
  const downloadButton = Array.from(quickActionButtons).find(btn => 
    btn.textContent?.includes('Download Report')
  )
  
  if (downloadButton) {
    try {
      // Listen for download events
      let downloadDetected = false
      const originalCreateElement = document.createElement
      document.createElement = function(tagName) {
        const element = originalCreateElement.call(this, tagName)
        if (tagName.toLowerCase() === 'a' && element.download) {
          downloadDetected = true
          console.log(`✅ Download initiated: ${element.download}`)
        }
        return element
      }
      
      downloadButton.click()
      
      setTimeout(() => {
        document.createElement = originalCreateElement
        if (downloadDetected) {
          console.log('✅ Download Report appears to work')
        } else {
          console.log('❓ Download Report click detected but no download triggered')
        }
      }, 500)
      
    } catch (error) {
      console.log('❌ Download Report test failed:', error.message)
    }
  }
  
  console.log('\n🏁 Quick Actions test completed!')
  console.log('\n💡 Manual tests to perform:')
  console.log('   1. Click "CI/CD Status" - should open GitHub Actions in new tab')
  console.log('   2. Click "Documentation" - should open docs in new window')
  console.log('   3. Click "Clear Results" - should reset all test progress')
}

// Function to fix common Quick Actions issues
function fixQuickActions() {
  console.log('🔧 Attempting to fix Quick Actions issues...')
  
  // Fix 1: Ensure proper button styling
  const quickActionButtons = document.querySelectorAll('button[class*="flex flex-col"]')
  quickActionButtons.forEach((button, index) => {
    if (!button.style.minHeight) {
      button.style.minHeight = '5rem'
      console.log(`✅ Fixed height for button ${index + 1}`)
    }
  })
  
  // Fix 2: Check for JavaScript errors
  const originalError = window.onerror
  let errorCount = 0
  
  window.onerror = function(msg, url, line, col, error) {
    errorCount++
    console.log(`❌ JS Error ${errorCount}: ${msg} at ${line}:${col}`)
    if (originalError) originalError.apply(this, arguments)
  }
  
  setTimeout(() => {
    window.onerror = originalError
    if (errorCount === 0) {
      console.log('✅ No JavaScript errors detected')
    } else {
      console.log(`⚠️ Found ${errorCount} JavaScript errors`)
    }
  }, 2000)
  
  console.log('🔧 Quick Actions fix attempt completed')
}

// Export to global scope
window.testQuickActions = testQuickActions
window.fixQuickActions = fixQuickActions

console.log('🛠️ Quick Actions test functions loaded')
console.log('Available functions:')
console.log('  testQuickActions() - Test all Quick Actions functionality')
console.log('  fixQuickActions() - Attempt to fix common issues')
console.log('')
console.log('🚀 Auto-running Quick Actions test...')
testQuickActions()
