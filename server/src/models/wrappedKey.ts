import { getClient } from '../db'
import { ObjectId } from 'mongodb'

export type WrappedKey = {
  _id?: ObjectId
  userId: ObjectId
  wrappedDEK: string
  dekIV: string
  dekSalt?: string
  createdAt: Date
}

export function wrappedKeysCollection() {
  return getClient().db().collection<WrappedKey>('wrappedKeys')
}
