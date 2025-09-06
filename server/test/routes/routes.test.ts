/**
 * Comprehensive unit tests for server routes
 * Tests authentication, authorization, validation, and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient, Db } from 'mongodb'
import { hashPassword } from '../../src/utils/crypto'
import { signAccess } from '../../src/utils/jwt'
import { authenticator } from 'otplib'

// Import routes
import authRouter from '../../src/routes/auth'
import notesRouter from '../../src/routes/notes'
import filesRouter from '../../src/routes/files'
import healthRouter from '../../src/routes/health'

// Mock external services
vi.mock('../../src/utils/s3', () => ({
  generateUploadUrl: vi.fn().mockResolvedValue('https://s3.example.com/upload-url'),
  generateDownloadUrl: vi.fn().mockResolvedValue('https://s3.example.com/download-url'),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  virusScanFile: vi.fn().mockResolvedValue({ isClean: true }),
  validateFile: vi.fn()
}))

vi.mock('../../src/utils/cloudinary', () => ({
  uploadToCloudinary: vi.fn().mockResolvedValue({ 
    secure_url: 'https://cloudinary.example.com/image.jpg',
    public_id: 'test-image-id'
  }),
  deleteFromCloudinary: vi.fn().mockResolvedValue(undefined),
  getThumbnailUrl: vi.fn().mockReturnValue('https://cloudinary.example.com/thumb.jpg'),
  getOptimizedImageUrl: vi.fn().mockReturnValue('https://cloudinary.example.com/optimized.jpg'),
  generateSignedUploadUrl: vi.fn().mockResolvedValue('https://cloudinary.example.com/upload'),
  validateCloudinaryConfig: vi.fn().mockReturnValue(true)
}))

vi.mock('../../src/services/auditLogger', () => ({
  AuditLogger: {
    getInstance: vi.fn().mockReturnValue({
      logAuth: vi.fn(),
      log2FA: vi.fn(),
      logFileOperation: vi.fn(),
      logSecurityEvent: vi.fn()
    })
  }
}))

let mongoServer: MongoMemoryServer
let client: MongoClient
let db: Db
let app: express.Application

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  const uri = mongoServer.getUri()
  client = new MongoClient(uri)
  await client.connect()
  db = client.db('test')
  
  // Set up database collections for testing
  process.env.MONGODB_URI = uri
  process.env.JWT_SECRET = 'test-secret-key-for-testing'
  process.env.NODE_ENV = 'test'
})

afterAll(async () => {
  await client.close()
  await mongoServer.stop()
})

beforeEach(() => {
  app = express()
  app.use(express.json())
  
  // Add routes
  app.use('/auth', authRouter)
  app.use('/notes', notesRouter)
  app.use('/files', filesRouter)
  app.use('/health', healthRouter)
  
  // Error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    res.status(err.status || 500).json({ error: err.message })
  })
})

afterEach(async () => {
  // Clean up database collections
  await db.collection('users').deleteMany({})
  await db.collection('notes').deleteMany({})
  await db.collection('files').deleteMany({})
  await db.collection('sessions').deleteMany({})
  vi.clearAllMocks()
})

// Test data helpers
const createTestUser = async (email = 'test@example.com', password = 'Test123!@#') => {
  const hashedPassword = await hashPassword(password)
  const user = {
    email,
    passwordHash: hashedPassword,
    salt: 'test-salt',
    wrappedDEK: 'test-wrapped-dek',
    wrappedDEKIv: 'test-iv',
    twoFactorSecret: null,
    twoFactorEnabled: false,
    createdAt: new Date(),
    lastLoginAt: null,
    failedLoginAttempts: 0,
    accountLocked: false
  }
  const result = await db.collection('users').insertOne(user)
  return { ...user, _id: result.insertedId }
}

const createTestUserWith2FA = async (email = 'test2fa@example.com') => {
  const secret = authenticator.generateSecret()
  const user = await createTestUser(email)
  await db.collection('users').updateOne(
    { _id: user._id },
    { 
      $set: { 
        twoFactorSecret: secret,
        twoFactorEnabled: true 
      } 
    }
  )
  return { ...user, twoFactorSecret: secret, twoFactorEnabled: true }
}

const generateAuthToken = (userId: string) => {
  return signAccess({ userId })
}

describe('Auth Routes', () => {
  describe('POST /auth/signup', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'SecurePass123!@#'
      }
      
      const response = await request(app)
        .post('/auth/signup')
        .send(userData)
        .expect(201)
      
      expect(response.body).toHaveProperty('message', 'Account created successfully')
      
      // Verify user was created in database
      const user = await db.collection('users').findOne({ email: userData.email })
      expect(user).toBeTruthy()
      expect(user.email).toBe(userData.email)
      expect(user.passwordHash).toBeDefined()
    })

    it('should reject duplicate email registration', async () => {
      await createTestUser('existing@example.com')
      
      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'existing@example.com',
          password: 'NewPass123!@#'
        })
        .expect(400)
      
      expect(response.body.error).toContain('already exists')
    })

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'invalid-email',
          password: 'ValidPass123!@#'
        })
        .expect(400)
      
      expect(response.body.error).toContain('valid email')
    })

    it('should validate password strength', async () => {
      const weakPasswords = [
        'weak',           // too short
        'password',       // no numbers/symbols
        '12345678',       // no letters
        'Password',       // no numbers/symbols
        'password123'     // no symbols
      ]
      
      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/auth/signup')
          .send({
            email: 'test@example.com',
            password
          })
        
        expect(response.status).toBe(400)
        expect(response.body.error).toContain('Password must')
      }
    })

    it('should reject overly long email', async () => {
      const longEmail = 'a'.repeat(250) + '@example.com'
      
      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: longEmail,
          password: 'ValidPass123!@#'
        })
        .expect(400)
      
      expect(response.body.error).toContain('too long')
    })
  })

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const user = await createTestUser()
      
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: user.email,
          password: 'Test123!@#'
        })
        .expect(200)
      
      expect(response.body).toHaveProperty('requires2FA', false)
      expect(response.body).toHaveProperty('message', 'Login successful')
      expect(response.headers['set-cookie']).toBeDefined()
    })

    it('should reject invalid password', async () => {
      const user = await createTestUser()
      
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: user.email,
          password: 'WrongPassword123!@#'
        })
        .expect(401)
      
      expect(response.body.error).toContain('Invalid credentials')
    })

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'AnyPassword123!@#'
        })
        .expect(401)
      
      expect(response.body.error).toContain('Invalid credentials')
    })

    it('should require 2FA when enabled', async () => {
      const user = await createTestUserWith2FA()
      
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: user.email,
          password: 'Test123!@#'
        })
        .expect(200)
      
      expect(response.body).toHaveProperty('requires2FA', true)
      expect(response.body).toHaveProperty('message', '2FA verification required')
    })

    it('should handle account lockout after failed attempts', async () => {
      const user = await createTestUser()
      
      // Simulate 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/auth/login')
          .send({
            email: user.email,
            password: 'WrongPassword'
          })
      }
      
      // Next attempt should be blocked
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: user.email,
          password: 'Test123!@#'
        })
        .expect(423)
      
      expect(response.body.error).toContain('Account locked')
    })

    it('should handle missing fields', async () => {
      const responses = await Promise.all([
        request(app).post('/auth/login').send({ email: 'test@example.com' }),
        request(app).post('/auth/login').send({ password: 'password' }),
        request(app).post('/auth/login').send({})
      ])
      
      responses.forEach(response => {
        expect(response.status).toBe(400)
      })
    })
  })

  describe('POST /auth/enable-2fa', () => {
    it('should enable 2FA for authenticated user', async () => {
      const user = await createTestUser()
      const token = generateAuthToken(user._id.toString())
      
      const response = await request(app)
        .post('/auth/enable-2fa')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: user.email })
        .expect(200)
      
      expect(response.body).toHaveProperty('secret')
      expect(response.body).toHaveProperty('qrCode')
      expect(response.body.secret).toMatch(/^[A-Z2-7]{32}$/)
      
      // Verify 2FA secret was saved
      const updatedUser = await db.collection('users').findOne({ _id: user._id })
      expect(updatedUser.twoFactorSecret).toBeDefined()
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/auth/enable-2fa')
        .send({ email: 'test@example.com' })
        .expect(401)
      
      expect(response.body.error).toContain('Unauthorized')
    })

    it('should validate email matches authenticated user', async () => {
      const user = await createTestUser()
      const token = generateAuthToken(user._id.toString())
      
      const response = await request(app)
        .post('/auth/enable-2fa')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'different@example.com' })
        .expect(400)
      
      expect(response.body.error).toContain('Email does not match')
    })
  })

  describe('POST /auth/verify-2fa', () => {
    it('should verify 2FA code and complete login', async () => {
      const user = await createTestUserWith2FA()
      const validCode = authenticator.generate(user.twoFactorSecret)
      
      const response = await request(app)
        .post('/auth/verify-2fa')
        .send({
          email: user.email,
          code: validCode
        })
        .expect(200)
      
      expect(response.body).toHaveProperty('message', '2FA verification successful')
      expect(response.headers['set-cookie']).toBeDefined()
    })

    it('should reject invalid 2FA code', async () => {
      const user = await createTestUserWith2FA()
      
      const response = await request(app)
        .post('/auth/verify-2fa')
        .send({
          email: user.email,
          code: '000000'
        })
        .expect(401)
      
      expect(response.body.error).toContain('Invalid 2FA code')
    })

    it('should reject for user without 2FA enabled', async () => {
      const user = await createTestUser()
      
      const response = await request(app)
        .post('/auth/verify-2fa')
        .send({
          email: user.email,
          code: '123456'
        })
        .expect(400)
      
      expect(response.body.error).toContain('2FA not enabled')
    })
  })

  describe('POST /auth/logout', () => {
    it('should logout successfully', async () => {
      const user = await createTestUser()
      const token = generateAuthToken(user._id.toString())
      
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
      
      expect(response.body).toHaveProperty('message', 'Logged out successfully')
    })

    it('should handle logout without authentication', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .expect(200)
      
      expect(response.body).toHaveProperty('message', 'Logged out successfully')
    })
  })
})

describe('Notes Routes', () => {
  let user: any
  let authToken: string

  beforeEach(async () => {
    user = await createTestUser()
    authToken = generateAuthToken(user._id.toString())
  })

  describe('POST /notes', () => {
    it('should create a new encrypted note', async () => {
      const noteData = {
        ciphertext: 'encrypted-content',
        iv: 'initialization-vector',
        tags: ['test', 'encrypted']
      }
      
      const response = await request(app)
        .post('/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(noteData)
        .expect(201)
      
      expect(response.body).toHaveProperty('id')
      expect(response.body).toHaveProperty('message', 'Note created')
      
      // Verify note was saved
      const savedNote = await db.collection('notes').findOne({ _id: new ObjectId(response.body.id) })
      expect(savedNote).toBeTruthy()
      expect(savedNote.ciphertext).toBe(noteData.ciphertext)
      expect(savedNote.isEncrypted).toBe(true)
    })

    it('should create a plain text note (legacy format)', async () => {
      const noteData = {
        title: 'Test Note',
        content: 'Plain text content',
        tags: ['test']
      }
      
      const response = await request(app)
        .post('/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(noteData)
        .expect(201)
      
      const savedNote = await db.collection('notes').findOne({ _id: new ObjectId(response.body.id) })
      expect(savedNote.title).toBe(noteData.title)
      expect(savedNote.isEncrypted).toBe(false)
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/notes')
        .send({
          title: 'Test',
          content: 'Content'
        })
        .expect(401)
      
      expect(response.body.error).toContain('Unauthorized')
    })

    it('should validate required fields', async () => {
      const invalidPayloads = [
        {}, // missing all fields
        { title: 'Only title' }, // missing content
        { content: 'Only content' }, // missing title
        { ciphertext: 'Only ciphertext' }, // missing iv
        { iv: 'Only iv' } // missing ciphertext
      ]
      
      for (const payload of invalidPayloads) {
        const response = await request(app)
          .post('/notes')
          .set('Authorization', `Bearer ${authToken}`)
          .send(payload)
        
        expect(response.status).toBe(400)
      }
    })

    it('should handle optional tags field', async () => {
      const noteData = {
        ciphertext: 'encrypted-content',
        iv: 'initialization-vector'
        // tags omitted
      }
      
      const response = await request(app)
        .post('/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(noteData)
        .expect(201)
      
      const savedNote = await db.collection('notes').findOne({ _id: new ObjectId(response.body.id) })
      expect(savedNote.tags).toEqual([])
    })
  })

  describe('GET /notes', () => {
    it('should return user notes', async () => {
      // Create test notes
      await db.collection('notes').insertMany([
        {
          userId: user._id,
          ciphertext: 'encrypted1',
          iv: 'iv1',
          isEncrypted: true,
          tags: ['tag1'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          userId: user._id,
          title: 'Plain Note',
          content: 'Plain content',
          isEncrypted: false,
          tags: ['tag2'],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])
      
      const response = await request(app)
        .get('/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
      
      expect(response.body).toHaveLength(2)
      expect(response.body[0]).toHaveProperty('_id')
      expect(response.body[1]).toHaveProperty('_id')
    })

    it('should return empty array for user with no notes', async () => {
      const response = await request(app)
        .get('/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
      
      expect(response.body).toEqual([])
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/notes')
        .expect(401)
      
      expect(response.body.error).toContain('Unauthorized')
    })

    it('should only return notes for authenticated user', async () => {
      const otherUser = await createTestUser('other@example.com')
      
      // Create note for other user
      await db.collection('notes').insertOne({
        userId: otherUser._id,
        title: 'Other user note',
        content: 'Should not be visible',
        isEncrypted: false,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      })
      
      const response = await request(app)
        .get('/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
      
      expect(response.body).toEqual([])
    })
  })

  describe('PUT /notes/:id', () => {
    let noteId: string

    beforeEach(async () => {
      const note = await db.collection('notes').insertOne({
        userId: user._id,
        ciphertext: 'original-encrypted',
        iv: 'original-iv',
        isEncrypted: true,
        tags: ['original'],
        createdAt: new Date(),
        updatedAt: new Date()
      })
      noteId = note.insertedId.toString()
    })

    it('should update note successfully', async () => {
      const updateData = {
        ciphertext: 'updated-encrypted',
        iv: 'updated-iv',
        tags: ['updated', 'test']
      }
      
      const response = await request(app)
        .put(`/notes/${noteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200)
      
      expect(response.body).toHaveProperty('message', 'Note updated')
      
      // Verify update
      const updatedNote = await db.collection('notes').findOne({ _id: new ObjectId(noteId) })
      expect(updatedNote.ciphertext).toBe(updateData.ciphertext)
      expect(updatedNote.tags).toEqual(updateData.tags)
    })

    it('should reject update for non-existent note', async () => {
      const fakeId = new ObjectId().toString()
      
      const response = await request(app)
        .put(`/notes/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ciphertext: 'updated',
          iv: 'updated-iv'
        })
        .expect(404)
      
      expect(response.body.error).toContain('Note not found')
    })

    it('should reject update for other user note', async () => {
      const otherUser = await createTestUser('other@example.com')
      const otherToken = generateAuthToken(otherUser._id.toString())
      
      const response = await request(app)
        .put(`/notes/${noteId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          ciphertext: 'unauthorized-update',
          iv: 'unauthorized-iv'
        })
        .expect(404)
      
      expect(response.body.error).toContain('Note not found')
    })

    it('should validate ObjectId format', async () => {
      const response = await request(app)
        .put('/notes/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ciphertext: 'update',
          iv: 'iv'
        })
        .expect(400)
      
      expect(response.body.error).toContain('Invalid note ID')
    })
  })

  describe('DELETE /notes/:id', () => {
    let noteId: string

    beforeEach(async () => {
      const note = await db.collection('notes').insertOne({
        userId: user._id,
        title: 'To be deleted',
        content: 'This note will be deleted',
        isEncrypted: false,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      })
      noteId = note.insertedId.toString()
    })

    it('should delete note successfully', async () => {
      const response = await request(app)
        .delete(`/notes/${noteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
      
      expect(response.body).toHaveProperty('message', 'Note deleted')
      
      // Verify deletion
      const deletedNote = await db.collection('notes').findOne({ _id: new ObjectId(noteId) })
      expect(deletedNote).toBeNull()
    })

    it('should reject deletion for non-existent note', async () => {
      const fakeId = new ObjectId().toString()
      
      const response = await request(app)
        .delete(`/notes/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404)
      
      expect(response.body.error).toContain('Note not found')
    })
  })
})

describe('Health Routes', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)
      
      expect(response.body).toHaveProperty('status', 'ok')
      expect(response.body).toHaveProperty('timestamp')
      expect(response.body).toHaveProperty('version')
    })

    it('should not require authentication', async () => {
      // This test verifies health endpoint is publicly accessible
      const response = await request(app)
        .get('/health')
        .expect(200)
      
      expect(response.body.status).toBe('ok')
    })
  })
})

describe('Error Handling', () => {
  it('should handle malformed JSON', async () => {
    const response = await request(app)
      .post('/auth/signup')
      .set('Content-Type', 'application/json')
      .send('invalid-json{')
      .expect(400)
    
    expect(response.body.error).toBeDefined()
  })

  it('should handle missing Content-Type header', async () => {
    const response = await request(app)
      .post('/auth/signup')
      .send('email=test@example.com&password=Test123!')
      .expect(400)
    
    expect(response.body.error).toBeDefined()
  })

  it('should handle oversized payloads', async () => {
    const largePayload = {
      email: 'test@example.com',
      password: 'a'.repeat(10000) // Very long password
    }
    
    const response = await request(app)
      .post('/auth/signup')
      .send(largePayload)
      .expect(400)
    
    expect(response.body.error).toContain('too long')
  })

  it('should handle database connection errors gracefully', async () => {
    // Simulate database error by closing connection
    await client.close()
    
    const response = await request(app)
      .get('/notes')
      .set('Authorization', `Bearer ${generateAuthToken('507f1f77bcf86cd799439011')}`)
    
    expect(response.status).toBeGreaterThanOrEqual(500)
    
    // Reconnect for other tests
    await client.connect()
  })
})
