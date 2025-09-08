import { User, usersCollection } from '../models/user'
import { ObjectId } from 'mongodb'
import { getClientIP } from '../middleware/security'
import { Request } from 'express'

export interface SecurityEvent {
  eventType: 'login_success' | 'login_failure' | 'password_change' | 'unusual_activity' | 'account_locked' | 'account_unlocked'
  timestamp: Date
  ipAddress?: string
  userAgent?: string
  location?: string
  details?: string
}

export function getClientInfo(req: Request) {
  return {
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'] || 'Unknown'
  }
}

export class SecurityManager {
  private static readonly MAX_FAILED_ATTEMPTS = 5
  private static readonly LOCKOUT_DURATION_MINUTES = 5
  private static readonly UNUSUAL_ACTIVITY_THRESHOLD = 3

  /**
   * Check if account is currently locked
   */
  static isAccountLocked(user: User): boolean {
    if (!user.accountLocked) return false
    
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      return true
    }
    
    // Auto-unlock if lockout period has expired
    if (user.accountLockedUntil && user.accountLockedUntil <= new Date()) {
      this.unlockAccount(user._id!.toHexString())
      return false
    }
    
    return user.accountLocked || false
  }

  /**
   * Handle failed login attempt
   */
  static async handleFailedLogin(userId: string, req: Request): Promise<boolean> {
    const col = usersCollection()
    const user = await col.findOne({ _id: new ObjectId(userId) })
    
    if (!user) return false

    const failedAttempts = (user.failedLoginAttempts || 0) + 1
    const clientInfo = getClientInfo(req)
    
    // Log security event
    const securityEvent: SecurityEvent = {
      eventType: 'login_failure',
      timestamp: new Date(),
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      details: `Failed login attempt ${failedAttempts}/${this.MAX_FAILED_ATTEMPTS}`
    }

    let updateData: any = {
      $set: {
        failedLoginAttempts: failedAttempts,
        lastFailedLoginAt: new Date(),
        updatedAt: new Date()
      },
      $push: { securityEvents: securityEvent }
    }

    // Lock account if max attempts reached
    if (failedAttempts >= this.MAX_FAILED_ATTEMPTS) {
      const lockoutUntil = new Date(Date.now() + this.LOCKOUT_DURATION_MINUTES * 60 * 1000)
      
      updateData.$set = {
        ...updateData.$set,
        accountLocked: true,
        accountLockedUntil: lockoutUntil,
        accountLockedReason: `Account locked due to ${this.MAX_FAILED_ATTEMPTS} failed login attempts`
      }

      // Add account locked event
      const lockEvent: SecurityEvent = {
        eventType: 'account_locked',
        timestamp: new Date(),
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        details: `Account locked for ${this.LOCKOUT_DURATION_MINUTES} minutes`
      }
      
      updateData.$push = { securityEvents: { $each: [securityEvent, lockEvent] } }
    }

    await col.updateOne(
      { _id: new ObjectId(userId) },
      updateData
    )

    return failedAttempts >= this.MAX_FAILED_ATTEMPTS
  }

  /**
   * Handle successful login
   */
  static async handleSuccessfulLogin(userId: string, req: Request): Promise<void> {
    const col = usersCollection()
    const clientInfo = getClientInfo(req)
    
    // Check for unusual activity
    const user = await col.findOne({ _id: new ObjectId(userId) })
    if (user) {
      const isUnusual = await this.detectUnusualActivity(user, req)
      
      if (isUnusual) {
        await this.handleUnusualActivity(userId, req)
      }
    }

    const securityEvent: SecurityEvent = {
      eventType: 'login_success',
      timestamp: new Date(),
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent
    }

    await col.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          failedLoginAttempts: 0,
          lastLoginAt: new Date(),
          updatedAt: new Date()
        },
        $push: { securityEvents: securityEvent }
      }
    )
  }

  /**
   * Unlock account manually or automatically
   */
  static async unlockAccount(userId: string): Promise<void> {
    const col = usersCollection()
    
    const securityEvent: SecurityEvent = {
      eventType: 'account_unlocked',
      timestamp: new Date(),
      details: 'Account unlocked'
    }

    await col.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          accountLocked: false,
          failedLoginAttempts: 0,
          updatedAt: new Date()
        },
        $unset: {
          accountLockedUntil: '',
          accountLockedReason: ''
        },
        $push: { securityEvents: securityEvent }
      }
    )
  }

  /**
   * Clear unusual activity detection for a user (after emergency verification)
   */
  static async clearUnusualActivityFlags(userId: string): Promise<void> {
    const col = usersCollection()
    
    await col.updateOne(
      { _id: new ObjectId(userId) },
      { 
        $set: { 
          lastVerifiedAt: new Date(),
          updatedAt: new Date()
        }
      }
    )
  }

  /**
   * Detect unusual activity
   */
  static async detectUnusualActivity(user: User, req: Request): Promise<boolean> {
    const clientInfo = getClientInfo(req)
    
    // Don't trigger unusual activity detection for new accounts (less than 24 hours old)
    const accountAge = Date.now() - user.createdAt.getTime()
    const isNewAccount = accountAge < 24 * 60 * 60 * 1000 // 24 hours
    
    if (isNewAccount) {
      return false // Skip unusual activity detection for new accounts
    }

    // Skip if user was recently verified (within last 6 hours)
    if (user.lastVerifiedAt) {
      const timeSinceVerification = Date.now() - user.lastVerifiedAt.getTime()
      if (timeSinceVerification < 6 * 60 * 60 * 1000) { // 6 hours
        return false
      }
    }
    
    // Check recent login history (only successful logins)
    const recentEvents = user.securityEvents?.filter(
      event => 
        event.eventType === 'login_success' && 
        event.timestamp > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
    ) || []

    // Need at least 3 successful logins to establish a pattern
    if (recentEvents.length < 3) {
      return false
    }

    // Check for new IP address
    const knownIPs = recentEvents.map(event => event.ipAddress).filter(Boolean)
    const isNewIP = !knownIPs.includes(clientInfo.ipAddress)

    // Check for new user agent
    const knownUserAgents = recentEvents.map(event => event.userAgent).filter(Boolean)
    const isNewUserAgent = !knownUserAgents.includes(clientInfo.userAgent)

    // Check for rapid failed login attempts from different locations
    const recentFailures = user.securityEvents?.filter(
      event => 
        event.eventType === 'login_failure' && 
        event.timestamp > new Date(Date.now() - 2 * 60 * 60 * 1000) // Last 2 hours (increased from 1 hour)
    ) || []

    const hasMultipleFailures = recentFailures.length >= this.UNUSUAL_ACTIVITY_THRESHOLD

    // Only trigger if BOTH new IP AND new user agent with recent failures
    // OR if there are many recent failures (5+) from different IPs
    const differentFailureIPs = new Set(recentFailures.map(f => f.ipAddress).filter(Boolean))
    const hasFailuresFromMultipleIPs = differentFailureIPs.size >= 3

    return (isNewIP && isNewUserAgent && hasMultipleFailures) || hasFailuresFromMultipleIPs
  }

  /**
   * Handle unusual activity detection
   */
  static async handleUnusualActivity(userId: string, req: Request): Promise<void> {
    const col = usersCollection()
    const clientInfo = getClientInfo(req)
    
    const securityEvent: SecurityEvent = {
      eventType: 'unusual_activity',
      timestamp: new Date(),
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      details: 'Unusual login activity detected - additional verification required'
    }

    await col.updateOne(
      { _id: new ObjectId(userId) },
      {
        $push: { securityEvents: securityEvent },
        $set: { updatedAt: new Date() }
      }
    )
  }

  /**
   * Verify user identity for unusual activity
   */
  static async verifyUserIdentity(userId: string, verificationData: {
    username?: string
    email?: string
    phoneNumber?: string
  }): Promise<boolean> {
    const col = usersCollection()
    const user = await col.findOne({ _id: new ObjectId(userId) })
    
    if (!user) return false

    // Check all provided fields match
    const checks: boolean[] = []
    
    if (verificationData.username) {
      checks.push(user.username.toLowerCase() === verificationData.username.toLowerCase())
    }
    
    if (verificationData.email) {
      checks.push(user.email.toLowerCase() === verificationData.email.toLowerCase())
    }
    
    if (verificationData.phoneNumber) {
      // Normalize phone numbers (remove spaces, dashes, etc.)
      const normalizePhone = (phone: string) => phone.replace(/\D/g, '')
      checks.push(normalizePhone(user.phoneNumber) === normalizePhone(verificationData.phoneNumber))
    }

    // All provided checks must pass
    return checks.length > 0 && checks.every(check => check === true)
  }

  /**
   * Get security status for user
   */
  static getSecurityStatus(user: User): {
    isLocked: boolean
    lockoutTimeRemaining?: number
    failedAttempts: number
    maxAttempts: number
    recentSecurityEvents: SecurityEvent[]
  } {
    const isLocked = this.isAccountLocked(user)
    const lockoutTimeRemaining = user.accountLockedUntil ? 
      Math.max(0, user.accountLockedUntil.getTime() - Date.now()) : undefined

    const recentEvents = user.securityEvents?.filter(
      event => event.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    ) || []

    return {
      isLocked,
      lockoutTimeRemaining,
      failedAttempts: user.failedLoginAttempts || 0,
      maxAttempts: this.MAX_FAILED_ATTEMPTS,
      recentSecurityEvents: recentEvents.slice(-10) // Last 10 events
    }
  }
}
