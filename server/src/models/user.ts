import { getClient } from '../db'
import { ObjectId } from 'mongodb'

export type User = {
  _id?: ObjectId
  username: string
  email: string
  phoneNumber: string
  passwordHash: string
  argonSalt: string
  role?: 'user' | 'admin' | 'super_admin'
  adminCreatedAt?: Date
  adminCreatedBy?: string
  adminPermissions?: string[]
  totpSecret?: string
  totpTempSecret?: string
  wrappedDEK?: string
  dekSalt?: string
  createdAt: Date
  updatedAt?: Date
  lastLoginAt?: Date
  lastFailedLoginAt?: Date
  lastVerifiedAt?: Date
  failedLoginAttempts?: number
  accountLocked?: boolean
  accountLockedUntil?: Date
  accountLockedReason?: string
  twoFactorEnabled?: boolean
  twoFactorEnabledAt?: Date
  twoFactorDisabledAt?: Date
  backupCodes?: Array<{
    code: string
    used: boolean
    usedAt?: Date
  }>
  backupCodesGenerated?: Date
  securityQuestions?: Array<{
    question: string
    answerHash: string
    salt: string
  }>
  trustedDevices?: Array<{
    deviceId: string
    deviceName: string
    fingerprint: string
    addedAt: Date
    lastUsedAt?: Date
    expiresAt: Date
  }>
  emailRecovery?: {
    enabled: boolean
    lastCodeSentAt?: Date
    codesSentCount?: number
  }
  securityEvents?: Array<{
    eventType: 'login_success' | 'login_failure' | 'password_change' | 'unusual_activity' | 'account_locked' | 'account_unlocked'
    timestamp: Date
    ipAddress?: string
    userAgent?: string
    location?: string
    details?: string
  }>
  verificationStatus?: {
    emailVerified: boolean
    phoneVerified: boolean
    emailVerifiedAt?: Date
    phoneVerifiedAt?: Date
  }
}

export function usersCollection() {
  return getClient().db().collection<User>('users')
}
