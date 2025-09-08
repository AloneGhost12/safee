import { Request, Response, NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import crypto from 'crypto'
import { AuditLogger } from '../services/auditLogger'

// Generate random admin access tokens that change on server restart
export const ADMIN_SECRETS = {
  accessToken: crypto.randomBytes(32).toString('hex'),
  secretPath: process.env.ADMIN_SECRET_PATH || crypto.randomBytes(16).toString('hex'),
  pathSalt: crypto.randomBytes(8).toString('hex')
}

// Log admin access info securely (only in development)
if (process.env.NODE_ENV === 'development') {
  console.log('🔒 [DEV ONLY] Admin Access Info:')
  console.log(`   Secret Path: /${ADMIN_SECRETS.secretPath}`)
  console.log(`   Access Token: ${ADMIN_SECRETS.accessToken}`)
  console.log('   Header: X-Admin-Token')
} else {
  console.log('🔒 Admin panel initialized with hidden access')
}

// Ultra-strict rate limiting for admin routes
export const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Only 3 attempts per 15 minutes per IP
  message: { error: 'Resource not found' }, // Hide that it's rate limited
  standardHeaders: false, // Hide rate limit headers
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: (req) => {
    // Use IP + User-Agent for more strict limiting
    return `${req.ip}_${crypto.createHash('md5').update(req.get('User-Agent') || '').digest('hex')}`
  },
  handler: (req, res) => {
    // Log suspicious activity
    const auditLogger = AuditLogger.getInstance()
    auditLogger.logSecurityEvent({
      action: 'admin_rate_limit_exceeded',
      resource: 'admin_panel',
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      riskLevel: 'critical',
      details: { 
        path: req.path, 
        method: req.method,
        timestamp: new Date().toISOString()
      }
    })
    
    // Return 404 instead of 429 to hide admin existence
    res.status(404).json({ error: 'Not found' })
  }
})

// Honeypot for common admin paths
export const adminHoneypot = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPaths = [
    '/admin', '/administrator', '/wp-admin', '/admin.php',
    '/admin/', '/panel', '/dashboard', '/control', '/manage',
    '/admin/login', '/admin/panel', '/adminpanel'
  ]
  
  if (suspiciousPaths.some(path => req.path.toLowerCase().includes(path))) {
    // Log potential attack
    const auditLogger = AuditLogger.getInstance()
    auditLogger.logSecurityEvent({
      action: 'admin_honeypot_triggered',
      resource: 'admin_panel',
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      riskLevel: 'high',
      details: { 
        attemptedPath: req.path,
        method: req.method,
        query: req.query,
        timestamp: new Date().toISOString()
      }
    })
    
    // Fake response to waste attacker's time
    setTimeout(() => {
      res.status(404).json({ error: 'Not found' })
    }, Math.random() * 3000 + 1000) // Random delay 1-4 seconds
    return
  }
  
  next()
}

// Admin access token validation
export const validateAdminAccess = (req: any, res: Response, next: NextFunction) => {
  const token = req.headers['x-admin-token'] || req.query.access_token
  const pathToken = req.params.secretPath
  
  // Validate secret path
  if (!pathToken || pathToken !== ADMIN_SECRETS.secretPath) {
    logUnauthorizedAccess(req, 'invalid_secret_path')
    return res.status(404).json({ error: 'Not found' })
  }
  
  // Validate access token
  if (!token || token !== ADMIN_SECRETS.accessToken) {
    logUnauthorizedAccess(req, 'invalid_access_token')
    return res.status(404).json({ error: 'Not found' })
  }
  
  // IP whitelist check
  const allowedIPs = (process.env.ADMIN_ALLOWED_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean)
  if (allowedIPs.length > 0 && !allowedIPs.includes(req.ip || '')) {
    logUnauthorizedAccess(req, 'ip_not_whitelisted')
    return res.status(404).json({ error: 'Not found' })
  }
  
  next()
}

// IP whitelist middleware
export const enforceIPWhitelist = (req: Request, res: Response, next: NextFunction) => {
  const allowedIPs = (process.env.ADMIN_ALLOWED_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean)
  
  if (allowedIPs.length === 0) {
    console.warn('⚠️ No IP whitelist configured for admin panel - this is dangerous in production!')
    return next()
  }
  
  const clientIP = req.ip || 'unknown'
  if (!allowedIPs.includes(clientIP)) {
    logUnauthorizedAccess(req, 'ip_blocked')
    return res.status(404).json({ error: 'Not found' })
  }
  
  next()
}

// Log unauthorized access attempts
function logUnauthorizedAccess(req: any, reason: string) {
  const auditLogger = AuditLogger.getInstance()
  auditLogger.logSecurityEvent({
    action: 'unauthorized_admin_access',
    resource: 'admin_panel',
    ipAddress: req.ip || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    riskLevel: 'critical',
    details: { 
      reason,
      path: req.path,
      method: req.method,
      headers: Object.keys(req.headers),
      timestamp: new Date().toISOString()
    }
  })
}

// Generate time-based access URLs (optional extra security)
export function generateTimeBasedAccess(): string {
  const now = Math.floor(Date.now() / 1000)
  const timeWindow = Math.floor(now / 300) // 5-minute windows
  const hash = crypto.createHash('sha256')
    .update(`${ADMIN_SECRETS.accessToken}${timeWindow}${ADMIN_SECRETS.pathSalt}`)
    .digest('hex')
    .substring(0, 16)
  
  return hash
}

// Validate time-based access
export function validateTimeBasedAccess(providedHash: string): boolean {
  const now = Math.floor(Date.now() / 1000)
  
  // Check current and previous time window (10 minutes total)
  for (let offset = 0; offset <= 1; offset++) {
    const timeWindow = Math.floor(now / 300) - offset
    const expectedHash = crypto.createHash('sha256')
      .update(`${ADMIN_SECRETS.accessToken}${timeWindow}${ADMIN_SECRETS.pathSalt}`)
      .digest('hex')
      .substring(0, 16)
    
    if (providedHash === expectedHash) {
      return true
    }
  }
  
  return false
}
