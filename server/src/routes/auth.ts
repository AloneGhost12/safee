import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { ObjectId } from 'mongodb'
import { usersCollection, User } from '../models/user'
import { sessionsCollection } from '../models/session'
import { emailRecoveryCodesCollection, cleanupExpiredRecoveryCodes } from '../models/emailRecovery'
import { authenticator } from 'otplib'
import { hashPassword, verifyPassword } from '../utils/crypto'
import { signAccess, signRefresh } from '../utils/jwt'
import { generateBackupCodes } from '../utils/backupCodes'
import { getEmailService, generateRecoveryCode } from '../services/emailService'
import { UserRole } from '../types/permissions'
import { SecurityManager } from '../utils/security'
import { 
  authRateLimit, 
  generalUserRateLimit,
  twoFAOperationsRateLimit,
  loginRateLimit, 
  authSlowDown, 
  validateInput, 
  validationSchemas,
  getClientIP 
} from '../middleware/security'
import { AuditLogger } from '../services/auditLogger'
import { asyncHandler } from '../middleware/errors'
import { requireAuth, AuthedRequest } from '../middleware/auth'

const router = Router()

// Validation schemas
const signupSchema = z.object({ 
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  email: validationSchemas.email,
  phoneNumber: z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number too long')
    .regex(/^[\+]?[1-9][\d]{0,15}$/, 'Invalid phone number format'),
  password: validationSchemas.password,
  viewPassword: validationSchemas.password.optional() // Optional view-only password
})

const loginSchema = z.object({ 
  identifier: z.string()
    .min(3, 'Identifier required')
    .max(100, 'Identifier too long'),
  password: z.string().min(1, 'Password required').max(128, 'Password too long')
})

const enable2FASchema = z.object({
  email: validationSchemas.email
})

const verify2FASchema = z.object({
  email: validationSchemas.email,
  code: validationSchemas.totpCode
})

const emailRecoverySchema = z.object({
  email: validationSchemas.email
})

const verifyEmailRecoverySchema = z.object({
  email: validationSchemas.email,
  code: z.string().length(6, 'Recovery code must be 6 digits').regex(/^\d{6}$/, 'Recovery code must be numeric')
})

const securityQuestionSchema = z.object({
  email: validationSchemas.email,
  questions: z.array(z.object({
    question: z.string().min(10, 'Question too short').max(200, 'Question too long'),
    answer: z.string().min(3, 'Answer too short').max(100, 'Answer too long')
  })).length(3, 'Exactly 3 security questions required')
})

const verifySecurityQuestionsSchema = z.object({
  email: validationSchemas.email,
  answers: z.array(z.string().min(1, 'Answer required')).length(3, 'All 3 answers required')
})

// Removed global rate limiter - now applied per route as needed
// router.use(authRateLimit)
// router.use(authSlowDown)

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
  const { username, email, phoneNumber, password, viewPassword } = req.body
  const auditLogger = AuditLogger.getInstance()
  const clientInfo = getClientInfo(req)
  
  try {
    const col = usersCollection()
    
    // Check if username, email, or phone number already exists
    const existing = await col.findOne({ 
      $or: [
        { email },
        { username: username.toLowerCase() },
        { phoneNumber }
      ]
    })
    
    if (existing) {
      let conflictField = 'Account'
      if (existing.email === email) conflictField = 'Email'
      else if (existing.username === username.toLowerCase()) conflictField = 'Username'
      else if (existing.phoneNumber === phoneNumber) conflictField = 'Phone number'
      
      await auditLogger.logAuth({
        action: 'signup',
        email,
        success: false,
        failureReason: `${conflictField} already exists`,
        ...clientInfo
      })
      return res.status(409).json({ error: `${conflictField} already exists` })
    }
    
    const passwordHash = await hashPassword(password)
    
    // Hash view password if provided
    let viewPasswordHash: string | undefined
    if (viewPassword && viewPassword.trim() !== '') {
      viewPasswordHash = await hashPassword(viewPassword)
    }
    
    const user: User = { 
      username: username.toLowerCase(),
      email, 
      phoneNumber,
      passwordHash, 
      argonSalt: '', 
      // Dual password support
      viewPasswordHash,
      viewArgonSalt: viewPasswordHash ? '' : undefined,
      userRole: UserRole.ADMIN, // Default to admin for account owner
      createdAt: new Date(),
      lastLoginAt: new Date(),
      failedLoginAttempts: 0,
      accountLocked: false,
      verificationStatus: {
        emailVerified: false,
        phoneVerified: false
      },
      securityEvents: [{
        eventType: 'login_success',
        timestamp: new Date(),
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        details: 'Account created and first login'
      }]
    }
    
    const result = await col.insertOne(user as any)
    const id = result.insertedId.toHexString()
    
    const access = signAccess({ 
      sub: id, 
      role: UserRole.ADMIN,
      userId: id 
    })
    const refresh = signRefresh({ 
      sub: id, 
      role: UserRole.ADMIN,
      userId: id 
    })
    
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
  const { identifier, password } = req.body
  const auditLogger = AuditLogger.getInstance()
  const clientInfo = getClientInfo(req)
  
  try {
    const col = usersCollection()
    // Search for user by username, email, or phone number
    const user = await col.findOne({
      $or: [
        { email: identifier },
        { username: identifier },
        { phoneNumber: identifier }
      ]
    })
    
    if (!user) {
      await auditLogger.logAuth({
        action: 'login_failure',
        email: identifier,
        success: false,
        failureReason: 'User not found',
        ...clientInfo
      })
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    
    // Check if account is locked using SecurityManager
    const isLocked = SecurityManager.isAccountLocked(user)
    if (isLocked) {
      await auditLogger.logAuth({
        action: 'login_failure',
        userId: user._id?.toHexString(),
        email: user.email,
        success: false,
        failureReason: 'Account locked',
        ...clientInfo
      })
      
      // Calculate remaining lockout time in seconds
      let retryAfter = 600 // Default to 10 minutes
      if (user.accountLockedUntil) {
        retryAfter = Math.max(0, Math.ceil((user.accountLockedUntil.getTime() - Date.now()) / 1000))
      }
      
      return res.status(423).json({ 
        error: 'Account temporarily locked due to suspicious activity',
        retryAfter,
        lockoutExpiresAt: user.accountLockedUntil
      })
    }
    
    // Check for unusual activity
    const isUnusual = await SecurityManager.detectUnusualActivity(user, req)
    if (isUnusual) {
      // Return special response requiring additional verification
      return res.status(418).json({ 
        error: 'Unusual activity detected',
        requiresEmergencyVerification: true,
        verificationRequired: ['username', 'email', 'phoneNumber']
      })
    }
    
    // Check both main password and view password
    const mainPasswordOk = await verifyPassword(user.passwordHash, password)
    let viewPasswordOk = false
    let loginRole = UserRole.ADMIN // Default to admin access
    
    // Check view password if main password fails and view password exists
    if (!mainPasswordOk && user.viewPasswordHash) {
      viewPasswordOk = await verifyPassword(user.viewPasswordHash, password)
      if (viewPasswordOk) {
        loginRole = UserRole.VIEWER
      }
    }
    
    if (!mainPasswordOk && !viewPasswordOk) {
      // Handle failed login with SecurityManager
      const isNowLocked = await SecurityManager.handleFailedLogin(user._id!.toHexString(), req)
      
      await auditLogger.logAuth({
        action: 'login_failure',
        userId: user._id?.toHexString(),
        email: user.email,
        success: false,
        failureReason: 'Invalid password',
        ...clientInfo
      })
      
      // If account is now locked, return 423 status
      if (isNowLocked) {
        const retryAfter = SecurityManager.getLockoutDurationMinutes() * 60 // Convert to seconds
        return res.status(423).json({ 
          error: 'Account locked due to repeated failed login attempts',
          retryAfter,
          lockoutMessage: `Account temporarily locked for ${SecurityManager.getLockoutDurationMinutes()} minutes due to security policy.`
        })
      }
      
      return res.status(401).json({ 
        error: 'Invalid credentials'
      })
    }
    
    // Check if 2FA is enabled
    if (user.twoFactorEnabled && user.totpSecret) {
      // Don't create session yet, just indicate 2FA is required
      await auditLogger.logAuth({
        action: 'login_attempt',
        userId: user._id!.toHexString(),
        email: user.email,
        success: true,
        ...clientInfo
      })
      
      return res.json({ 
        requires2FA: true,
        user: {
          id: user._id!.toHexString(),
          email: user.email,
          twoFactorEnabled: true
        }
      })
    }
    
    // Reset failed attempts on successful login and update user role
    await col.updateOne(
      { _id: user._id },
      { 
        $set: { 
          failedLoginAttempts: 0,
          accountLocked: false,
          lastLoginAt: new Date(),
          userRole: loginRole // Update the current login role
        }
      }
    )

    const id = user._id!.toHexString()
    
    // Create session first to get session ID
    const sessions = sessionsCollection()
    const sessionResult = await sessions.insertOne({ 
      userId: user._id, 
      refreshToken: '', // Will be updated after JWT creation
      createdAt: new Date(), 
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent
    })
    
    const sessionId = sessionResult.insertedId.toHexString()
    
    // Include session ID and role in JWT claims
    const access = signAccess({ 
      sub: id, 
      jti: sessionId,
      role: loginRole,
      userId: id // For backward compatibility
    })
    const refresh = signRefresh({ 
      sub: id, 
      jti: sessionId,
      role: loginRole,
      userId: id
    })    // Update session with refresh token
    await sessions.updateOne(
      { _id: sessionResult.insertedId },
      { $set: { refreshToken: refresh } }
    )
    
    res.cookie(
      process.env.SESSION_COOKIE_NAME || 'pv_sess', 
      refresh, 
      getSecureCookieOptions()
    )
    
    await auditLogger.logAuth({
      action: 'login_success',
      userId: id,
      email: user.email,
      success: true,
      ...clientInfo
    })
    
    res.json({ 
      access,
      user: {
        id,
        email: user.email,
        username: user.username,
        role: loginRole,
        twoFactorEnabled: false,
        permissions: require('../types/permissions').getUserPermissions(loginRole)
      }
    })
  } catch (error) {
    await auditLogger.logAuth({
      action: 'login_failure',
      email: identifier,
      success: false,
      failureReason: 'Internal error',
      ...clientInfo
    })
    console.error('Login error:', error)
    throw error
  }
}))

// Emergency verification endpoint for unusual activity
router.post('/verify-emergency', validateInput(z.object({
  email: z.string().email(),
  username: z.string().min(1),
  phoneNumber: z.string().min(1),
  password: z.string().min(1)
})), asyncHandler(async (req: Request, res: Response) => {
  const { email, username, phoneNumber, password } = req.body
  const auditLogger = AuditLogger.getInstance()
  const clientInfo = getClientInfo(req)
  
  try {
    const col = usersCollection()
    const user = await col.findOne({ email })
    
    if (!user) {
      await auditLogger.logAuth({
        action: 'emergency_verification_failure',
        email,
        success: false,
        failureReason: 'User not found',
        ...clientInfo
      })
      return res.status(401).json({ error: 'Invalid verification details' })
    }
    
    // Verify all emergency details using SecurityManager and password check
    const identityVerified = await SecurityManager.verifyUserIdentity(user._id!.toHexString(), {
      username,
      email,
      phoneNumber
    })
    
    const passwordVerified = await verifyPassword(user.passwordHash, password)
    
    if (!identityVerified || !passwordVerified) {
      await auditLogger.logAuth({
        action: 'emergency_verification_failure',
        userId: user._id?.toHexString(),
        email,
        success: false,
        failureReason: 'Identity verification failed',
        ...clientInfo
      })
      return res.status(401).json({ error: 'Identity verification failed' })
    }
    
    // Clear unusual activity flags and allow login
    await SecurityManager.clearUnusualActivityFlags(user._id!.toHexString())
    
    // Update verification timestamp
    await col.updateOne(
      { _id: user._id },
      { 
        $set: { 
          lastVerifiedAt: new Date(),
          lastLoginAt: new Date()
        }
      }
    )
    
    // Check if 2FA is enabled
    if (user.twoFactorEnabled && user.totpSecret) {
      await auditLogger.logAuth({
        action: 'emergency_verification_success_2fa_required',
        userId: user._id!.toHexString(),
        email,
        success: true,
        ...clientInfo
      })
      
      return res.json({ 
        requires2FA: true,
        user: {
          id: user._id!.toHexString(),
          email: user.email,
          twoFactorEnabled: true
        }
      })
    }
    
    // Create session directly after emergency verification
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
      action: 'emergency_verification_success',
      userId: user._id!.toHexString(),
      email: user.email,
      success: true,
      ...clientInfo
    })
    
    res.json({ 
      access,
      user: {
        id: user._id!.toHexString(),
        email: user.email,
        username: user.username,
        twoFactorEnabled: user.twoFactorEnabled || false
      }
    })
    
  } catch (error) {
    console.error('Emergency verification error:', error)
    res.status(500).json({ error: 'Internal server error' })
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

router.post('/logout', generalUserRateLimit, asyncHandler(async (req: Request, res: Response) => {
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
router.post('/2fa/login', validateInput(z.object({
  identifier: z.string().min(3, 'Identifier required').max(100, 'Identifier too long'),
  password: z.string().min(1, 'Password required').max(128, 'Password too long'),
  code: validationSchemas.totpCode
})), asyncHandler(async (req: Request, res: Response) => {
  const { identifier, password, code } = req.body
  const auditLogger = AuditLogger.getInstance()
  const clientInfo = getClientInfo(req)
  
  try {
    const col = usersCollection()
    // Search for user by username, email, or phone number
    const user = await col.findOne({
      $or: [
        { email: identifier },
        { username: identifier },
        { phoneNumber: identifier }
      ]
    })
    
    if (!user) {
      await auditLogger.logAuth({
        action: 'login_failure',
        email: identifier,
        success: false,
        failureReason: 'User not found',
        ...clientInfo
      })
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    
    // Verify password first
    const passwordOk = await verifyPassword(user.passwordHash, password)
    if (!passwordOk) {
      await auditLogger.logAuth({
        action: 'login_failure',
        userId: user._id?.toHexString(),
        email: user.email,
        success: false,
        failureReason: 'Invalid password',
        ...clientInfo
      })
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    
    // Check if 2FA is enabled and verify code
    if (!user.twoFactorEnabled || !user.totpSecret) {
      return res.status(400).json({ error: '2FA not enabled for this account' })
    }
    
    const codeOk = authenticator.check(code, user.totpSecret)
    if (!codeOk) {
      await auditLogger.log2FA({
        action: '2fa_verify_failure',
        userId: user._id!.toHexString(),
        success: false,
        code,
        ...clientInfo
      })
      return res.status(401).json({ error: 'Invalid verification code' })
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
      email: user.email,
      success: true,
      ...clientInfo
    })
    
    res.json({ 
      access,
      user: {
        id,
        email: user.email,
        username: user.username,
        twoFactorEnabled: true
      }
    })
  } catch (error) {
    await auditLogger.logAuth({
      action: 'login_failure',
      email: identifier,
      success: false,
      failureReason: 'Internal error',
      ...clientInfo
    })
    throw error
  }
}))

// TOTP endpoints with enhanced security
router.post('/2fa/enable', requireAuth, asyncHandler(async (req: AuthedRequest, res: Response) => {
  const userId = req.userId
  const auditLogger = AuditLogger.getInstance()
  const clientInfo = getClientInfo(req)
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  const col = usersCollection()
  const user = await col.findOne({ _id: new ObjectId(userId) })
  
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
    user.email, 
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

router.post('/2fa/verify', requireAuth, validateInput(z.object({
  code: validationSchemas.totpCode
})), asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { code } = req.body
  const userId = req.userId
  const auditLogger = AuditLogger.getInstance()
  const clientInfo = getClientInfo(req)
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  const col = usersCollection()
  const user = await col.findOne({ _id: new ObjectId(userId) })
  
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
  
  // Generate backup codes when 2FA is first enabled
  const backupCodes = generateBackupCodes(8)
  const backupCodesWithMetadata = backupCodes.map(code => ({
    code,
    used: false
  }))
  
  // Move temp secret to active and save backup codes
  await col.updateOne(
    { _id: user._id }, 
    { 
      $unset: { totpTempSecret: '' }, 
      $set: { 
        totpSecret: user.totpTempSecret,
        twoFactorEnabled: true,
        twoFactorEnabledAt: new Date(),
        backupCodes: backupCodesWithMetadata,
        backupCodesGenerated: new Date()
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
  
  res.json({ 
    ok: true, 
    backupCodes: backupCodes // Return codes so user can save them
  })
}))

router.post('/2fa/disable', requireAuth, asyncHandler(async (req: AuthedRequest, res: Response) => {
  const userId = req.userId
  const auditLogger = AuditLogger.getInstance()
  const clientInfo = getClientInfo(req)
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  const col = usersCollection()
  const user = await col.findOne({ _id: new ObjectId(userId) })
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }
  
  // Completely disable 2FA and remove all related data
  await col.updateOne(
    { _id: user._id }, 
    { 
      $unset: { 
        totpSecret: '',
        totpTempSecret: '',
        backupCodes: '',
        backupCodesGenerated: '',
        twoFactorEnabledAt: ''
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
  
  res.json({ 
    ok: true,
    message: '2FA has been completely disabled. You can now login with email OTP only.'
  })
}))

// Backup codes management
router.post('/2fa/backup-codes/regenerate', twoFAOperationsRateLimit, requireAuth, asyncHandler(async (req: AuthedRequest, res: Response) => {
  const userId = req.userId
  const auditLogger = AuditLogger.getInstance()
  const clientInfo = getClientInfo(req)
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  const col = usersCollection()
  const user = await col.findOne({ _id: new ObjectId(userId) })
  
  if (!user || !user.twoFactorEnabled) {
    return res.status(400).json({ error: '2FA not enabled' })
  }
  
  // Generate new backup codes
  const backupCodes = generateBackupCodes(8)
  const backupCodesWithMetadata = backupCodes.map(code => ({
    code,
    used: false
  }))
  
  await col.updateOne(
    { _id: user._id },
    {
      $set: {
        backupCodes: backupCodesWithMetadata,
        backupCodesGenerated: new Date()
      }
    }
  )
  
  await auditLogger.log2FA({
    action: '2fa_verify_success', // Using existing action
    userId: user._id!.toHexString(),
    success: true,
    code: 'backup_codes_regenerated',
    ...clientInfo
  })
  
  res.json({ backupCodes })
}))

// GET route for backup codes info (just counts, not actual codes)
router.get('/2fa/backup-codes', twoFAOperationsRateLimit, requireAuth, asyncHandler(async (req: AuthedRequest, res: Response) => {
  const userId = req.userId
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  const col = usersCollection()
  const user = await col.findOne({ _id: new ObjectId(userId) })
  
  if (!user || !user.twoFactorEnabled) {
    return res.status(400).json({ error: '2FA not enabled' })
  }
  
  // Return backup codes info without revealing actual codes
  const unusedCount = user.backupCodes?.filter(code => !code.used).length || 0
  const totalCount = user.backupCodes?.length || 0
  
  res.json({ 
    unusedCodesCount: unusedCount,
    totalCodes: totalCount,
    generated: user.backupCodesGenerated
  })
}))

router.post('/2fa/backup-codes', twoFAOperationsRateLimit, requireAuth, asyncHandler(async (req: AuthedRequest, res: Response) => {
  const userId = req.userId
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  const col = usersCollection()
  const user = await col.findOne({ _id: new ObjectId(userId) })
  
  if (!user || !user.twoFactorEnabled) {
    return res.status(400).json({ error: '2FA not enabled' })
  }
  
  // Return unused backup codes (don't show the actual codes for security)
  const unusedCount = user.backupCodes?.filter(code => !code.used).length || 0
  
  res.json({ 
    unusedCodesCount: unusedCount,
    totalCodes: user.backupCodes?.length || 0,
    generated: user.backupCodesGenerated
  })
}))

// Backup code login
router.post('/2fa/backup-login', validateInput(z.object({
  identifier: z.string().min(3, 'Identifier required').max(100, 'Identifier too long'),
  password: z.string().min(1, 'Password required').max(128, 'Password too long'),
  backupCode: z.string().min(1, 'Backup code required').max(20, 'Invalid backup code')
})), asyncHandler(async (req: Request, res: Response) => {
  const { identifier, password, backupCode } = req.body
  const auditLogger = AuditLogger.getInstance()
  const clientInfo = getClientInfo(req)
  
  try {
    const col = usersCollection()
    // Search for user by username, email, or phone number
    const user = await col.findOne({
      $or: [
        { email: identifier },
        { username: identifier },
        { phoneNumber: identifier }
      ]
    })
    
    if (!user) {
      await auditLogger.logAuth({
        action: 'login_failure',
        email: identifier,
        success: false,
        failureReason: 'User not found',
        ...clientInfo
      })
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    
    // Verify password first
    const passwordOk = await verifyPassword(user.passwordHash, password)
    if (!passwordOk) {
      await auditLogger.logAuth({
        action: 'login_failure',
        userId: user._id?.toHexString(),
        email: user.email,
        success: false,
        failureReason: 'Invalid password',
        ...clientInfo
      })
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    
    // Check if 2FA is enabled
    if (!user.twoFactorEnabled || !user.backupCodes) {
      return res.status(400).json({ error: 'Backup codes not available' })
    }
    
    // Find matching backup code
    const normalizedCode = backupCode.toUpperCase().replace(/\s+/g, '')
    const backupCodeEntry = user.backupCodes.find(code => 
      code.code === normalizedCode && !code.used
    )
    
    if (!backupCodeEntry) {
      await auditLogger.log2FA({
        action: '2fa_verify_failure',
        userId: user._id!.toHexString(),
        success: false,
        code: 'backup_code_invalid',
        ...clientInfo
      })
      return res.status(401).json({ error: 'Invalid or used backup code' })
    }
    
    // Mark backup code as used
    await col.updateOne(
      { 
        _id: user._id,
        'backupCodes.code': normalizedCode
      },
      {
        $set: {
          'backupCodes.$.used': true,
          'backupCodes.$.usedAt': new Date(),
          lastLoginAt: new Date(),
          failedLoginAttempts: 0,
          accountLocked: false
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
      email: user.email,
      success: true,
      ...clientInfo
    })
    
    // Check remaining backup codes
    const remainingCodes = user.backupCodes.filter(code => !code.used).length - 1
    
    res.json({ 
      access,
      user: {
        id,
        email: user.email,
        twoFactorEnabled: true
      },
      warningMessage: remainingCodes <= 2 ? 
        `Warning: Only ${remainingCodes} backup codes remaining. Consider generating new ones.` : 
        undefined
    })
  } catch (error) {
    await auditLogger.logAuth({
      action: 'login_failure',
      email: identifier,
      success: false,
      failureReason: 'Internal error',
      ...clientInfo
    })
    throw error
  }
}))

// Account Recovery Routes

// Request email recovery code
router.post('/recovery/email-code', validateInput(emailRecoverySchema), asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body
  const auditLogger = AuditLogger.getInstance()
  const clientInfo = getClientInfo(req)
  
  try {
    const col = usersCollection()
    const user = await col.findOne({ email })
    
    if (!user) {
      // Don't reveal if user exists, but log the attempt
      await auditLogger.logAuth({
        action: 'login_failure',
        email,
        success: false,
        failureReason: 'Recovery attempt for non-existent user',
        ...clientInfo
      })
      
      // Still return success to prevent email enumeration
      return res.json({ success: true, message: 'If this email exists, a recovery code has been sent.' })
    }

    // Rate limiting: max 3 recovery codes per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const recentCodes = await emailRecoveryCodesCollection().countDocuments({
      userId: user._id,
      createdAt: { $gte: oneHourAgo }
    })

    if (recentCodes >= 3) {
      return res.status(429).json({ error: 'Too many recovery attempts. Please try again in an hour.' })
    }

    // Generate and store recovery code
    const code = generateRecoveryCode()
    const codeHash = await hashPassword(code)
    
    await emailRecoveryCodesCollection().insertOne({
      userId: user._id!,
      email,
      code, // Store plaintext temporarily for email
      codeHash,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      createdAt: new Date(),
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent
    })

    // Send email
    const emailService = getEmailService()
    await emailService.sendRecoveryCode(email, code)

    // Clean up the plaintext code from database immediately after sending
    await emailRecoveryCodesCollection().updateOne(
      { userId: user._id, code },
      { $unset: { code: '' } }
    )

    await auditLogger.logAuth({
      action: 'login_attempt',
      userId: user._id.toHexString(),
      email,
      success: true,
      ...clientInfo
    })

    res.json({ success: true, message: 'Recovery code sent to your email.' })
  } catch (error) {
    console.error('Email recovery error:', error)
    res.status(500).json({ error: 'Failed to send recovery code.' })
  }
}))

// Verify email recovery code and allow 2FA bypass
router.post('/recovery/verify-email', validateInput(verifyEmailRecoverySchema), asyncHandler(async (req: Request, res: Response) => {
  const { email, code } = req.body
  const auditLogger = AuditLogger.getInstance()
  const clientInfo = getClientInfo(req)
  
  try {
    const col = usersCollection()
    const user = await col.findOne({ email })
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid recovery attempt.' })
    }

    // Find valid recovery code
    const recoveryCode = await emailRecoveryCodesCollection().findOne({
      userId: user._id,
      expiresAt: { $gt: new Date() },
      usedAt: { $exists: false }
    })

    if (!recoveryCode) {
      await auditLogger.logAuth({
        action: 'login_failure',
        userId: user._id!.toHexString(),
        email,
        success: false,
        failureReason: 'No valid recovery code found',
        ...clientInfo
      })
      return res.status(401).json({ error: 'Invalid or expired recovery code.' })
    }

    // Verify code
    const codeValid = await verifyPassword(recoveryCode.codeHash, code)
    if (!codeValid) {
      await auditLogger.logAuth({
        action: 'login_failure',
        userId: user._id!.toHexString(),
        email,
        success: false,
        failureReason: 'Invalid recovery code',
        ...clientInfo
      })
      return res.status(401).json({ error: 'Invalid recovery code.' })
    }

    // Mark code as used
    await emailRecoveryCodesCollection().updateOne(
      { _id: recoveryCode._id },
      { $set: { usedAt: new Date() } }
    )

    // Generate temporary bypass token (short-lived)
    const bypassToken = signAccess({ sub: user._id!.toHexString(), bypass2FA: true }, '10m')

    await auditLogger.logAuth({
      action: 'login_success',
      userId: user._id!.toHexString(),
      email,
      success: true,
      ...clientInfo
    })

    res.json({ 
      bypassToken, 
      message: 'Email verified. You can now disable 2FA or regenerate backup codes.',
      expiresIn: 600 // 10 minutes
    })
  } catch (error) {
    console.error('Email recovery verification error:', error)
    res.status(500).json({ error: 'Recovery verification failed.' })
  }
}))

// Setup security questions
router.post('/recovery/setup-questions', requireAuth, validateInput(z.object({
  questions: z.array(z.object({
    question: z.string().min(10, 'Question too short').max(200, 'Question too long'),
    answer: z.string().min(3, 'Answer too short').max(100, 'Answer too long')
  })).length(3, 'Exactly 3 security questions required')
})), asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { questions } = req.body
  const userId = req.userId
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  const col = usersCollection()
  const user = await col.findOne({ _id: new ObjectId(userId) })
  
  if (!user) {
    return res.status(404).json({ error: 'User not found.' })
  }

  // Hash security question answers
  console.log('Setting up security questions debug:')
  console.log('Questions received:', questions.length)
  
  const hashedQuestions = await Promise.all(
    questions.map(async (q: any, index: number) => {
      const normalizedAnswer = q.answer.toLowerCase().trim()
      console.log(`Question ${index + 1}: "${q.question}"`)
      console.log(`Original answer: "${q.answer}"`)
      console.log(`Normalized answer: "${normalizedAnswer}"`)
      
      const answerHash = await hashPassword(normalizedAnswer)
      console.log(`Answer hash: ${answerHash}`)
      
      return {
        question: q.question,
        answerHash,
        salt: 'security-questions-salt' // In production, use unique salts
      }
    })
  )

  await col.updateOne(
    { _id: user._id },
    { $set: { securityQuestions: hashedQuestions } }
  )

  res.json({ success: true, message: 'Security questions saved successfully.' })
}))

// Get security questions for recovery (without authentication for account recovery)
router.post('/recovery/get-questions', generalUserRateLimit, validateInput(z.object({
  email: validationSchemas.email
})), asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body
  
  const col = usersCollection()
  const user = await col.findOne({ email })
  
  if (!user || !user.securityQuestions || user.securityQuestions.length === 0) {
    // Don't reveal if user exists or has questions set up
    return res.json({ questions: [] })
  }

  // Return only the questions, not the answers
  const questions = user.securityQuestions.map(sq => sq.question)
  
  res.json({ questions })
}))

// Get security questions for authenticated user (Settings page)
router.get('/security-questions', generalUserRateLimit, requireAuth, asyncHandler(async (req: AuthedRequest, res: Response) => {
  const userId = req.userId
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  const col = usersCollection()
  const user = await col.findOne({ _id: new ObjectId(userId) })
  
  if (!user || !user.securityQuestions || user.securityQuestions.length === 0) {
    return res.json({ questions: [] })
  }

  // Return only the questions, not the answers
  const questions = user.securityQuestions.map(sq => sq.question)
  
  res.json({ questions })
}))

// Verify security questions for 2FA bypass
router.post('/recovery/verify-questions', validateInput(verifySecurityQuestionsSchema), asyncHandler(async (req: Request, res: Response) => {
  const { email, answers } = req.body
  const auditLogger = AuditLogger.getInstance()
  const clientInfo = getClientInfo(req)
  
  try {
    const col = usersCollection()
    const user = await col.findOne({ email })
    
    if (!user || !user.securityQuestions || user.securityQuestions.length !== 3) {
      return res.status(401).json({ error: 'Invalid recovery attempt.' })
    }

    // Verify all answers
    const allCorrect = await Promise.all(
      answers.map(async (answer: string, index: number) => {
        const normalizedAnswer = answer.toLowerCase().trim()
        console.log(`Verifying answer ${index + 1}: "${normalizedAnswer}" for question: "${user.securityQuestions![index].question}"`)
        const isCorrect = await verifyPassword(user.securityQuestions![index].answerHash, normalizedAnswer)
        console.log(`Answer ${index + 1} result:`, isCorrect)
        return isCorrect
      })
    )

    console.log('All answers verification results:', allCorrect)

    if (!allCorrect.every(correct => correct)) {
      await auditLogger.logAuth({
        action: 'login_failure',
        userId: user._id!.toHexString(),
        email,
        success: false,
        failureReason: 'Incorrect security question answers',
        ...clientInfo
      })
      return res.status(401).json({ error: 'Incorrect answers to security questions.' })
    }

    // Generate temporary bypass token
    const bypassToken = signAccess({ sub: user._id!.toHexString(), bypass2FA: true }, '10m')

    await auditLogger.logAuth({
      action: 'login_success',
      userId: user._id!.toHexString(),
      email,
      success: true,
      ...clientInfo
    })

    res.json({ 
      bypassToken, 
      message: 'Security questions verified. You can now disable 2FA or regenerate backup codes.',
      expiresIn: 600
    })
  } catch (error) {
    console.error('Security questions verification error:', error)
    res.status(500).json({ error: 'Recovery verification failed.' })
  }
}))

// Cleanup expired recovery codes (can be called periodically)
router.post('/recovery/cleanup', asyncHandler(async (req: Request, res: Response) => {
  await cleanupExpiredRecoveryCodes()
  res.json({ success: true, message: 'Cleanup completed.' })
}))

// Complete email-based login after OTP verification
router.post('/email-login', validateInput(z.object({
  email: validationSchemas.email
})), asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body
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
        failureReason: 'Account not found',
        ...clientInfo
      })
      return res.status(404).json({ 
        error: 'No account found with this email address' 
      })
    }

    // Check if user has 2FA enabled and if it's still required
    // Note: We double-check that 2FA is actually enabled since the user might have just disabled it
    if (user.twoFactorEnabled === true && user.totpSecret) {
      await auditLogger.logAuth({
        action: 'login_attempt',
        userId: user._id!.toHexString(),
        email,
        success: false,
        failureReason: '2FA required after email verification',
        ...clientInfo
      })
      
      return res.json({ 
        requires2FA: true,
        user: {
          id: user._id!.toHexString(),
          email: user.email,
          twoFactorEnabled: true
        }
      })
    }

    // Update user login info
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
    
    // Create session first to get session ID
    const sessions = sessionsCollection()
    const sessionResult = await sessions.insertOne({ 
      userId: user._id, 
      refreshToken: '', // Will be updated after JWT creation
      createdAt: new Date(), 
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent
    })
    
    const sessionId = sessionResult.insertedId.toHexString()
    
    // Include session ID in JWT claims
    const access = signAccess({ sub: id, jti: sessionId })
    const refresh = signRefresh({ sub: id, jti: sessionId })
    
    // Update session with refresh token
    await sessions.updateOne(
      { _id: sessionResult.insertedId },
      { $set: { refreshToken: refresh } }
    )
    
    res.cookie(
      process.env.SESSION_COOKIE_NAME || 'pv_sess', 
      refresh, 
      getSecureCookieOptions()
    )
    
    await auditLogger.logAuth({
      action: 'login_success',
      userId: id,
      email: user.email,
      success: true,
      ...clientInfo
    })
    
    res.json({ 
      access,
      user: {
        id,
        email: user.email,
        username: user.username,
        twoFactorEnabled: user.twoFactorEnabled || false
      }
    })
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

// Complete email-based login after OTP verification with 2FA
router.post('/email-login-2fa', validateInput(z.object({
  email: validationSchemas.email,
  code: z.string().min(6, 'TOTP code must be 6 digits').max(6, 'TOTP code must be 6 digits')
})), asyncHandler(async (req: Request, res: Response) => {
  const { email, code } = req.body
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
        failureReason: 'Account not found',
        ...clientInfo
      })
      return res.status(404).json({ 
        error: 'No account found with this email address' 
      })
    }

    // Verify that 2FA is enabled and user has TOTP secret
    if (!user.twoFactorEnabled || !user.totpSecret) {
      await auditLogger.logAuth({
        action: 'login_failure',
        userId: user._id!.toHexString(),
        email,
        success: false,
        failureReason: '2FA not enabled for email login',
        ...clientInfo
      })
      return res.status(400).json({ 
        error: '2FA is not enabled for this account' 
      })
    }

    // Verify TOTP code
    const verified = authenticator.check(code, user.totpSecret)

    if (!verified) {
      await auditLogger.logAuth({
        action: 'login_failure',
        userId: user._id!.toHexString(),
        email,
        success: false,
        failureReason: 'Invalid 2FA code for email login',
        ...clientInfo
      })
      return res.status(400).json({ 
        error: 'Invalid verification code' 
      })
    }

    // Update user login info
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
    
    // Create session first to get session ID
    const sessions = sessionsCollection()
    const sessionResult = await sessions.insertOne({ 
      userId: user._id, 
      refreshToken: '', // Will be updated after JWT creation
      createdAt: new Date(), 
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent
    })
    
    const sessionId = sessionResult.insertedId.toHexString()
    
    // Include session ID in JWT claims
    const access = signAccess({ sub: id, jti: sessionId })
    const refresh = signRefresh({ sub: id, jti: sessionId })
    
    // Update session with refresh token
    await sessions.updateOne(
      { _id: sessionResult.insertedId },
      { $set: { refreshToken: refresh } }
    )
    
    res.cookie(
      process.env.SESSION_COOKIE_NAME || 'pv_sess', 
      refresh, 
      getSecureCookieOptions()
    )
    
    await auditLogger.logAuth({
      action: 'login_success',
      userId: id,
      email: user.email,
      success: true,
      ...clientInfo
    })
    
    res.json({ 
      access,
      user: {
        id,
        email: user.email,
        username: user.username,
        twoFactorEnabled: user.twoFactorEnabled || false
      }
    })
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

// Verify account exists for email login
router.post('/verify-email', validateInput(z.object({
  email: validationSchemas.email
})), asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body
  const auditLogger = AuditLogger.getInstance()
  const clientInfo = getClientInfo(req)
  
  try {
    const col = usersCollection()
    const user = await col.findOne({ email })
    
    if (!user) {
      await auditLogger.logAuth({
        action: 'login_attempt',
        email,
        success: false,
        failureReason: 'Account not found',
        ...clientInfo
      })
      return res.status(404).json({ 
        exists: false,
        error: 'No account found with this email address' 
      })
    }

    await auditLogger.logAuth({
      action: 'login_attempt',
      userId: user._id!.toHexString(),
      email,
      success: true,
      ...clientInfo
    })

    res.json({ 
      exists: true,
      username: user.username
    })
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

// Check if registration data already exists (before email verification)
router.post('/check-registration', validateInput(z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  email: validationSchemas.email,
  phoneNumber: z.string().min(10).max(15).regex(/^[\+]?[1-9][\d]{0,15}$/)
})), asyncHandler(async (req: Request, res: Response) => {
  const { username, email, phoneNumber } = req.body
  const auditLogger = AuditLogger.getInstance()
  const clientInfo = getClientInfo(req)
  
  try {
    const col = usersCollection()
    
    // Check if username, email, or phone number already exists
    const existing = await col.findOne({ 
      $or: [
        { email },
        { username: username.toLowerCase() },
        { phoneNumber }
      ]
    })
    
    if (existing) {
      let conflictField = 'Account'
      let conflictType = 'account'
      if (existing.email === email) {
        conflictField = 'Email address'
        conflictType = 'email'
      } else if (existing.username === username.toLowerCase()) {
        conflictField = 'Username'
        conflictType = 'username'
      } else if (existing.phoneNumber === phoneNumber) {
        conflictField = 'Phone number'
        conflictType = 'phoneNumber'
      }
      
      await auditLogger.logAuth({
        action: 'signup',
        email,
        success: false,
        failureReason: `${conflictField} already exists`,
        ...clientInfo
      })
      
      return res.status(409).json({ 
        available: false,
        conflictType,
        error: `${conflictField} is already registered` 
      })
    }

    await auditLogger.logAuth({
      action: 'signup',
      email,
      success: true,
      failureReason: 'Registration data validated',
      ...clientInfo
    })

    res.json({ 
      available: true,
      message: 'Registration data is available'
    })
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

export default router
