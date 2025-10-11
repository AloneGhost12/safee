import { Request, Response, NextFunction } from 'express'
import { UserRole, hasPermission, UserPermissions } from '../types/permissions'
import { verifyAccess } from '../utils/jwt'
import { usersCollection } from '../models/user'
import { ObjectId } from 'mongodb'

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string
    username: string
    role: UserRole
    permissions: UserPermissions
  }
}

// Middleware to check if user has specific permission
export function requirePermission(permission: keyof UserPermissions) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies.authToken || req.headers.authorization?.replace('Bearer ', '')
      
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const decoded = verifyAccess(token) as any
      if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' })
      }

      const user = await usersCollection().findOne({ _id: new ObjectId(decoded.userId) })
      if (!user) {
        return res.status(401).json({ error: 'User not found' })
      }

      const userRole = user.userRole || UserRole.ADMIN // Default to admin for existing users
      
      if (!hasPermission(userRole, permission)) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: permission,
          userRole: userRole
        })
      }

      // Add user info to request
      req.user = {
        userId: decoded.userId,
        username: user.username,
        role: userRole,
        permissions: require('../types/permissions').getUserPermissions(userRole)
      }

      next()
    } catch (error) {
      console.error('Permission check error:', error)
      res.status(500).json({ error: 'Permission check failed' })
    }
  }
}

// Middleware to check if user is admin (full access)
export const requireAdmin = requirePermission('canAccessSettings')

// Middleware to check upload permission
export const requireUpload = requirePermission('canUpload')

// Middleware to check download permission  
export const requireDownload = requirePermission('canDownload')

// Middleware to check delete permission
export const requireDelete = requirePermission('canDelete')

// General auth middleware that adds user info without permission check
export async function addUserInfo(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const token = req.cookies.authToken || req.headers.authorization?.replace('Bearer ', '')
    
    if (token) {
      const decoded = verifyAccess(token) as any
      if (decoded) {
        const user = await usersCollection().findOne({ _id: new ObjectId(decoded.userId) })
        if (user) {
          const userRole = user.userRole || UserRole.ADMIN
          req.user = {
            userId: decoded.userId,
            username: user.username,
            role: userRole,
            permissions: require('../types/permissions').getUserPermissions(userRole)
          }
        }
      }
    }
    
    next()
  } catch (error) {
    // Continue without user info if there's an error
    next()
  }
}