import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { ObjectId } from 'mongodb'
import { validateInput } from '../middleware/security'
import { asyncHandler } from '../middleware/errors'
import { 
  requireAdmin, 
  requireUserManagement, 
  requireSecurityMonitoring, 
  requireSystemAdmin,
  requireAuditAccess,
  AdminRequest,
  AdminPermissions 
} from '../middleware/adminAuth'
import { usersCollection } from '../models/user'
import { sessionsCollection } from '../models/session'
import { filesCollection } from '../models/file'
import { AuditLogger } from '../services/auditLogger'
import { SecurityManager } from '../utils/security'

const router = Router()

// Admin Dashboard Stats
router.get('/stats', requireAdmin(), asyncHandler(async (req: AdminRequest, res: Response) => {
  const users = usersCollection()
  const sessions = sessionsCollection()
  const files = filesCollection()
  
  const [
    totalUsers,
    activeUsers,
    lockedUsers,
    totalFiles,
    activeSessions,
    recentSignups
  ] = await Promise.all([
    users.countDocuments(),
    users.countDocuments({ lastLoginAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
    users.countDocuments({ accountLocked: true }),
    files.countDocuments(),
    sessions.countDocuments({ expiresAt: { $gt: new Date() } }),
    users.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } })
  ])

  res.json({
    totalUsers,
    activeUsers,
    lockedUsers,
    totalFiles,
    activeSessions,
    recentSignups,
    timestamp: new Date()
  })
}))

// User Management
router.get('/users', requireUserManagement, validateInput(z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  search: z.string().optional(),
  filter: z.enum(['all', 'active', 'locked', 'admin']).optional().default('all')
})), asyncHandler(async (req: AdminRequest, res: Response) => {
  const { page, limit, search, filter } = req.query as any
  const users = usersCollection()
  
  // Parse pagination with proper defaults and validation
  const pageNum = Math.max(1, parseInt(page) || 1)
  const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 10))
  const skip = (pageNum - 1) * limitNum
  
  const query: any = {}
  
  // Apply filters
  if (filter === 'active') {
    query.lastLoginAt = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  } else if (filter === 'locked') {
    query.accountLocked = true
  } else if (filter === 'admin') {
    query.role = { $in: ['admin', 'super_admin'] }
  }
  
  // Apply search
  if (search) {
    query.$or = [
      { email: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } }
    ]
  }
  
  const [userList, total] = await Promise.all([
    users.find(query)
      .project({ 
        passwordHash: 0, 
        argonSalt: 0, 
        totpSecret: 0, 
        wrappedDEK: 0, 
        dekSalt: 0 
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray(),
    users.countDocuments(query)
  ])
  
  res.json({
    users: userList,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum)
  })
}))

// Get specific user details
router.get('/users/:userId', requireUserManagement, asyncHandler(async (req: AdminRequest, res: Response) => {
  const { userId } = req.params
  const users = usersCollection()
  
  const user = await users.findOne(
    { _id: new ObjectId(userId) },
    { 
      projection: { 
        passwordHash: 0, 
        argonSalt: 0, 
        totpSecret: 0, 
        wrappedDEK: 0, 
        dekSalt: 0 
      } 
    }
  )
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }
  
  res.json(user)
}))

// Lock/Unlock User Account
router.post('/users/:userId/lock', requireUserManagement, validateInput(z.object({
  reason: z.string().min(1),
  duration: z.number().optional() // Duration in minutes
})), asyncHandler(async (req: AdminRequest, res: Response) => {
  const { userId } = req.params
  const { reason, duration } = req.body
  const users = usersCollection()
  
  const lockUntil = duration ? new Date(Date.now() + duration * 60 * 1000) : undefined
  
  await users.updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        accountLocked: true,
        accountLockedUntil: lockUntil,
        accountLockedReason: reason,
        updatedAt: new Date()
      }
    }
  )
  
  const auditLogger = AuditLogger.getInstance()
  await auditLogger.logAdmin({
    action: 'user_account_locked',
    adminId: req.userId!,
    targetUserId: userId,
    details: { reason, duration },
    ipAddress: req.ip || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown'
  })
  
  res.json({ success: true, message: 'User account locked' })
}))

router.post('/users/:userId/unlock', requireUserManagement, asyncHandler(async (req: AdminRequest, res: Response) => {
  const { userId } = req.params
  const users = usersCollection()
  
  await users.updateOne(
    { _id: new ObjectId(userId) },
    {
      $unset: {
        accountLocked: 1,
        accountLockedUntil: 1,
        accountLockedReason: 1
      },
      $set: { updatedAt: new Date() }
    }
  )
  
  // Clear unusual activity flags
  await SecurityManager.clearUnusualActivityFlags(userId)
  
  const auditLogger = AuditLogger.getInstance()
  await auditLogger.logAdmin({
    action: 'user_account_unlocked',
    adminId: req.userId!,
    targetUserId: userId,
    ipAddress: req.ip || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown'
  })
  
  res.json({ success: true, message: 'User account unlocked' })
}))

// Security Events Monitoring
router.get('/security/events', requireSecurityMonitoring, validateInput(z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('50'),
  eventType: z.string().optional(),
  userId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
})), asyncHandler(async (req: AdminRequest, res: Response) => {
  const { page, limit, eventType, userId, startDate, endDate } = req.query as any
  const users = usersCollection()
  
  // Parse pagination with proper defaults and validation
  const pageNum = Math.max(1, parseInt(page) || 1)
  const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 50))
  
  const matchStage: any = {}
  
  if (userId) matchStage._id = new ObjectId(userId)
  if (eventType) matchStage['securityEvents.eventType'] = eventType
  
  const dateFilter: any = {}
  if (startDate) dateFilter.$gte = new Date(startDate)
  if (endDate) dateFilter.$lte = new Date(endDate)
  if (Object.keys(dateFilter).length > 0) {
    matchStage['securityEvents.timestamp'] = dateFilter
  }
  
  const pipeline = [
    { $match: matchStage },
    { $unwind: '$securityEvents' },
    { $match: eventType ? { 'securityEvents.eventType': eventType } : {} },
    { $sort: { 'securityEvents.timestamp': -1 } },
    { $skip: (pageNum - 1) * limitNum },
    { $limit: limitNum },
    {
      $project: {
        userId: '$_id',
        email: 1,
        username: 1,
        event: '$securityEvents'
      }
    }
  ]
  
  const events = await users.aggregate(pipeline).toArray()
  
  res.json({
    events,
    page: pageNum,
    limit: limitNum
  })
}))

// Active Sessions Management
router.get('/sessions', requireSecurityMonitoring, asyncHandler(async (req: AdminRequest, res: Response) => {
  const sessions = sessionsCollection()
  const users = usersCollection()
  
  const activeSessions = await sessions.aggregate([
    { $match: { expiresAt: { $gt: new Date() } } },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        sessionId: '$_id',
        userId: '$userId',
        email: '$user.email',
        username: '$user.username',
        createdAt: 1,
        expiresAt: 1,
        ipAddress: 1,
        userAgent: 1,
        lastActivity: '$user.lastLoginAt'
      }
    },
    { $sort: { createdAt: -1 } }
  ]).toArray()
  
  res.json({ sessions: activeSessions })
}))

// Revoke User Session
router.delete('/sessions/:sessionId', requireSecurityMonitoring, asyncHandler(async (req: AdminRequest, res: Response) => {
  const { sessionId } = req.params
  const sessions = sessionsCollection()
  
  const result = await sessions.deleteOne({ _id: new ObjectId(sessionId) })
  
  if (result.deletedCount === 0) {
    return res.status(404).json({ error: 'Session not found' })
  }
  
  const auditLogger = AuditLogger.getInstance()
  await auditLogger.logAdmin({
    action: 'session_revoked',
    adminId: req.userId!,
    targetSessionId: sessionId,
    ipAddress: req.ip || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown'
  })
  
  res.json({ success: true, message: 'Session revoked' })
}))

// System Health Check
router.get('/system/health', requireSystemAdmin, asyncHandler(async (req: AdminRequest, res: Response) => {
  const users = usersCollection()
  const sessions = sessionsCollection()
  
  try {
    // Test database connectivity
    await users.findOne({}, { projection: { _id: 1 } })
    
    const systemStats = {
      database: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development'
    }
    
    res.json(systemStats)
  } catch (error) {
    res.status(500).json({
      database: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    })
  }
}))

// Grant Admin Privileges
router.post('/users/:userId/grant-admin', requireSystemAdmin, validateInput(z.object({
  role: z.enum(['admin', 'super_admin']),
  permissions: z.array(z.string()).optional()
})), asyncHandler(async (req: AdminRequest, res: Response) => {
  const { userId } = req.params
  const { role, permissions } = req.body
  const users = usersCollection()
  
  await users.updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        role,
        adminPermissions: permissions || Object.values(AdminPermissions),
        adminCreatedAt: new Date(),
        adminCreatedBy: req.userId,
        updatedAt: new Date()
      }
    }
  )
  
  const auditLogger = AuditLogger.getInstance()
  await auditLogger.logAdmin({
    action: 'admin_privileges_granted',
    adminId: req.userId!,
    targetUserId: userId,
    details: { role, permissions },
    ipAddress: req.ip || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown'
  })
  
  res.json({ success: true, message: 'Admin privileges granted' })
}))

// Revoke Admin Privileges
router.post('/users/:userId/revoke-admin', requireSystemAdmin, asyncHandler(async (req: AdminRequest, res: Response) => {
  const { userId } = req.params
  const users = usersCollection()
  
  await users.updateOne(
    { _id: new ObjectId(userId) },
    {
      $unset: {
        role: 1,
        adminPermissions: 1,
        adminCreatedAt: 1,
        adminCreatedBy: 1
      },
      $set: { updatedAt: new Date() }
    }
  )
  
  const auditLogger = AuditLogger.getInstance()
  await auditLogger.logAdmin({
    action: 'admin_privileges_revoked',
    adminId: req.userId!,
    targetUserId: userId,
    ipAddress: req.ip || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown'
  })
  
  res.json({ success: true, message: 'Admin privileges revoked' })
}))

export default router
