// Determine API base URL based on environment
const getApiBase = () => {
  // In production, use the full server URL
  if (import.meta.env.PROD && import.meta.env.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL}/api`
  }
  
  // In development, use proxy setup
  return '/api'
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
      console.log('⏳ Token refresh in cooldown period, skipping...')
      throw new Error('Token refresh in cooldown period')
    }
  }

  isRefreshing = true

  try {
    console.log('🔄 Attempting token refresh...')
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.log('❌ Token refresh failed with status:', response.status)
      throw new Error('Token refresh failed')
    }

    const data = await response.json()
    const newToken = data.access
    
    console.log('✅ Token refresh successful')
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
    const isPublicPage = currentPath === '/login' || currentPath === '/register' || currentPath === '/recovery'
    
    if (!isPublicPage) {
      console.log('🔄 Redirecting to login due to token refresh failure')
      // Use a flag to prevent multiple redirections
      if (!sessionStorage.getItem('redirecting-to-login')) {
        sessionStorage.setItem('redirecting-to-login', 'true')
        // Use setTimeout to prevent immediate redirect during other operations
        setTimeout(() => {
          sessionStorage.removeItem('redirecting-to-login')
          window.location.href = '/login'
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
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${authToken}`,
    }
  }

  try {
    let response = await fetch(url, config)
    
    // If unauthorized and we have a token, try to refresh it
    if (response.status === 401 && authToken && !endpoint.includes('/auth/')) {
      try {
        const newToken = await refreshAuthToken()
        
        // Retry the original request with the new token
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${newToken}`,
        }
        
        response = await fetch(url, config)
      } catch (refreshError) {
        // Refresh failed, throw the original error
        throw new APIError(401, 'Authentication failed')
      }
    }
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
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
    request<{ access: string; user?: { id: string; email: string; username: string } }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username, email, phoneNumber, password }),
    }).then(result => {
      setAuthToken(result.access)
      return result
    }),

  login: (identifier: string, password: string) =>
    request<{ access: string; requires2FA?: boolean; user?: { id: string; email: string; twoFactorEnabled: boolean } }>('/auth/login', {
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
    request<{ access: string; user: { id: string; email: string; twoFactorEnabled: boolean } }>('/auth/2fa/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, code }),
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

  setupSecurityQuestions: (email: string, questions: Array<{ question: string; answer: string }>) =>
    request<{ success: boolean; message: string }>('/auth/recovery/setup-questions', {
      method: 'POST',
      body: JSON.stringify({ email, questions }),
    }),

  getSecurityQuestions: (email: string) =>
    request<{ questions: string[] }>('/auth/recovery/get-questions', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  verifySecurityQuestions: (email: string, answers: string[]) =>
    request<{ bypassToken: string; message: string; expiresIn: number }>('/auth/recovery/verify-questions', {
      method: 'POST',
      body: JSON.stringify({ email, answers }),
    }),

  verifyEmergency: (email: string, username: string, phoneNumber: string, password: string) =>
    request<{ access: string; requires2FA?: boolean; user?: { id: string; email: string; username: string; twoFactorEnabled: boolean } }>('/auth/verify-emergency', {
      method: 'POST',
      body: JSON.stringify({ email, username, phoneNumber, password }),
    }).then(result => {
      // Only set token if verification is complete (no 2FA required)
      if (!result.requires2FA) {
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
