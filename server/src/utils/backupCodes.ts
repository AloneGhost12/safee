import crypto from 'crypto'

/**
 * Generate secure backup codes for 2FA recovery
 */
export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = []
  
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase()
    // Format as XXXX-XXXX for better readability
    const formattedCode = `${code.slice(0, 4)}-${code.slice(4, 8)}`
    codes.push(formattedCode)
  }
  
  return codes
}

/**
 * Validate backup code format
 */
export function isValidBackupCodeFormat(code: string): boolean {
  // Format: XXXX-XXXX (8 hex characters with dash)
  const pattern = /^[A-F0-9]{4}-[A-F0-9]{4}$/
  return pattern.test(code.toUpperCase())
}

/**
 * Normalize backup code for comparison
 */
export function normalizeBackupCode(code: string): string {
  return code.toUpperCase().replace(/\s+/g, '')
}
