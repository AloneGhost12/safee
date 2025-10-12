// Determine API base URL based on environment
const getApiBase = () => {
  // Check if we're in production
  const isProduction = import.meta.env.PROD
  const isDevelopment = import.meta.env.DEV
  
  console.log('🔧 API Base Detection:', {
    isProduction,
    isDevelopment,
    VITE_API_URL: import.meta.env.VITE_API_URL,
    hostname: window.location.hostname
  })
  
  // In production, use the configured API URL
  if (isProduction && import.meta.env.VITE_API_URL) {
    const apiBase = `${import.meta.env.VITE_API_URL}/api`
    console.log('🎯 Using production API:', apiBase)
    return apiBase
  }
  
  // In development, check if we're on localhost
  if (isDevelopment || window.location.hostname === 'localhost') {
    console.log('🏠 Using development proxy: /api')
    return '/api'
  }
  
  // Fallback for production without environment variable
  const fallbackApi = 'https://safee-y8iw.onrender.com/api'
  console.log('⚠️ Using fallback API:', fallbackApi)
  return fallbackApi
}

const API_BASE = getApiBase()

export class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'APIError'
  }
}

// Global state for token management
let authToken: string | null = null
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: Error) => void
}> = []

export function setAuthToken(token: string | null) {
  authToken = token
}

export function getAuthToken() {
  return authToken
}

export function debugAuthState() {
  console.log('🔐 Auth State Debug:', {
    hasToken: !!authToken,
    tokenLength: authToken?.length,
    tokenPrefix: authToken?.substring(0, 20) + '...',
    localStorage: !!localStorage.getItem('user'),
    isRefreshing
  })
}

function processQueue(error: Error | null, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else if (token) {
      resolve(token)
    } else {
      reject(new Error('No token available'))
    }
  })
  
  failedQueue = []
}

async function refreshAuthToken(): Promise<string> {
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject })
    })
  }

  // Prevent refresh loops by checking if we recently failed
  const lastRefreshFailure = sessionStorage.getItem('last-refresh-failure')
  if (lastRefreshFailure) {
    const timeSinceFailure = Date.now() - parseInt(lastRefreshFailure)
    if (timeSinceFailure < 30000) { // 30 seconds cooldown
      console.log('⏳ Token refresh in cooldown period, skipping...', {
        timeSinceFailure: Math.round(timeSinceFailure / 1000),
        cooldownRemaining: Math.round((30000 - timeSinceFailure) / 1000)
      })
      throw new Error('Token refresh in cooldown period')
    }
  }

  isRefreshing = true

  try {
    const refreshUrl = `${API_BASE}/auth/refresh`
    console.log('🔄 Attempting token refresh...', { 
      apiBase: API_BASE, 
      refreshUrl,
      isProduction: import.meta.env.PROD,
      origin: window.location.origin
    })
    
    const response = await fetch(refreshUrl, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.log('❌ Token refresh failed with status:', response.status)
      const errorText = await response.text().catch(() => 'Unknown error')
      console.log('❌ Token refresh error details:', errorText)
      
      // Log additional context for debugging
      console.log('🔍 Refresh context:', {
        status: response.status,
        statusText: response.statusText,
        url: refreshUrl,
        headers: Object.fromEntries(response.headers.entries())
      })
      
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const newToken = data.access
    
    if (!newToken) {
      console.error('❌ Token refresh returned no access token')
      throw new Error('No access token received')
    }
    
    console.log('✅ Token refresh successful', {
      tokenLength: newToken.length,
      tokenPrefix: newToken.substring(0, 20) + '...'
    })
    // Clear any previous failure timestamp
    sessionStorage.removeItem('last-refresh-failure')
    setAuthToken(newToken)
    processQueue(null, newToken)
    
    return newToken
  } catch (error) {
    console.error('❌ Token refresh error:', error)
    // Record the failure timestamp
    sessionStorage.setItem('last-refresh-failure', Date.now().toString())
    
    const err = error instanceof Error ? error : new Error('Token refresh failed')
    processQueue(err)
    setAuthToken(null)
    
    // Clear stored user data on refresh failure
    localStorage.removeItem('user')
    
    // Only redirect if we're not already on login/register pages and not in the middle of navigation
    const currentPath = window.location.pathname
    const isPublicPage = currentPath === '/login' || currentPath === '/register' || currentPath === '/recovery' || 
                        currentPath.includes('/login') || currentPath.includes('/register') || currentPath.includes('/recovery')
    
    if (!isPublicPage) {
      console.log('🔄 Redirecting to login due to token refresh failure', {
        currentPath,
        origin: window.location.origin
      })
      // Use a flag to prevent multiple redirections
      if (!sessionStorage.getItem('redirecting-to-login')) {
        sessionStorage.setItem('redirecting-to-login', 'true')
        // Use setTimeout to prevent immediate redirect during other operations
        setTimeout(() => {
          sessionStorage.removeItem('redirecting-to-login')
          // Handle base paths properly (e.g., /safee/login)
          const basePath = window.location.pathname.split('/')[1]
          const loginPath = (basePath && basePath !== 'login' && !isPublicPage) ? `/${basePath}/login` : '/login'
          window.location.href = window.location.origin + loginPath
        }, 100)
      }
    }
    throw err
  } finally {
    isRefreshing = false
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`
  
  let config: RequestInit = {
    headers: {},
    credentials: 'include', // Include cookies
    ...options,
  }

  // Only set Content-Type for non-FormData requests
  if (!(options.body instanceof FormData)) {
    config.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    }
  }

  // Add auth token if available and not already provided
  const headers = options.headers as Record<string, string> || {}
  if (authToken && !headers['Authorization']) {
    console.log('🔐 Adding auth token to request:', endpoint)
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${authToken}`,
    }
  } else if (!authToken && !endpoint.includes('/auth/') && !endpoint.includes('/health')) {
    console.warn('⚠️ No auth token available for protected endpoint:', endpoint)
  }

  try {
    let response = await fetch(url, config)
    
    // If unauthorized and we have a token, try to refresh it
    // Also handle 500 errors as potential auth issues in production
    if ((response.status === 401 || response.status === 500) && authToken && !endpoint.includes('/auth/')) {
      console.log(`🔒 Auth-related error (${response.status}), attempting token refresh...`)
      try {
        const newToken = await refreshAuthToken()
        
        // Retry the original request with the new token
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${newToken}`,
        }
        
        response = await fetch(url, config)
      } catch (refreshError) {
        console.error('❌ Token refresh failed, clearing auth state')
        // Clear invalid auth state and redirect to login
        const currentPath = window.location.pathname
        const isPublicPage = currentPath === '/login' || currentPath === '/register' || currentPath === '/recovery'
        
        if (!isPublicPage && !sessionStorage.getItem('redirecting-to-login')) {
          console.log('🔄 Redirecting to login due to auth failure')
          sessionStorage.setItem('redirecting-to-login', 'true')
          // Clear invalid user data
          localStorage.removeItem('user')
          setAuthToken(null)
          setTimeout(() => {
            sessionStorage.removeItem('redirecting-to-login')
            window.location.href = '/login'
          }, 100)
        }
        // Refresh failed, throw the original error
        throw new APIError(401, 'Authentication failed')
      }
    }
    
    if (!response.ok) {
      let errorData: any
      try {
        errorData = await response.json()
      } catch {
        errorData = { error: `HTTP ${response.status} - ${response.statusText}` }
      }
      
      console.error(`❌ API Error [${response.status}] on ${endpoint}:`, errorData)
      
      // Provide more specific error messages
      if (response.status === 401) {
        throw new APIError(response.status, errorData.error || 'Authentication required. Please log in again.')
      } else if (response.status === 400) {
        throw new APIError(response.status, errorData.error || 'Invalid request data.')
      } else if (response.status === 403) {
        throw new APIError(response.status, errorData.error || 'Access denied.')
      }
      
      throw new APIError(response.status, errorData.error || `HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error')
  }
}

// Auth API
export const authAPI = {
  signup: (username: string, email: string, phoneNumber: string, password: string) =>
    request<{ access: string; user?: { id: string; email: string; username: string; role: string; twoFactorEnabled: boolean; permissions: string[] } }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username, email, phoneNumber, password }),
    }).then(result => {
      setAuthToken(result.access)
      return result
    }),

  login: (identifier: string, password: string) =>
    request<{ 
      access: string; 
      requires2FA?: boolean; 
      user?: { 
        id: string; 
        email: string; 
        username: string;
        role: string;
        permissions: any;
        twoFactorEnabled: boolean;
      } 
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }).then(result => {
      // Only set token if login is complete (no 2FA required)
      if (!result.requires2FA) {
        setAuthToken(result.access)
      }
      return result
    }),

  verify2FALogin: (identifier: string, password: string, code: string) =>
    request<{ access: string; user: { id: string; email: string; username: string; twoFactorEnabled: boolean } }>('/auth/2fa/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, code }),
    }).then(result => {
      setAuthToken(result.access)
      return result
    }),

  // Complete email OTP login with 2FA verification
  completeEmailLogin2FA: (email: string, code: string) =>
    request<{ access: string; user: { id: string; email: string; username: string; twoFactorEnabled: boolean } }>('/auth/email-login-2fa', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }).then(result => {
      setAuthToken(result.access)
      return result
    }),

  logout: () =>
    request<{ ok: boolean }>('/auth/logout', {
      method: 'POST',
    }).then(result => {
      setAuthToken(null)
      return result
    }),

  refresh: () =>
    request<{ access: string }>('/auth/refresh', {
      method: 'POST',
    }),

  // 2FA endpoints
  enable2FA: (email: string) =>
    request<{ otpauth_url: string }>('/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  verify2FA: (email: string, code: string) =>
    request<{ ok: boolean; backupCodes?: string[] }>('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),

  disable2FA: (email: string) =>
    request<{ ok: boolean }>('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  // Backup codes
  getBackupCodesInfo: () =>
    request<{ unusedCodesCount: number; totalCodes: number; generated?: string }>('/auth/2fa/backup-codes', {
      method: 'GET',
    }),

  regenerateBackupCodes: (email: string) =>
    request<{ backupCodes: string[] }>('/auth/2fa/backup-codes/regenerate', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  loginWithBackupCode: (identifier: string, password: string, backupCode: string) =>
    request<{ access: string; user: { id: string; email: string; twoFactorEnabled: boolean }; warningMessage?: string }>('/auth/2fa/backup-login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, backupCode }),
    }).then(result => {
      setAuthToken(result.access)
      return result
    }),

  // Account Recovery
  requestEmailRecovery: (email: string) =>
    request<{ success: boolean; message: string }>('/auth/recovery/email-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  verifyEmailRecovery: (email: string, code: string) =>
    request<{ bypassToken: string; message: string; expiresIn: number }>('/auth/recovery/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),

  setupSecurityQuestions: (questions: Array<{ question: string; answer: string }>) =>
    request<{ success: boolean; message: string }>('/auth/recovery/setup-questions', {
      method: 'POST',
      body: JSON.stringify({ questions }),
    }),

  getSecurityQuestions: (email: string) =>
    request<{ questions: string[] }>('/auth/recovery/get-questions', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  // Get security questions for authenticated user (Settings page)
  getMySecurityQuestions: () =>
    request<{ questions: string[] }>('/auth/security-questions', {
      method: 'GET',
    }),

  verifySecurityQuestions: (email: string, answers: string[]) =>
    request<{ bypassToken: string; message: string; expiresIn: number }>('/auth/recovery/verify-questions', {
      method: 'POST',
      body: JSON.stringify({ email, answers }),
    }),

  verifyEmergency: (email: string, username: string, phoneNumber: string, password: string) =>
    request<{ access: string; requires2FA?: boolean; user?: { id: string; email: string; username: string; twoFactorEnabled: boolean; role: string; permissions: string[] } }>('/auth/verify-emergency', {
      method: 'POST',
      body: JSON.stringify({ email, username, phoneNumber, password }),
    }).then(result => {
      // Only set token if verification is complete (no 2FA required)
      if (!result.requires2FA) {
        setAuthToken(result.access)
      }
      return result
    }),

  // View password management
  setViewPassword: (currentPassword: string, viewPassword: string) =>
    request<{ message: string }>('/auth/set-view-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, viewPassword }),
    }),

  removeViewPassword: (currentPassword: string) =>
    request<{ message: string }>('/auth/view-password', {
      method: 'DELETE',
      body: JSON.stringify({ currentPassword }),
    }),

  hasViewPassword: () =>
    request<{ hasViewPassword: boolean }>('/auth/has-view-password', {
      method: 'GET',
    }),
}

// Email OTP API
export const emailOTPAPI = {
  // Send OTP to email
  sendOTP: (email: string, purpose: string = 'email_verification') =>
    request<{ success: boolean; message: string; expiresIn: number; canResendAfter: number }>('/otp/send', {
      method: 'POST',
      body: JSON.stringify({ email, purpose }),
    }),

  // Verify OTP code
  verifyOTP: (email: string, code: string, purpose: string = 'email_verification') =>
    request<{ success: boolean; message: string; sessionId?: string }>('/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code, purpose }),
    }),

  // Resend OTP
  resendOTP: (email: string, purpose: string = 'email_verification') =>
    request<{ success: boolean; message: string; expiresIn: number; canResendAfter: number }>('/otp/resend', {
      method: 'POST',
      body: JSON.stringify({ email, purpose }),
    }),

  // Get OTP configuration
  getConfig: () =>
    request<{ 
      expirationMinutes: number; 
      maxAttempts: number; 
      resendDelaySeconds: number;
      dailyLimit: number;
    }>('/otp/config'),

  // Get OTP status for email
  getStatus: (email: string, purpose: string = 'email_verification') => {
    const params = new URLSearchParams({ email, purpose })
    return request<{
      hasActivateOTP: boolean;
      attemptsRemaining: number;
      canResend: boolean;
      nextResendTime?: number;
      expiresAt?: number;
    }>(`/otp/status?${params.toString()}`, { method: 'GET' })
  },

  // Test email functionality (for admin/testing)
  testEmail: (email: string) =>
    request<{ success: boolean; messageId?: string; error?: string }>('/otp/test-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  // Verify account exists for email login
  verifyAccountExists: (email: string) =>
    request<{ exists: boolean; username?: string }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  // Check if registration data is available (before email verification)
  checkRegistrationData: (username: string, email: string, phoneNumber: string) =>
    request<{ 
      available: boolean; 
      conflictType?: 'email' | 'username' | 'phoneNumber';
      error?: string;
      message?: string;
    }>('/auth/check-registration', {
      method: 'POST',
      body: JSON.stringify({ username, email, phoneNumber }),
    }),

  // Complete email-based login after OTP verification
  completeEmailLogin: (email: string) =>
    request<{ 
      access: string; 
      user: { id: string; email: string; username: string; twoFactorEnabled?: boolean; }
      requires2FA?: boolean;
    }>('/auth/email-login', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }).then(result => {
      // If login is completed (no additional 2FA), set the auth token
      if (!result.requires2FA && result.access) {
        setAuthToken(result.access)
      }
      return result
    }),
}

// Notes API
export const notesAPI = {
  getAll: () =>
    request<{ notes: any[] }>('/notes'),

  getDeleted: () =>
    request<{ notes: any[] }>('/notes/deleted'),

  create: (note: { title: string; content: string; tags: string[] }) =>
    request<{ note: any }>('/notes', {
      method: 'POST',
      body: JSON.stringify(note),
    }),

  update: (id: string, note: { title: string; content: string; tags: string[] }) =>
    request<{ note: any }>(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(note),
    }),

  delete: (id: string) =>
    request<{ ok: boolean }>(`/notes/${id}`, {
      method: 'DELETE',
    }),

  restore: (id: string) =>
    request<{ note: any }>(`/notes/${id}/restore`, {
      method: 'POST',
    }),

  permanentDelete: (id: string) =>
    request<{ ok: boolean }>(`/notes/${id}/permanent`, {
      method: 'DELETE',
    }),
}

// Health check
export const healthAPI = {
  check: () => request<{ status: string }>('/health'),
}

// Files API
export const filesAPI = {
  requestUploadUrl: (uploadData: {
    fileName: string
    fileSize: number
    contentType: string
    encryptedName: string
    encryptedMimeType: string
    tags?: string[]
  }) =>
    request<{
      uploadUrl: string
      fileId: string
      s3Key: string
      expiresIn: number
    }>('/files/upload-url', {
      method: 'POST',
      body: JSON.stringify(uploadData),
    }),

  confirmUpload: (fileId: string) =>
    request<{ success: boolean }>('/files/upload-complete', {
      method: 'POST',
      body: JSON.stringify({ fileId }),
    }),

  requestDownloadUrl: (fileId: string, password: string) =>
    request<{
      downloadUrl: string
      expiresIn: number
      fileName: string
      mimeType: string
      size: number
    }>(`/files/${fileId}/download-url`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  getAll: () =>
    request<{
      files: Array<{
        id: string
        originalName: string
        mimeType: string
        size: number
        uploadedAt: string
        virusScanned: boolean
        virusScanResult?: 'clean' | 'infected' | 'error'
        tags: string[]
      }>
    }>('/files'),

  getDeleted: () =>
    request<{
      files: Array<{
        id: string
        originalName: string
        mimeType: string
        size: number
        uploadedAt: string
        deletedAt: string
        virusScanned: boolean
        virusScanResult?: 'clean' | 'infected' | 'error'
        tags: string[]
        isDeleted: boolean
      }>
    }>('/files/deleted'),

  delete: (fileId: string) =>
    request<{ success: boolean }>(`/files/${fileId}`, {
      method: 'DELETE',
    }),

  permanentDelete: (fileId: string) =>
    request<{ success: boolean }>(`/files/${fileId}/permanent`, {
      method: 'DELETE',
    }),

  restore: (fileId: string) =>
    request<{ success: boolean }>(`/files/${fileId}/restore`, {
      method: 'POST',
    }),

  // Cloudinary methods
  uploadToCloudinary: (formData: FormData) =>
    request<{
      fileId: string
      cloudinaryUrl: string
      thumbnailUrl?: string
      publicId: string
    }>('/files/cloudinary/upload', {
      method: 'POST',
      body: formData,
    }),

  requestCloudinaryUploadUrl: (uploadData: {
    fileName: string
    fileSize: number
    contentType: string
    encryptedName: string
    encryptedMimeType: string
    tags?: string[]
  }) =>
    request<{
      fileId: string
      uploadUrl: string
      uploadData: {
        signature: string
        timestamp: number
        api_key: string
        folder: string
      }
    }>('/files/cloudinary/upload-url', {
      method: 'POST',
      body: JSON.stringify(uploadData),
    }),

  getOptimizedImageUrl: (fileId: string, options?: {
    width?: number
    height?: number
    quality?: string
    format?: string
  }) => {
    const params = new URLSearchParams()
    if (options?.width) params.append('width', options.width.toString())
    if (options?.height) params.append('height', options.height.toString())
    if (options?.quality) params.append('quality', options.quality)
    if (options?.format) params.append('format', options.format)
    
    const queryString = params.toString()
    const url = `/files/${fileId}/optimized${queryString ? `?${queryString}` : ''}`
    
    return request<{ optimizedUrl: string }>(url)
  },

  getPreview: async (fileId: string, password: string) => {
    console.log('API: Getting preview for file:', fileId)
    
    try {
      const response = await request<{
        type: 'text' | 'image' | 'pdf' | 'video' | 'audio' | 'code' | 'document' | 'unsupported'
        content: string
        mimeType: string
        size: number
      }>(`/files/${fileId}/preview`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      
      console.log('API: Preview response:', response)
      
      // The server is returning URLs to encrypted content
      // We need to download and decrypt the content on the client side for all file types
      if (response.type === 'image' || response.type === 'pdf' || response.type === 'video' || response.type === 'audio' || response.type === 'text' || response.type === 'code') {
        try {
          console.log('Downloading encrypted content for decryption:', response.content)
          
          // Download the encrypted content
          const contentResponse = await fetch(response.content)
          console.log('Content response status:', contentResponse.status, contentResponse.statusText)
          
          if (!contentResponse.ok) {
            throw new Error(`Failed to download encrypted content: ${contentResponse.status}`)
          }
          
          const encryptedBlob = await contentResponse.blob()
          console.log('Downloaded encrypted blob, size:', encryptedBlob.size)
          
          // Import the decryption functions
          const { decryptFile } = await import('../crypto/files')
          
          // For file decryption, we need to use the user's master key
          // Since we don't have the user's actual password, we'll use the session-based approach
          // that derives the key from user ID (same as in useCrypto hook)
          const userString = localStorage.getItem('user')
          if (!userString) {
            throw new Error('User not found in session')
          }
          
          const user = JSON.parse(userString)
          console.log('User found for decryption:', user.id)
          
          // Derive master key using the same approach as useCrypto
          const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(user.id.padEnd(32, '0')),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
          )
          
          const masterKey = await window.crypto.subtle.deriveKey(
            {
              name: 'PBKDF2',
              salt: new TextEncoder().encode('vault-salt'),
              iterations: 100000,
              hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
          )
          
          console.log('Master key derived for file decryption')
          
          // Get the file metadata to extract encryption info
          const fileMetadata = await request<{
            id: string
            originalName: string
            mimeType: string
            size: number
            encryptedName: string
            encryptedMimeType: string
            uploadedAt: string
          }>(`/files/${fileId}/metadata`)
          
          console.log('File metadata:', fileMetadata)
          
          // Create metadata object for decryption (matching the structure from encryptFile)
          const metadata = {
            encryptedName: fileMetadata.encryptedName,
            encryptedMimeType: fileMetadata.encryptedMimeType,
            originalSize: fileMetadata.size,
            encryptedSize: encryptedBlob.size,
            iv: '', // IV is embedded in the encrypted file data
            chunkSize: 64 * 1024 // Default chunk size from crypto/files.ts
          }
          
          console.log('Decrypting file with metadata:', metadata)
          
          // Decrypt the file
          const { file: decryptedFile, mimeType } = await decryptFile(encryptedBlob, metadata, masterKey)
          
          console.log('File decrypted successfully, size:', decryptedFile.size, 'type:', mimeType)
          
          // For text/code files, read the content as text
          if (response.type === 'text' || response.type === 'code') {
            const text = await decryptedFile.text()
            console.log('Text content extracted, length:', text.length)
            
            return {
              type: response.type,
              content: text,
              error: undefined
            }
          }
          
          // For PDFs, return the raw Uint8Array data for SecurePDFViewer
          if (response.type === 'pdf') {
            const arrayBuffer = await decryptedFile.arrayBuffer()
            const uint8Array = new Uint8Array(arrayBuffer)
            console.log('Returning PDF as Uint8Array, size:', uint8Array.length)
            
            return {
              type: response.type,
              content: uint8Array,
              error: undefined
            }
          }
          
          // For other binary files (images, videos, etc.), create blob URL
          const blobUrl = URL.createObjectURL(decryptedFile)
          console.log('Created decrypted blob URL:', blobUrl)
          
          return {
            type: response.type,
            content: blobUrl,
            error: undefined
          }
        } catch (decryptError) {
          console.error('Failed to decrypt content for preview:', decryptError)
          
          // Fallback to direct URL (will likely fail but better than nothing)
          return {
            type: response.type,
            content: response.content,
            error: `Failed to decrypt: ${(decryptError as Error).message || 'Unknown error'}`
          }
        }
      }
      
      // For text/code, the content should already be decrypted server-side
      return {
        type: response.type,
        content: response.content,
        error: undefined
      }
    } catch (error) {
      console.error('API: Preview error:', error)
      throw error
    }
  },
}

// AI Debug API
export const aiDebugAPI = {
  // Get system status for AI Debug widget
  getStatus: () =>
    request<{
      success: boolean
      status: 'healthy' | 'degraded' | 'down'
      health: {
        email: string
        database: string
        storage: string
        overall: string
      }
      timestamp: string
      message: string
    }>(`/ai-debug/status`),

  // Send a chat message for AI analysis
  chat: (message: string, conversationHistory?: Array<{ role: string; content: string }>) =>
    request<{
      success: boolean
      response: string
      issueId?: string | null
      canAutoFix: boolean
      severity: 'low' | 'medium' | 'high' | 'critical'
      systemHealth: {
        overall: string
        email: string
        database: string
        storage: string
      }
    }>(`/ai-debug/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, conversationHistory })
    }),

  // Apply automatic fix for an issue
  applyAutoFix: (issueId: string) =>
    request<{
      success: boolean
      result: {
        appliedFixes: string[]
        message: string
        requiresManualReview: boolean
      }
    }>(`/ai-debug/auto-fix`, {
      method: 'POST',
      body: JSON.stringify({ issueId })
    })
}
