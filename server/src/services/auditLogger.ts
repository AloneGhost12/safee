import { Collection, MongoClient, ObjectId } from 'mongodb'
import { getClient } from '../db'

export interface AuditLogEntry {
  _id?: ObjectId
  userId?: ObjectId
  action: string
  resource?: string
  details: Record<string, any>
  ipAddress: string
  userAgent: string
  timestamp: Date
  success: boolean
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  sessionId?: string
  location?: {
    country?: string
    city?: string
    isp?: string
  }
}

export function auditLogCollection(): Collection<AuditLogEntry> {
  return getClient().db().collection<AuditLogEntry>('audit_logs')
}

/**
 * Audit log service for security-sensitive operations
 */
export class AuditLogger {
  private static instance: AuditLogger
  private collection: Collection<AuditLogEntry>

  private constructor() {
    this.collection = auditLogCollection()
  }

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger()
    }
    return AuditLogger.instance
  }

  /**
   * Log authentication events
   */
  async logAuth(data: {
    action: 'login_attempt' | 'login_success' | 'login_failure' | 'logout' | 'signup' | 'password_reset' | 'emergency_verification_success' | 'emergency_verification_failure' | 'emergency_verification_success_2fa_required'
    userId?: string
    email?: string
    ipAddress: string
    userAgent: string
    success: boolean
    failureReason?: string
    sessionId?: string
  }): Promise<void> {
    const entry: AuditLogEntry = {
      userId: data.userId ? new ObjectId(data.userId) : undefined,
      action: data.action,
      resource: 'authentication',
      details: {
        email: data.email,
        failureReason: data.failureReason,
        sessionId: data.sessionId
      },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      timestamp: new Date(),
      success: data.success,
      riskLevel: this.assessAuthRisk(data.action, data.success),
      sessionId: data.sessionId
    }

    await this.collection.insertOne(entry)

    // Alert on suspicious activity
    if (entry.riskLevel === 'high' || entry.riskLevel === 'critical') {
      await this.alertSuspiciousActivity(entry)
    }
  }

  /**
   * Log 2FA events
   */
  async log2FA(data: {
    action: '2fa_enable' | '2fa_disable' | '2fa_verify_success' | '2fa_verify_failure'
    userId: string
    ipAddress: string
    userAgent: string
    success: boolean
    code?: string
  }): Promise<void> {
    const entry: AuditLogEntry = {
      userId: new ObjectId(data.userId),
      action: data.action,
      resource: '2fa',
      details: {
        codeLength: data.code?.length
      },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      timestamp: new Date(),
      success: data.success,
      riskLevel: data.action === '2fa_disable' ? 'medium' : 'low'
    }

    await this.collection.insertOne(entry)
  }

  /**
   * Log file operations
   */
  async logFileOperation(data: {
    action: 'file_upload' | 'file_download' | 'file_delete' | 'file_export'
    userId: string
    fileId?: string
    fileName?: string
    fileSize?: number
    ipAddress: string
    userAgent: string
    success: boolean
    errorMessage?: string
  }): Promise<void> {
    const entry: AuditLogEntry = {
      userId: new ObjectId(data.userId),
      action: data.action,
      resource: 'files',
      details: {
        fileId: data.fileId,
        fileName: data.fileName,
        fileSize: data.fileSize,
        errorMessage: data.errorMessage
      },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      timestamp: new Date(),
      success: data.success,
      riskLevel: data.action === 'file_export' ? 'medium' : 'low'
    }

    await this.collection.insertOne(entry)
  }

  /**
   * Log security events
   */
  async logSecurityEvent(data: {
    action: string
    userId?: string
    resource: string
    details: Record<string, any>
    ipAddress: string
    userAgent: string
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  }): Promise<void> {
    const entry: AuditLogEntry = {
      userId: data.userId ? new ObjectId(data.userId) : undefined,
      action: data.action,
      resource: data.resource,
      details: data.details,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      timestamp: new Date(),
      success: true,
      riskLevel: data.riskLevel
    }

    await this.collection.insertOne(entry)

    if (data.riskLevel === 'high' || data.riskLevel === 'critical') {
      await this.alertSuspiciousActivity(entry)
    }
  }

  /**
   * Get audit logs for a user
   */
  async getUserAuditLogs(userId: string, limit: number = 100): Promise<AuditLogEntry[]> {
    return await this.collection
      .find({ userId: new ObjectId(userId) })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray()
  }

  /**
   * Get security alerts
   */
  async getSecurityAlerts(limit: number = 50): Promise<AuditLogEntry[]> {
    return await this.collection
      .find({ 
        riskLevel: { $in: ['high', 'critical'] },
        timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray()
  }

  /**
   * Detect suspicious patterns
   */
  async detectSuspiciousActivity(ipAddress: string, timeWindow: number = 60 * 60 * 1000): Promise<boolean> {
    const recentFailures = await this.collection.countDocuments({
      ipAddress,
      action: { $in: ['login_failure', '2fa_verify_failure'] },
      timestamp: { $gte: new Date(Date.now() - timeWindow) }
    })

    return recentFailures >= 5 // 5 failures in the time window
  }

  /**
   * Clean old audit logs (for GDPR compliance)
   */
  async cleanOldLogs(retentionDays: number = 365): Promise<void> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    await this.collection.deleteMany({
      timestamp: { $lt: cutoffDate },
      riskLevel: { $in: ['low', 'medium'] } // Keep high-risk logs longer
    })
  }

  private assessAuthRisk(action: string, success: boolean): 'low' | 'medium' | 'high' | 'critical' {
    if (!success) {
      if (action === 'login_failure') return 'medium'
      if (action === '2fa_verify_failure') return 'medium'
    }
    
    if (action === 'password_reset') return 'medium'
    if (action === 'signup') return 'low'
    
    return 'low'
  }

  private async alertSuspiciousActivity(entry: AuditLogEntry): Promise<void> {
    // In production, this would send alerts to security team
    console.warn('SECURITY ALERT:', {
      action: entry.action,
      userId: entry.userId?.toString(),
      ipAddress: entry.ipAddress,
      riskLevel: entry.riskLevel,
      timestamp: entry.timestamp,
      details: entry.details
    })

    // Could integrate with:
    // - Email alerts
    // - Slack notifications
    // - SIEM systems
    // - Security monitoring tools
  }
}

/**
 * Middleware to automatically log requests
 */
export function auditMiddleware(action: string, resource: string) {
  return async (req: any, res: any, next: any) => {
    const auditLogger = AuditLogger.getInstance()
    const originalSend = res.send

    res.send = function(data: any) {
      const success = res.statusCode < 400

      // Log the operation
      auditLogger.logSecurityEvent({
        action,
        userId: req.userId,
        resource,
        details: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          responseSize: data?.length || 0
        },
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        riskLevel: success ? 'low' : 'medium'
      }).catch(console.error)

      return originalSend.call(this, data)
    }

    next()
  }
}
