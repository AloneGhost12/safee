import { Collection, MongoClient, ObjectId } from 'mongodb'
import { getClient } from '../db'

export interface FileMetadata {
  _id?: ObjectId
  userId: ObjectId
  originalName: string // encrypted
  encryptedName: string // what's stored in S3/Cloudinary
  mimeType: string // encrypted
  size: number
  // Storage type and location
  storageType?: 's3' | 'cloudinary'
  s3Key?: string // for S3 storage
  s3Bucket?: string // for S3 storage
  cloudinaryPublicId?: string // for Cloudinary storage
  cloudinaryUrl?: string // for Cloudinary storage
  thumbnailUrl?: string // for Cloudinary image thumbnails
  uploadedAt: Date
  virusScanned?: boolean
  virusScanResult?: 'clean' | 'infected' | 'error'
  virusScanStatus?: 'pending' | 'scanning' | 'clean' | 'infected' | 'scan_error'
  tags?: string[]
  isDeleted?: boolean
  deletedAt?: Date
}

export function filesCollection(): Collection<FileMetadata> {
  return getClient().db().collection<FileMetadata>('files')
}
