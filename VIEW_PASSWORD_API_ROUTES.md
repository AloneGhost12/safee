// Add these routes to your auth router in server/src/routes/auth.ts

// Set/Update view password
router.post('/set-view-password', authenticateToken, validateInput(z.object({
  currentPassword: validationSchemas.password,
  viewPassword: validationSchemas.password
})), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, viewPassword } = req.body
  const userId = req.user!.userId
  const auditLogger = AuditLogger.getInstance()
  const clientInfo = getClientInfo(req)
  
  try {
    const col = usersCollection()
    const user = await col.findOne({ _id: new ObjectId(userId) })
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    // Verify current password
    const validPassword = await verifyPassword(user.passwordHash, currentPassword)
    if (!validPassword) {
      await auditLogger.logAuth({
        action: 'set_view_password_failure',
        userId,
        success: false,
        failureReason: 'Invalid current password',
        ...clientInfo
      })
      return res.status(401).json({ error: 'Current password is incorrect' })
    }
    
    // Hash the new view password
    const viewPasswordHash = await hashPassword(viewPassword)
    
    // Update user with view password
    await col.updateOne(
      { _id: new ObjectId(userId) },
      { 
        $set: { 
          viewPasswordHash,
          viewArgonSalt: '', // Argon2 includes salt
          updatedAt: new Date()
        }
      }
    )
    
    await auditLogger.logAuth({
      action: 'set_view_password_success',
      userId,
      success: true,
      ...clientInfo
    })
    
    res.json({ message: 'View password set successfully' })
  } catch (error) {
    console.error('Set view password error:', error)
    res.status(500).json({ error: 'Failed to set view password' })
  }
}))

// Remove view password
router.delete('/view-password', authenticateToken, validateInput(z.object({
  currentPassword: validationSchemas.password
})), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword } = req.body
  const userId = req.user!.userId
  const auditLogger = AuditLogger.getInstance()
  const clientInfo = getClientInfo(req)
  
  try {
    const col = usersCollection()
    const user = await col.findOne({ _id: new ObjectId(userId) })
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    // Verify current password
    const validPassword = await verifyPassword(user.passwordHash, currentPassword)
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }
    
    // Remove view password
    await col.updateOne(
      { _id: new ObjectId(userId) },
      { 
        $unset: { 
          viewPasswordHash: '',
          viewArgonSalt: ''
        },
        $set: {
          updatedAt: new Date()
        }
      }
    )
    
    await auditLogger.logAuth({
      action: 'remove_view_password_success',
      userId,
      success: true,
      ...clientInfo
    })
    
    res.json({ message: 'View password removed successfully' })
  } catch (error) {
    console.error('Remove view password error:', error)
    res.status(500).json({ error: 'Failed to remove view password' })
  }
}))

// Check if user has view password
router.get('/has-view-password', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId
  
  try {
    const col = usersCollection()
    const user = await col.findOne(
      { _id: new ObjectId(userId) },
      { projection: { viewPasswordHash: 1 } }
    )
    
    res.json({ 
      hasViewPassword: !!(user?.viewPasswordHash) 
    })
  } catch (error) {
    console.error('Check view password error:', error)
    res.status(500).json({ error: 'Failed to check view password status' })
  }
}))