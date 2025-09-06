import { getClient } from '../db'
import { ObjectId } from 'mongodb'

export type User = {
  _id?: ObjectId
  email: string
  passwordHash: string
  argonSalt: string
  totpSecret?: string
  totpTempSecret?: string
  wrappedDEK?: string
  dekSalt?: string
  createdAt: Date
  updatedAt?: Date
  lastLoginAt?: Date
  lastFailedLoginAt?: Date
  failedLoginAttempts?: number
  accountLocked?: boolean
  twoFactorEnabled?: boolean
  twoFactorEnabledAt?: Date
  twoFactorDisabledAt?: Date
}

export function usersCollection() {
  return getClient().db().collection<User>('users')
}
