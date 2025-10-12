import { Router, Response, NextFunction } from 'express'
import { z } from 'zod'
import { ObjectId } from 'mongodb'
import { requireAuth, requireSessionAuth, AuthedRequest } from '../middleware/auth'
import { 
  fileAccessRateLimit, 
  logFileAccess, 
  validateFileSession,
  validateFileOperationRequest,
  fileOperationSchema
} from '../middleware/fileAccess'
import { filesCollection, FileMetadata } from '../models/file'
import { usersCollection } from '../models/user'
import { verifyPassword } from '../utils/crypto'
import { 
  generateUploadUrl, 
  generateDownloadUrl, 
  deleteFile, 
  virusScanFile,
  validateFile 
} from '../utils/s3'
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  getThumbnailUrl,
  getOptimizedImageUrl,
  generateSignedUploadUrl,
  validateCloudinaryConfig
} from '../utils/cloudinary'
import multer from 'multer'

const router = Router()

// Validation schemas
const uploadRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().min(1).max(100 * 1024 * 1024), // 100MB max
  contentType: z.string().min(1),
  encryptedName: z.string().min(1),
  encryptedMimeType: z.string().min(1),
  tags: z.array(z.string()).optional(),
})

const fileIdSchema = z.object({
  fileId: z.string().min(1),
})

/**
 * Request presigned URL for file upload
 */
router.post('/upload-url', requireSessionAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const parsed = uploadRequestSchema.parse(req.body)
    
    // Validate file
    validateFile(parsed.fileName, parsed.fileSize, parsed.contentType)

    // Generate presigned URL
    const uploadResponse = await generateUploadUrl({
      userId,
      fileName: parsed.fileName,
      fileSize: parsed.fileSize,
      contentType: parsed.contentType,
    })

    // Create file metadata record
    const fileMetadata: FileMetadata = {
      userId: new ObjectId(userId),
      originalName: parsed.encryptedName, // Client sends encrypted filename
      encryptedName: parsed.fileName, // What will be stored in S3
      mimeType: parsed.encryptedMimeType, // Client sends encrypted MIME type
      size: parsed.fileSize,
      s3Key: uploadResponse.s3Key,
      s3Bucket: process.env.S3_BUCKET_NAME || 'personal-vault-files',
      uploadedAt: new Date(),
      virusScanned: false,
      tags: parsed.tags || [],
      isDeleted: false,
    }

    const filesCol = filesCollection()
    const result = await filesCol.insertOne(fileMetadata)

    res.json({
      uploadUrl: uploadResponse.uploadUrl,
      fileId: result.insertedId.toHexString(),
      s3Key: uploadResponse.s3Key,
      expiresIn: uploadResponse.expiresIn,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * Confirm upload completion and trigger virus scan
 */
router.post('/upload-complete', requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { fileId } = fileIdSchema.parse(req.body)
    const filesCol = filesCollection()

    // Find the file
    const file = await filesCol.findOne({
      _id: new ObjectId(fileId),
      userId: new ObjectId(userId),
    })

    if (!file) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Trigger virus scan asynchronously (only for S3 files)
    if (file.s3Key) {
      virusScanFile(file.s3Key)
      .then(async (result) => {
        await filesCol.updateOne(
          { _id: file._id },
          {
            $set: {
              virusScanned: true,
              virusScanResult: result,
            },
          }
        )
      })
      .catch((error) => {
        console.error('Virus scan failed:', error)
        filesCol.updateOne(
          { _id: file._id },
          {
            $set: {
              virusScanned: true,
              virusScanResult: 'error',
            },
          }
        )
      })
    }

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

/**
 * Get presigned URL for file download
 */
router.post('/:fileId/download-url', 
  requireAuth, 
  validateFileSession,
  fileAccessRateLimit(5, 300000), // 5 attempts per 5 minutes
  validateFileOperationRequest(fileOperationSchema),
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { fileId } = req.params
    const { password } = req.body

    const filesCol = filesCollection()

    // Find the file
    const file = await filesCol.findOne({
      _id: new ObjectId(fileId),
      userId: new ObjectId(userId),
      isDeleted: { $ne: true },
    })

    if (!file) {
      logFileAccess(userId, fileId, 'download', req, false, 'File not found')
      return res.status(404).json({ error: 'File not found' })
    }

    // Verify password - Must be user's main password
    if (!password || password.length < 1) {
      logFileAccess(userId, fileId, 'download', req, false, 'Invalid password')
      return res.status(401).json({ error: 'Invalid password' })
    }

    // Get user data to verify password
    const usersCol = usersCollection()
    const user = await usersCol.findOne({ _id: new ObjectId(userId) })
    
    if (!user) {
      logFileAccess(userId, fileId, 'download', req, false, 'User not found')
      return res.status(404).json({ error: 'User not found' })
    }

    // Verify that the provided password is the user's main password
    const passwordValid = await verifyPassword(user.passwordHash, password)
    if (!passwordValid) {
      logFileAccess(userId, fileId, 'download', req, false, 'Invalid main password')
      return res.status(401).json({ error: 'Invalid password. Only the main password can be used to download files.' })
    }

    // Check virus scan status
    if (file.virusScanResult === 'infected') {
      logFileAccess(userId, fileId, 'download', req, false, 'File is infected')
      return res.status(403).json({ error: 'File is infected and cannot be downloaded' })
    }

    // Check storage type and generate appropriate download URL
    if (!file.s3Key && !file.cloudinaryUrl) {
      logFileAccess(userId, fileId, 'download', req, false, 'No storage information')
      return res.status(400).json({ error: 'File storage information missing' })
    }

    if (file.s3Key) {
      // Generate S3 download URL
      const downloadResponse = await generateDownloadUrl(file.s3Key)

      logFileAccess(userId, fileId, 'download', req, true)

      res.json({
        downloadUrl: downloadResponse.downloadUrl,
        expiresIn: downloadResponse.expiresIn,
        fileName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
      })
    } else if (file.cloudinaryUrl) {
      // For Cloudinary files, return the direct URL
      logFileAccess(userId, fileId, 'download', req, true)

      res.json({
        downloadUrl: file.cloudinaryUrl,
        expiresIn: 86400, // 24 hours (Cloudinary URLs are long-lived)
        fileName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
      })
    }
  } catch (err) {
    const userId = req.userId || 'unknown'
    const { fileId } = req.params
    logFileAccess(userId, fileId, 'download', req, false, err instanceof Error ? err.message : 'Unknown error')
    next(err)
  }
})

/**
 * Get list of user's files
 */
router.get('/', requireSessionAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const filesCol = filesCollection()
    const files = await filesCol
      .find({
        userId: new ObjectId(userId),
        isDeleted: { $ne: true },
      })
      .sort({ uploadedAt: -1 })
      .toArray()

    const filesWithoutS3Keys = files.map(file => ({
      id: file._id?.toHexString(),
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      uploadedAt: file.uploadedAt,
      virusScanned: file.virusScanned,
      virusScanResult: file.virusScanResult,
      tags: file.tags || [],
      isDeleted: false,
    }))

    res.json({ files: filesWithoutS3Keys })
  } catch (err) {
    next(err)
  }
})

/**
 * Get file metadata for decryption (used by preview system)
 */
router.get('/:fileId/metadata', requireSessionAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { fileId } = req.params

    const filesCol = filesCollection()
    const file = await filesCol.findOne({
      _id: new ObjectId(fileId),
      userId: new ObjectId(userId),
      isDeleted: { $ne: true },
    })

    if (!file) {
      return res.status(404).json({ error: 'File not found' })
    }

    res.json({
      id: file._id?.toHexString(),
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      encryptedName: file.encryptedName,
      encryptedMimeType: file.mimeType, // In the current model, mimeType is stored encrypted
      uploadedAt: file.uploadedAt,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * Get list of user's deleted files (for trash)
 */
router.get('/deleted', requireSessionAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const filesCol = filesCollection()
    const files = await filesCol
      .find({
        userId: new ObjectId(userId),
        isDeleted: true,
      })
      .sort({ deletedAt: -1 })
      .toArray()

    const filesWithoutS3Keys = files.map(file => ({
      id: file._id?.toHexString(),
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      uploadedAt: file.uploadedAt,
      deletedAt: file.deletedAt,
      virusScanned: file.virusScanned,
      virusScanResult: file.virusScanResult,
      tags: file.tags || [],
      isDeleted: true,
    }))

    res.json({ files: filesWithoutS3Keys })
  } catch (err) {
    next(err)
  }
})

/**
 * Delete a file
 */
router.delete('/:fileId', requireSessionAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { fileId } = req.params
    const filesCol = filesCollection()

    // Find the file
    const file = await filesCol.findOne({
      _id: new ObjectId(fileId),
      userId: new ObjectId(userId),
    })

    if (!file) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Soft delete - mark as deleted
    await filesCol.updateOne(
      { _id: file._id },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      }
    )

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

/**
 * Permanently delete a file
 */
router.delete('/:fileId/permanent', requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { fileId } = req.params
    const filesCol = filesCollection()

    // Find the file
    const file = await filesCol.findOne({
      _id: new ObjectId(fileId),
      userId: new ObjectId(userId),
    })

    if (!file) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Delete from storage based on storage type
    try {
      if (file.s3Key) {
        await deleteFile(file.s3Key)
      } else if (file.cloudinaryPublicId) {
        await deleteFromCloudinary(file.cloudinaryPublicId)
      }
    } catch (storageError) {
      console.error('Failed to delete from storage:', storageError)
      // Continue with database deletion even if storage deletion fails
    }

    // Delete from database
    await filesCol.deleteOne({ _id: file._id })

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

/**
 * Restore a deleted file
 */
router.post('/:fileId/restore', requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { fileId } = req.params
    const filesCol = filesCollection()

    // Find the deleted file
    const file = await filesCol.findOne({
      _id: new ObjectId(fileId),
      userId: new ObjectId(userId),
      isDeleted: true,
    })

    if (!file) {
      return res.status(404).json({ error: 'Deleted file not found' })
    }

    // Restore the file
    await filesCol.updateOne(
      { _id: file._id },
      {
        $unset: {
          isDeleted: '',
          deletedAt: '',
        },
      }
    )

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
})

/**
 * Upload file directly to Cloudinary (alternative to S3)
 */
router.post('/cloudinary/upload', requireAuth, upload.single('file'), async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    if (!validateCloudinaryConfig()) {
      return res.status(503).json({ error: 'Cloudinary not configured' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    const { encryptedName, encryptedMimeType, tags } = req.body

    if (!encryptedName || !encryptedMimeType) {
      return res.status(400).json({ error: 'Missing encrypted metadata' })
    }

    // Validate file
    validateFile(req.file.originalname, req.file.size, req.file.mimetype)

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: `vault-files/${userId}`,
      resource_type: 'auto',
      max_file_size: 10 * 1024 * 1024 // 10MB
    })

    // Save metadata to database
    const filesCol = filesCollection()
    const fileDoc: Omit<FileMetadata, '_id'> = {
      userId: new ObjectId(userId),
      originalName: req.file.originalname,
      encryptedName,
      mimeType: req.file.mimetype,
      size: req.file.size,
      storageType: 'cloudinary',
      cloudinaryPublicId: result.public_id,
      cloudinaryUrl: result.secure_url,
      thumbnailUrl: result.resource_type === 'image' ? getThumbnailUrl(result.public_id) : undefined,
      tags: tags ? JSON.parse(tags) : [],
      uploadedAt: new Date(),
      virusScanned: false,
      virusScanStatus: 'pending',
    }

    const insertResult = await filesCol.insertOne(fileDoc)

    // Schedule virus scan (if applicable)
    try {
      await virusScanFile(result.public_id)
    } catch (scanError) {
      console.warn('Virus scan failed to start:', scanError)
    }

    res.json({
      fileId: insertResult.insertedId.toString(),
      cloudinaryUrl: result.secure_url,
      thumbnailUrl: fileDoc.thumbnailUrl,
      publicId: result.public_id
    })
  } catch (err) {
    next(err)
  }
})

/**
 * Get Cloudinary signed upload URL for direct client uploads
 */
router.post('/cloudinary/upload-url', requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    if (!validateCloudinaryConfig()) {
      return res.status(503).json({ error: 'Cloudinary not configured' })
    }

    const parsed = uploadRequestSchema.parse(req.body)

    // Validate file
    validateFile(parsed.fileName, parsed.fileSize, parsed.contentType)

    // Generate signed upload URL
    const signedUrl = generateSignedUploadUrl({
      folder: `vault-files/${userId}`,
      maxFileSize: 10 * 1024 * 1024,
      allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'txt']
    })

    // Create pending file record
    const filesCol = filesCollection()
    const fileDoc: Omit<FileMetadata, '_id'> = {
      userId: new ObjectId(userId),
      originalName: parsed.fileName,
      encryptedName: parsed.encryptedName,
      mimeType: parsed.contentType,
      size: parsed.fileSize,
      storageType: 'cloudinary',
      cloudinaryPublicId: '', // Will be updated after upload
      tags: parsed.tags || [],
      uploadedAt: new Date(),
      virusScanned: false,
      virusScanStatus: 'pending',
    }

    const insertResult = await filesCol.insertOne(fileDoc)

    res.json({
      fileId: insertResult.insertedId.toString(),
      uploadUrl: signedUrl.url,
      uploadData: {
        signature: signedUrl.signature,
        timestamp: signedUrl.timestamp,
        api_key: signedUrl.apiKey,
        folder: `vault-files/${userId}`
      }
    })
  } catch (err) {
    next(err)
  }
})

/**
 * Get optimized image URL from Cloudinary
 */
router.get('/:fileId/optimized', requireSessionAuth, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { fileId } = req.params
    const { width, height, quality, format } = req.query

    const filesCol = filesCollection()
    const file = await filesCol.findOne({
      _id: new ObjectId(fileId),
      userId: new ObjectId(userId),
      isDeleted: { $ne: true },
      storageType: 'cloudinary'
    })

    if (!file) {
      return res.status(404).json({ error: 'File not found' })
    }

    if (!file.cloudinaryPublicId) {
      return res.status(400).json({ error: 'File not uploaded to Cloudinary' })
    }

    const optimizedUrl = getOptimizedImageUrl(file.cloudinaryPublicId, {
      width: width ? parseInt(width as string) : undefined,
      height: height ? parseInt(height as string) : undefined,
      quality: quality ? (Number.isInteger(Number(quality)) ? Number(quality) : 'auto') : 'auto',
      format: format && ['jpg', 'png', 'webp', 'auto'].includes(format as string) ? format as ('jpg' | 'png' | 'webp' | 'auto') : 'auto'
    })

    res.json({ optimizedUrl })
  } catch (err) {
    next(err)
  }
})

/**
 * Get file preview without downloading the entire file
 */
router.post('/:fileId/preview', 
  requireAuth, 
  validateFileSession,
  fileAccessRateLimit(10, 300000), // 10 preview attempts per 5 minutes
  validateFileOperationRequest(fileOperationSchema),
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { fileId } = req.params
    const { password } = req.body

    const filesCol = filesCollection()
    const file = await filesCol.findOne({
      _id: new ObjectId(fileId),
      userId: new ObjectId(userId),
      isDeleted: { $ne: true },
    })

    if (!file) {
      logFileAccess(userId, fileId, 'preview', req, false, 'File not found')
      return res.status(404).json({ error: 'File not found' })
    }

    // Verify password - Must be user's main password
    if (!password || password.length < 1) {
      console.log('🔐 Preview failed: Empty password provided')
      logFileAccess(userId, fileId, 'preview', req, false, 'Invalid password')
      return res.status(401).json({ error: 'Invalid password' })
    }

    // Get user data to verify password
    const usersCol = usersCollection()
    const user = await usersCol.findOne({ _id: new ObjectId(userId) })
    
    if (!user) {
      logFileAccess(userId, fileId, 'preview', req, false, 'User not found')
      return res.status(404).json({ error: 'User not found' })
    }

    // Verify that the provided password is the user's main password
    console.log('🔐 Password verification for preview:', {
      userId: userId,
      fileId: fileId,
      passwordLength: password?.length || 0,
      userHashExists: !!user.passwordHash,
      timestamp: new Date().toISOString()
    })
    
    const passwordValid = await verifyPassword(user.passwordHash, password)
    console.log('🔐 Password verification result:', {
      userId: userId,
      valid: passwordValid,
      timestamp: new Date().toISOString()
    })
    
    if (!passwordValid) {
      logFileAccess(userId, fileId, 'preview', req, false, 'Invalid main password')
      return res.status(401).json({ error: 'Invalid password. Only the main password can be used to access files.' })
    }

    // Check virus scan status
    if (file.virusScanResult === 'infected') {
      logFileAccess(userId, fileId, 'preview', req, false, 'File is infected')
      return res.status(403).json({ error: 'File is infected and cannot be previewed' })
    }

    // Determine preview type based on MIME type and file extension
    const mimeType = file.mimeType?.toLowerCase() || ''
    const fileName = file.originalName?.toLowerCase() || ''
    let previewType: 'text' | 'image' | 'pdf' | 'video' | 'audio' | 'code' | 'document' | 'unsupported' = 'unsupported'
    
    // Get file extension
    const extension = fileName.split('.').pop() || ''
    
    // Text-based files
    if (mimeType.includes('text/') || 
        mimeType.includes('application/json') ||
        mimeType.includes('application/xml') ||
        mimeType.includes('application/javascript') ||
        mimeType.includes('application/typescript') ||
        mimeType.includes('text/csv') ||
        mimeType.includes('text/markdown') ||
        mimeType.includes('text/yaml') ||
        mimeType.includes('text/x-') ||
        mimeType.includes('application/x-sh') ||
        ['txt', 'log', 'ini', 'conf', 'cfg', 'env', 'gitignore', 'dockerfile', 'readme', 'md', 'csv', 'json', 'xml', 'yaml', 'yml'].includes(extension)) {
      previewType = 'text'
    } 
    // Code files
    else if (mimeType.includes('application/x-python') ||
             mimeType.includes('application/x-java') ||
             mimeType.includes('application/x-c') ||
             mimeType.includes('application/x-cpp') ||
             mimeType.includes('application/x-php') ||
             mimeType.includes('application/x-ruby') ||
             mimeType.includes('application/x-go') ||
             mimeType.includes('application/x-rust') ||
             mimeType.includes('application/sql') ||
             ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'php', 'rb', 'go', 'rs', 'sql', 'sh', 'bash', 'ps1', 'bat', 'css', 'scss', 'less', 'html', 'htm', 'vue', 'svelte'].includes(extension)) {
      previewType = 'code'
    }
    // Images
    else if (mimeType.includes('image/') ||
             ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif', 'ico'].includes(extension)) {
      previewType = 'image'
    }
    // PDFs and documents
    else if (mimeType.includes('pdf') ||
             mimeType.includes('application/pdf') ||
             extension === 'pdf') {
      previewType = 'pdf'
    }
    // Document formats
    else if (mimeType.includes('application/msword') ||
             mimeType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml') ||
             mimeType.includes('application/vnd.oasis.opendocument.text') ||
             mimeType.includes('application/rtf') ||
             ['doc', 'docx', 'odt', 'rtf', 'pages'].includes(extension)) {
      previewType = 'document'
    }
    // Video files
    else if (mimeType.includes('video/') ||
             ['mp4', 'webm', 'avi', 'mov', 'wmv', 'mkv', 'flv', 'm4v', '3gp'].includes(extension)) {
      previewType = 'video'
    }
    // Audio files
    else if (mimeType.includes('audio/') ||
             ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma', 'opus'].includes(extension)) {
      previewType = 'audio'
    }

    if (previewType === 'unsupported') {
      logFileAccess(userId, fileId, 'preview', req, true, 'Unsupported file type')
      return res.json({
        type: 'unsupported',
        content: '',
        mimeType: file.mimeType,
        size: file.size
      })
    }

    // Get preview content based on storage type
    let previewContent = ''

    try {
      if (file.s3Key) {
        // For S3 files, get download URL and fetch content
        const downloadResponse = await generateDownloadUrl(file.s3Key)
        if (process.env.NODE_ENV === 'development') {
          console.log(`[DEBUG] Download response for ${file.originalName}:`, downloadResponse)
        }
        
        if (!downloadResponse || !downloadResponse.downloadUrl) {
          console.error(`[ERROR] Invalid download response for ${file.originalName}:`, downloadResponse)
          return res.json({
            type: previewType,
            content: '',
            mimeType: file.mimeType,
            size: file.size,
            error: 'Failed to generate download URL'
          })
        }
        
        if (previewType === 'text' || previewType === 'code') {
          // For text/code files, return the download URL - client will decrypt
          previewContent = downloadResponse.downloadUrl
        } else if (previewType === 'pdf') {
          // For PDFs, return the direct URL and let the client handle viewer selection
          previewContent = downloadResponse.downloadUrl
        } else if (previewType === 'image' || previewType === 'video' || previewType === 'audio') {
          // For media files, return the download URL directly
          previewContent = downloadResponse.downloadUrl
          if (process.env.NODE_ENV === 'development') {
            console.log(`[DEBUG] Image preview URL for ${file.originalName}:`, previewContent)
          }
          
          // Validate URL format
          if (!previewContent.startsWith('http')) {
            console.error(`[ERROR] Invalid URL format for ${file.originalName}:`, previewContent)
            previewContent = `Failed to generate valid URL: ${previewContent}`
          }
        } else if (previewType === 'document') {
          // For documents, provide download URL (can't preview content directly)
          previewContent = downloadResponse.downloadUrl
        }
      } else if (file.cloudinaryUrl) {
        // For Cloudinary files, use the direct URL
        if (previewType === 'text' || previewType === 'code') {
          // For text/code files, return the download URL - client will decrypt
          previewContent = file.cloudinaryUrl
        } else if (previewType === 'pdf') {
          // For PDFs, return the direct URL and let the client handle viewer selection
          previewContent = file.cloudinaryUrl
        } else {
          previewContent = file.cloudinaryUrl
          if (process.env.NODE_ENV === 'development') {
            console.log(`[DEBUG] Cloudinary image URL for ${file.originalName}:`, previewContent)
          }
        }
      }

      logFileAccess(userId, fileId, 'preview', req, true)

      res.json({
        type: previewType,
        content: previewContent,
        mimeType: file.mimeType,
        size: file.size
      })
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEBUG] Preview response for ${file.originalName}:`, {
          type: previewType,
          contentType: typeof previewContent,
          contentLength: typeof previewContent === 'string' ? previewContent.length : 'N/A',
          contentPreview: typeof previewContent === 'string' && previewContent.length < 100 ? previewContent : 'Too long to show'
        })
      }
    } catch (fetchError) {
      logFileAccess(userId, fileId, 'preview', req, false, 'Failed to fetch preview content')
      res.json({
        type: previewType,
        content: '',
        mimeType: file.mimeType,
        size: file.size,
        error: 'Failed to load preview content'
      })
    }
  } catch (err) {
    const userId = req.userId || 'unknown'
    const { fileId } = req.params
    logFileAccess(userId, fileId, 'preview', req, false, err instanceof Error ? err.message : 'Unknown error')
    next(err)
  }
})

export default router
