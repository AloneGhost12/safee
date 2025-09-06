import { Request, Response, NextFunction } from 'express'
import logger from './logger'
import { AuditLogger } from '../services/auditLogger'

/**
 * Safe error messages that don't leak sensitive information
 */
const SAFE_ERROR_MESSAGES: Record<string, string> = {
  // Authentication errors
  'Invalid credentials': 'Invalid email or password',
  'User exists': 'Account already exists',
  'Invalid session': 'Session expired, please log in again',
  'Missing auth': 'Authentication required',
  'Invalid token': 'Authentication token invalid',
  
  // Validation errors
  'Validation failed': 'Invalid input data',
  'Required field missing': 'Required information missing',
  'Invalid format': 'Data format is invalid',
  
  // File errors
  'File not found': 'Requested file not found',
  'File too large': 'File size exceeds limit',
  'Invalid file type': 'File type not supported',
  
  // Rate limiting
  'Too many requests': 'Rate limit exceeded, please try again later',
  
  // Generic errors
  'Database error': 'Service temporarily unavailable',
  'Network error': 'Connection error, please try again',
  'Internal error': 'An unexpected error occurred'
}

/**
 * Determine if error should be logged as security incident
 */
function isSecurityEvent(error: any, req: Request): boolean {
  const securityIndicators = [
    'CORS policy violation',
    'Invalid token',
    'Rate limit exceeded',
    'Malformed request',
    'SQL injection attempt',
    'XSS attempt',
    'Path traversal attempt'
  ]
  
  return securityIndicators.some(indicator => 
    error.message?.includes(indicator) ||
    error.name?.includes(indicator)
  )
}

/**
 * Get client IP address safely
 */
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  return (forwarded ? forwarded.toString().split(',')[0] : req.socket.remoteAddress) || 'unknown'
}

/**
 * Enhanced error handler with security logging and safe error messages
 */
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const isDev = process.env.NODE_ENV === 'development'
  const requestId = req.headers['x-request-id'] || 'unknown'
  const clientIP = getClientIP(req)
  const userAgent = req.headers['user-agent'] || 'unknown'
  
  // Determine error details
  const status = err.status || err.statusCode || 500
  const originalMessage = err.message || 'Unknown error'
  const errorCode = err.code || 'UNKNOWN_ERROR'
  
  // Get safe error message
  const safeMessage = SAFE_ERROR_MESSAGES[originalMessage] || 
                     (status >= 500 ? 'Internal server error' : originalMessage)
  
  // Log error details (full details for debugging)
  const errorDetails = {
    message: originalMessage,
    stack: err.stack,
    status,
    code: errorCode,
    requestId,
    url: req.url,
    method: req.method,
    ip: clientIP,
    userAgent,
    userId: (req as any).userId,
    body: isDev ? req.body : '[REDACTED]',
    query: req.query,
    headers: isDev ? req.headers : '[REDACTED]'
  }
  
  // Log based on severity
  if (status >= 500) {
    logger.error(errorDetails, 'Server error')
  } else if (status >= 400) {
    logger.warn(errorDetails, 'Client error')
  }
  
  // Log security events
  if (isSecurityEvent(err, req)) {
    const auditLogger = AuditLogger.getInstance()
    auditLogger.logSecurityEvent({
      action: 'security_event',
      userId: (req as any).userId,
      resource: 'api',
      details: {
        errorType: err.name,
        message: originalMessage,
        url: req.url,
        method: req.method,
        statusCode: status
      },
      ipAddress: clientIP,
      userAgent,
      riskLevel: status === 429 ? 'medium' : 'high'
    }).catch(console.error)
  }
  
  // Prepare response
  const errorResponse: any = {
    error: safeMessage,
    status,
    requestId
  }
  
  // Include additional details in development
  if (isDev) {
    errorResponse.details = {
      originalMessage,
      code: errorCode,
      stack: err.stack?.split('\n').slice(0, 10) // Limit stack trace
    }
  }
  
  // Add validation errors if present
  if (err.name === 'ZodError' || err.errors) {
    errorResponse.validationErrors = err.errors?.map((e: any) => ({
      field: e.path?.join('.') || e.property,
      message: e.message,
      code: e.code
    }))
  }
  
  // Add retry information for rate limiting
  if (status === 429) {
    errorResponse.retryAfter = err.retryAfter || 60
  }
  
  // Security headers for error responses
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  })
  
  res.status(status).json(errorResponse)
}

/**
 * 404 handler for undefined routes
 */
export function notFoundHandler(req: Request, res: Response) {
  const clientIP = getClientIP(req)
  
  // Log potential reconnaissance attempts
  if (req.url.includes('admin') || 
      req.url.includes('.php') || 
      req.url.includes('.asp') ||
      req.url.includes('wp-') ||
      req.url.includes('config') ||
      req.url.includes('backup')) {
    
    const auditLogger = AuditLogger.getInstance()
    auditLogger.logSecurityEvent({
      action: 'suspicious_request',
      resource: 'api',
      details: {
        url: req.url,
        method: req.method,
        suspiciousPattern: true
      },
      ipAddress: clientIP,
      userAgent: req.headers['user-agent'] || 'unknown',
      riskLevel: 'medium'
    }).catch(console.error)
  }
  
  res.status(404).json({
    error: 'Endpoint not found',
    status: 404,
    path: req.url
  })
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
