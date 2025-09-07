import { getClient } from '../db'
import { ObjectId } from 'mongodb'

export type EmailRecoveryCode = {
  _id?: ObjectId
  userId: ObjectId
  email: string
  code: string
  codeHash: string
  expiresAt: Date
  usedAt?: Date
  createdAt: Date
  ipAddress: string
  userAgent: string
}

export function emailRecoveryCodesCollection() {
  return getClient().db().collection<EmailRecoveryCode>('email_recovery_codes')
}

// Clean up expired codes periodically
export async function cleanupExpiredRecoveryCodes(): Promise<void> {
  const collection = emailRecoveryCodesCollection()
  await collection.deleteMany({
    expiresAt: { $lt: new Date() }
  })
}
