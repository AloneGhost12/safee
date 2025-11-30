import * as s3 from './s3'
import * as cloudinary from './cloudinary'
import * as localStorage from './localStorage'

export type StorageProvider = 's3' | 'cloudinary' | 'local'

export interface StorageConfig {
    provider: StorageProvider
}

/**
 * Determine which storage provider to use based on environment
 */
export function getStorageProvider(): StorageProvider {
    // Check for S3 configuration
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        console.log('📦 Using S3 storage')
        return 's3'
    }

    // Check for Cloudinary configuration
    if (cloudinary.validateCloudinaryConfig()) {
        console.log('☁️ Using Cloudinary storage')
        return 'cloudinary'
    }

    // Fallback to local storage
    console.log('💾 Using local file storage (no cloud credentials found)')
    return 'local'
}

/**
 * Upload file using the configured storage provider
 */
export async function uploadFile(
    fileBuffer: Buffer,
    options: {
        userId: string
        fileName: string
        fileSize: number
        contentType: string
    }
): Promise<{
    key: string
    url?: string
    provider: StorageProvider
}> {
    const provider = getStorageProvider()

    switch (provider) {
        case 's3': {
            const result = await s3.generateUploadUrl(options)
            // For S3, we need to upload the buffer directly
            // This is a simplified version - in production you'd use presigned URLs
            return {
                key: result.s3Key,
                url: result.uploadUrl,
                provider: 's3'
            }
        }

        case 'cloudinary': {
            const result = await cloudinary.uploadToCloudinary(fileBuffer, {
                folder: `vault-files/${options.userId}`,
                resource_type: 'auto'
            })
            return {
                key: result.public_id,
                url: result.secure_url,
                provider: 'cloudinary'
            }
        }

        case 'local': {
            const result = await localStorage.saveToLocal(fileBuffer, options)
            return {
                key: result.localKey,
                url: `/uploads/${result.localKey}`, // Relative URL for local files
                provider: 'local'
            }
        }
    }
}

/**
 * Download file using the configured storage provider
 */
export async function downloadFile(
    key: string,
    provider: StorageProvider
): Promise<Buffer> {
    switch (provider) {
        case 's3': {
            const result = await s3.generateDownloadUrl(key)
            // Fetch the file from the presigned URL
            const response = await fetch(result.downloadUrl)
            return Buffer.from(await response.arrayBuffer())
        }

        case 'cloudinary': {
            // For Cloudinary, construct the URL and fetch
            const url = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/${key}`
            const response = await fetch(url)
            return Buffer.from(await response.arrayBuffer())
        }

        case 'local': {
            return await localStorage.readFromLocal(key)
        }
    }
}

/**
 * Delete file using the configured storage provider
 */
export async function deleteFile(
    key: string,
    provider: StorageProvider
): Promise<void> {
    switch (provider) {
        case 's3':
            await s3.deleteFile(key)
            break

        case 'cloudinary':
            await cloudinary.deleteFromCloudinary(key, 'raw')
            break

        case 'local':
            await localStorage.deleteFromLocal(key)
            break
    }
}
