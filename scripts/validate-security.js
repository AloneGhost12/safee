#!/usr/bin/env node

/**
 * Security Configuration Validator
 * Validates security settings and environment configuration
 */

const fs = require('fs')
const path = require('path')

const REQUIRED_ENV_VARS = [
  'ACCESS_TOKEN_SECRET',
  'REFRESH_TOKEN_SECRET',
  'DATABASE_URL',
  'ALLOWED_ORIGINS'
]

const RECOMMENDED_ENV_VARS = [
  'TRUST_PROXY',
  'SESSION_COOKIE_NAME',
  'COOKIE_DOMAIN',
  'S3_BUCKET_NAME',
  'CLOUDINARY_CLOUD_NAME'
]

const SECURITY_CHECKS = {
  // Environment variable security
  checkEnvironment: () => {
    const results = []
    
    // Check required variables
    for (const envVar of REQUIRED_ENV_VARS) {
      if (!process.env[envVar]) {
        results.push({
          level: 'error',
          message: `Missing required environment variable: ${envVar}`,
          fix: `Set ${envVar} in your .env file`
        })
      }
    }
    
    // Check JWT secret strength
    const accessSecret = process.env.ACCESS_TOKEN_SECRET
    if (accessSecret && accessSecret.length < 32) {
      results.push({
        level: 'warning',
        message: 'ACCESS_TOKEN_SECRET should be at least 32 characters',
        fix: 'Generate a stronger secret using crypto.randomBytes(32).toString("hex")'
      })
    }
    
    // Check CORS origins
    const allowedOrigins = process.env.ALLOWED_ORIGINS
    if (allowedOrigins && allowedOrigins.includes('localhost') && process.env.NODE_ENV === 'production') {
      results.push({
        level: 'error',
        message: 'localhost origins detected in production CORS settings',
        fix: 'Remove localhost origins from ALLOWED_ORIGINS in production'
      })
    }
    
    // Check database URL security
    const dbUrl = process.env.DATABASE_URL
    if (dbUrl && !dbUrl.includes('ssl=true') && process.env.NODE_ENV === 'production') {
      results.push({
        level: 'warning',
        message: 'Database URL does not specify SSL connection',
        fix: 'Add ssl=true parameter to DATABASE_URL'
      })
    }
    
    return results
  },
  
  // File permissions and security
  checkFilePermissions: () => {
    const results = []
    const sensitiveFiles = ['.env', '.env.local', '.env.production']
    
    for (const file of sensitiveFiles) {
      const filePath = path.join(process.cwd(), file)
      if (fs.existsSync(filePath)) {
        try {
          const stats = fs.statSync(filePath)
          const mode = stats.mode & parseInt('777', 8)
          
          if (mode & parseInt('044', 8)) {  // Check if readable by group/others
            results.push({
              level: 'warning',
              message: `${file} is readable by group/others`,
              fix: `chmod 600 ${file}`
            })
          }
        } catch (error) {
          results.push({
            level: 'error',
            message: `Cannot check permissions for ${file}: ${error.message}`,
            fix: `Ensure ${file} exists and is accessible`
          })
        }
      }
    }
    
    return results
  },
  
  // Package security
  checkDependencies: () => {
    const results = []
    const packageJsonPath = path.join(process.cwd(), 'package.json')
    
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
        
        // Check for common vulnerable packages
        const vulnerablePackages = ['lodash', 'moment', 'request']
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
        
        for (const pkg of vulnerablePackages) {
          if (dependencies[pkg]) {
            results.push({
              level: 'info',
              message: `Consider updating or replacing ${pkg} (known security concerns)`,
              fix: `Check for alternatives or ensure latest version: npm update ${pkg}`
            })
          }
        }
        
        // Check for development dependencies in production
        if (process.env.NODE_ENV === 'production' && packageJson.devDependencies) {
          results.push({
            level: 'info',
            message: 'Development dependencies detected',
            fix: 'Use npm ci --only=production for production builds'
          })
        }
        
      } catch (error) {
        results.push({
          level: 'error',
          message: `Cannot parse package.json: ${error.message}`,
          fix: 'Ensure package.json is valid JSON'
        })
      }
    }
    
    return results
  },
  
  // Security headers validation
  checkSecurityConfig: () => {
    const results = []
    
    // Check if security middleware is properly configured
    const securityMiddlewarePath = path.join(process.cwd(), 'src', 'middleware', 'security.ts')
    if (!fs.existsSync(securityMiddlewarePath)) {
      results.push({
        level: 'error',
        message: 'Security middleware not found',
        fix: 'Ensure security middleware is properly implemented'
      })
    }
    
    // Check CSP configuration
    if (process.env.NODE_ENV === 'production') {
      results.push({
        level: 'info',
        message: 'Verify CSP is working correctly in production',
        fix: 'Test CSP headers using browser dev tools or online CSP validators'
      })
    }
    
    return results
  }
}

function runSecurityValidation() {
  console.log('🛡️  Personal Vault Security Validation\n')
  
  let totalIssues = 0
  let errorCount = 0
  let warningCount = 0
  
  for (const [checkName, checkFunction] of Object.entries(SECURITY_CHECKS)) {
    console.log(`\n📋 Running ${checkName}...`)
    
    try {
      const results = checkFunction()
      
      if (results.length === 0) {
        console.log('✅ No issues found')
      } else {
        for (const result of results) {
          totalIssues++
          
          const icon = result.level === 'error' ? '❌' : 
                      result.level === 'warning' ? '⚠️' : 'ℹ️'
          
          console.log(`${icon} ${result.level.toUpperCase()}: ${result.message}`)
          console.log(`   Fix: ${result.fix}`)
          
          if (result.level === 'error') errorCount++
          if (result.level === 'warning') warningCount++
        }
      }
    } catch (error) {
      console.log(`❌ Check failed: ${error.message}`)
      errorCount++
      totalIssues++
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 SECURITY VALIDATION SUMMARY')
  console.log('='.repeat(60))
  
  if (totalIssues === 0) {
    console.log('🎉 All security checks passed!')
  } else {
    console.log(`Total issues found: ${totalIssues}`)
    console.log(`  - Errors: ${errorCount}`)
    console.log(`  - Warnings: ${warningCount}`)
    console.log(`  - Info: ${totalIssues - errorCount - warningCount}`)
  }
  
  if (errorCount > 0) {
    console.log('\n❗ CRITICAL: Fix all errors before deploying to production!')
    process.exit(1)
  } else if (warningCount > 0) {
    console.log('\n⚠️  Consider addressing warnings for improved security')
  }
  
  console.log('\n🔒 For detailed security guidelines, see SECURITY.md')
  console.log('📝 For environment setup, see .env.production.template')
}

if (require.main === module) {
  runSecurityValidation()
}

module.exports = { SECURITY_CHECKS, runSecurityValidation }
