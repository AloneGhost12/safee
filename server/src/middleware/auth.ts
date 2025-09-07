import { Request, Response, NextFunction } from 'express'
import { verifyAccess } from '../utils/jwt'

export interface AuthedRequest extends Request {
  userId?: string
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization
    if (!auth) return res.status(401).json({ error: 'Missing auth' })
    const [, token] = auth.split(' ')
    const payload = verifyAccess(token)
    if (payload && typeof payload === 'object' && 'sub' in payload) {
      req.userId = payload.sub as string
    } else {
      return res.status(401).json({ error: 'Invalid token payload' })
    }
    next()
  } catch (err) {
    next(err)
  }
}
