import jwt from 'jsonwebtoken'

const ACCESS_EXPIRES_IN = '4h'
const REFRESH_EXPIRES_IN = '7d'

export function signAccess(payload: object, expiresIn?: string) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET || 'dev_access_secret', { 
    expiresIn: expiresIn || ACCESS_EXPIRES_IN 
  })
}

export function signRefresh(payload: object, expiresIn?: string) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret', { 
    expiresIn: expiresIn || REFRESH_EXPIRES_IN 
  })
}

export function verifyAccess(token: string) {
  try {
    console.log('🔐 JWT verifyAccess attempt:', {
      tokenLength: token?.length || 0,
      tokenPrefix: token?.substring(0, 20) + '...',
      secret: process.env.JWT_ACCESS_SECRET ? '[PRESENT]' : 'dev_access_secret',
      timestamp: new Date().toISOString()
    })
    
    const result = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'dev_access_secret')
    console.log('✅ JWT verifyAccess success:', {
      userId: typeof result === 'object' && result && 'sub' in result ? result.sub : 'UNKNOWN',
      timestamp: new Date().toISOString()
    })
    return result
  } catch (error) {
    console.log('❌ JWT verifyAccess failed:', error instanceof Error ? error.message : 'Unknown error')
    console.log('🔐 JWT failure details:', {
      tokenLength: token?.length || 0,
      tokenStart: token?.substring(0, 50) || 'NO_TOKEN',
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      timestamp: new Date().toISOString()
    })
    return null
  }
}

export function verifyRefresh(token: string) {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret')
  } catch (error) {
    console.log('❌ JWT verifyRefresh failed:', error instanceof Error ? error.message : 'Unknown error')
    return null
  }
}
