import { Router, Request, Response } from 'express'
import { requireAuth, AuthedRequest } from '../middleware/auth'
import geminiService from '../services/geminiService'
import { z } from 'zod'

const router = Router()

const summarizeSchema = z.object({
    content: z.string().min(1).max(50000) // Limit content size
})

const searchSchema = z.object({
    query: z.string().min(1).max(500)
})

/**
 * Summarize content
 */
router.post('/summarize', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
        const validation = summarizeSchema.safeParse(req.body)

        if (!validation.success) {
            return res.status(400).json({
                success: false,
                error: 'Invalid content format',
                details: validation.error.issues
            })
        }

        const { content } = validation.data
        const summary = await geminiService.generateSummary(content)

        res.json({
            success: true,
            summary
        })
    } catch (error) {
        console.error('AI Summarize error:', error)
        res.status(500).json({
            success: false,
            error: 'Failed to generate summary'
        })
    }
})

/**
 * Extract keywords
 */
router.post('/keywords', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
        const validation = summarizeSchema.safeParse(req.body)

        if (!validation.success) {
            return res.status(400).json({
                success: false,
                error: 'Invalid content format',
                details: validation.error.issues
            })
        }

        const { content } = validation.data
        const keywords = await geminiService.extractKeywords(content)

        res.json({
            success: true,
            keywords
        })
    } catch (error) {
        console.error('AI Keywords error:', error)
        res.status(500).json({
            success: false,
            error: 'Failed to extract keywords'
        })
    }
})

export default router
