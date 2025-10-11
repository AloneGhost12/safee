import crypto from 'crypto'
import { ObjectId } from 'mongodb'
import { 
  EmailOTP, 
  createEmailOTP, 
  findEmailOTP, 
  markOTPAsUsed, 
  incrementOTPAttempts,
  checkRateLimit,
  incrementRateLimit
} from '../models/emailOTP'
import { getEmailService, generateOTPCode } from './emailService'
import { AuditLogger } from './auditLogger'

export interface OTPConfiguration {
  length: number
  expirationMinutes: number
  maxAttempts: number
  allowedPurposes: string[]
}

export interface GenerateOTPOptions {
  email: string
  purpose: 'login' | 'registration' | 'password_reset' | 'email_verification' | 'account_recovery'
  userId?: ObjectId
  ipAddress?: string
  userAgent?: string
  metadata?: {
    sessionId?: string
    deviceFingerprint?: string
    location?: string
    isResend?: boolean
    [key: string]: any  // Allow additional metadata
  }
}

export interface VerifyOTPOptions {
  email: string
  code: string
  purpose: string
  ipAddress?: string
  userAgent?: string
}

export interface OTPResult {
  success: boolean
  otpId?: ObjectId
  error?: string
  remainingAttempts?: number
  isBlocked?: boolean
  blockExpiresAt?: Date
}

export interface RateLimitResult {
  allowed: boolean
  remainingAttempts: number
  resetTime?: Date
}

class EmailOTPService {
  private auditLogger: AuditLogger
  private config: OTPConfiguration

  constructor(config?: Partial<OTPConfiguration>) {
    this.auditLogger = AuditLogger.getInstance()
    
    // Default configuration
    this.config = {
      length: 6,
      expirationMinutes: 10,
      maxAttempts: 3,
      allowedPurposes: ['login', 'registration', 'password_reset', 'email_verification', 'account_recovery'],
      ...config
    }
  }

  /**
   * Generate and send OTP code to email
   */
  async generateOTP(options: GenerateOTPOptions): Promise<OTPResult> {
    try {
      // Validate purpose
      if (!this.config.allowedPurposes.includes(options.purpose)) {
        return {
          success: false,
          error: 'Invalid OTP purpose'
        }
      }

      // Check rate limiting
      if (options.ipAddress) {
        const rateLimit = await checkRateLimit(options.email, options.ipAddress, options.purpose)
        if (!rateLimit.allowed) {
          // Log rate limit exceeded
          this.auditLogger.logSecurityEvent({
            action: 'otp_rate_limit_exceeded',
            userId: options.userId?.toString(),
            resource: 'email_otp',
            ipAddress: options.ipAddress || 'unknown',
            userAgent: options.userAgent || 'unknown',
            riskLevel: 'medium',
            details: {
              email: options.email,
              purpose: options.purpose,
              remainingAttempts: rateLimit.remainingAttempts,
              resetTime: rateLimit.resetTime
            }
          })

          return {
            success: false,
            error: 'Too many OTP requests. Please try again later.',
            isBlocked: true,
            blockExpiresAt: rateLimit.resetTime
          }
        }
      }

      // Generate secure OTP code
      const code = this.generateSecureOTP()
      const codeHash = this.hashOTP(code)
      
      // Calculate expiration time
      const expiresAt = new Date(Date.now() + (this.config.expirationMinutes * 60 * 1000))

      // Create OTP record in database
      const otpData: Omit<EmailOTP, '_id'> = {
        email: options.email,
        code, // Store plain code temporarily for email sending
        codeHash,
        purpose: options.purpose,
        userId: options.userId,
        attempts: 0,
        maxAttempts: this.config.maxAttempts,
        createdAt: new Date(),
        expiresAt,
        isUsed: false,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        metadata: options.metadata
      }

      const otpId = await createEmailOTP(otpData)

      // Send OTP via email
      const emailService = getEmailService()
      const emailResult = await emailService.sendOTP(
        options.email, 
        code, 
        options.purpose, 
        this.config.expirationMinutes
      )

      if (!emailResult.success) {
        // Log email send failure
        this.auditLogger.logSecurityEvent({
          action: 'otp_email_send_failed',
          userId: options.userId?.toString(),
          resource: 'email_otp',
          ipAddress: options.ipAddress || 'unknown',
          userAgent: options.userAgent || 'unknown',
          riskLevel: 'medium',
          details: {
            email: options.email,
            purpose: options.purpose,
            error: emailResult.error
          }
        })

        return {
          success: false,
          error: 'Failed to send OTP email. Please try again.'
        }
      }

      // Increment rate limit counter
      if (options.ipAddress) {
        await incrementRateLimit(options.email, options.ipAddress, options.purpose)
      }

      // Log successful OTP generation
      this.auditLogger.logSecurityEvent({
        action: 'otp_generated',
        userId: options.userId?.toString(),
        resource: 'email_otp',
        ipAddress: options.ipAddress || 'unknown',
        userAgent: options.userAgent || 'unknown',
        riskLevel: 'low',
        details: {
          email: options.email,
          purpose: options.purpose,
          otpId: otpId.toString(),
          expiresAt: expiresAt.toISOString(),
          emailMessageId: emailResult.messageId
        }
      })

      console.log(`📧 OTP sent to ${options.email} for ${options.purpose} (expires in ${this.config.expirationMinutes} minutes)`)

      return {
        success: true,
        otpId
      }

    } catch (error) {
      console.error('❌ Failed to generate OTP:', error)
      
      this.auditLogger.logSecurityEvent({
        action: 'otp_generation_error',
        userId: options.userId?.toString(),
        resource: 'email_otp',
        ipAddress: options.ipAddress || 'unknown',
        userAgent: options.userAgent || 'unknown',
        riskLevel: 'high',
        details: {
          email: options.email,
          purpose: options.purpose,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })

      return {
        success: false,
        error: 'Internal server error. Please try again later.'
      }
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOTP(options: VerifyOTPOptions): Promise<OTPResult> {
    try {
      // Validate input
      if (!options.email || !options.code || !options.purpose) {
        return {
          success: false,
          error: 'Missing required parameters'
        }
      }

      // Hash the provided code for comparison
      const codeHash = this.hashOTP(options.code)

      // Find the OTP record
      const otpRecord = await findEmailOTP(options.email, options.purpose as EmailOTP['purpose'], codeHash)

      if (!otpRecord) {
        // Log invalid OTP attempt
        this.auditLogger.logSecurityEvent({
          action: 'otp_verification_failed',
          resource: 'email_otp',
          ipAddress: options.ipAddress || 'unknown',
          userAgent: options.userAgent || 'unknown',
          riskLevel: 'medium',
          details: {
            email: options.email,
            purpose: options.purpose,
            reason: 'invalid_code'
          }
        })

        return {
          success: false,
          error: 'Invalid or expired OTP code'
        }
      }

      // Check if OTP has exceeded max attempts
      if (otpRecord.attempts >= otpRecord.maxAttempts) {
        // Log max attempts exceeded
        this.auditLogger.logSecurityEvent({
          action: 'otp_max_attempts_exceeded',
          userId: otpRecord.userId?.toString(),
          resource: 'email_otp',
          ipAddress: options.ipAddress || 'unknown',
          userAgent: options.userAgent || 'unknown',
          riskLevel: 'high',
          details: {
            email: options.email,
            purpose: options.purpose,
            otpId: otpRecord._id?.toString(),
            attempts: otpRecord.attempts
          }
        })

        return {
          success: false,
          error: 'OTP code has been locked due to too many failed attempts',
          remainingAttempts: 0
        }
      }

      // Verify the code matches
      if (otpRecord.codeHash !== codeHash) {
        // Increment attempts
        const newAttempts = await incrementOTPAttempts(otpRecord._id!)
        
        // Log invalid OTP attempt
        this.auditLogger.logSecurityEvent({
          action: 'otp_verification_failed',
          userId: otpRecord.userId?.toString(),
          resource: 'email_otp',
          ipAddress: options.ipAddress || 'unknown',
          userAgent: options.userAgent || 'unknown',
          riskLevel: 'medium',
          details: {
            email: options.email,
            purpose: options.purpose,
            otpId: otpRecord._id?.toString(),
            attempts: newAttempts,
            reason: 'incorrect_code'
          }
        })

        return {
          success: false,
          error: 'Invalid OTP code',
          remainingAttempts: Math.max(0, otpRecord.maxAttempts - newAttempts)
        }
      }

      // Mark OTP as used
      await markOTPAsUsed(otpRecord._id!)

      // Log successful OTP verification
      this.auditLogger.logSecurityEvent({
        action: 'otp_verified_successfully',
        userId: otpRecord.userId?.toString(),
        resource: 'email_otp',
        ipAddress: options.ipAddress || 'unknown',
        userAgent: options.userAgent || 'unknown',
        riskLevel: 'low',
        details: {
          email: options.email,
          purpose: options.purpose,
          otpId: otpRecord._id?.toString()
        }
      })

      console.log(`✅ OTP verified successfully for ${options.email} (${options.purpose})`)

      return {
        success: true,
        otpId: otpRecord._id
      }

    } catch (error) {
      console.error('❌ Failed to verify OTP:', error)
      
      this.auditLogger.logSecurityEvent({
        action: 'otp_verification_error',
        resource: 'email_otp',
        ipAddress: options.ipAddress || 'unknown',
        userAgent: options.userAgent || 'unknown',
        riskLevel: 'high',
        details: {
          email: options.email,
          purpose: options.purpose,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })

      return {
        success: false,
        error: 'Internal server error. Please try again later.'
      }
    }
  }

  /**
   * Generate cryptographically secure OTP
   */
  private generateSecureOTP(): string {
    const min = Math.pow(10, this.config.length - 1)
    const max = Math.pow(10, this.config.length) - 1
    return crypto.randomInt(min, max + 1).toString().padStart(this.config.length, '0')
  }

  /**
   * Hash OTP code for secure storage
   */
  private hashOTP(code: string): string {
    return crypto.createHash('sha256').update(code + 'otp_salt_safee_2025').digest('hex')
  }

  /**
   * Check rate limiting for OTP requests
   */
  async checkRateLimit(email: string, ipAddress: string, purpose: string): Promise<RateLimitResult> {
    return await checkRateLimit(email, ipAddress, purpose)
  }

  /**
   * Get OTP configuration
   */
  getConfiguration(): OTPConfiguration {
    return { ...this.config }
  }

  /**
   * Update OTP configuration
   */
  updateConfiguration(config: Partial<OTPConfiguration>): void {
    this.config = { ...this.config, ...config }
  }
}

// Lazy singleton instance
let _emailOTPService: EmailOTPService | null = null

export function getEmailOTPService(): EmailOTPService {
  if (!_emailOTPService) {
    _emailOTPService = new EmailOTPService()
  }
  return _emailOTPService
}

// Export the class for testing and custom configurations
export { EmailOTPService }
