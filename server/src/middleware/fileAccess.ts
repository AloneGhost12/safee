import { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

// Rate limiting for file operations
const fileOperationAttempts = new Map<string, { count: number; lastAttempt: number }>()

export const fileAccessRateLimit = (maxAttempts: number = 5, windowMs: number = 300000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).userId
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const key = `${userId}:${req.params.fileId}:${req.method}:${req.route?.path}`
    const now = Date.now()
    const userAttempts = fileOperationAttempts.get(key)

    if (userAttempts) {
      // Reset counter if window has passed
      if (now - userAttempts.lastAttempt > windowMs) {
        fileOperationAttempts.set(key, { count: 1, lastAttempt: now })
      } else if (userAttempts.count >= maxAttempts) {
        return res.status(429).json({ 
          error: 'Too many file access attempts. Please try again later.',
          retryAfter: Math.ceil((userAttempts.lastAttempt + windowMs - now) / 1000)
        })
      } else {
        userAttempts.count++
        userAttempts.lastAttempt = now
      }
    } else {
      fileOperationAttempts.set(key, { count: 1, lastAttempt: now })
    }

    next()
  }
}

// Enhanced password validation
export const validatePasswordStrength = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// Audit logging for file access
export interface FileAccessLog {
  userId: string
  fileId: string
  action: 'preview' | 'download' | 'upload' | 'delete'
  timestamp: Date
  ipAddress: string
  userAgent: string
  success: boolean
  errorMessage?: string
}

const auditLogs: FileAccessLog[] = []

export const logFileAccess = (
  userId: string,
  fileId: string,
  action: FileAccessLog['action'],
  req: Request,
  success: boolean,
  errorMessage?: string
) => {
  const log: FileAccessLog = {
    userId,
    fileId,
    action,
    timestamp: new Date(),
    ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    success,
    errorMessage
  }

  auditLogs.push(log)

  // Keep only last 10000 logs to prevent memory issues
  if (auditLogs.length > 10000) {
    auditLogs.splice(0, auditLogs.length - 10000)
  }

  // Log to console for now (in production, log to proper logging service)
  console.log(`File Access: ${JSON.stringify(log)}`)
}

export const getAuditLogs = (userId?: string, fileId?: string, limit: number = 100): FileAccessLog[] => {
  let filtered = auditLogs

  if (userId) {
    filtered = filtered.filter(log => log.userId === userId)
  }

  if (fileId) {
    filtered = filtered.filter(log => log.fileId === fileId)
  }

  return filtered
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit)
}

// Session validation for file operations
export const validateFileSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Add session timestamp validation
    const authHeader = req.headers.authorization
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' })
    }

    // In a real implementation, you would validate the JWT token here
    // and ensure it hasn't expired and is still valid

    next()
  } catch (error) {
    res.status(401).json({ error: 'Invalid session' })
  }
}

// Middleware to validate file operation requests
export const validateFileOperationRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.body)
      req.body = parsed
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        })
      }
      next(error)
    }
  }
}

// Schema for password-protected file operations
export const fileOperationSchema = z.object({
  password: z.string().min(1, 'Password is required'),
})

// Clean up old rate limit entries
setInterval(() => {
  const now = Date.now()
  const fiveMinutesAgo = now - 300000

  for (const [key, attempts] of fileOperationAttempts.entries()) {
    if (attempts.lastAttempt < fiveMinutesAgo) {
      fileOperationAttempts.delete(key)
    }
  }
}, 60000) // Clean up every minute
