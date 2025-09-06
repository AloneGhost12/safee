#!/usr/bin/env node

/**
 * Ultra-minimal test for CI environments
 * Just checks that Node.js and basic environment are working
 */

console.log('🧪 Ultra-Simple CI Test');
console.log('=======================');

// Test 1: Basic Node.js functionality
console.log('✅ Node.js version:', process.version);
console.log('✅ Platform:', process.platform);
console.log('✅ Working directory:', process.cwd());

// Test 2: Basic file system
const fs = require('fs');
const packageExists = fs.existsSync('./package.json');
console.log('✅ Package.json exists:', packageExists);

if (!packageExists) {
  console.log('❌ Critical file missing - package.json not found');
  process.exit(1);
}

console.log('🎉 Ultra-simple test PASSED!');
process.exit(0);
