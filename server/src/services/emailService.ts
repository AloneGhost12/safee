import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { AuditLogger } from './auditLogger'

export interface EmailService {
  sendRecoveryCode(email: string, code: string, userName?: string): Promise<void>
  sendBackupCodesEmail(email: string, codes: string[], userName?: string): Promise<void>
  sendOTP(email: string, code: string, purpose: string, expirationMinutes?: number): Promise<EmailServiceResult>
  sendTestEmail(to: string): Promise<EmailServiceResult>
  sendAccountLockoutAlert(email: string, userName?: string, lockoutDurationMinutes?: number, clientInfo?: { ipAddress?: string; userAgent?: string }): Promise<void>
}

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
}

export interface EmailServiceResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Brevo (formerly Sendinblue) Email Service
 * Real SMTP integration for production use
 */
export class BrevoEmailService implements EmailService {
  private transporter: nodemailer.Transporter
  private auditLogger: AuditLogger
  private connectionVerified: boolean = false
  private retryCount: number = 0
  private maxRetries: number = 3

  constructor() {
    this.auditLogger = AuditLogger.getInstance()
    this.initializeTransporter()
  }

  private initializeTransporter(): void {
    // Create SMTP transporter with production-optimized settings
    const isProduction = process.env.NODE_ENV === 'production'
    
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
      port: parseInt(process.env.SMTP_PORT || (isProduction ? '587' : '465')),
      secure: process.env.SMTP_SECURE === 'true' || (!isProduction && process.env.SMTP_PORT === '465'),
      auth: {
        user: process.env.SMTP_USER || '93c1d4002@smtp-brevo.com',
        pass: process.env.SMTP_PASS || 'byQ4dHOJkNEaMGYh'
      },
      // Production-optimized timeouts
      connectionTimeout: isProduction ? 30000 : 15000, // 30s in production
      greetingTimeout: isProduction ? 20000 : 10000,   // 20s in production
      socketTimeout: isProduction ? 45000 : 20000,     // 45s in production
      // Additional configuration for production stability
      pool: true,
      maxConnections: isProduction ? 3 : 5,
      maxMessages: isProduction ? 50 : 100,
      // Retry configuration
      retryDelay: 5000, // 5 seconds between retries
      maxRetries: 3,
      // TLS configuration for production
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: isProduction
      },
      // Additional debugging for production
      logger: isProduction,
      debug: !isProduction
    })

    // Don't verify connection immediately in production to avoid blocking startup
    if (!isProduction) {
      this.verifyConnection()
    } else {
      // In production, verify connection lazily on first email send
      console.log('📧 Email service initialized (connection will be verified on first use)')
    }
  }

  private async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify()
      this.connectionVerified = true
      console.log('📧 Brevo SMTP connection verified successfully')
      return true
    } catch (error) {
      this.connectionVerified = false
      console.error('❌ Brevo SMTP connection failed:', error)
      
      // In production, try alternative configuration
      if (process.env.NODE_ENV === 'production' && this.retryCount < this.maxRetries) {
        console.log(`🔄 Retrying SMTP connection (attempt ${this.retryCount + 1}/${this.maxRetries})...`)
        this.retryCount++
        
        // Try alternative port/settings
        await this.tryAlternativeConfiguration()
        return this.verifyConnection()
      }
      
      return false
    }
  }

  private async tryAlternativeConfiguration(): Promise<void> {
    console.log('🔧 Trying alternative SMTP configuration...')
    
    // Alternative configurations to try
    const alternatives = [
      { port: 587, secure: false, tls: { ciphers: 'SSLv3' } },
      { port: 25, secure: false, tls: { ciphers: 'SSLv3' } },
      { port: 2525, secure: false, tls: { ciphers: 'SSLv3' } }
    ]
    
    const currentAlt = alternatives[this.retryCount - 1]
    if (currentAlt) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
        port: currentAlt.port,
        secure: currentAlt.secure,
        auth: {
          user: process.env.SMTP_USER || '93c1d4002@smtp-brevo.com',
          pass: process.env.SMTP_PASS || 'byQ4dHOJkNEaMGYh'
        },
        connectionTimeout: 45000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
        pool: true,
        maxConnections: 2,
        maxMessages: 10,
        tls: currentAlt.tls
      })
      
      console.log(`🔧 Trying port ${currentAlt.port}, secure: ${currentAlt.secure}`)
    }
  }

  private async sendEmail(options: EmailOptions): Promise<EmailServiceResult> {
    // In production, verify connection on first email send if not already verified
    if (process.env.NODE_ENV === 'production' && !this.connectionVerified) {
      console.log('🔍 Verifying SMTP connection before sending email...')
      const connected = await this.verifyConnection()
      if (!connected) {
        return {
          success: false,
          error: 'SMTP connection failed after all retry attempts'
        }
      }
    }

    try {
      const mailOptions = {
        from: options.from || `"Tridex Support" <security@tridex.app>`,
        replyTo: 'support@tridex.app',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
        headers: {
          'Message-ID': `<${Date.now()}-${Math.random().toString(36)}@tridex.app>`,
          'X-Mailer': 'Tridex Notification System',
          'List-Unsubscribe': '<mailto:unsubscribe@tridex.app>',
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal',
          'Importance': 'Normal',
          'Auto-Submitted': 'auto-generated',
          'X-Auto-Response-Suppress': 'All'
        }
      }

      const info = await this.transporter.sendMail(mailOptions)
      
      console.log('📧 Email sent successfully:', info.messageId)
      
      return {
        success: true,
        messageId: info.messageId
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      console.error('❌ Failed to send email:', errorMessage)
      
      // If this is a connection timeout in production, try to reinitialize
      if (process.env.NODE_ENV === 'production' && 
          (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT'))) {
        console.log('🔄 Connection timeout detected, reinitializing transporter...')
        this.connectionVerified = false
        this.retryCount = 0
        this.initializeTransporter()
        
        return {
          success: false,
          error: 'Connection timeout - email service reinitializing'
        }
      }
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  }

  // Implementation of EmailService interface methods
  async sendRecoveryCode(email: string, code: string, userName?: string): Promise<void> {
    const text = this.generatePlainTextRecovery(code, userName)
    await this.sendEmail({
      to: email,
      subject: 'Login Code',
      text,
      html: `<p>Hi ${userName || 'there'},</p><p>Your login code: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p><p>Thanks,<br>Support Team</p>`
    })
  }

  async sendBackupCodesEmail(email: string, codes: string[], userName?: string): Promise<void> {
    const html = this.generateBackupCodesEmailTemplate(codes, userName)
    await this.sendEmail({
      to: email,
      subject: 'Your Backup Codes - Tridex',
      html
    })
  }

  async sendAccountLockoutAlert(email: string, userName?: string, lockoutDurationMinutes: number = 5, clientInfo?: { ipAddress?: string; userAgent?: string }): Promise<void> {
    const html = this.generateAccountLockoutEmailTemplate(userName, lockoutDurationMinutes, clientInfo)
    await this.sendEmail({
      to: email,
      subject: 'Tridex Account Security Notice - Temporary Access Restriction',
      html
    })
  }

  async sendOTP(
    email: string, 
    code: string, 
    purpose: string, 
    expirationMinutes: number = 10
  ): Promise<EmailServiceResult> {
    const subject = this.getOTPSubject(purpose)
    const html = this.generateOTPEmailTemplate(code, purpose, expirationMinutes)
    
    return this.sendEmail({
      to: email,
      subject,
      html
    })
  }

  async sendTestEmail(to: string): Promise<EmailServiceResult> {
    return this.sendEmail({
      to,
      subject: '🧪 Tridex Email Service Test',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>✅ Email Service Test Successful!</h2>
          <p>Your Brevo SMTP configuration is working correctly.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>Service:</strong> Brevo SMTP</p>
          <p><strong>From:</strong> Tridex Support &lt;gff130170@gmail.com&gt;</p>
          <hr>
          <p><em>This is a test email from Tridex Support System.</em></p>
        </div>
      `
    })
  }

  private getOTPSubject(purpose: string): string {
    switch (purpose) {
      case 'login':
        return '🔐 Your Login Verification Code - Tridex'
      case 'registration':
        return '🎉 Welcome to Tridex - Verify Your Email'
      case 'password_reset':
        return '🔒 Password Reset Verification - Tridex'
      case 'email_verification':
        return '📧 Email Verification Required - Tridex'
      case 'account_recovery':
        return '🛡️ Account Recovery Verification - Tridex'
      default:
        return '🔐 Verification Code - Tridex'
    }
  }

  private generateRecoveryEmailTemplate(code: string, userName?: string): string {
    const currentYear = new Date().getFullYear()
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account Recovery</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; color: #495057; margin-bottom: 10px; }
        .code { background: #f8f9fa; color: #495057; font-size: 28px; font-weight: bold; text-align: center; padding: 15px; margin: 20px 0; border-radius: 4px; letter-spacing: 3px; border: 2px solid #dee2e6; }
        .info { background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #2196f3; }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6c757d; border-top: 1px solid #dee2e6; padding-top: 20px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Tridex</div>
            <h2>Account Recovery</h2>
        </div>
        
        <p>Hello ${userName || 'valued user'},</p>
        <p>We received a request to help you regain access to your account. Please use the verification code below to proceed with your account recovery.</p>
        
        <div class="code">${code}</div>
        
        <div class="info">
            <strong>Security Notice:</strong> This verification code will expire in 15 minutes for your protection.
        </div>
        
        <p>If you did not request this recovery code, please disregard this message. Your account security remains intact.</p>
        
        <p>Need assistance? Contact our support team at <a href="mailto:support@tridex.app">support@tridex.app</a></p>
        
        <div class="footer">
            <p><strong>Tridex Support Team</strong></p>
            <p>This is an automated message from Tridex. Please do not reply to this email.</p>
            <p>&copy; ${currentYear} Tridex. All rights reserved.</p>
            <p><a href="mailto:unsubscribe@tridex.app">Unsubscribe</a> | <a href="https://tridex.app/privacy">Privacy Policy</a></p>
        </div>
    </div>
</body>
</html>`
  }

  private generatePlainTextRecovery(code: string, userName?: string): string {
    return `Hi ${userName || 'there'},

Your login code: ${code}

This code expires in 15 minutes.

Thanks,
Support Team
`
  }

  private generateBackupCodesEmailTemplate(codes: string[], userName?: string): string {
    const currentYear = new Date().getFullYear()
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Backup Codes</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4; }
        .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border-top: 4px solid #28a745; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 28px; font-weight: bold; color: #28a745; margin-bottom: 10px; }
        .codes { background: #f8f9fa; border: 1px solid #dee2e6; padding: 20px; border-radius: 8px; margin: 20px 0; font-family: monospace; }
        .code-item { margin: 10px 0; font-size: 16px; font-weight: bold; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107; }
        .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #666; border-top: 1px solid #eee; padding-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🛡️ TRIDEX</div>
            <h2>Your New Backup Codes</h2>
        </div>
        
        <p>Hello ${userName || 'User'},</p>
        <p>Your 2FA backup codes have been generated. Please save these securely:</p>
        
        <div class="codes">
            ${codes.map((code, index) => `<div class="code-item">${index + 1}. ${code}</div>`).join('')}
        </div>
        
        <div class="warning">
            <strong>⚠️ Important:</strong>
            <ul>
                <li>Each code can only be used once</li>
                <li>Store these codes in a secure location</li>
                <li>Use these if you lose access to your authenticator app</li>
            </ul>
        </div>
        
        <div class="footer">
            <p><strong>Tridex Support Team</strong></p>
            <p>&copy; ${currentYear} Tridex. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`
  }

  private generateAccountLockoutEmailTemplate(userName?: string, lockoutDurationMinutes: number = 5, clientInfo?: { ipAddress?: string; userAgent?: string }): string {
    const currentYear = new Date().getFullYear()
    const timestamp = new Date().toLocaleString('en-US', { 
      timeZone: 'UTC',
      dateStyle: 'full',
      timeStyle: 'long'
    })
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Tridex Account Security Notification">
    <title>Tridex Account Security Notice</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #444; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; }
        .container { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border-top: 3px solid #007bff; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: 600; color: #007bff; margin-bottom: 8px; }
        .title { color: #2c3e50; font-size: 20px; margin-bottom: 0; }
        .notice-box { background: #e3f2fd; border: 1px solid #bbdefb; color: #1565c0; padding: 20px; margin: 25px 0; border-radius: 6px; border-left: 4px solid #2196f3; }
        .notice-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #1565c0; }
        .info-box { background: #f8f9fa; border: 1px solid #e9ecef; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .info-list { margin: 10px 0; padding-left: 0; list-style: none; }
        .info-list li { padding: 5px 0; border-bottom: 1px solid #eee; }
        .info-list li:last-child { border-bottom: none; }
        .info-list strong { color: #495057; min-width: 100px; display: inline-block; }
        .next-steps { background: #fff3cd; border: 1px solid #ffeaa7; padding: 18px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107; }
        .security-tips { background: #d1ecf1; border: 1px solid #bee5eb; padding: 18px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #17a2b8; }
        .security-tips h4 { margin-top: 0; color: #0c5460; font-size: 16px; }
        .tips-list { margin-bottom: 0; padding-left: 18px; }
        .tips-list li { margin-bottom: 6px; color: #0c5460; }
        .footer { text-align: center; margin-top: 35px; font-size: 13px; color: #6c757d; border-top: 1px solid #dee2e6; padding-top: 20px; }
        .footer-brand { font-weight: 600; color: #495057; }
        .text-muted { color: #6c757d; font-size: 14px; line-height: 1.4; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">TRIDEX</div>
            <h2 class="title">Account Security Notice</h2>
        </div>
        
        <div class="notice-box">
            <div class="notice-title">Temporary Access Restriction</div>
            <p style="margin-bottom: 0;">Your account access has been temporarily restricted as a security precaution.</p>
        </div>
        
        <p>Dear ${userName || 'User'},</p>
        <p>We have temporarily restricted access to your Tridex account after detecting multiple unsuccessful login attempts. This is a standard security measure to protect your account.</p>
        
        <div class="info-box">
            <h4 style="margin-top: 0; color: #495057; font-size: 16px;">Restriction Details</h4>
            <ul class="info-list">
                <li><strong>Duration:</strong> ${lockoutDurationMinutes} minutes</li>
                <li><strong>Reason:</strong> Multiple unsuccessful login attempts</li>
                <li><strong>Time:</strong> ${timestamp}</li>
                ${clientInfo?.ipAddress ? `<li><strong>IP Address:</strong> ${clientInfo.ipAddress}</li>` : ''}
                ${clientInfo?.userAgent ? `<li><strong>Device:</strong> ${clientInfo.userAgent.substring(0, 60)}...</li>` : ''}
            </ul>
        </div>
        
        <div class="next-steps">
            <h4 style="margin-top: 0; color: #856404; font-size: 16px;">What Happens Next</h4>
            <ul style="margin-bottom: 0; padding-left: 18px;">
                <li>Your account will automatically unlock after <strong>${lockoutDurationMinutes} minutes</strong></li>
                <li>You can then attempt to log in again with your correct credentials</li>
                <li>If you continue experiencing issues, please use our account recovery option</li>
            </ul>
        </div>

        <div class="security-tips">
            <h4>Security Recommendations</h4>
            <ul class="tips-list">
                <li><strong>If this was you:</strong> Please wait for the restriction to expire and ensure you're using the correct password</li>
                <li><strong>If this wasn't you:</strong> Someone may have attempted to access your account</li>
                <li>Verify you're using the correct username/email and password combination</li>
                <li>Check that Caps Lock is not enabled when entering your password</li>
                <li>Consider using our account recovery feature if you've forgotten your password</li>
                <li>Consider enabling two-factor authentication for enhanced account security</li>
            </ul>
        </div>

        <p class="text-muted"><strong>Did not attempt to log in?</strong><br>
        If you did not try to access your account, this may indicate unauthorized access attempts. We recommend changing your password once the restriction expires.</p>
        
        <p class="text-muted">This restriction will be automatically lifted after ${lockoutDurationMinutes} minutes. You will then be able to access your account normally.</p>
        
        <div class="footer">
            <p class="footer-brand">Tridex Security Team</p>
            <p>This is an automated security notification. Please do not reply to this email.</p>
            <p>If you need assistance, please contact our support team.</p>
            <p>&copy; ${currentYear} Tridex. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`
  }

  private generateOTPEmailTemplate(
    code: string, 
    purpose: string, 
    expirationMinutes: number
  ): string {
    const purposeText = this.getPurposeText(purpose)
    const currentYear = new Date().getFullYear()
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verification Code</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4; }
        .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border-top: 4px solid #007bff; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 28px; font-weight: bold; color: #007bff; margin-bottom: 10px; }
        .otp-code { background: linear-gradient(135deg, #007bff, #0056b3); color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; margin: 30px 0; border-radius: 8px; letter-spacing: 6px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107; }
        .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #666; border-top: 1px solid #eee; padding-top: 20px; }
        .security-tips { background: #e8f4fd; border: 1px solid #bee5eb; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #17a2b8; }
        .security-tips h4 { margin-top: 0; color: #0c5460; }
        .security-tips ul { margin-bottom: 0; padding-left: 20px; }
        .security-tips li { margin-bottom: 5px; color: #0c5460; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🔐 TRIDEX</div>
            <h2>Verification Code Required</h2>
        </div>
        
        <p>Hello,</p>
        <p>${purposeText}</p>
        
        <div class="otp-code">${code}</div>
        
        <div class="warning">
            <strong>⏰ Important:</strong> This code will expire in <strong>${expirationMinutes} minutes</strong>. 
            Please use it as soon as possible.
        </div>

        <div class="security-tips">
            <h4>🛡️ Security Tips:</h4>
            <ul>
                <li>Never share this code with anyone</li>
                <li>Tridex will never ask for your verification code via phone or email</li>
                <li>If you didn't request this code, please ignore this email</li>
                <li>For security concerns, contact our support team</li>
            </ul>
        </div>
        
        <p>If you didn't request this verification code, please ignore this email or contact our support team if you have concerns about your account security.</p>
        
        <div class="footer">
            <p><strong>Tridex Support Team</strong></p>
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; ${currentYear} Tridex. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`
  }

  private getPurposeText(purpose: string): string {
    switch (purpose) {
      case 'login':
        return 'We received a request to sign in to your Tridex account. Please use the verification code below to complete your login:'
      case 'registration':
        return 'Welcome to Tridex! Please use the verification code below to verify your email address and complete your registration:'
      case 'password_reset':
        return 'We received a request to reset your password. Please use the verification code below to proceed with your password reset:'
      case 'email_verification':
        return 'Please verify your email address by using the code below:'
      case 'account_recovery':
        return 'We received a request for account recovery. Please use the verification code below to recover your account:'
      default:
        return 'Please use the verification code below to proceed:'
    }
  }
}

/**
 * Generate a secure 6-digit recovery code
 */
export function generateRecoveryCode(): string {
  return crypto.randomInt(100000, 999999).toString()
}

/**
 * Generate secure 6-digit OTP code
 */
export function generateOTPCode(): string {
  return crypto.randomInt(100000, 999999).toString()
}

/**
 * Generate secure device fingerprint
 */
export function generateDeviceFingerprint(userAgent: string, ipAddress: string): string {
  const data = `${userAgent}-${ipAddress}-${Date.now()}`
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16)
}

// Singleton instance
let emailService: EmailService

export function getEmailService(): EmailService {
  if (!emailService) {
    emailService = new BrevoEmailService()
  }
  return emailService
}

export function setEmailService(service: EmailService): void {
  emailService = service
}
