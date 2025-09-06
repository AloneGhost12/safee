import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'

// Initialize S3 client (works with both AWS S3 and Cloudflare R2)
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT || undefined, // For R2, set this to your R2 endpoint
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', // Required for some S3-compatible services
})

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'personal-vault-files'
const PRESIGNED_URL_EXPIRES_IN = 15 * 60 // 15 minutes

export interface UploadParams {
  userId: string
  fileName: string
  fileSize: number
  contentType: string
}

export interface UploadResponse {
  uploadUrl: string
  s3Key: string
  expiresIn: number
}

export interface DownloadResponse {
  downloadUrl: string
  expiresIn: number
}

/**
 * Generate a presigned URL for uploading a file to S3
 */
export async function generateUploadUrl(params: UploadParams): Promise<UploadResponse> {
  // Generate unique S3 key with user ID and UUID
  const fileExtension = params.fileName.split('.').pop()
  const s3Key = `users/${params.userId}/files/${uuidv4()}${fileExtension ? '.' + fileExtension : ''}`

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ContentType: params.contentType,
    ContentLength: params.fileSize,
    Metadata: {
      'user-id': params.userId,
      'original-filename': params.fileName, // This will be encrypted on client side
      'upload-timestamp': new Date().toISOString(),
    },
  })

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: PRESIGNED_URL_EXPIRES_IN,
  })

  return {
    uploadUrl,
    s3Key,
    expiresIn: PRESIGNED_URL_EXPIRES_IN,
  }
}

/**
 * Generate a presigned URL for downloading a file from S3
 */
export async function generateDownloadUrl(s3Key: string): Promise<DownloadResponse> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  })

  const downloadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: PRESIGNED_URL_EXPIRES_IN,
  })

  return {
    downloadUrl,
    expiresIn: PRESIGNED_URL_EXPIRES_IN,
  }
}

/**
 * Delete a file from S3
 */
export async function deleteFile(s3Key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  })

  await s3Client.send(command)
}

/**
 * Virus scan hook - implement actual virus scanning here
 * This is a stub that always returns 'clean'
 */
export async function virusScanFile(s3Key: string): Promise<'clean' | 'infected' | 'error'> {
  // TODO: Integrate with actual virus scanning service
  // For now, simulate a scan
  console.log(`[VIRUS_SCAN] Scanning file: ${s3Key}`)
  
  // Simulate scan delay
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Always return clean for demo
  return 'clean'
}

/**
 * Validate file size and type
 */
export function validateFile(fileName: string, fileSize: number, contentType: string) {
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
    'application/octet-stream', // Allow encrypted files
  ]

  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`)
  }

  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new Error(`File type ${contentType} is not allowed`)
  }

  // Additional filename validation
  if (fileName.length > 255) {
    throw new Error('Filename is too long')
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(fileName.replace(/\s+/g, '-'))) {
    throw new Error('Filename contains invalid characters')
  }
}
