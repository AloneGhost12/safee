import { Request, Response, NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import slowDown from 'express-slow-down'
import { z } from 'zod'

/**
 * Content Security Policy (CSP) middleware
 * Prevents XSS, clickjacking, and other code injection attacks
 */
export function setupCSP() {
  return (req: Request, res: Response, next: NextFunction) => {
    const isDev = process.env.NODE_ENV === 'development'
    
    // Strict CSP for production, more lenient for development
    const cspDirectives = {
      "default-src": ["'self'"],
      "script-src": isDev 
        ? ["'self'", "'unsafe-inline'", "'unsafe-eval'", "http://localhost:*", "ws://localhost:*"]
        : ["'self'", "'strict-dynamic'"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "img-src": ["'self'", "data:", "https:", "blob:"],
      "connect-src": isDev
        ? ["'self'", "http://localhost:*", "ws://localhost:*", "https://api.cloudinary.com"]
        : ["'self'", "https://api.cloudinary.com", process.env.CLOUDINARY_UPLOAD_URL || ""].filter(Boolean),
      "frame-ancestors": ["'none'"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
      "upgrade-insecure-requests": isDev ? [] : [""]
    }

    const cspString = Object.entries(cspDirectives)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ')

    res.setHeader('Content-Security-Policy', cspString)
    
    // Additional security headers
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('X-XSS-Protection', '1; mode=block')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
    
    // HSTS for production
    if (!isDev) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
    }
    
    next()
  }
}

/**
 * Rate limiting for authentication endpoints
 * Prevents brute force attacks while allowing normal user operations
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Increased from 5 to 100 requests per windowMs for auth endpoints
  message: {
    error: 'Too many authentication attempts, please try again later',
    retryAfter: 15 * 60 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use manual key generation to avoid trust proxy issues
  keyGenerator: (req) => {
    // Use x-forwarded-for header for Render, fallback to req.ip
    const forwarded = req.headers['x-forwarded-for'] as string
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip || 'unknown'
    return ip
  },
  // Skip rate limiting for whitelisted IPs in development
  skip: (req) => {
    if (process.env.NODE_ENV === 'development' && 
        (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip?.startsWith('192.168.'))) {
      return true
    }
    return false
  }
})

/**
 * Lenient rate limiting for general user operations
 * For logout, profile info, non-sensitive operations
 */
export const generalUserRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // High limit for general operations
  message: {
    error: 'Too many requests, please try again later',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'] as string
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip || 'unknown'
    return ip
  },
  skip: (req) => {
    if (process.env.NODE_ENV === 'development' && 
        (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip?.startsWith('192.168.'))) {
      return true
    }
    return false
  }
})

/**
 * Moderate rate limiting for 2FA operations
 * Slightly more restrictive than general but not too aggressive
 */
export const twoFAOperationsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per 15 minutes for 2FA operations
  message: {
    error: 'Too many 2FA requests, please try again later',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'] as string
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip || 'unknown'
    return ip
  },
  skip: (req) => {
    if (process.env.NODE_ENV === 'development' && 
        (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip?.startsWith('192.168.'))) {
      return true
    }
    return false
  }
})

/**
 * Aggressive rate limiting for failed login attempts
 * Applies progressive delays after failed attempts
 */
export const loginRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Increased from 3 to 10 attempts per hour
  message: {
    error: 'Too many failed login attempts, account temporarily locked',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use x-forwarded-for header for Render, fallback to req.ip
    const forwarded = req.headers['x-forwarded-for'] as string
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip || 'unknown'
    return ip
  },
  skipSuccessfulRequests: true, // Don't count successful requests
})

/**
 * Progressive delay for authentication attempts
 * Slows down requests after repeated attempts
 */
export const authSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 2, // Allow 2 requests per window without delay
  delayMs: () => 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  validate: { delayMs: false }, // Disable the warning
})

/**
 * Input validation and sanitization middleware
 */
export function validateInput(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const validatedBody = schema.parse(req.body)
      req.body = validatedBody
      
      // Check content length
      const contentLength = parseInt(req.headers['content-length'] || '0')
      const maxSize = 1024 * 1024 // 1MB max for regular requests
      
      if (contentLength > maxSize) {
        return res.status(413).json({ 
          error: 'Request too large',
          maxSize: '1MB'
        })
      }
      
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid input data',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        })
      }
      next(error)
    }
  }
}

/**
 * Common validation schemas with length limits
 */
export const validationSchemas = {
  email: z.string()
    .email('Invalid email format')
    .min(5, 'Email too short')
    .max(255, 'Email too long')
    .toLowerCase()
    .trim(),
    
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
    
  filename: z.string()
    .min(1, 'Filename required')
    .max(255, 'Filename too long')
    .regex(/^[^<>:"/\\|?*\x00-\x1f]*$/, 'Invalid filename characters'),
    
  noteTitle: z.string()
    .min(1, 'Title required')
    .max(200, 'Title too long')
    .trim(),
    
  noteContent: z.string()
    .max(1024 * 1024, 'Content too long') // 1MB limit
    .optional(),
    
  tags: z.array(z.string().max(50, 'Tag too long')).max(20, 'Too many tags'),
  
  totpCode: z.string()
    .length(6, 'TOTP code must be 6 digits')
    .regex(/^\d{6}$/, 'TOTP code must be numeric'),
}

/**
 * Helmet configuration for enhanced security
 */
export const helmetConfig = {
  contentSecurityPolicy: false, // We handle CSP manually for more control
  crossOriginEmbedderPolicy: { policy: 'require-corp' as const },
  crossOriginOpenerPolicy: { policy: 'same-origin' as const },
  crossOriginResourcePolicy: { policy: 'same-origin' as const },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' as const },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' as const },
  xssFilter: true
}

/**
 * IP address extraction and validation
 */
export function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  const ip = (forwarded ? forwarded.toString().split(',')[0] : req.socket.remoteAddress) || 'unknown'
  return ip.trim()
}

/**
 * Trusted proxy configuration for rate limiting
 */
export function configureTrustedProxies(app: any) {
  // For Render deployment, trust specific Cloudflare IPs instead of all proxies
  if (process.env.NODE_ENV === 'production' && process.env.TRUST_PROXY === 'true') {
    // Trust Cloudflare IP ranges used by Render
    app.set('trust proxy', ['127.0.0.1', '::1', '172.68.0.0/12', '172.69.0.0/12', '104.16.0.0/12'])
  } else if (process.env.TRUSTED_PROXIES) {
    app.set('trust proxy', process.env.TRUSTED_PROXIES.split(','))
  } else if (process.env.NODE_ENV === 'development') {
    // Only trust localhost in development
    app.set('trust proxy', ['127.0.0.1', '::1'])
  }
}
