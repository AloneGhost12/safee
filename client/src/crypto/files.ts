/**
 * File encryption/decryption utilities for client-side file processing
 * Uses Web Crypto API for streaming encryption of large files
 */

export interface EncryptedFileMetadata {
  encryptedName: string
  encryptedMimeType: string
  originalSize: number
  encryptedSize: number
  iv: string
  chunkSize: number
}

export interface FileEncryptionProgress {
  loaded: number
  total: number
  percentage: number
}

const CHUNK_SIZE = 64 * 1024 // 64KB chunks for streaming

/**
 * Encrypt a file name using AES-GCM
 */
export async function encryptFileName(fileName: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(fileName)
  
  const iv = crypto.getRandomValues(new Uint8Array(12))
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  )
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)
  
  return btoa(String.fromCharCode(...combined))
}

/**
 * Check if a string is valid base64
 */
function isValidBase64(str: string): boolean {
  // Check if string is empty or has invalid characters
  if (!str || typeof str !== 'string') return false
  
  // Length must be reasonable for encrypted data (at least 16 chars for IV + some data)
  if (str.length < 16) return false
  
  // Check for valid base64 characters only (more lenient approach)
  const base64Regex = /^[A-Za-z0-9+/]+=*$/
  if (!base64Regex.test(str)) return false
  
  // Remove padding and check length
  const withoutPadding = str.replace(/=/g, '')
  const paddingLength = str.length - withoutPadding.length
  
  // Padding can only be 0, 1, or 2 characters
  if (paddingLength > 2) return false
  
  // Try to decode the full string to verify it's actually valid base64
  try {
    const decoded = atob(str)
    // Check if decoded has reasonable length (should be at least 12 bytes for IV)
    return decoded.length >= 12
  } catch {
    return false
  }
}

/**
 * Debug function to analyze a potentially encrypted string
 */
function analyzeEncryptedString(str: string): {
  length: number
  hasValidBase64Chars: boolean
  paddingCount: number
  decodable: boolean
  decodedLength?: number
  looksEncrypted: boolean
} {
  const length = str.length
  const hasValidBase64Chars = /^[A-Za-z0-9+/]*$/.test(str.replace(/=/g, ''))
  const paddingCount = (str.match(/=/g) || []).length
  
  let decodable = false
  let decodedLength: number | undefined
  
  try {
    const decoded = atob(str)
    decodable = true
    decodedLength = decoded.length
  } catch {
    decodable = false
  }
  
  const looksEncrypted = length >= 16 && hasValidBase64Chars && paddingCount <= 2 && decodable && (decodedLength || 0) >= 12
  
  return {
    length,
    hasValidBase64Chars,
    paddingCount,
    decodable,
    decodedLength,
    looksEncrypted
  }
}

/**
 * Decrypt a file name
 */
export async function decryptFileName(encryptedName: string, key: CryptoKey): Promise<string> {
  // Check if the string is properly base64 encoded
  if (!encryptedName || typeof encryptedName !== 'string') {
    throw new Error('Invalid encrypted name: empty or not a string')
  }
  
  // Clean the input string (remove any whitespace that might have been added)
  const cleanedName = encryptedName.trim()
  
  // If the string doesn't look like encrypted data, return it as-is
  // This handles legacy unencrypted data and standard MIME types
  if (cleanedName.length < 16 || !cleanedName.match(/^[A-Za-z0-9+/]+=*$/)) {
    // Only show warning for actual file names, not standard MIME types
    if (!cleanedName.includes('/') && !cleanedName.startsWith('application/') && !cleanedName.startsWith('text/') && !cleanedName.startsWith('image/')) {
      console.warn('File name does not appear to be encrypted, returning as-is:', cleanedName)
    }
    return cleanedName
  }
  
  // Validate base64 format before attempting decode
  if (!isValidBase64(cleanedName)) {
    const analysis = analyzeEncryptedString(cleanedName)
    console.warn('Invalid base64 format, analysis:', analysis, 'returning original name:', cleanedName)
    return cleanedName
  }
  
  let combined: Uint8Array
  try {
    // Try to decode base64
    const binaryString = atob(cleanedName)
    combined = new Uint8Array(
      binaryString.split('').map(char => char.charCodeAt(0))
    )
  } catch (error) {
    console.warn('Failed to decode base64, returning original name:', cleanedName, error)
    return cleanedName
  }
  
  if (combined.length < 12) {
    console.warn('Decoded data too short for IV + data, returning original name:', cleanedName)
    return cleanedName
  }
  
  const iv = combined.slice(0, 12)
  const encrypted = combined.slice(12)
  
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    )
    
    const decoder = new TextDecoder()
    const decryptedName = decoder.decode(decrypted)
    
    // Validate that the decrypted name is reasonable
    if (decryptedName && decryptedName.length > 0 && decryptedName.length < 1000) {
      return decryptedName
    } else {
      console.warn('Decrypted name is invalid, returning original:', cleanedName)
      return cleanedName
    }
  } catch (decryptError) {
    console.warn('Failed to decrypt file name, returning original:', cleanedName, decryptError)
    return cleanedName
  }
}

/**
 * Encrypt a file in chunks with progress tracking
 */
export async function encryptFile(
  file: File,
  key: CryptoKey,
  onProgress?: (progress: FileEncryptionProgress) => void
): Promise<{ encryptedBlob: Blob; metadata: EncryptedFileMetadata }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encryptedChunks: Uint8Array[] = []
  
  // Encrypt filename and MIME type
  const encryptedName = await encryptFileName(file.name, key)
  const encryptedMimeType = await encryptFileName(file.type, key)
  
  let totalProcessed = 0
  const totalSize = file.size
  
  // Process file in chunks
  for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE)
    const chunkBuffer = await chunk.arrayBuffer()
    
    // Create a unique IV for each chunk by combining base IV with chunk index
    const chunkIndex = Math.floor(offset / CHUNK_SIZE)
    const chunkIv = new Uint8Array(12)
    chunkIv.set(iv.slice(0, 8)) // Use first 8 bytes of base IV
    
    // Add chunk index to last 4 bytes (little-endian)
    const indexView = new DataView(chunkIv.buffer, 8, 4)
    indexView.setUint32(0, chunkIndex, true)
    
    // Encrypt chunk
    const encryptedChunk = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: chunkIv },
      key,
      chunkBuffer
    )
    
    encryptedChunks.push(new Uint8Array(encryptedChunk))
    
    totalProcessed += chunkBuffer.byteLength
    
    if (onProgress) {
      onProgress({
        loaded: totalProcessed,
        total: totalSize,
        percentage: Math.round((totalProcessed / totalSize) * 100)
      })
    }
  }
  
  // Combine all encrypted chunks with metadata
  const encryptedSize = encryptedChunks.reduce((total, chunk) => total + chunk.length, 0)
  const finalBlob = new Uint8Array(12 + encryptedSize) // IV + encrypted data
  
  // Add base IV at the beginning
  finalBlob.set(iv)
  
  let offset = 12
  for (const chunk of encryptedChunks) {
    finalBlob.set(chunk, offset)
    offset += chunk.length
  }
  
  const encryptedBlob = new Blob([finalBlob], { type: 'application/octet-stream' })
  
  const metadata: EncryptedFileMetadata = {
    encryptedName,
    encryptedMimeType,
    originalSize: file.size,
    encryptedSize: encryptedBlob.size,
    iv: btoa(String.fromCharCode(...iv)),
    chunkSize: CHUNK_SIZE
  }
  
  return { encryptedBlob, metadata }
}

/**
 * Decrypt a file with progress tracking
 */
export async function decryptFile(
  encryptedBlob: Blob,
  metadata: EncryptedFileMetadata,
  key: CryptoKey,
  onProgress?: (progress: FileEncryptionProgress) => void
): Promise<{ file: Blob; fileName: string; mimeType: string }> {
  const encryptedBuffer = await encryptedBlob.arrayBuffer()
  const encryptedData = new Uint8Array(encryptedBuffer)
  
  // Extract base IV
  const baseIv = encryptedData.slice(0, 12)
  const encrypted = encryptedData.slice(12)
  
  // Decrypt filename and MIME type
  const fileName = await decryptFileName(metadata.encryptedName, key)
  let mimeType = await decryptFileName(metadata.encryptedMimeType, key)
  
  // If MIME type is generic octet-stream, try to detect from file content
  if (mimeType === 'application/octet-stream' && metadata.originalSize > 0) {
    // For now, we'll keep the original logic and let the preview component handle detection
    // Future enhancement: Add file signature detection here
  }
  
  const decryptedChunks: Uint8Array[] = []
  let totalProcessed = 0
  
  // Calculate chunk size for encrypted data (includes GCM tag)
  const encryptedChunkSize = CHUNK_SIZE + 16 // 16 bytes for GCM auth tag
  
  // Process encrypted data in chunks
  for (let offset = 0; offset < encrypted.length; offset += encryptedChunkSize) {
    const chunkSize = Math.min(encryptedChunkSize, encrypted.length - offset)
    const encryptedChunk = encrypted.slice(offset, offset + chunkSize)
    
    // Reconstruct chunk IV
    const chunkIndex = Math.floor(offset / encryptedChunkSize)
    const chunkIv = new Uint8Array(12)
    chunkIv.set(baseIv.slice(0, 8))
    
    const indexView = new DataView(chunkIv.buffer, 8, 4)
    indexView.setUint32(0, chunkIndex, true)
    
    // Decrypt chunk
    const decryptedChunk = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: chunkIv },
      key,
      encryptedChunk
    )
    
    decryptedChunks.push(new Uint8Array(decryptedChunk))
    
    totalProcessed += chunkSize
    
    if (onProgress) {
      onProgress({
        loaded: totalProcessed,
        total: encrypted.length,
        percentage: Math.round((totalProcessed / encrypted.length) * 100)
      })
    }
  }
  
  // Combine all decrypted chunks
  const totalSize = decryptedChunks.reduce((total, chunk) => total + chunk.length, 0)
  const decryptedData = new Uint8Array(totalSize)
  
  let offset = 0
  for (const chunk of decryptedChunks) {
    decryptedData.set(chunk, offset)
    offset += chunk.length
  }
  
  const file = new Blob([decryptedData], { type: mimeType })
  
  return { file, fileName, mimeType }
}

/**
 * Validate file before encryption
 */
export function validateFileForUpload(file: File): void {
  const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed',
  ]

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`)
  }

  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`File type ${file.type} is not allowed`)
  }

  if (file.name.length > 255) {
    throw new Error('Filename is too long')
  }
}

/**
 * Upload encrypted file to S3 using presigned URL
 */
export async function uploadEncryptedFile(
  uploadUrl: string,
  encryptedBlob: Blob,
  contentType: string,
  onProgress?: (progress: FileEncryptionProgress) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          loaded: e.loaded,
          total: e.total,
          percentage: Math.round((e.loaded / e.total) * 100)
        })
      }
    })
    
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`))
      }
    })
    
    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'))
    })
    
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.send(encryptedBlob)
  })
}

/**
 * Download encrypted file from S3 using presigned URL
 */
export async function downloadEncryptedFile(
  downloadUrl: string,
  onProgress?: (progress: FileEncryptionProgress) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.responseType = 'blob'
    
    xhr.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          loaded: e.loaded,
          total: e.total,
          percentage: Math.round((e.loaded / e.total) * 100)
        })
      }
    })
    
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as Blob)
      } else {
        reject(new Error(`Download failed with status ${xhr.status}`))
      }
    })
    
    xhr.addEventListener('error', () => {
      reject(new Error('Download failed'))
    })
    
    xhr.open('GET', downloadUrl)
    xhr.send()
  })
}
