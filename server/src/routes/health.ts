import { Router } from 'express'
const router = Router()

router.get('/health', (_req, res) => {
  // Prevent caching to ensure fresh requests wake the server
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  })
  
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid,
    version: process.version,
    platform: process.platform
  })
})

// Additional lightweight endpoint for keep-alive pings
router.get('/ping', (_req, res) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  })
  
  res.send('pong')
})

export default router
