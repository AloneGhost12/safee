import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { usersCollection, User } from '../models/user'
import { sessionsCollection } from '../models/session'
import { authenticator } from 'otplib'
import { hashPassword, verifyPassword } from '../utils/crypto'
import { signAccess, signRefresh } from '../utils/jwt'
import { 
  authRateLimit, 
  loginRateLimit, 
  authSlowDown, 
  validateInput, 
  validationSchemas,
  getClientIP 
} from '../middleware/security'
import { AuditLogger } from '../services/auditLogger'
import { asyncHandler } from '../middleware/errors'

const router = Router()

// Validation schemas
const signupSchema = z.object({ 
  email: validationSchemas.email,
  password: validationSchemas.password
})

const loginSchema = z.object({ 
  email: validationSchemas.email,
  password: z.string().min(1, 'Password required').max(128, 'Password too long')
})

const enable2FASchema = z.object({
  email: validationSchemas.email
})

const verify2FASchema = z.object({
  email: validationSchemas.email,
  code: validationSchemas.totpCode
})

// Apply rate limiting and validation to all auth routes
router.use(authRateLimit)
router.use(authSlowDown)

/**
 * Secure cookie configuration
 */
function getSecureCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production'
  
  return {
    httpOnly: true,
    secure: isProduction, // Only send over HTTPS in production
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    ...(isProduction && { domain: process.env.COOKIE_DOMAIN })
  }
}

/**
 * Get client information for audit logging
 */
function getClientInfo(req: Request) {
  return {
    ipAddress: getClientIP(req),
    userAgent: req.get('User-Agent') || 'unknown'
  }
}

router.post('/signup', validateInput(signupSchema), asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body
  const auditLogger = AuditLogger.getInstance()
  const clientInfo = getClientInfo(req)
  
  try {
    const col = usersCollection()
    const existing = await col.findOne({ email })
    
    if (existing) {
      await auditLogger.logAuth({
        action: 'signup',
        email,
        success: false,
        failureReason: 'User already exists',
        ...clientInfo
      })
      return res.status(409).json({ error: 'Account already exists' })
    }
    
    const passwordHash = await hashPassword(password)
    const user: User = { 
      email, 
      passwordHash, 
      argonSalt: '', 
      createdAt: new Date(),
      lastLoginAt: new Date(),
      failedLoginAttempts: 0,
      accountLocked: false
    }
    
    const result = await col.insertOne(user as any)
    const id = result.insertedId.toHexString()
    
    const access = signAccess({ sub: id })
    const refresh = signRefresh({ sub: id })
    
    const sessions = sessionsCollection()
    await sessions.insertOne({ 
      userId: result.insertedId, 
      refreshToken: refresh, 
      createdAt: new Date(), 
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent
    })
    
    res.cookie(
      process.env.SESSION_COOKIE_NAME || 'pv_sess', 
      refresh, 
      getSecureCookieOptions()
    )
    
    await auditLogger.logAuth({
      action: 'signup',
      userId: id,
      email,
      success: true,
      ...clientInfo
    })
    
    res.json({ access })
  } catch (error) {
    await auditLogger.logAuth({
      action: 'signup',
      email,
      success: false,
      failureReason: 'Internal error',
      ...clientInfo
    })
    throw error
  }
}))

router.post('/login', loginRateLimit, validateInput(loginSchema), asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body
  const auditLogger = AuditLogger.getInstance()
  const clientInfo = getClientInfo(req)
  
  try {
    const col = usersCollection()
    const user = await col.findOne({ email })
    
    if (!user) {
      await auditLogger.logAuth({
        action: 'login_failure',
        email,
        success: false,
        failureReason: 'User not found',
        ...clientInfo
      })
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    
    // Check if account is locked
    if (user.accountLocked) {
      await auditLogger.logAuth({
        action: 'login_failure',
        userId: user._id?.toHexString(),
        email,
        success: false,
        failureReason: 'Account locked',
        ...clientInfo
      })
      return res.status(423).json({ error: 'Account temporarily locked due to suspicious activity' })
    }
    
    const ok = await verifyPassword(user.passwordHash, password)
    
    if (!ok) {
      // Increment failed login attempts
      const failedAttempts = (user.failedLoginAttempts || 0) + 1
      const shouldLock = failedAttempts >= 5
      
      await col.updateOne(
        { _id: user._id },
        { 
          $set: { 
            failedLoginAttempts: failedAttempts,
            accountLocked: shouldLock,
            lastFailedLoginAt: new Date()
          }
        }
      )
      
      await auditLogger.logAuth({
        action: 'login_failure',
        userId: user._id?.toHexString(),
        email,
        success: false,
        failureReason: 'Invalid password',
        ...clientInfo
      })
      
      return res.status(401).json({ 
        error: 'Invalid credentials',
        ...(shouldLock && { lockoutMessage: 'Account locked due to repeated failures' })
      })
    }
    
    // Reset failed attempts on successful login
    await col.updateOne(
      { _id: user._id },
      { 
        $set: { 
          failedLoginAttempts: 0,
          accountLocked: false,
          lastLoginAt: new Date()
        }
      }
    )
    
    const id = user._id!.toHexString()
    const access = signAccess({ sub: id })
    const refresh = signRefresh({ sub: id })
    
    const sessions = sessionsCollection()
    await sessions.insertOne({ 
      userId: user._id, 
      refreshToken: refresh, 
      createdAt: new Date(), 
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent
    })
    
    res.cookie(
      process.env.SESSION_COOKIE_NAME || 'pv_sess', 
      refresh, 
      getSecureCookieOptions()
    )
    
    await auditLogger.logAuth({
      action: 'login_success',
      userId: id,
      email,
      success: true,
      ...clientInfo
    })
    
    res.json({ access })
  } catch (error) {
    await auditLogger.logAuth({
      action: 'login_failure',
      email,
      success: false,
      failureReason: 'Internal error',
      ...clientInfo
    })
    throw error
  }
}))

router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[process.env.SESSION_COOKIE_NAME || 'pv_sess']
  const clientInfo = getClientInfo(req)
  
  if (!token) {
    return res.status(401).json({ error: 'No refresh token' })
  }
  
  const sessions = sessionsCollection()
  const session = await sessions.findOne({ refreshToken: token })
  
  if (!session) {
    return res.status(401).json({ error: 'Invalid session' })
  }
  
  // Check if session is expired
  if (session.expiresAt < new Date()) {
    await sessions.deleteOne({ _id: session._id })
    return res.status(401).json({ error: 'Session expired' })
  }
  
  // Generate new tokens
  const newRefresh = signRefresh({ sub: session.userId.toHexString() })
  const access = signAccess({ sub: session.userId.toHexString() })
  
  // Update session with new token and extend expiry
  await sessions.updateOne(
    { _id: session._id }, 
    { 
      $set: { 
        refreshToken: newRefresh, 
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        lastUsedAt: new Date(),
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent
      } 
    }
  )
  
  res.cookie(
    process.env.SESSION_COOKIE_NAME || 'pv_sess', 
    newRefresh, 
    getSecureCookieOptions()
  )
  
  res.json({ access })
}))

router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[process.env.SESSION_COOKIE_NAME || 'pv_sess']
  const auditLogger = AuditLogger.getInstance()
  const clientInfo = getClientInfo(req)
  
  if (token) {
    const sessions = sessionsCollection()
    const session = await sessions.findOne({ refreshToken: token })
    
    if (session) {
      await auditLogger.logAuth({
        action: 'logout',
        userId: session.userId.toHexString(),
        success: true,
        ...clientInfo
      })
    }
    
    await sessions.deleteOne({ refreshToken: token })
    res.clearCookie(
      process.env.SESSION_COOKIE_NAME || 'pv_sess', 
      { path: '/' }
    )
  }
  
  res.json({ ok: true })
}))

// TOTP endpoints with enhanced security
router.post('/2fa/enable', validateInput(enable2FASchema), asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body
  const auditLogger = AuditLogger.getInstance()
  const clientInfo = getClientInfo(req)
  
  const col = usersCollection()
  const user = await col.findOne({ email })
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }
  
  const secret = authenticator.generateSecret()
  
  // Save temporarily to user record
  await col.updateOne(
    { _id: user._id }, 
    { $set: { totpTempSecret: secret } }
  )
  
  const token = authenticator.keyuri(
    email, 
    process.env.VITE_APP_NAME || 'PersonalVault', 
    secret
  )
  
  await auditLogger.log2FA({
    action: '2fa_enable',
    userId: user._id!.toHexString(),
    success: true,
    ...clientInfo
  })
  
  res.json({ otpauth_url: token })
}))

router.post('/2fa/verify', validateInput(verify2FASchema), asyncHandler(async (req: Request, res: Response) => {
  const { email, code } = req.body
  const auditLogger = AuditLogger.getInstance()
  const clientInfo = getClientInfo(req)
  
  const col = usersCollection()
  const user = await col.findOne({ email })
  
  if (!user || !user.totpTempSecret) {
    await auditLogger.log2FA({
      action: '2fa_verify_failure',
      userId: user?._id?.toHexString() || '',
      success: false,
      code,
      ...clientInfo
    })
    return res.status(400).json({ error: 'Invalid request' })
  }
  
  const ok = authenticator.check(code, user.totpTempSecret)
  
  if (!ok) {
    await auditLogger.log2FA({
      action: '2fa_verify_failure',
      userId: user._id!.toHexString(),
      success: false,
      code,
      ...clientInfo
    })
    return res.status(400).json({ error: 'Invalid verification code' })
  }
  
  // Move temp secret to active
  await col.updateOne(
    { _id: user._id }, 
    { 
      $unset: { totpTempSecret: '' }, 
      $set: { 
        totpSecret: user.totpTempSecret,
        twoFactorEnabled: true,
        twoFactorEnabledAt: new Date()
      } 
    }
  )
  
  await auditLogger.log2FA({
    action: '2fa_verify_success',
    userId: user._id!.toHexString(),
    success: true,
    code,
    ...clientInfo
  })
  
  res.json({ ok: true })
}))

router.post('/2fa/disable', validateInput(enable2FASchema), asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body
  const auditLogger = AuditLogger.getInstance()
  const clientInfo = getClientInfo(req)
  
  const col = usersCollection()
  const user = await col.findOne({ email })
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }
  
  await col.updateOne(
    { email }, 
    { 
      $unset: { 
        totpSecret: '',
        totpTempSecret: ''
      },
      $set: {
        twoFactorEnabled: false,
        twoFactorDisabledAt: new Date()
      }
    }
  )
  
  await auditLogger.log2FA({
    action: '2fa_disable',
    userId: user._id!.toHexString(),
    success: true,
    ...clientInfo
  })
  
  res.json({ ok: true })
}))

export default router
