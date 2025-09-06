/**
 * Specific unit tests for files routes
 * Tests file upload, download, deletion, and cloud storage integration
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
// import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient, Db, ObjectId } from 'mongodb'
import { signAccess } from '../../src/utils/jwt'
import { hashPassword } from '../../src/utils/crypto'

// Import files router
import filesRouter from '../../src/routes/files'

// Mock external services
const mockS3 = {
  generateUploadUrl: vi.fn(),
  generateDownloadUrl: vi.fn(),
  deleteFile: vi.fn(),
  virusScanFile: vi.fn(),
  validateFile: vi.fn()
}

const mockCloudinary = {
  uploadToCloudinary: vi.fn(),
  deleteFromCloudinary: vi.fn(),
  getThumbnailUrl: vi.fn(),
  getOptimizedImageUrl: vi.fn(),
  generateSignedUploadUrl: vi.fn(),
  validateCloudinaryConfig: vi.fn()
}

vi.mock('../../src/utils/s3', () => mockS3)
vi.mock('../../src/utils/cloudinary', () => mockCloudinary)

vi.mock('../../src/services/auditLogger', () => ({
  AuditLogger: {
    getInstance: vi.fn().mockReturnValue({
      logFileOperation: vi.fn(),
      logSecurityEvent: vi.fn()
    })
  }
}))

// let mongoServer: MongoMemoryServer
let client: MongoClient
let db: Db
let app: express.Application
let user: any
let authToken: string

beforeAll(async () => {
  // mongoServer = await MongoMemoryServer.create()
  // const uri = mongoServer.getUri()
  const uri = 'mongodb://localhost:27017'  // Use real MongoDB for testing
  client = new MongoClient(uri)
  await client.connect()
  db = client.db('test-files')
  
  process.env.MONGODB_URI = uri
  process.env.JWT_SECRET = 'test-secret-key'
  process.env.NODE_ENV = 'test'
  process.env.AWS_S3_BUCKET = 'test-bucket'
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud'
})

afterAll(async () => {
  await client.close()
  // await mongoServer.stop()
})

beforeEach(async () => {
  app = express()
  app.use(express.json())
  app.use('/files', filesRouter)
  
  // Error handling
  app.use((err: any, req: any, res: any, next: any) => {
    res.status(err.status || 500).json({ error: err.message })
  })
  
  // Create test user
  const hashedPassword = await hashPassword('Test123!@#')
  const userResult = await db.collection('users').insertOne({
    email: 'test@example.com',
    passwordHash: hashedPassword,
    salt: 'test-salt',
    wrappedDEK: 'test-wrapped-dek',
    wrappedDEKIv: 'test-iv',
    createdAt: new Date()
  })
  
  user = { ...userResult, _id: userResult.insertedId }
  authToken = signAccess({ userId: user._id.toString() })
  
  // Reset mocks
  vi.clearAllMocks()
  
  // Set up default mock responses
  mockS3.generateUploadUrl.mockResolvedValue('https://s3.example.com/upload-url')
  mockS3.generateDownloadUrl.mockResolvedValue('https://s3.example.com/download-url')
  mockS3.deleteFile.mockResolvedValue(undefined)
  mockS3.virusScanFile.mockResolvedValue({ isClean: true })
  mockS3.validateFile.mockImplementation(() => {}) // No throw = valid
  
  mockCloudinary.uploadToCloudinary.mockResolvedValue({
    secure_url: 'https://cloudinary.example.com/image.jpg',
    public_id: 'test-image-id'
  })
  mockCloudinary.deleteFromCloudinary.mockResolvedValue(undefined)
  mockCloudinary.getThumbnailUrl.mockReturnValue('https://cloudinary.example.com/thumb.jpg')
  mockCloudinary.getOptimizedImageUrl.mockReturnValue('https://cloudinary.example.com/optimized.jpg')
  mockCloudinary.generateSignedUploadUrl.mockResolvedValue('https://cloudinary.example.com/upload')
  mockCloudinary.validateCloudinaryConfig.mockReturnValue(true)
})

afterEach(async () => {
  await db.collection('users').deleteMany({})
  await db.collection('files').deleteMany({})
})

describe('Files Routes', () => {
  describe('POST /files/upload-url', () => {
    const validUploadRequest = {
      fileName: 'test-document.pdf',
      fileSize: 1024 * 1024, // 1MB
      contentType: 'application/pdf',
      encryptedName: 'encrypted-filename-base64',
      encryptedMimeType: 'encrypted-mimetype-base64',
      tags: ['document', 'test']
    }

    it('should generate upload URL for valid file', async () => {
      const response = await request(app)
        .post('/files/upload-url')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validUploadRequest)
        .expect(200)
      
      expect(response.body).toHaveProperty('uploadUrl', 'https://s3.example.com/upload-url')
      expect(response.body).toHaveProperty('fileId')
      expect(mockS3.validateFile).toHaveBeenCalledWith(
        validUploadRequest.fileName,
        validUploadRequest.fileSize,
        validUploadRequest.contentType
      )
      expect(mockS3.generateUploadUrl).toHaveBeenCalled()
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/files/upload-url')
        .send(validUploadRequest)
        .expect(401)
      
      expect(response.body.error).toContain('Unauthorized')
    })

    it('should validate file name length', async () => {
      const invalidRequest = {
        ...validUploadRequest,
        fileName: 'a'.repeat(256) + '.pdf' // Too long
      }
      
      const response = await request(app)
        .post('/files/upload-url')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRequest)
        .expect(400)
      
      expect(response.body.error).toBeDefined()
    })

    it('should validate file size limits', async () => {
      const invalidRequest = {
        ...validUploadRequest,
        fileSize: 101 * 1024 * 1024 // 101MB - exceeds limit
      }
      
      const response = await request(app)
        .post('/files/upload-url')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRequest)
        .expect(400)
      
      expect(response.body.error).toBeDefined()
    })

    it('should validate content type', async () => {
      const invalidRequest = {
        ...validUploadRequest,
        contentType: ''
      }
      
      const response = await request(app)
        .post('/files/upload-url')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRequest)
        .expect(400)
      
      expect(response.body.error).toBeDefined()
    })

    it('should handle S3 validation errors', async () => {
      mockS3.validateFile.mockImplementation(() => {
        throw new Error('File type not allowed')
      })
      
      const response = await request(app)
        .post('/files/upload-url')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validUploadRequest)
        .expect(400)
      
      expect(response.body.error).toContain('File type not allowed')
    })

    it('should handle S3 service errors', async () => {
      mockS3.generateUploadUrl.mockRejectedValue(new Error('S3 service unavailable'))
      
      const response = await request(app)
        .post('/files/upload-url')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validUploadRequest)
        .expect(500)
      
      expect(response.body.error).toBeDefined()
    })

    it('should store file metadata in database', async () => {
      const response = await request(app)
        .post('/files/upload-url')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validUploadRequest)
        .expect(200)
      
      const fileId = response.body.fileId
      const savedFile = await db.collection('files').findOne({ _id: new ObjectId(fileId) })
      
      expect(savedFile).toBeTruthy()
      expect(savedFile!.userId.toString()).toBe(user._id.toString())
      expect(savedFile!.encryptedName).toBe(validUploadRequest.encryptedName)
      expect(savedFile!.fileSize).toBe(validUploadRequest.fileSize)
      expect(savedFile!.status).toBe('pending')
    })

    it('should handle optional tags field', async () => {
      const requestWithoutTags = {
        fileName: 'test.pdf',
        fileSize: 1024,
        contentType: 'application/pdf',
        encryptedName: 'encrypted-name',
        encryptedMimeType: 'encrypted-type'
        // tags omitted
      }
      
      const response = await request(app)
        .post('/files/upload-url')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestWithoutTags)
        .expect(200)
      
      expect(response.body).toHaveProperty('uploadUrl')
    })
  })

  describe('POST /files/:fileId/confirm-upload', () => {
    let fileId: string

    beforeEach(async () => {
      const file = await db.collection('files').insertOne({
        userId: user._id,
        encryptedName: 'encrypted-name',
        encryptedMimeType: 'encrypted-type',
        originalSize: 1024,
        fileSize: 1024,
        s3Key: 'test-s3-key',
        contentType: 'application/pdf',
        tags: ['test'],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      fileId = file.insertedId.toString()
    })

    it('should confirm upload and run virus scan', async () => {
      const response = await request(app)
        .post(`/files/${fileId}/confirm-upload`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
      
      expect(response.body).toHaveProperty('message', 'Upload confirmed, file is being processed')
      expect(mockS3.virusScanFile).toHaveBeenCalled()
      
      // Check file status updated
      const updatedFile = await db.collection('files').findOne({ _id: new ObjectId(fileId) })
      expect(updatedFile!.status).toBe('uploaded')
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/files/${fileId}/confirm-upload`)
        .expect(401)
      
      expect(response.body.error).toContain('Unauthorized')
    })

    it('should validate file ownership', async () => {
      const otherUser = await db.collection('users').insertOne({
        email: 'other@example.com',
        passwordHash: 'hash',
        salt: 'salt'
      })
      const otherToken = signAccess({ userId: otherUser.insertedId.toString() })
      
      const response = await request(app)
        .post(`/files/${fileId}/confirm-upload`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404)
      
      expect(response.body.error).toContain('File not found')
    })

    it('should handle non-existent file', async () => {
      const fakeFileId = new ObjectId().toString()
      
      const response = await request(app)
        .post(`/files/${fakeFileId}/confirm-upload`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404)
      
      expect(response.body.error).toContain('File not found')
    })

    it('should handle virus scan failure', async () => {
      mockS3.virusScanFile.mockResolvedValue({ isClean: false, threats: ['malware.exe'] })
      
      const response = await request(app)
        .post(`/files/${fileId}/confirm-upload`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400)
      
      expect(response.body.error).toContain('security scan')
      
      // File should be marked as infected
      const updatedFile = await db.collection('files').findOne({ _id: new ObjectId(fileId) })
      expect(updatedFile!.status).toBe('infected')
    })

    it('should handle virus scan service error', async () => {
      mockS3.virusScanFile.mockRejectedValue(new Error('Scan service unavailable'))
      
      const response = await request(app)
        .post(`/files/${fileId}/confirm-upload`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500)
      
      expect(response.body.error).toBeDefined()
    })

    it('should validate ObjectId format', async () => {
      const response = await request(app)
        .post('/files/invalid-id/confirm-upload')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400)
      
      expect(response.body.error).toContain('Invalid file ID')
    })
  })

  describe('GET /files', () => {
    beforeEach(async () => {
      // Create test files
      await db.collection('files').insertMany([
        {
          userId: user._id,
          encryptedName: 'encrypted-doc1',
          encryptedMimeType: 'encrypted-pdf',
          fileSize: 1024,
          s3Key: 'file1-key',
          contentType: 'application/pdf',
          tags: ['document'],
          status: 'uploaded',
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01')
        },
        {
          userId: user._id,
          encryptedName: 'encrypted-img1',
          encryptedMimeType: 'encrypted-jpeg',
          fileSize: 2048,
          s3Key: 'img1-key',
          contentType: 'image/jpeg',
          tags: ['photo'],
          status: 'uploaded',
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02')
        }
      ])
    })

    it('should return user files', async () => {
      const response = await request(app)
        .get('/files')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
      
      expect(response.body).toHaveLength(2)
      expect(response.body[0]).toHaveProperty('_id')
      expect(response.body[0]).toHaveProperty('encryptedName')
      expect(response.body[0]).toHaveProperty('fileSize')
      
      // Should be sorted by creation date (newest first)
      expect(new Date(response.body[0].createdAt).getTime()).toBeGreaterThan(new Date(response.body[1].createdAt).getTime())
    })

    it('should filter by tags', async () => {
      const response = await request(app)
        .get('/files?tags=document')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
      
      expect(response.body).toHaveLength(1)
      expect(response.body[0].tags).toContain('document')
    })

    it('should filter by multiple tags', async () => {
      const response = await request(app)
        .get('/files?tags=document,photo')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
      
      expect(response.body).toHaveLength(2)
    })

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/files?limit=1&offset=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
      
      expect(response.body).toHaveLength(1)
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/files')
        .expect(401)
      
      expect(response.body.error).toContain('Unauthorized')
    })

    it('should only return files for authenticated user', async () => {
      const otherUser = await db.collection('users').insertOne({
        email: 'other@example.com',
        passwordHash: 'hash'
      })
      
      // Create file for other user
      await db.collection('files').insertOne({
        userId: otherUser.insertedId,
        encryptedName: 'other-file',
        status: 'uploaded'
      })
      
      const response = await request(app)
        .get('/files')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
      
      // Should still only return 2 files (not the other user's file)
      expect(response.body).toHaveLength(2)
    })

    it('should return empty array for user with no files', async () => {
      const newUser = await db.collection('users').insertOne({
        email: 'new@example.com',
        passwordHash: 'hash'
      })
      const newToken = signAccess({ userId: newUser.insertedId.toString() })
      
      const response = await request(app)
        .get('/files')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200)
      
      expect(response.body).toEqual([])
    })
  })

  describe('GET /files/:fileId/download-url', () => {
    let fileId: string

    beforeEach(async () => {
      const file = await db.collection('files').insertOne({
        userId: user._id,
        encryptedName: 'encrypted-file',
        s3Key: 'download-test-key',
        status: 'uploaded',
        contentType: 'application/pdf',
        fileSize: 1024
      })
      fileId = file.insertedId.toString()
    })

    it('should generate download URL', async () => {
      const response = await request(app)
        .get(`/files/${fileId}/download-url`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
      
      expect(response.body).toHaveProperty('downloadUrl', 'https://s3.example.com/download-url')
      expect(mockS3.generateDownloadUrl).toHaveBeenCalledWith('download-test-key')
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/files/${fileId}/download-url`)
        .expect(401)
      
      expect(response.body.error).toContain('Unauthorized')
    })

    it('should validate file ownership', async () => {
      const otherUser = await db.collection('users').insertOne({
        email: 'other@example.com',
        passwordHash: 'hash'
      })
      const otherToken = signAccess({ userId: otherUser.insertedId.toString() })
      
      const response = await request(app)
        .get(`/files/${fileId}/download-url`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404)
      
      expect(response.body.error).toContain('File not found')
    })

    it('should handle S3 service errors', async () => {
      mockS3.generateDownloadUrl.mockRejectedValue(new Error('S3 service error'))
      
      const response = await request(app)
        .get(`/files/${fileId}/download-url`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500)
      
      expect(response.body.error).toBeDefined()
    })
  })

  describe('DELETE /files/:fileId', () => {
    let fileId: string

    beforeEach(async () => {
      const file = await db.collection('files').insertOne({
        userId: user._id,
        encryptedName: 'to-be-deleted',
        s3Key: 'delete-test-key',
        status: 'uploaded',
        contentType: 'application/pdf'
      })
      fileId = file.insertedId.toString()
    })

    it('should delete file successfully', async () => {
      const response = await request(app)
        .delete(`/files/${fileId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
      
      expect(response.body).toHaveProperty('message', 'File deleted successfully')
      expect(mockS3.deleteFile).toHaveBeenCalledWith('delete-test-key')
      
      // Verify file removed from database
      const deletedFile = await db.collection('files').findOne({ _id: new ObjectId(fileId) })
      expect(deletedFile).toBeNull()
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .delete(`/files/${fileId}`)
        .expect(401)
      
      expect(response.body.error).toContain('Unauthorized')
    })

    it('should validate file ownership', async () => {
      const otherUser = await db.collection('users').insertOne({
        email: 'other@example.com',
        passwordHash: 'hash'
      })
      const otherToken = signAccess({ userId: otherUser.insertedId.toString() })
      
      const response = await request(app)
        .delete(`/files/${fileId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404)
      
      expect(response.body.error).toContain('File not found')
    })

    it('should handle S3 deletion errors gracefully', async () => {
      mockS3.deleteFile.mockRejectedValue(new Error('S3 deletion failed'))
      
      const response = await request(app)
        .delete(`/files/${fileId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
      
      // Should still remove from database even if S3 deletion fails
      expect(response.body.message).toContain('File deleted')
      
      const deletedFile = await db.collection('files').findOne({ _id: new ObjectId(fileId) })
      expect(deletedFile).toBeNull()
    })

    it('should handle non-existent file', async () => {
      const fakeFileId = new ObjectId().toString()
      
      const response = await request(app)
        .delete(`/files/${fakeFileId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404)
      
      expect(response.body.error).toContain('File not found')
    })
  })

  describe('Cloudinary Integration', () => {
    describe('POST /files/cloudinary/upload-url', () => {
      it('should generate Cloudinary upload URL for images', async () => {
        const imageRequest = {
          fileName: 'photo.jpg',
          fileSize: 512 * 1024, // 512KB
          contentType: 'image/jpeg',
          encryptedName: 'encrypted-photo-name',
          encryptedMimeType: 'encrypted-jpeg',
          tags: ['photo']
        }
        
        const response = await request(app)
          .post('/files/cloudinary/upload-url')
          .set('Authorization', `Bearer ${authToken}`)
          .send(imageRequest)
          .expect(200)
        
        expect(response.body).toHaveProperty('uploadUrl', 'https://cloudinary.example.com/upload')
        expect(response.body).toHaveProperty('fileId')
        expect(mockCloudinary.generateSignedUploadUrl).toHaveBeenCalled()
      })

      it('should reject non-image files', async () => {
        const nonImageRequest = {
          fileName: 'document.pdf',
          fileSize: 1024,
          contentType: 'application/pdf',
          encryptedName: 'encrypted-doc',
          encryptedMimeType: 'encrypted-pdf'
        }
        
        const response = await request(app)
          .post('/files/cloudinary/upload-url')
          .set('Authorization', `Bearer ${authToken}`)
          .send(nonImageRequest)
          .expect(400)
        
        expect(response.body.error).toContain('Only image files')
      })

      it('should handle Cloudinary service errors', async () => {
        mockCloudinary.generateSignedUploadUrl.mockRejectedValue(new Error('Cloudinary error'))
        
        const response = await request(app)
          .post('/files/cloudinary/upload-url')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            fileName: 'photo.jpg',
            fileSize: 1024,
            contentType: 'image/jpeg',
            encryptedName: 'encrypted',
            encryptedMimeType: 'encrypted'
          })
          .expect(500)
        
        expect(response.body.error).toBeDefined()
      })
    })

    describe('GET /files/:fileId/thumbnail', () => {
      let imageFileId: string

      beforeEach(async () => {
        const imageFile = await db.collection('files').insertOne({
          userId: user._id,
          encryptedName: 'encrypted-image',
          contentType: 'image/jpeg',
          cloudinaryPublicId: 'test-image-id',
          storageProvider: 'cloudinary',
          status: 'uploaded'
        })
        imageFileId = imageFile.insertedId.toString()
      })

      it('should generate thumbnail URL', async () => {
        const response = await request(app)
          .get(`/files/${imageFileId}/thumbnail`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
        
        expect(response.body).toHaveProperty('thumbnailUrl', 'https://cloudinary.example.com/thumb.jpg')
        expect(mockCloudinary.getThumbnailUrl).toHaveBeenCalledWith('test-image-id')
      })

      it('should reject non-image files', async () => {
        const docFile = await db.collection('files').insertOne({
          userId: user._id,
          encryptedName: 'encrypted-doc',
          contentType: 'application/pdf',
          s3Key: 'doc-key',
          status: 'uploaded'
        })
        
        const response = await request(app)
          .get(`/files/${docFile.insertedId}/thumbnail`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)
        
        expect(response.body.error).toContain('not an image')
      })
    })
  })

  describe('Rate Limiting and Security', () => {
    it('should apply rate limiting to upload endpoints', async () => {
      const uploadRequest = {
        fileName: 'test.pdf',
        fileSize: 1024,
        contentType: 'application/pdf',
        encryptedName: 'encrypted',
        encryptedMimeType: 'encrypted'
      }
      
      // Make multiple rapid requests
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/files/upload-url')
          .set('Authorization', `Bearer ${authToken}`)
          .send(uploadRequest)
      )
      
      const responses = await Promise.all(requests)
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })

    it('should validate file permissions on all operations', async () => {
      const file = await db.collection('files').insertOne({
        userId: new ObjectId(), // Different user
        encryptedName: 'unauthorized-file',
        s3Key: 'unauthorized-key',
        status: 'uploaded'
      })
      
      const fileId = file.insertedId.toString()
      
      // All operations should fail for unauthorized access
      const unauthorizedRequests = [
        request(app).get(`/files/${fileId}/download-url`).set('Authorization', `Bearer ${authToken}`),
        request(app).delete(`/files/${fileId}`).set('Authorization', `Bearer ${authToken}`),
        request(app).post(`/files/${fileId}/confirm-upload`).set('Authorization', `Bearer ${authToken}`)
      ]
      
      const responses = await Promise.all(unauthorizedRequests)
      responses.forEach(response => {
        expect(response.status).toBe(404) // File not found for security
      })
    })
  })
})
