import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useApp } from '@/context/AppContext'
import { useCrypto } from '@/hooks/useCrypto'
import { filesAPI } from '@/lib/api'
import { 
  encryptFile, 
  uploadEncryptedFile, 
  validateFileForUpload,
  FileEncryptionProgress 
} from '@/crypto/files'
import {
  Upload,
  File,
  X,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'

interface FileUploadProps {
  open: boolean
  onClose: () => void
  onUploadComplete?: () => void
}

interface UploadingFile {
  file: File
  progress: number
  status: 'encrypting' | 'uploading' | 'completing' | 'completed' | 'error'
  error?: string
  fileId?: string
}

export function FileUpload({ open, onClose, onUploadComplete }: FileUploadProps) {
  const { state } = useApp()
  const { getMasterKey } = useCrypto()
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [tags, setTags] = useState('')
  const [storageType, setStorageType] = useState<'s3' | 'cloudinary'>('cloudinary')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const autoCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced refresh function
  const triggerRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
    }
    refreshTimeoutRef.current = setTimeout(() => {
      onUploadComplete?.()
    }, 1000) // Wait 1 second after last upload completes
  }, [onUploadComplete])

  // Check if all uploads are completed and auto-close after a delay
  const checkAutoClose = useCallback(() => {
    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current)
    }
    
    // Check if all files are completed or have errors (no active uploads)
    const allDone = uploadingFiles.length > 0 && uploadingFiles.every(f => 
      f.status === 'completed' || f.status === 'error'
    )
    
    if (allDone) {
      autoCloseTimeoutRef.current = setTimeout(() => {
        handleClose()
      }, 2000) // Auto-close after 2 seconds if all uploads are done
    }
  }, [uploadingFiles])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
      if (autoCloseTimeoutRef.current) {
        clearTimeout(autoCloseTimeoutRef.current)
      }
    }
  }, [])

  // Check for auto-close when upload states change
  useEffect(() => {
    checkAutoClose()
  }, [uploadingFiles, checkAutoClose])

  const updateFileProgress = useCallback((index: number, updates: Partial<UploadingFile>) => {
    setUploadingFiles(prev => prev.map((f, i) => i === index ? { ...f, ...updates } : f))
  }, [])

  const uploadFileToCloudinary = useCallback(async (file: File, index: number) => {
    if (!state.user?.token) {
      updateFileProgress(index, { status: 'error', error: 'Not authenticated' })
      return
    }

    try {
      // Validate file
      validateFileForUpload(file)

      // Get master key
      const masterKey = await getMasterKey()
      if (!masterKey) {
        updateFileProgress(index, { status: 'error', error: 'Encryption key not available' })
        return
      }

      // Encrypt file
      updateFileProgress(index, { status: 'encrypting', progress: 0 })
      
      const { encryptedBlob, metadata } = await encryptFile(
        file,
        masterKey,
        (progress: FileEncryptionProgress) => {
          updateFileProgress(index, { progress: progress.percentage })
        }
      )

      // Create form data for direct upload
      updateFileProgress(index, { status: 'uploading', progress: 50 })
      
      const formData = new FormData()
      formData.append('file', encryptedBlob, file.name)
      formData.append('encryptedName', metadata.encryptedName)
      formData.append('encryptedMimeType', metadata.encryptedMimeType)
      
      if (tags.trim()) {
        const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean)
        formData.append('tags', JSON.stringify(tagArray))
      }

      // Upload to Cloudinary
      const result = await filesAPI.uploadToCloudinary(formData)
      
      updateFileProgress(index, { 
        status: 'completed', 
        progress: 100,
        fileId: result.fileId
      })

      // Trigger debounced refresh
      triggerRefresh()
    } catch (error: any) {
      console.error('Cloudinary upload failed:', error)
      updateFileProgress(index, { 
        status: 'error', 
        error: error.message || 'Upload failed' 
      })
    }
  }, [state.user?.token, getMasterKey, tags, updateFileProgress])

  const uploadFile = useCallback(async (file: File, index: number) => {
    if (!state.user?.token) {
      updateFileProgress(index, { status: 'error', error: 'Not authenticated' })
      return
    }

    try {
      // Validate file
      validateFileForUpload(file)

      // Get master key
      const masterKey = await getMasterKey()
      if (!masterKey) {
        updateFileProgress(index, { status: 'error', error: 'Encryption key not available' })
        return
      }

      // Encrypt file
      updateFileProgress(index, { status: 'encrypting', progress: 0 })
      
      const { encryptedBlob, metadata } = await encryptFile(
        file,
        masterKey,
        (progress: FileEncryptionProgress) => {
          updateFileProgress(index, { progress: progress.percentage })
        }
      )

      // Request upload URL
      updateFileProgress(index, { status: 'uploading', progress: 0 })
      
      const fileTags = tags.split(',').map(tag => tag.trim()).filter(Boolean)
      
      const uploadResponse = await filesAPI.requestUploadUrl({
        fileName: file.name,
        fileSize: encryptedBlob.size,
        contentType: 'application/octet-stream',
        encryptedName: metadata.encryptedName,
        encryptedMimeType: metadata.encryptedMimeType,
        tags: fileTags,
      })

      updateFileProgress(index, { fileId: uploadResponse.fileId })

      // Upload encrypted file to S3
      await uploadEncryptedFile(
        uploadResponse.uploadUrl,
        encryptedBlob,
        'application/octet-stream',
        (progress: FileEncryptionProgress) => {
          updateFileProgress(index, { progress: progress.percentage })
        }
      )

      // Confirm upload completion
      updateFileProgress(index, { status: 'completing', progress: 100 })
      
      await filesAPI.confirmUpload(uploadResponse.fileId)

      updateFileProgress(index, { status: 'completed', progress: 100 })

      // Trigger debounced refresh
      triggerRefresh()

    } catch (error: any) {
      updateFileProgress(index, { 
        status: 'error', 
        error: error.message || 'Upload failed' 
      })
    }
  }, [state.user?.token, getMasterKey, tags, updateFileProgress])

  const handleFileSelect = useCallback((files: FileList) => {
    const fileArray = Array.from(files)
    const newUploadingFiles: UploadingFile[] = fileArray.map(file => ({
      file,
      progress: 0,
      status: 'encrypting'
    }))

    setUploadingFiles(newUploadingFiles)

    // Start uploading each file using selected storage type
    fileArray.forEach((file, index) => {
      if (storageType === 'cloudinary') {
        uploadFileToCloudinary(file, index)
      } else {
        uploadFile(file, index)
      }
    })
  }, [uploadFile, uploadFileToCloudinary, storageType])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files)
    }
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const removeFile = (index: number) => {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleClose = () => {
    const hasActiveUploads = uploadingFiles.some(f => 
      f.status === 'encrypting' || f.status === 'uploading' || f.status === 'completing'
    )
    
    if (hasActiveUploads) {
      if (!confirm('There are active uploads. Are you sure you want to close?')) {
        return
      }
    }

    setUploadingFiles([])
    setTags('')
    onClose()
  }

  const getStatusIcon = (status: UploadingFile['status']) => {
    switch (status) {
      case 'encrypting':
      case 'uploading':
      case 'completing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <File className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusText = (file: UploadingFile) => {
    switch (file.status) {
      case 'encrypting':
        return 'Encrypting...'
      case 'uploading':
        return 'Uploading...'
      case 'completing':
        return 'Finalizing...'
      case 'completed':
        return 'Completed'
      case 'error':
        return file.error || 'Error'
      default:
        return 'Pending'
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Upload Files</DialogTitle>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            Upload and encrypt your files securely. Choose between S3 or Cloudinary storage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Storage Type Selector */}
          <div>
            <Label>Storage Type</Label>
            <div className="flex space-x-4 mt-2">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="storageType"
                  value="s3"
                  checked={storageType === 's3'}
                  onChange={(e) => setStorageType(e.target.value as 's3' | 'cloudinary')}
                  disabled={uploadingFiles.length > 0}
                  className="text-blue-600"
                />
                <span className="text-sm">S3/R2 Storage</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="storageType"
                  value="cloudinary"
                  checked={storageType === 'cloudinary'}
                  onChange={(e) => setStorageType(e.target.value as 's3' | 'cloudinary')}
                  disabled={uploadingFiles.length > 0}
                  className="text-blue-600"
                />
                <span className="text-sm">Cloudinary (Images)</span>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {storageType === 's3' 
                ? 'Use S3/R2 for general file storage with presigned URLs'
                : 'Use Cloudinary for optimized image storage with transformations'
              }
            </p>
          </div>

          {/* Tags Input */}
          <div>
            <Label htmlFor="tags">Tags (optional)</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Enter tags separated by commas"
              disabled={uploadingFiles.length > 0}
            />
            <p className="text-xs text-gray-500 mt-1">
              e.g., documents, images, important
            </p>
          </div>

          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-950'
                : 'border-gray-300 dark:border-gray-600'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => {
              // Allow clicking the drop zone to open file picker when no active uploads are in progress
              const hasActiveUploads = uploadingFiles.some(f => 
                f.status === 'encrypting' || f.status === 'uploading' || f.status === 'completing'
              )
              if (!hasActiveUploads) {
                fileInputRef.current?.click()
              }
            }}
          >
            <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Drop files here or click to browse
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Maximum file size: 100MB. Supported formats: Images, PDFs, Documents, Archives
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFiles.some(f => 
                f.status === 'encrypting' || f.status === 'uploading' || f.status === 'completing'
              )}
            >
              Select Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleInputChange}
            />
          </div>

          {/* Upload Progress */}
          {uploadingFiles.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium">Upload Progress</h3>
              {uploadingFiles.map((uploadingFile, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  {getStatusIcon(uploadingFile.status)}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {uploadingFile.file.name}
                    </p>
                    <div className="flex items-center space-x-2">
                      <p className="text-xs text-gray-500">
                        {getStatusText(uploadingFile)}
                      </p>
                      {uploadingFile.status !== 'error' && uploadingFile.status !== 'completed' && (
                        <span className="text-xs text-gray-500">
                          {uploadingFile.progress}%
                        </span>
                      )}
                    </div>
                    
                    {/* Progress bar */}
                    {uploadingFile.status !== 'error' && uploadingFile.status !== 'completed' && (
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadingFile.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {(uploadingFile.status === 'error' || uploadingFile.status === 'completed') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Security Notice */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  End-to-End Encrypted
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Files are encrypted on your device before upload. Only you can decrypt and view them.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
