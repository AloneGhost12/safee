import { getClient } from '../db'
import { ObjectId } from 'mongodb'

export type Session = {
  _id?: ObjectId
  userId: ObjectId
  refreshToken: string
  createdAt: Date
  expiresAt: Date
  lastUsedAt?: Date
  ipAddress?: string
  userAgent?: string
}

export function sessionsCollection() {
  return getClient().db().collection<Session>('sessions')
}
