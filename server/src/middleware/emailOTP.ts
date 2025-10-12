import { Request, Response, NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { ObjectId } from 'mongodb'
import { getEmailOTPService } from '../services/emailOTPService'
import { emailOTPCollection_func } from '../models/emailOTP'
import { AuditLogger } from '../services/auditLogger'

// Extend Request interface to include OTP verification data and user/session
export interface OTPRequest extends Request {
  otpVerification?: {
    email: string
    purpose: string
    verified: boolean
    otpId: string
  }
  user?: {
    id?: string
    _id?: ObjectId
    email?: string
  }
  session?: {
    otpVerification?: {
      email: string
      purpose: string
      verified: boolean
      otpId: string
      verifiedAt: string
    }
  }
  sessionID?: string
}

// Validation schemas
export const sendOTPSchema = z.object({
  email: z.string().email('Invalid email address'),
  purpose: z.enum(['login', 'registration', 'password_reset', 'email_verification', 'account_recovery'])
})

export const verifyOTPSchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().min(6, 'OTP code must be 6 digits').max(6, 'OTP code must be 6 digits'),
  purpose: z.enum(['login', 'registration', 'password_reset', 'email_verification', 'account_recovery'])
})

// Rate limiting for OTP endpoints
export const otpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window per IP
  message: {
    error: 'Too many OTP requests. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use IP + email for more specific rate limiting
    const email = req.body?.email || req.query?.email || 'unknown'
    return `${req.ip}_${email}`
  },
  handler: (req, res) => {
    const auditLogger = AuditLogger.getInstance()
    
    auditLogger.logSecurityEvent({
      action: 'otp_rate_limit_exceeded',
      resource: 'otp_endpoint',
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      riskLevel: 'medium',
      details: {
        endpoint: req.path,
        method: req.method,
        email: req.body?.email || req.query?.email
      }
    })
    
    res.status(429).json({
      error: 'Too many OTP requests. Please try again later.',
      retryAfter: '15 minutes'
    })
  }
})

// Stricter rate limiting for verification attempts
export const otpVerifyRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 verification attempts per window
  message: {
    error: 'Too many verification attempts. Please try again later.',
    retryAfter: '5 minutes'
  },
  keyGenerator: (req) => {
    const email = req.body?.email || 'unknown'
    return `verify_${req.ip}_${email}`
  },
  handler: (req, res) => {
    const auditLogger = AuditLogger.getInstance()
    
    auditLogger.logSecurityEvent({
      action: 'otp_verify_rate_limit_exceeded',
      resource: 'otp_verification',
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      riskLevel: 'high',
      details: {
        email: req.body?.email,
        attempts: 'max_reached'
      }
    })
    
    res.status(429).json({
      error: 'Too many verification attempts. Please try again later.',
      retryAfter: '5 minutes'
    })
  }
})

/**
 * Middleware to validate send OTP request
 */
export function validateSendOTP(req: Request, res: Response, next: NextFunction) {
  try {
    const result = sendOTPSchema.safeParse(req.body)
    
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      })
    }
    
    // Attach validated data to request
    res.locals.validatedData = result.data
    next()
  } catch (error) {
    res.status(400).json({
      error: 'Invalid request format'
    })
  }
}

/**
 * Middleware to validate verify OTP request
 */
export function validateVerifyOTP(req: Request, res: Response, next: NextFunction) {
  try {
    const result = verifyOTPSchema.safeParse(req.body)
    
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      })
    }
    
    // Attach validated data to request
    res.locals.validatedData = result.data
    next()
  } catch (error) {
    res.status(400).json({
      error: 'Invalid request format'
    })
  }
}

/**
 * Middleware to require OTP verification for protected routes
 */
export function requireOTPVerification(purpose: string) {
  return async (req: OTPRequest, res: Response, next: NextFunction) => {
    try {
      const email = req.body?.email || req.user?.email
      
      if (!email) {
        return res.status(400).json({
          error: 'Email is required for OTP verification'
        })
      }
      
      // Check if OTP verification data exists in session or request
      const otpVerification = req.session?.otpVerification || req.otpVerification
      
      if (!otpVerification || 
          !otpVerification.verified || 
          otpVerification.email !== email || 
          otpVerification.purpose !== purpose) {
        
        return res.status(403).json({
          error: 'OTP verification required',
          requiresOTP: true,
          purpose,
          email
        })
      }
      
      // OTP verification is valid, proceed
      next()
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error during OTP verification'
      })
    }
  }
}

/**
 * Middleware to generate and send OTP
 */
export async function sendOTPMiddleware(req: OTPRequest, res: Response, next: NextFunction) {
  try {
    const { email, purpose } = res.locals.validatedData
    const userId = req.user?.id || req.user?._id?.toString()
    
    const emailOTPService = getEmailOTPService()
    const result = await emailOTPService.generateOTP({
      email,
      purpose,
      userId: userId ? new ObjectId(userId) : undefined,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        sessionId: req.sessionID || req.headers['x-session-id'] as string,
        deviceFingerprint: req.headers['x-device-fingerprint'] as string,
        location: req.headers['x-user-location'] as string
      }
    })
    
    if (!result.success) {
      if (result.isBlocked) {
        return res.status(429).json({
          error: result.error,
          blocked: true,
          blockExpiresAt: result.blockExpiresAt
        })
      }
      
      return res.status(400).json({
        error: result.error || 'Failed to send OTP'
      })
    }
    
    // Base response
    const responseBody: Record<string, any> = {
      success: true,
      message: 'OTP sent successfully',
      email,
      purpose,
      expiresIn: '10 minutes'
    }

    // Optional admin-only debug: expose OTP in response when explicitly authorized
    // Guard rails:
    // - Require process.env.OTP_DEBUG_TOKEN to be set
    // - Require request header 'x-otp-debug' to match OTP_DEBUG_TOKEN
    // - Only for non-production by default; allow in production if OTP_DEBUG_ALLOW_PROD==='true'
    try {
      const debugToken = process.env.OTP_DEBUG_TOKEN
      const provided = (req.headers['x-otp-debug'] as string | undefined)?.trim()
      const allowProd = process.env.OTP_DEBUG_ALLOW_PROD === 'true'
      const isProd = process.env.NODE_ENV === 'production'

      if (debugToken && provided && provided === debugToken && (allowProd || !isProd)) {
        // Fetch the just-created OTP document and include its code
        const collection = emailOTPCollection_func()
        const latest = await collection.find({
          email,
          purpose,
          isUsed: false
        }).sort({ createdAt: -1 }).limit(1).toArray()

        const latestCode = latest?.[0]?.code
        if (latestCode) {
          responseBody.debug = {
            code: latestCode,
            note: 'Admin-only debug output. Do not expose to end users.'
          }
          // Log with context for traceability
          console.warn('[OTP DEBUG MODE] OTP disclosed in response for authorized admin', {
            email,
            purpose,
            ip: req.ip,
            ua: req.get('User-Agent')
          })
        }
      }
    } catch (e) {
      // Never break the main flow due to debug path
      console.error('OTP debug disclosure failed (ignored):', e instanceof Error ? e.message : e)
    }

    res.json(responseBody)
  } catch (error) {
    console.error('Send OTP middleware error:', error)
    res.status(500).json({
      error: 'Failed to send OTP. Please try again later.'
    })
  }
}

/**
 * Middleware to verify OTP
 */
export async function verifyOTPMiddleware(req: OTPRequest, res: Response, next: NextFunction) {
  try {
    const { email, code, purpose } = res.locals.validatedData
    
    const emailOTPService = getEmailOTPService()
    const result = await emailOTPService.verifyOTP({
      email,
      code,
      purpose,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    })
    
    if (!result.success) {
      return res.status(400).json({
        error: result.error || 'Invalid OTP code',
        remainingAttempts: result.remainingAttempts
      })
    }
    
    // Store OTP verification in session
    if (req.session) {
      req.session.otpVerification = {
        email,
        purpose,
        verified: true,
        otpId: result.otpId?.toString() || '',
        verifiedAt: new Date().toISOString()
      }
    }
    
    // Also attach to request for immediate use
    req.otpVerification = {
      email,
      purpose,
      verified: true,
      otpId: result.otpId?.toString() || ''
    }
    
    res.json({
      success: true,
      message: 'OTP verified successfully',
      email,
      purpose
    })
  } catch (error) {
    console.error('Verify OTP middleware error:', error)
    res.status(500).json({
      error: 'Failed to verify OTP. Please try again later.'
    })
  }
}

/**
 * Middleware to clear OTP verification from session
 */
export function clearOTPVerification(req: OTPRequest, res: Response, next: NextFunction) {
  if (req.session?.otpVerification) {
    delete req.session.otpVerification
  }
  next()
}

/**
 * Middleware to check if OTP is required for the current action
 */
export function checkOTPRequirement(purpose: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Define which actions require OTP verification
    const otpRequiredActions = new Set([
      'login',
      'password_reset',
      'account_recovery',
      'sensitive_operation'
    ])
    
    if (otpRequiredActions.has(purpose)) {
      res.locals.requiresOTP = true
      res.locals.otpPurpose = purpose
    }
    
    next()
  }
}

/**
 * Security headers for OTP endpoints
 */
export function otpSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Cache control for sensitive endpoints
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  
  next()
}
