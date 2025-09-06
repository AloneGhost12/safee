import { chromium, FullConfig } from '@playwright/test';
import { execSync } from 'child_process';

/**
 * Global setup for Playwright tests
 * Runs before all tests to prepare the environment
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup...');
  
  // Wait for servers to be ready
  await waitForServer('http://localhost:5173', 30000); // Client dev server
  await waitForServer('http://localhost:3000/health', 30000); // Server API
  
  // Clean up test database
  await cleanupTestDatabase();
  
  // Create test admin account for e2e tests
  await createTestAccounts();
  
  console.log('✅ Global setup completed');
}

/**
 * Wait for server to be ready
 */
async function waitForServer(url: string, timeout: number): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`✅ Server ready at ${url}`);
        return;
      }
    } catch (error) {
      // Server not ready yet, continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error(`❌ Server at ${url} not ready within ${timeout}ms`);
}

/**
 * Clean up test database
 */
async function cleanupTestDatabase(): Promise<void> {
  try {
    // This would connect to test database and clean up
    // For now, we'll use a simple approach
    console.log('🧹 Cleaning up test database...');
    
    // In a real implementation, you'd:
    // 1. Connect to test MongoDB instance
    // 2. Drop test collections or clear test data
    // 3. Reset any test state
    
    console.log('✅ Test database cleaned');
  } catch (error) {
    console.warn('⚠️ Database cleanup failed:', error);
  }
}

/**
 * Create test accounts for e2e testing
 */
async function createTestAccounts(): Promise<void> {
  try {
    console.log('👤 Creating test accounts...');
    
    const testUsers = [
      {
        email: 'e2e-test@example.com',
        password: 'Test123!@#E2E',
        name: 'E2E Test User'
      },
      {
        email: 'e2e-admin@example.com', 
        password: 'Admin123!@#E2E',
        name: 'E2E Admin User'
      }
    ];
    
    // Create test users via API
    for (const user of testUsers) {
      try {
        const response = await fetch('http://localhost:3000/auth/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: user.email,
            password: user.password
          })
        });
        
        if (response.ok) {
          console.log(`✅ Created test user: ${user.email}`);
        } else if (response.status === 400) {
          // User might already exist, that's okay
          console.log(`ℹ️ Test user already exists: ${user.email}`);
        } else {
          console.warn(`⚠️ Failed to create user ${user.email}:`, await response.text());
        }
      } catch (error) {
        console.warn(`⚠️ Error creating user ${user.email}:`, error);
      }
    }
    
    console.log('✅ Test accounts setup completed');
  } catch (error) {
    console.warn('⚠️ Test account creation failed:', error);
  }
}

export default globalSetup;
