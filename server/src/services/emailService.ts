import crypto from 'crypto'
import { hashPassword } from '../utils/crypto'

export interface EmailService {
  sendRecoveryCode(email: string, code: string, userName?: string): Promise<void>
  sendBackupCodesEmail(email: string, codes: string[], userName?: string): Promise<void>
}

/**
 * Mock email service for development
 * In production, replace with actual email service (SendGrid, AWS SES, etc.)
 */
export class MockEmailService implements EmailService {
  async sendRecoveryCode(email: string, code: string, userName?: string): Promise<void> {
    console.log(`
=== EMAIL RECOVERY CODE ===
To: ${email}
Subject: Personal Vault - Account Recovery Code
    
Hello ${userName || 'User'},

You requested account recovery for your Personal Vault account.

Your recovery code is: ${code}

This code will expire in 15 minutes.

If you didn't request this, please ignore this email.

Security tip: Never share this code with anyone.

Best regards,
Personal Vault Team
===========================
    `)
  }

  async sendBackupCodesEmail(email: string, codes: string[], userName?: string): Promise<void> {
    console.log(`
=== BACKUP CODES EMAIL ===
To: ${email}
Subject: Personal Vault - Your New Backup Codes
    
Hello ${userName || 'User'},

Your 2FA backup codes have been generated. Please save these securely:

${codes.map((code, index) => `${index + 1}. ${code}`).join('\n')}

IMPORTANT:
- Each code can only be used once
- Store these codes in a secure location
- Use these if you lose access to your authenticator app

Best regards,
Personal Vault Team
===========================
    `)
  }
}

/**
 * Generate a secure 6-digit recovery code
 */
export function generateRecoveryCode(): string {
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
    emailService = new MockEmailService()
  }
  return emailService
}

export function setEmailService(service: EmailService): void {
  emailService = service
}
