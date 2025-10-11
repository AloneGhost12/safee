import { Router, Request, Response } from 'express'
import { 
  otpRateLimit, 
  otpVerifyRateLimit,
  validateSendOTP, 
  validateVerifyOTP,
  sendOTPMiddleware,
  verifyOTPMiddleware,
  otpSecurityHeaders,
  OTPRequest
} from '../middleware/emailOTP'
import { asyncHandler } from '../middleware/errors'
import { getEmailOTPService } from '../services/emailOTPService'
import { getEmailService } from '../services/emailService'

const router = Router()

// Apply security headers to all OTP routes
router.use(otpSecurityHeaders)

/**
 * POST /api/otp/send
 * Send OTP code to email
 */
router.post('/send', 
  otpRateLimit,
  validateSendOTP,
  sendOTPMiddleware
)

/**
 * POST /api/otp/verify
 * Verify OTP code
 */
router.post('/verify',
  otpVerifyRateLimit,
  validateVerifyOTP,
  verifyOTPMiddleware
)

/**
 * POST /api/otp/resend
 * Resend OTP code (with stricter rate limiting)
 */
router.post('/resend',
  otpRateLimit,
  validateSendOTP,
  asyncHandler(async (req: OTPRequest, res: Response) => {
    const { email, purpose } = res.locals.validatedData
    
    // Additional rate limiting for resend requests
    const emailOTPService = getEmailOTPService()
    const rateLimitResult = await emailOTPService.checkRateLimit(
      email, 
      req.ip || '127.0.0.1', 
      purpose
    )
    
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        error: 'Too many resend requests. Please wait before requesting again.',
        remainingAttempts: rateLimitResult.remainingAttempts,
        resetTime: rateLimitResult.resetTime
      })
    }
    
    // Generate and send new OTP
    const result = await emailOTPService.generateOTP({
      email,
      purpose,
      userId: req.user?._id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        sessionId: req.sessionID || req.headers['x-session-id'] as string,
        deviceFingerprint: req.headers['x-device-fingerprint'] as string,
        location: req.headers['x-user-location'] as string,
        isResend: true
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
        error: result.error || 'Failed to resend OTP'
      })
    }
    
    res.json({
      success: true,
      message: 'OTP resent successfully',
      email,
      purpose,
      expiresIn: '10 minutes'
    })
  })
)

/**
 * GET /api/otp/status
 * Check OTP verification status for current session
 */
router.get('/status',
  asyncHandler(async (req: OTPRequest, res: Response) => {
    const email = req.query.email as string
    const purpose = req.query.purpose as string
    
    if (!email || !purpose) {
      return res.status(400).json({
        error: 'Email and purpose are required'
      })
    }
    
    // Check session for OTP verification
    const otpVerification = req.session?.otpVerification
    
    const isVerified = otpVerification && 
                      otpVerification.email === email && 
                      otpVerification.purpose === purpose &&
                      otpVerification.verified
    
    res.json({
      verified: !!isVerified,
      email: isVerified ? email : undefined,
      purpose: isVerified ? purpose : undefined,
      verifiedAt: isVerified ? otpVerification?.verifiedAt : undefined
    })
  })
)

/**
 * POST /api/otp/test-email
 * Test email service functionality (development only)
 */
router.post('/test-email',
  asyncHandler(async (req: Request, res: Response) => {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        error: 'Test endpoint not available in production'
      })
    }
    
    const { email } = req.body
    
    if (!email) {
      return res.status(400).json({
        error: 'Email is required'
      })
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format'
      })
    }
    
    try {
      const emailService = getEmailService()
      const result = await emailService.sendTestEmail(email)
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Test email sent successfully',
          messageId: result.messageId,
          email
        })
      } else {
        res.status(500).json({
          error: 'Failed to send test email',
          details: result.error
        })
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to send test email',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })
)

/**
 * GET /api/otp/config
 * Get OTP configuration (public settings only)
 */
router.get('/config',
  asyncHandler(async (req: Request, res: Response) => {
    const emailOTPService = getEmailOTPService()
    const config = emailOTPService.getConfiguration()
    
    // Return only public configuration
    res.json({
      length: config.length,
      expirationMinutes: config.expirationMinutes,
      maxAttempts: config.maxAttempts,
      allowedPurposes: config.allowedPurposes
    })
  })
)

/**
 * POST /api/otp/clear
 * Clear OTP verification from session
 */
router.post('/clear',
  asyncHandler(async (req: OTPRequest, res: Response) => {
    const { email, purpose } = req.body
    
    if (req.session?.otpVerification) {
      // Only clear if email and purpose match (security measure)
      if (!email || !purpose || 
          req.session.otpVerification.email !== email ||
          req.session.otpVerification.purpose !== purpose) {
        return res.status(400).json({
          error: 'Invalid email or purpose for clearing verification'
        })
      }
      
      delete req.session.otpVerification
    }
    
    res.json({
      success: true,
      message: 'OTP verification cleared'
    })
  })
)

/**
 * Error handler for OTP routes
 */
router.use((error: any, req: Request, res: Response, next: any) => {
  console.error('OTP route error:', error)
  
  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({
      error: 'Internal server error'
    })
  } else {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
      stack: error.stack
    })
  }
})

export default router
