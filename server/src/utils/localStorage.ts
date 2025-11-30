import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

export interface LocalStorageUploadParams {
    userId: string
    fileName: string
    fileSize: number
    contentType: string
}

export interface LocalStorageUploadResponse {
    filePath: string
    localKey: string
}

/**
 * Initialize local storage directory
 */
export async function initializeLocalStorage(): Promise<void> {
    try {
        await fs.access(UPLOAD_DIR)
    } catch {
        // Directory doesn't exist, create it
        await fs.mkdir(UPLOAD_DIR, { recursive: true })
        console.log('📁 Created local uploads directory:', UPLOAD_DIR)
    }
}

/**
 * Save file to local storage
 */
export async function saveToLocal(
    fileBuffer: Buffer,
    params: LocalStorageUploadParams
): Promise<LocalStorageUploadResponse> {
    await initializeLocalStorage()

    // Generate unique file key
    const fileExtension = params.fileName.split('.').pop()
    const localKey = `${params.userId}/${uuidv4()}${fileExtension ? '.' + fileExtension : ''}`
    const filePath = path.join(UPLOAD_DIR, localKey)

    // Ensure user directory exists
    const userDir = path.join(UPLOAD_DIR, params.userId)
    try {
        await fs.access(userDir)
    } catch {
        await fs.mkdir(userDir, { recursive: true })
    }

    // Save file
    await fs.writeFile(filePath, fileBuffer)

    console.log(`💾 Saved file locally: ${localKey}`)

    return {
        filePath,
        localKey
    }
}

/**
 * Read file from local storage
 */
export async function readFromLocal(localKey: string): Promise<Buffer> {
    const filePath = path.join(UPLOAD_DIR, localKey)
    return await fs.readFile(filePath)
}

/**
 * Delete file from local storage
 */
export async function deleteFromLocal(localKey: string): Promise<void> {
    const filePath = path.join(UPLOAD_DIR, localKey)
    await fs.unlink(filePath)
    console.log(`🗑️ Deleted file from local storage: ${localKey}`)
}

/**
 * Check if file exists in local storage
 */
export async function fileExistsLocally(localKey: string): Promise<boolean> {
    try {
        const filePath = path.join(UPLOAD_DIR, localKey)
        await fs.access(filePath)
        return true
    } catch {
        return false
    }
}
