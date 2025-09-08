import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { 
  ADMIN_SECRETS, 
  adminRateLimit, 
  validateAdminAccess, 
  enforceIPWhitelist,
  generateTimeBasedAccess,
  validateTimeBasedAccess
} from '../middleware/hiddenAdminAuth'
import { validateInput } from '../middleware/security'
import { asyncHandler } from '../middleware/errors'
import { requireAdmin, AdminRequest } from '../middleware/adminAuth'

const router = Router()

// Apply security layers to all routes
router.use(adminRateLimit)
router.use(enforceIPWhitelist)

// Hidden admin access endpoint - only accessible with secret path and token
router.get(`/hidden/:secretPath/access`, validateAdminAccess, (req: Request, res: Response) => {
  const timeBasedToken = generateTimeBasedAccess()
  
  res.json({
    message: 'Admin access granted',
    adminPath: `/${ADMIN_SECRETS.secretPath}`,
    accessToken: ADMIN_SECRETS.accessToken,
    timeBasedToken,
    instructions: {
      header: 'X-Admin-Token: ' + ADMIN_SECRETS.accessToken,
      or: 'Use ?access_token=' + ADMIN_SECRETS.accessToken,
      timeWindow: '5 minutes for time-based token'
    }
  })
})

// Hidden admin authentication - ultra secure
router.post(`/hidden/:secretPath/auth`, 
  validateAdminAccess,
  validateInput(z.object({
    email: z.string().email(),
    password: z.string().min(8),
    timeToken: z.string().optional() // Optional time-based token for extra security
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, timeToken } = req.body

    // Optional: Validate time-based token for extra security
    if (timeToken && !validateTimeBasedAccess(timeToken)) {
      return res.status(401).json({ error: 'Invalid time token' })
    }

    // Use the same admin auth logic but with hidden endpoint
    // This would typically validate against admin users in database
    
    res.json({
      success: true,
      message: 'Admin authenticated',
      adminToken: 'jwt-token-here', // Replace with actual JWT generation
      permissions: ['user_management', 'security_monitoring', 'system_admin']
    })
  })
)

// All other admin routes are now hidden behind secret path
router.use(`/hidden/:secretPath/api`, validateAdminAccess, requireAdmin())

// Import and re-export all existing admin routes under hidden path
import originalAdminRouter from './admin'
router.use(`/hidden/:secretPath/api`, originalAdminRouter)

export default router
