import { v2 as cloudinary } from 'cloudinary'

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
})

export interface CloudinaryUploadOptions {
  folder?: string
  public_id?: string
  resource_type?: 'auto' | 'image' | 'video' | 'raw'
  allowed_formats?: string[]
  max_file_size?: number
  transformation?: any[]
}

export interface CloudinaryUploadResult {
  public_id: string
  secure_url: string
  url: string
  format: string
  resource_type: string
  bytes: number
  width?: number
  height?: number
  created_at: string
  version: number
  signature: string
}

/**
 * Upload a file to Cloudinary
 */
export async function uploadToCloudinary(
  fileBuffer: Buffer,
  options: CloudinaryUploadOptions = {}
): Promise<CloudinaryUploadResult> {
  try {
    const {
      folder = 'vault-files',
      resource_type = 'auto',
      allowed_formats,
      max_file_size = 10485760, // 10MB default
      transformation,
      ...otherOptions
    } = options

    const uploadOptions: any = {
      folder,
      resource_type,
      max_file_size,
      ...otherOptions
    }

    if (allowed_formats) {
      uploadOptions.allowed_formats = allowed_formats
    }

    if (transformation) {
      uploadOptions.transformation = transformation
    }

    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            reject(new Error(`Cloudinary upload failed: ${error.message}`))
          } else if (result) {
            resolve(result as CloudinaryUploadResult)
          } else {
            reject(new Error('Cloudinary upload failed: No result returned'))
          }
        }
      ).end(fileBuffer)
    })
  } catch (error: any) {
    throw new Error(`Cloudinary upload error: ${error.message}`)
  }
}

/**
 * Delete a file from Cloudinary
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'image'
): Promise<{ result: string }> {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    })
    
    if (result.result !== 'ok') {
      throw new Error(`Failed to delete file: ${result.result}`)
    }
    
    return result
  } catch (error: any) {
    throw new Error(`Cloudinary delete error: ${error.message}`)
  }
}

/**
 * Get optimized image URL with transformations
 */
export function getOptimizedImageUrl(
  publicId: string,
  options: {
    width?: number
    height?: number
    crop?: 'fill' | 'fit' | 'scale' | 'crop' | 'thumb'
    quality?: 'auto' | number
    format?: 'auto' | 'webp' | 'jpg' | 'png'
    dpr?: 'auto' | number
  } = {}
): string {
  const {
    width,
    height,
    crop = 'fill',
    quality = 'auto',
    format = 'auto',
    dpr = 'auto'
  } = options

  const transformation: any = {
    quality,
    format,
    dpr
  }

  if (width || height) {
    transformation.crop = crop
    if (width) transformation.width = width
    if (height) transformation.height = height
  }

  return cloudinary.url(publicId, {
    transformation
  })
}

/**
 * Generate thumbnail URL for images
 */
export function getThumbnailUrl(
  publicId: string,
  size: 'small' | 'medium' | 'large' = 'medium'
): string {
  const sizes = {
    small: { width: 150, height: 150 },
    medium: { width: 300, height: 300 },
    large: { width: 600, height: 600 }
  }

  return getOptimizedImageUrl(publicId, {
    ...sizes[size],
    crop: 'fill',
    quality: 'auto',
    format: 'auto'
  })
}

/**
 * Get file info from Cloudinary
 */
export async function getFileInfo(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image') {
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: resourceType
    })
    return result
  } catch (error: any) {
    throw new Error(`Failed to get file info: ${error.message}`)
  }
}

/**
 * Generate a signed upload URL for direct client uploads
 */
export function generateSignedUploadUrl(options: {
  folder?: string
  publicId?: string
  transformation?: any[]
  allowedFormats?: string[]
  maxFileSize?: number
}): { url: string; signature: string; timestamp: number; apiKey: string } {
  const timestamp = Math.round(new Date().getTime() / 1000)
  
  const params: any = {
    timestamp,
    folder: options.folder || 'vault-files'
  }

  if (options.publicId) params.public_id = options.publicId
  if (options.transformation) params.transformation = JSON.stringify(options.transformation)
  if (options.allowedFormats) params.allowed_formats = options.allowedFormats.join(',')
  if (options.maxFileSize) params.max_file_size = options.maxFileSize

  const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET!)

  return {
    url: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY!
  }
}

/**
 * Validate Cloudinary configuration
 */
export function validateCloudinaryConfig(): boolean {
  const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
  
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing required Cloudinary environment variable: ${key}`)
      return false
    }
  }
  
  return true
}

export { cloudinary }
