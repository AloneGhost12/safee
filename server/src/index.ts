import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { createServer } from 'http'
import { connect } from './db'
import authRoutes from './routes/auth'
import adminRoutes from './routes/admin'
import hiddenAdminRoutes from './routes/hiddenAdmin'
import healthRoutes from './routes/health'
import notesRoutes from './routes/notes'
import filesRoutes from './routes/files'
import otpRoutes from './routes/otp'
import aiDebugRoutes from './routes/aiDebug'
import testRoutes, { initializeTestRunner } from './utils/testRunner'
import { httpLogger } from './middleware/logger'
import { errorHandler, notFoundHandler } from './middleware/errors'
import { validateCloudinaryConfig } from './utils/cloudinary'
import { setupSecureCORS, validateCORSConfig } from './middleware/cors'
import { emergencyCORSFix } from './middleware/emergencyCORS'
import { 
  setupCSP, 
  helmetConfig, 
  configureTrustedProxies 
} from './middleware/security'
import { adminHoneypot } from './middleware/hiddenAdminAuth'
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
app.use(emergencyCORSFix()) // Temporary fix for additional origins

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
  keyGenerator: (req) => {
    // Use x-forwarded-for header for Render, fallback to req.ip
    const forwarded = req.headers['x-forwarded-for'] as string
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip || 'unknown'
    return ip
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health'
  }
})
app.use(globalLimiter)

// Setup honeypot for common admin paths (logs potential attacks)
app.use(adminHoneypot)

// Routes
app.use('/api/auth', authRoutes)
// Hidden admin routes with enterprise security
app.use('/api/admin', hiddenAdminRoutes)
// Keep old admin for compatibility but it's now honeypot-protected
app.use('/api', healthRoutes)
app.use('/api/notes', notesRoutes)
app.use('/api/files', filesRoutes)
app.use('/api/otp', otpRoutes)
app.use('/api/ai-debug', aiDebugRoutes)
app.use('/api/test', testRoutes)

// Testing dashboard
app.get('/testing', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vault Testing Dashboard</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 20px;
                background-color: #f5f5f5;
                color: #333;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                padding: 20px;
            }
            .header {
                border-bottom: 1px solid #eee;
                padding-bottom: 20px;
                margin-bottom: 20px;
            }
            .header h1 {
                margin: 0;
                color: #2c3e50;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .status {
                display: inline-block;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
                color: white;
                background-color: #27ae60;
            }
            .section {
                margin-bottom: 30px;
                padding: 20px;
                border: 1px solid #eee;
                border-radius: 6px;
                background: #fafafa;
            }
            .section h2 {
                margin-top: 0;
                color: #34495e;
                border-bottom: 2px solid #3498db;
                padding-bottom: 10px;
            }
            .endpoint {
                background: white;
                padding: 15px;
                border-radius: 4px;
                margin-bottom: 10px;
                border-left: 4px solid #3498db;
            }
            .method {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 12px;
                font-weight: bold;
                color: white;
                margin-right: 10px;
            }
            .get { background-color: #27ae60; }
            .post { background-color: #e74c3c; }
            .put { background-color: #f39c12; }
            .delete { background-color: #c0392b; }
            .test-btn {
                background: #3498db;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                margin-left: 10px;
            }
            .test-btn:hover {
                background: #2980b9;
            }
            .result {
                margin-top: 10px;
                padding: 10px;
                border-radius: 4px;
                background: #ecf0f1;
                font-family: monospace;
                font-size: 12px;
                max-height: 200px;
                overflow-y: auto;
            }
            .success { background-color: #d5f4e6; color: #27ae60; }
            .error { background-color: #fadbd8; color: #e74c3c; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🧪 Vault Testing Dashboard <span class="status">ACTIVE</span></h1>
                <p>Test your Vault API endpoints and verify system functionality</p>
            </div>
            
            <div class="section">
                <h2>🔒 Email OTP System</h2>
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <code>/api/otp/config</code>
                    <button class="test-btn" onclick="testEndpoint('GET', '/api/otp/config')">Test</button>
                    <div id="result-otp-config" class="result" style="display:none;"></div>
                </div>
                
                <div class="endpoint">
                    <span class="method post">POST</span>
                    <code>/api/otp/test-email</code>
                    <button class="test-btn" onclick="testOTPEmail()">Test Email</button>
                    <div id="result-otp-email" class="result" style="display:none;"></div>
                </div>
                
                <div class="endpoint">
                    <span class="method post">POST</span>
                    <code>/api/otp/send</code>
                    <button class="test-btn" onclick="testOTPSend()">Send OTP</button>
                    <div id="result-otp-send" class="result" style="display:none;"></div>
                </div>
            </div>
            
            <div class="section">
                <h2>🏥 System Health</h2>
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <code>/api/health</code>
                    <button class="test-btn" onclick="testEndpoint('GET', '/api/health')">Test</button>
                    <div id="result-health" class="result" style="display:none;"></div>
                </div>
            </div>
            
            <div class="section">
                <h2>🔐 Authentication</h2>
                <div class="endpoint">
                    <span class="method post">POST</span>
                    <code>/api/auth/register</code>
                    <button class="test-btn" onclick="alert('Use Postman or curl for auth testing')">Manual Test</button>
                </div>
                
                <div class="endpoint">
                    <span class="method post">POST</span>
                    <code>/api/auth/login</code>
                    <button class="test-btn" onclick="alert('Use Postman or curl for auth testing')">Manual Test</button>
                </div>
            </div>
        </div>
        
        <script>
            async function testEndpoint(method, url, body = null) {
                const resultId = 'result-' + url.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                const resultDiv = document.getElementById(resultId) || document.getElementById('result-' + url.split('/').pop());
                
                if (resultDiv) {
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = 'Testing...';
                    resultDiv.className = 'result';
                }
                
                try {
                    const options = {
                        method: method,
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    };
                    
                    if (body) {
                        options.body = JSON.stringify(body);
                    }
                    
                    const response = await fetch(url, options);
                    const data = await response.text();
                    
                    if (resultDiv) {
                        resultDiv.className = response.ok ? 'result success' : 'result error';
                        resultDiv.innerHTML = \`Status: \${response.status}\\n\\n\${data}\`;
                    }
                } catch (error) {
                    if (resultDiv) {
                        resultDiv.className = 'result error';
                        resultDiv.innerHTML = \`Error: \${error.message}\`;
                    }
                }
            }
            
            function testOTPEmail() {
                const email = prompt('Enter email address for test:', 'test@example.com');
                if (email) {
                    testEndpoint('POST', '/api/otp/test-email', { email: email });
                }
            }
            
            function testOTPSend() {
                const email = prompt('Enter email address for OTP:', 'test@example.com');
                if (email) {
                    testEndpoint('POST', '/api/otp/send', { 
                        email: email, 
                        purpose: 'email_verification' 
                    });
                }
            }
            
            // Auto-refresh page every 30 seconds to keep it updated
            setTimeout(() => location.reload(), 30000);
        </script>
    </body>
    </html>
  `)
})

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
    // Validate critical environment variables (including database)
    const criticalEnvVars = [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'ALLOWED_ORIGINS',
      'MONGO_URI'
    ]
    
    const missingCriticalVars = criticalEnvVars.filter(envVar => !process.env[envVar])
    if (missingCriticalVars.length > 0) {
      console.error('❌ Missing critical environment variables:', missingCriticalVars)
      console.error('❌ Cannot start server without required configuration')
      process.exit(1)
    }

    // Connect to database - this is required for the application to function
    try {
      console.log('🔗 Connecting to database...')
      await connect()
      console.log('✅ Database connected successfully')
    } catch (err) {
      console.error('❌ Database connection failed:', err)
      console.error('❌ Cannot start server without database connection')
      process.exit(1)
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
