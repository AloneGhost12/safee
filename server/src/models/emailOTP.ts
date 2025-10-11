import { Collection, MongoClient, ObjectId } from 'mongodb'
import { getClient } from '../db'

export interface EmailOTP {
  _id?: ObjectId
  email: string
  code: string
  codeHash: string // Hashed version of the OTP code for security
  purpose: 'login' | 'registration' | 'password_reset' | 'email_verification' | 'account_recovery'
  userId?: ObjectId // Optional: link to user if exists
  attempts: number
  maxAttempts: number
  createdAt: Date
  expiresAt: Date
  isUsed: boolean
  ipAddress?: string
  userAgent?: string
  metadata?: {
    sessionId?: string
    deviceFingerprint?: string
    location?: string
  }
}

export interface EmailOTPRateLimit {
  _id?: ObjectId
  email: string
  ipAddress: string
  purpose: string
  attempts: number
  lastAttemptAt: Date
  windowStartAt: Date
  windowSizeMinutes: number
  maxAttempts: number
  blockedUntil?: Date
}

let emailOTPCollection: Collection<EmailOTP>
let emailOTPRateLimitCollection: Collection<EmailOTPRateLimit>

export async function initializeEmailOTPCollections() {
  const db = getClient().db()
  
  emailOTPCollection = db.collection<EmailOTP>('emailOTPs')
  emailOTPRateLimitCollection = db.collection<EmailOTPRateLimit>('emailOTPRateLimits')
  
  // Create indexes for performance and automatic cleanup
  await emailOTPCollection.createIndex({ email: 1, purpose: 1 })
  await emailOTPCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await emailOTPCollection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 }) // Cleanup after 1 hour
  await emailOTPCollection.createIndex({ codeHash: 1 })
  await emailOTPCollection.createIndex({ userId: 1 })
  
  // Rate limiting indexes
  await emailOTPRateLimitCollection.createIndex({ email: 1, purpose: 1, ipAddress: 1 })
  await emailOTPRateLimitCollection.createIndex({ windowStartAt: 1 }, { expireAfterSeconds: 86400 }) // Cleanup after 24 hours
  await emailOTPRateLimitCollection.createIndex({ blockedUntil: 1 }, { expireAfterSeconds: 0 })
  
  console.log('📧 Email OTP collections initialized')
}

export function emailOTPCollection_func(): Collection<EmailOTP> {
  if (!emailOTPCollection) {
    emailOTPCollection = getClient().db().collection<EmailOTP>('emailOTPs')
  }
  return emailOTPCollection
}

export function emailOTPRateLimitCollection_func(): Collection<EmailOTPRateLimit> {
  if (!emailOTPRateLimitCollection) {
    emailOTPRateLimitCollection = getClient().db().collection<EmailOTPRateLimit>('emailOTPRateLimits')
  }
  return emailOTPRateLimitCollection
}

// Helper functions for common operations
export async function createEmailOTP(otpData: Omit<EmailOTP, '_id'>): Promise<ObjectId> {
  const collection = emailOTPCollection_func()
  
  // Remove any existing unused OTPs for the same email and purpose
  await collection.deleteMany({
    email: otpData.email,
    purpose: otpData.purpose,
    isUsed: false,
    expiresAt: { $gt: new Date() }
  })
  
  const result = await collection.insertOne(otpData)
  return result.insertedId
}

export async function findEmailOTP(email: string, purpose: EmailOTP['purpose'], codeHash: string): Promise<EmailOTP | null> {
  const collection = emailOTPCollection_func()
  
  return await collection.findOne({
    email,
    purpose,
    codeHash, // We'll hash the input code before calling this
    isUsed: false,
    expiresAt: { $gt: new Date() }
  })
}

export async function markOTPAsUsed(otpId: ObjectId): Promise<void> {
  const collection = emailOTPCollection_func()
  
  await collection.updateOne(
    { _id: otpId },
    { 
      $set: { 
        isUsed: true,
        usedAt: new Date()
      } 
    }
  )
}

export async function incrementOTPAttempts(otpId: ObjectId): Promise<number> {
  const collection = emailOTPCollection_func()
  
  const result = await collection.findOneAndUpdate(
    { _id: otpId },
    { 
      $inc: { attempts: 1 },
      $set: { lastAttemptAt: new Date() }
    },
    { returnDocument: 'after' }
  )
  
  return result?.value?.attempts || 0
}

export async function checkRateLimit(
  email: string, 
  ipAddress: string, 
  purpose: string
): Promise<{ allowed: boolean; remainingAttempts: number; resetTime?: Date }> {
  const collection = emailOTPRateLimitCollection_func()
  const now = new Date()
  const windowSizeMinutes = 15 // 15-minute window
  const maxAttempts = 5 // Max 5 OTP requests per window
  
  const windowStart = new Date(now.getTime() - (windowSizeMinutes * 60 * 1000))
  
  let rateLimit = await collection.findOne({
    email,
    ipAddress,
    purpose,
    windowStartAt: { $gte: windowStart }
  })
  
  if (!rateLimit) {
    // Create new rate limit entry
    const newRateLimit = {
      email,
      ipAddress,
      purpose,
      attempts: 0,
      lastAttemptAt: now,
      windowStartAt: now,
      windowSizeMinutes,
      maxAttempts
    }
    const result = await collection.insertOne(newRateLimit)
    rateLimit = { ...newRateLimit, _id: result.insertedId }
  }
  
  // Check if blocked
  if (rateLimit?.blockedUntil && rateLimit.blockedUntil > now) {
    return {
      allowed: false,
      remainingAttempts: 0,
      resetTime: rateLimit.blockedUntil
    }
  }
  
  // Check rate limit
  if (rateLimit && rateLimit.attempts >= maxAttempts) {
    // Block for 1 hour
    const blockedUntil = new Date(now.getTime() + (60 * 60 * 1000))
    await collection.updateOne(
      { _id: rateLimit._id },
      { $set: { blockedUntil } }
    )
    
    return {
      allowed: false,
      remainingAttempts: 0,
      resetTime: blockedUntil
    }
  }
  
  return {
    allowed: true,
    remainingAttempts: maxAttempts - (rateLimit?.attempts || 0)
  }
}

export async function incrementRateLimit(
  email: string, 
  ipAddress: string, 
  purpose: string
): Promise<void> {
  const collection = emailOTPRateLimitCollection_func()
  const now = new Date()
  const windowSizeMinutes = 15
  const windowStart = new Date(now.getTime() - (windowSizeMinutes * 60 * 1000))
  
  await collection.updateOne(
    {
      email,
      ipAddress,
      purpose,
      windowStartAt: { $gte: windowStart }
    },
    {
      $inc: { attempts: 1 },
      $set: { lastAttemptAt: now }
    },
    { upsert: true }
  )
}
