#!/usr/bin/env node

// Quick startup test for the server
console.log('🔧 Testing server startup with Cloudinary integration...')

// Test environment variables
const requiredEnvVars = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY', 
  'CLOUDINARY_API_SECRET'
]

console.log('\n📋 Environment Check:')
requiredEnvVars.forEach(envVar => {
  const value = process.env[envVar]
  if (value) {
    console.log(`✅ ${envVar}: ${value.substring(0, 10)}...`)
  } else {
    console.log(`❌ ${envVar}: Not set`)
  }
})

// Test Cloudinary configuration
try {
  const { validateCloudinaryConfig } = require('./dist/utils/cloudinary')
  
  console.log('\n🔍 Cloudinary Configuration Test:')
  if (validateCloudinaryConfig()) {
    console.log('✅ Cloudinary configuration is valid')
  } else {
    console.log('❌ Cloudinary configuration is incomplete')
  }
} catch (error) {
  console.log('⚠️  Could not test Cloudinary configuration:', error.message)
}

console.log('\n🎉 Server startup test completed!')
console.log('\n📝 Next steps:')
console.log('1. Set up your .env file with the provided Cloudinary credentials')
console.log('2. Start the server with: npm start')
console.log('3. Start the client with: npm run dev (in client directory)')
console.log('4. Test file uploads with both S3 and Cloudinary storage options')
