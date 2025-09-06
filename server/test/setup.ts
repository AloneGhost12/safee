import { afterAll, beforeAll, vi } from 'vitest'
import { ObjectId } from 'mongodb'

// Mock the database connection for tests
vi.mock('../src/db', () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  getDb: vi.fn().mockReturnValue({
    collection: vi.fn().mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null), // Default to no user found
      insertOne: vi.fn().mockResolvedValue({ 
        insertedId: new ObjectId(),
        acknowledged: true 
      }),
      updateOne: vi.fn().mockResolvedValue({ 
        matchedCount: 1, 
        modifiedCount: 1,
        acknowledged: true 
      }),
      deleteOne: vi.fn().mockResolvedValue({ 
        deletedCount: 1,
        acknowledged: true 
      }),
    })
  })
}))

beforeAll(async () => {
  // Set required environment variables for tests
  process.env.MONGO_URI = 'mongodb://localhost:27017/test'
  process.env.JWT_ACCESS_SECRET = 'test_access_secret'
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret'
  process.env.SESSION_COOKIE_NAME = 'pv_sess'
})

afterAll(async () => {
  // Clean up test environment variables
  delete process.env.MONGO_URI
  delete process.env.JWT_ACCESS_SECRET
  delete process.env.JWT_REFRESH_SECRET
  delete process.env.SESSION_COOKIE_NAME
})
