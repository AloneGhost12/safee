import { useState } from 'react'
import { useApp } from '@/context/AppContext'
import { useCrypto } from '@/hooks/useCrypto'
import { filesAPI } from '@/lib/api'
import { 
  downloadEncryptedFile, 
  decryptFile, 
  FileEncryptionProgress 
} from '@/crypto/files'

export interface FileDownloadProgress {
  stage: 'downloading' | 'decrypting' | 'completed'
  progress: number
  error?: string
}

export function useFileDownload() {
  const { state } = useApp()
  const { getMasterKey } = useCrypto()
  const [downloadProgress, setDownloadProgress] = useState<Map<string, FileDownloadProgress>>(new Map())

  const downloadFile = async (
    fileId: string,
    password: string,
    onProgress?: (progress: FileDownloadProgress) => void
  ): Promise<void> => {
    if (!state.user?.token) {
      throw new Error('Not authenticated')
    }

    try {
      // Initialize progress
      const initialProgress: FileDownloadProgress = {
        stage: 'downloading',
        progress: 0
      }
      setDownloadProgress(prev => new Map(prev).set(fileId, initialProgress))
      onProgress?.(initialProgress)

      // Get download URL and metadata with password
      const downloadResponse = await filesAPI.requestDownloadUrl(fileId, password)

      // Get master key for decryption
      const masterKey = await getMasterKey()
      if (!masterKey) {
        throw new Error('Could not get decryption key')
      }

      // Download encrypted file
      const encryptedBlob = await downloadEncryptedFile(
        downloadResponse.downloadUrl,
        (progress: FileEncryptionProgress) => {
          const currentProgress: FileDownloadProgress = {
            stage: 'downloading',
            progress: progress.percentage
          }
          setDownloadProgress(prev => new Map(prev).set(fileId, currentProgress))
          onProgress?.(currentProgress)
        }
      )

      // Update to decrypting stage
      const decryptingProgress: FileDownloadProgress = {
        stage: 'decrypting',
        progress: 0
      }
      setDownloadProgress(prev => new Map(prev).set(fileId, decryptingProgress))
      onProgress?.(decryptingProgress)

      // Parse metadata from API response
      const metadata = {
        encryptedName: downloadResponse.fileName,
        encryptedMimeType: downloadResponse.mimeType,
        originalSize: downloadResponse.size,
        encryptedSize: encryptedBlob.size,
        iv: '', // Will be extracted from blob
        chunkSize: 64 * 1024 // Default chunk size
      }

      // Decrypt file
      const { file, fileName } = await decryptFile(
        encryptedBlob,
        metadata,
        masterKey,
        (progress: FileEncryptionProgress) => {
          const currentProgress: FileDownloadProgress = {
            stage: 'decrypting',
            progress: progress.percentage
          }
          setDownloadProgress(prev => new Map(prev).set(fileId, currentProgress))
          onProgress?.(currentProgress)
        }
      )

      // Mark as completed
      const completedProgress: FileDownloadProgress = {
        stage: 'completed',
        progress: 100
      }
      setDownloadProgress(prev => new Map(prev).set(fileId, completedProgress))
      onProgress?.(completedProgress)

      // Trigger download in browser
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Clean up progress after a delay
      setTimeout(() => {
        setDownloadProgress(prev => {
          const newMap = new Map(prev)
          newMap.delete(fileId)
          return newMap
        })
      }, 3000)

    } catch (error: any) {
      const errorProgress: FileDownloadProgress = {
        stage: 'downloading',
        progress: 0,
        error: error.message || 'Download failed'
      }
      setDownloadProgress(prev => new Map(prev).set(fileId, errorProgress))
      onProgress?.(errorProgress)
      throw error
    }
  }

  const getProgress = (fileId: string): FileDownloadProgress | undefined => {
    return downloadProgress.get(fileId)
  }

  const clearProgress = (fileId: string) => {
    setDownloadProgress(prev => {
      const newMap = new Map(prev)
      newMap.delete(fileId)
      return newMap
    })
  }

  return {
    downloadFile,
    getProgress,
    clearProgress,
    downloadProgress: Array.from(downloadProgress.entries())
  }
}
