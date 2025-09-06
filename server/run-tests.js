const { spawn } = require('child_process');

function runTest(iteration) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== Running auth test iteration ${iteration} ===`);
    
    const child = spawn('npx', ['vitest', 'run', 'test/auth.test.ts', '--no-watch'], {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, CI: 'true' }
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`Test iteration ${iteration} passed`);
        resolve();
      } else {
        console.log(`Test iteration ${iteration} failed with code ${code}`);
        resolve(); // Continue with other tests even if one fails
      }
    });
    
    child.on('error', (error) => {
      console.error(`Test iteration ${iteration} error:`, error);
      reject(error);
    });
  });
}

async function runMultipleTests() {
  console.log('Starting 5 test runs of auth.test.ts...');
  
  try {
    for (let i = 1; i <= 5; i++) {
      await runTest(i);
      if (i < 5) {
        console.log('Waiting 2 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    console.log('\n=== All 5 test iterations completed ===');
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
}

runMultipleTests();
