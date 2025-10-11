import { Request, Response, NextFunction } from 'express'
import { verifyAccess } from '../utils/jwt'
import { sessionsCollection } from '../models/session'
import { usersCollection } from '../models/user'
import { ObjectId } from 'mongodb'

export interface AuthedRequest extends Request {
  userId?: string
  sessionId?: string
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization
    if (!auth) {
      console.log('❌ requireAuth: Missing authorization header')
      return res.status(401).json({ error: 'Missing auth' })
    }
    
    const [, token] = auth.split(' ')
    if (!token) {
      console.log('❌ requireAuth: Invalid authorization format')
      return res.status(401).json({ error: 'Invalid auth format' })
    }
    
    const payload = verifyAccess(token)
    if (payload && typeof payload === 'object' && 'sub' in payload) {
      req.userId = payload.sub as string
      console.log('✅ requireAuth: User authenticated:', req.userId)
      next()
    } else {
      console.log('❌ requireAuth: Invalid token payload or token verification failed')
      return res.status(401).json({ error: 'Invalid token payload' })
    }
  } catch (err) {
    console.error('❌ requireAuth: Exception:', err)
    return res.status(401).json({ error: 'Authentication failed' })
  }
}

/**
 * Enhanced authentication that validates both JWT and session existence
 */
export async function requireSessionAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization
    if (!auth) return res.status(401).json({ error: 'Missing auth' })
    
    const [, token] = auth.split(' ')
    const payload = verifyAccess(token)
    
    if (!payload || typeof payload !== 'object' || !('sub' in payload) || !('jti' in payload)) {
      console.log('❌ requireSessionAuth: Invalid token payload')
      return res.status(401).json({ error: 'Invalid token payload' })
    }

    const userId = payload.sub as string
    const sessionId = payload.jti as string

    // Check if session exists in database
    const sessions = sessionsCollection()
    const session = await sessions.findOne({ 
      _id: new ObjectId(sessionId),
      userId: new ObjectId(userId),
      expiresAt: { $gt: new Date() }
    })

    if (!session) {
      return res.status(401).json({ 
        error: 'Session invalid or expired',
        code: 'SESSION_REVOKED'
      })
    }

    // Check if user account is locked
    const users = usersCollection()
    const user = await users.findOne({ _id: new ObjectId(userId) })
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    if (user.accountLocked) {
      return res.status(423).json({ 
        error: 'Account locked',
        code: 'ACCOUNT_LOCKED'
      })
    }

    // Update session last used timestamp
    await sessions.updateOne(
      { _id: new ObjectId(sessionId) },
      { $set: { lastUsedAt: new Date() } }
    )

    req.userId = userId
    req.sessionId = sessionId
    next()
  } catch (err) {
    console.error('Session auth error:', err)
    res.status(401).json({ error: 'Authentication failed' })
  }
}
