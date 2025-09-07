import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { createServer } from 'http'
import { connect } from './db'
import authRoutes from './routes/auth'
import healthRoutes from './routes/health'
import notesRoutes from './routes/notes'
import filesRoutes from './routes/files'
import testRoutes, { initializeTestRunner } from './utils/testRunner'
import { httpLogger } from './middleware/logger'
import { errorHandler, notFoundHandler } from './middleware/errors'
import { validateCloudinaryConfig } from './utils/cloudinary'
import { setupSecureCORS, validateCORSConfig } from './middleware/cors'
import { 
  setupCSP, 
  helmetConfig, 
  configureTrustedProxies 
} from './middleware/security'
import rateLimit from 'express-rate-limit'

const app = express()

// Trust proxy configuration for accurate IP addresses
configureTrustedProxies(app)

// Security headers and CSP
app.use(helmet(helmetConfig))
app.use(setupCSP())

// CORS configuration
if (!validateCORSConfig()) {
  console.error('Invalid CORS configuration, exiting...')
  process.exit(1)
}
app.use(setupSecureCORS())

// Request parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cookieParser())

// Request logging
app.use(httpLogger)

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // More lenient in development
  message: {
    error: 'Too many requests from this IP, please try again later',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health'
  }
})
app.use(globalLimiter)

// Routes
app.use('/api/auth', authRoutes)
app.use('/api', healthRoutes)
app.use('/api/notes', notesRoutes)
app.use('/api/files', filesRoutes)
app.use('/api/test', testRoutes)

// Root endpoint - API documentation
app.get('/', (req, res) => {
  res.json({
    name: 'Personal Vault API',
    version: '0.1.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: 'GET /api/health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        refresh: 'POST /api/auth/refresh'
      },
      notes: {
        list: 'GET /api/notes',
        create: 'POST /api/notes',
        get: 'GET /api/notes/:id',
        update: 'PUT /api/notes/:id',
        delete: 'DELETE /api/notes/:id'
      },
      files: {
        upload: 'POST /api/files/upload',
        get: 'GET /api/files/:id',
        delete: 'DELETE /api/files/:id'
      }
    },
    documentation: 'Visit /api/health for service status'
  })
})

// 404 handler for undefined routes
app.use(notFoundHandler)

// Error handling
app.use(errorHandler)

async function start() {
  try {
    // Validate critical environment variables (non-database)
    const criticalEnvVars = [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'ALLOWED_ORIGINS'
    ]
    
    const missingCriticalVars = criticalEnvVars.filter(envVar => !process.env[envVar])
    if (missingCriticalVars.length > 0) {
      console.error('Missing critical environment variables:', missingCriticalVars)
      process.exit(1)
    }

    // Warn about missing database but don't exit
    if (!process.env.MONGO_URI) {
      console.warn('⚠️ MONGO_URI not set - database features will be unavailable')
      console.warn('⚠️ Server will start but database operations will fail')
    } else {
      // Only try to connect if MONGO_URI is available
      try {
        await connect()
        console.log('✅ Database connected successfully')
      } catch (err) {
        console.warn('⚠️ Database connection failed, but server will continue:', err)
        console.warn('⚠️ Database features will be unavailable')
      }
    }
    
    // Validate environment configurations
    if (!validateCloudinaryConfig()) {
      console.warn('Cloudinary configuration incomplete - file uploads may be limited')
    }
    
    const port = Number(process.env.PORT || 4000)
    const host = process.env.HOST || '0.0.0.0'
    
    // Create HTTP server for WebSocket support
    const server = createServer(app)
    
    // Initialize test runner with WebSocket support
    if (process.env.NODE_ENV !== 'production') {
      initializeTestRunner(server)
      console.log('🧪 Test runner initialized with WebSocket support')
    }
    
    server.listen(port, host, () => {
      console.log(`🚀 Server running on ${host}:${port}`)
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
      console.log(`🔒 Security features enabled`)
      
      if (process.env.NODE_ENV === 'production') {
        console.log('🛡️  Production security mode active')
      } else {
        console.log('🔧 Development mode - some security features relaxed')
        console.log('🧪 Testing dashboard available at /testing')
      }
    })
  } catch (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully')
  process.exit(0)
})

start()
