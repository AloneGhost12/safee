import { getClient } from '../db'
import { ObjectId } from 'mongodb'

export type Note = {
  _id?: ObjectId
  userId: ObjectId
  // Old format (plain text)
  title?: string
  content?: string
  // New format (encrypted)
  ciphertext?: string
  iv?: string
  // Common fields
  isEncrypted?: boolean
  tags?: string[]
  createdAt: Date
  updatedAt?: Date
  deletedAt?: Date | null
}

export function notesCollection() {
  return getClient().db().collection<Note>('notes')
}
