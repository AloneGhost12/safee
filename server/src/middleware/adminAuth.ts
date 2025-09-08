import { Request, Response, NextFunction } from 'express'
import { verifyAccess } from '../utils/jwt'
import { usersCollection } from '../models/user'
import { ObjectId } from 'mongodb'

export interface AdminRequest extends Request {
  userId?: string
  userRole?: string
  adminPermissions?: string[]
}

/**
 * Middleware to verify admin authentication and authorization
 */
export const requireAdmin = (requiredPermissions: string[] = []) => {
  return async (req: AdminRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization
      
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Admin access token required' })
      }

      const token = authHeader.substring(7)
      const payload = verifyAccess(token)
      
      if (!payload?.sub || typeof payload.sub !== 'string') {
        return res.status(401).json({ error: 'Invalid admin token' })
      }

      // Get user from database to check admin status
      const users = usersCollection()
      const user = await users.findOne({ _id: new ObjectId(payload.sub) })
      
      if (!user) {
        return res.status(401).json({ error: 'Admin user not found' })
      }

      // Check if user has admin role
      if (!user.role || !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ error: 'Admin privileges required' })
      }

      // Check specific permissions if required
      if (requiredPermissions.length > 0) {
        const userPermissions = user.adminPermissions || []
        const hasPermission = user.role === 'super_admin' || 
          requiredPermissions.every(perm => userPermissions.includes(perm))
        
        if (!hasPermission) {
          return res.status(403).json({ 
            error: 'Insufficient admin permissions',
            required: requiredPermissions
          })
        }
      }

      // Add user info to request
      req.userId = user._id!.toHexString()
      req.userRole = user.role
      req.adminPermissions = user.adminPermissions || []

      next()
    } catch (error) {
      console.error('Admin auth error:', error)
      res.status(401).json({ error: 'Invalid admin authentication' })
    }
  }
}

/**
 * Admin permission constants
 */
export const AdminPermissions = {
  USER_MANAGEMENT: 'user_management',
  SECURITY_MONITORING: 'security_monitoring',
  SYSTEM_ADMIN: 'system_admin',
  AUDIT_LOGS: 'audit_logs',
  USER_UNLOCK: 'user_unlock',
  DATA_EXPORT: 'data_export',
  SYSTEM_CONFIG: 'system_config'
} as const

/**
 * Check if user is super admin
 */
export const requireSuperAdmin = requireAdmin()

/**
 * Specific permission middlewares
 */
export const requireUserManagement = requireAdmin([AdminPermissions.USER_MANAGEMENT])
export const requireSecurityMonitoring = requireAdmin([AdminPermissions.SECURITY_MONITORING])
export const requireSystemAdmin = requireAdmin([AdminPermissions.SYSTEM_ADMIN])
export const requireAuditAccess = requireAdmin([AdminPermissions.AUDIT_LOGS])
