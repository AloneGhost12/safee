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
    // @ts-ignore
    req.userId = (payload as any).sub
    next()
  } catch (err) {
    next(err)
  }
}
