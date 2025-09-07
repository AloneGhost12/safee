import cors from 'cors'

/**
 * Secure CORS configuration
 * Only allows requests from whitelisted origins
 */
export function setupSecureCORS() {
  // Parse allowed origins from environment
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)

  // Validate origins format
  const validOrigins = allowedOrigins.filter(origin => {
    try {
      new URL(origin)
      return true
    } catch {
      console.warn(`Invalid origin in ALLOWED_ORIGINS: ${origin}`)
      return false
    }
  })

  if (validOrigins.length === 0) {
    throw new Error('No valid origins configured in ALLOWED_ORIGINS environment variable')
  }

  console.log('Allowed CORS origins:', validOrigins)

  return cors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (health checks, mobile apps, curl, etc.)
      if (!origin) {
        return callback(null, true)
      }

      // Check if origin is in whitelist
      if (origin && validOrigins.includes(origin)) {
        return callback(null, true)
      }

      // Special handling for development
      if (process.env.NODE_ENV === 'development') {
        // Allow localhost with any port for development
        if (origin && (
          origin.startsWith('http://localhost:') ||
          origin.startsWith('http://127.0.0.1:') ||
          origin.startsWith('http://[::1]:')
        )) {
          return callback(null, true)
        }
      }

      // Reject the request
      const error = new Error(`CORS policy violation: Origin ${origin} not allowed`)
      console.warn('CORS violation:', { origin, allowedOrigins: validOrigins })
      callback(error)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'X-API-Version'
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After'
    ],
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 200,
    preflightContinue: false
  })
}

/**
 * Validate environment variables for CORS setup
 */
export function validateCORSConfig(): boolean {
  const requiredEnvVars = ['ALLOWED_ORIGINS']
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`Missing required environment variable: ${envVar}`)
      return false
    }
  }

  return true
}
