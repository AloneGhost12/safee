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
    return jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'dev_access_secret')
  } catch (error) {
    console.log('❌ JWT verifyAccess failed:', error instanceof Error ? error.message : 'Unknown error')
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
