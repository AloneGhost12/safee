import { Router, Request, Response } from 'express'
import { requireAuth, AuthedRequest } from '../middleware/auth'
import { getAIDebugService } from '../services/aiDebugService'
import geminiService from '../services/geminiService'
import { z } from 'zod'

const router = Router()

// Validation schemas
const issueReportSchema = z.object({
  description: z.string().min(1).max(1000),
  category: z.enum(['email', 'files', 'auth', 'performance', 'general']).optional()
})

const autoFixSchema = z.object({
  issueId: z.string()
})

/**
 * Get system health status
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const aiService = getAIDebugService()
    
    // Perform health check
    const healthMetrics = await aiService.performHealthCheck()
    
    res.json({
      success: true,
      health: healthMetrics,
      summary: aiService.getSystemStatus()
    })
  } catch (error) {
    console.error('❌ AI Debug API: Health check failed:', error)
    res.status(500).json({
      success: false,
      error: 'Health check failed'
    })
  }
})

/**
 * Get AI Debug system status (for frontend chat widget)
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const aiService = getAIDebugService()
    
    // Perform health check
    const healthMetrics = await aiService.performHealthCheck()
    
    // Format response for frontend chat widget
    res.json({
      success: true,
      status: healthMetrics.overall,
      health: {
        email: healthMetrics.email.status,
        database: healthMetrics.database.status,
        storage: healthMetrics.storage.status,
        overall: healthMetrics.overall
      },
      timestamp: healthMetrics.timestamp,
      message: healthMetrics.overall === 'healthy' 
        ? '🟢 All systems operational' 
        : healthMetrics.overall === 'degraded'
        ? '🟡 Some systems experiencing issues'
        : '🔴 System maintenance required'
    })
  } catch (error) {
    console.error('❌ AI Debug API: Status check failed:', error)
    res.status(500).json({
      success: false,
      status: 'down',
      health: {
        email: 'down',
        database: 'down', 
        storage: 'down',
        overall: 'down'
      },
      message: '🔴 System temporarily unavailable',
      timestamp: new Date().toISOString()
    })
  }
})

/**
 * Report an issue for AI analysis
 */
router.post('/report-issue', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.userId
    const validation = issueReportSchema.safeParse(req.body)
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid issue report format',
        details: validation.error.issues
      })
    }
    
    const { description } = validation.data
    const aiService = getAIDebugService()
    
    // Report the issue
    const issueId = aiService.reportIssue(description, userId)
    
    // Analyze the issue
    const analysis = await aiService.analyzeIssue(description, userId)
    
    console.log(`🤖 AI Debug: Issue ${issueId} analyzed - ${analysis.diagnosis}`)
    
    res.json({
      success: true,
      issueId,
      analysis: {
        diagnosis: analysis.diagnosis,
        severity: analysis.severity,
        category: analysis.category,
        suggestedFixes: analysis.suggestedFixes,
        canAutoFix: analysis.canAutoFix
      }
    })
  } catch (error) {
    console.error('❌ AI Debug API: Issue report failed:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to process issue report'
    })
  }
})

/**
 * Apply automatic fix for an issue
 */
router.post('/auto-fix', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const validation = autoFixSchema.safeParse(req.body)
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid auto-fix request',
        details: validation.error.issues
      })
    }
    
    const { issueId } = validation.data
    const aiService = getAIDebugService()
    
    // Apply auto-fix
    const result = await aiService.applyAutoFix(issueId)
    
    console.log(`🔧 AI Debug: Auto-fix ${result.success ? 'applied' : 'failed'} for issue ${issueId}`)
    
    res.json({
      success: result.success,
      result: {
        appliedFixes: result.appliedFixes,
        message: result.message,
        requiresManualReview: result.requiresManualReview
      }
    })
  } catch (error) {
    console.error('❌ AI Debug API: Auto-fix failed:', error)
    res.status(500).json({
      success: false,
      error: 'Auto-fix operation failed'
    })
  }
})

/**
 * Get system status summary
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const aiService = getAIDebugService()
    const status = aiService.getSystemStatus()
    
    res.json({
      success: true,
      status
    })
  } catch (error) {
    console.error('❌ AI Debug API: Status check failed:', error)
    res.status(500).json({
      success: false,
      error: 'Status check failed'
    })
  }
})

/**
 * Chat endpoint for natural language issue reporting
 */
router.post('/chat', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { message, conversationHistory } = req.body
    
    if (!message || typeof message !== 'string' || message.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Invalid message format'
      })
    }
    
    const userId = req.userId!
    const userRole = 'viewer' // Default role, can be enhanced later
    const aiService = getAIDebugService()
    
    // Get current system health for context
    const systemHealth = await aiService.performHealthCheck()
    
    // Check if this is an issue report or general chat
    const isIssueReport = /problem|issue|error|not working|broken|failed|help/i.test(message)
    
    let response: string
    let issueId: string | null = null
    let canAutoFix = false
    let severity: string = 'low'
    
    if (isIssueReport) {
      // Report and analyze the issue with Gemini AI
      issueId = aiService.reportIssue(message, userId)
      
      const analysis = await geminiService.analyzeIssue(message, systemHealth, {
        userId,
        role: userRole
      })
      
      // Generate structured response based on AI analysis
      response = `🤖 **AI Debug Assistant**\n\n`
      response += `**Analysis:** ${analysis.solution}\n\n`
      response += `**Severity:** ${analysis.severity.toUpperCase()}\n\n`
      response += `**Category:** ${analysis.category.charAt(0).toUpperCase() + analysis.category.slice(1)}\n\n`
      
      if (analysis.steps.length > 0) {
        response += `**Recommended Steps:**\n`
        analysis.steps.forEach((step, index) => {
          response += `${index + 1}. ${step}\n`
        })
        response += `\n`
      }
      
      if (analysis.autoFixable) {
        response += `✅ I can automatically apply some fixes for this issue. Would you like me to try?\n\n`
        response += `Click the "Apply Auto-Fix" button to proceed with automatic resolution.`
      } else {
        response += `⚠️ This issue requires manual investigation. Please follow the recommended steps above.`
      }
      
      canAutoFix = analysis.autoFixable
      severity = analysis.severity
    } else {
      // General chat response using Gemini AI
      response = await geminiService.generateChatResponse(
        message,
        conversationHistory || [],
        systemHealth,
        { userId, role: userRole }
      )
    }
    
    console.log(`💬 AI Debug Chat: Responded to user ${userId}${issueId ? ` for issue ${issueId}` : ''}`)
    
    res.json({
      success: true,
      response,
      issueId,
      canAutoFix,
      severity,
      systemHealth: {
        overall: systemHealth.overall,
        email: systemHealth.email.status,
        database: systemHealth.database.status,
        storage: systemHealth.storage.status
      }
    })
  } catch (error) {
    console.error('❌ AI Debug Chat: Failed to process message:', error)
    res.status(500).json({
      success: false,
      error: 'Chat processing failed',
      response: '🤖 Sorry, I encountered an error while analyzing your message. Please try again or contact support if the issue persists.'
    })
  }
})

export default router