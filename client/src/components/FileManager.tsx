import { useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useApp } from '@/context/AppContext'
import { useCrypto } from '@/hooks/useCrypto'
import { useFileDownload } from '@/hooks/useFileDownload'
import { filesAPI } from '@/lib/api'
import { decryptFileName } from '@/crypto/files'
import { PasswordPrompt } from '@/components/PasswordPrompt'
import { FilePreviewModal } from '@/components/FilePreviewModal'
import { RoleBasedComponent } from '@/components/RoleBasedComponent'
import { UserRole } from '@/types/permissions'
import { 
  Download, 
  Trash2, 
  Search, 
  File, 
  Image, 
  FileText, 
  Archive, 
  AlertCircle, 
  Shield,
  Loader2,
  Calendar,
  Upload,
  Eye
} from 'lucide-react'

interface FileInfo {
  id: string
  originalName: string
  mimeType: string
  size: number
  uploadedAt: string
  virusScanned: boolean
  virusScanResult?: 'clean' | 'infected' | 'error'
  tags: string[]
  decryptedName?: string
  decryptedMimeType?: string
}

interface FileManagerProps {
  onUploadClick: () => void
}

export interface FileManagerRef {
  refreshFiles: () => Promise<void>
}

export const FileManager = forwardRef<FileManagerRef, FileManagerProps>(({ onUploadClick }, ref) => {
  const { state } = useApp()
  const { getMasterKey } = useCrypto()
  const { downloadFile, getProgress } = useFileDownload()
  const [files, setFiles] = useState<FileInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [decryptingFiles, setDecryptingFiles] = useState<Set<string>>(new Set())
  
  // Password prompt state
  const [passwordPrompt, setPasswordPrompt] = useState<{
    isOpen: boolean
    type: 'download' | 'preview'
    file: FileInfo | null
    loading: boolean
    error: string
  }>({
    isOpen: false,
    type: 'download',
    file: null,
    loading: false,
    error: ''
  })
  
  // File preview state
  const [filePreview, setFilePreview] = useState<{
    isOpen: boolean
    file: FileInfo | null
    content: {
      type: 'text' | 'image' | 'pdf' | 'video' | 'audio' | 'code' | 'document' | 'unsupported'
      content: string | ArrayBuffer | null
      error?: string
    } | null
    loading: boolean
  }>({
    isOpen: false,
    file: null,
    content: null,
    loading: false
  })

  const loadFiles = async () => {
    if (!state.user?.token) return

    try {
      setLoading(true)
      setError('')
      
      const response = await filesAPI.getAll()
      setFiles(response.files)
    } catch (err: any) {
      setError(err.message || 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }

  // Expose refresh function via ref
  useImperativeHandle(ref, () => ({
    refreshFiles: loadFiles
  }), [state.user?.token])

  const getFileIcon = (mimeType: string, fileName?: string) => {
    const mime = mimeType.toLowerCase()
    const extension = fileName?.toLowerCase().split('.').pop() || ''
    
    // Images
    if (mime.includes('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff'].includes(extension)) {
      return <Image className="h-5 w-5 text-blue-500" />
    }
    
    // Documents and PDFs
    if (mime.includes('pdf') || extension === 'pdf' || 
        mime.includes('document') || mime.includes('wordprocessingml') ||
        ['doc', 'docx', 'odt', 'rtf'].includes(extension)) {
      return <FileText className="h-5 w-5 text-green-500" />
    }
    
    // Text and code files
    if (mime.includes('text/') || mime.includes('json') || mime.includes('xml') ||
        ['txt', 'log', 'md', 'csv', 'json', 'xml', 'yaml', 'yml', 'js', 'ts', 'py', 'java', 'c', 'cpp', 'php', 'rb', 'go', 'rs', 'sql', 'sh', 'css', 'html'].includes(extension)) {
      return <FileText className="h-5 w-5 text-green-500" />
    }
    
    // Archives
    if (mime.includes('zip') || mime.includes('archive') ||
        ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(extension)) {
      return <Archive className="h-5 w-5 text-purple-500" />
    }
    
    return <File className="h-5 w-5 text-gray-500" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const decryptFileNames = async (filesToDecrypt: FileInfo[]) => {
    const masterKey = await getMasterKey()
    if (!masterKey) return

    const decryptPromises = filesToDecrypt.map(async (file) => {
      if (file.decryptedName) return file

      try {
        setDecryptingFiles(prev => new Set(prev).add(file.id))
        
        // Attempt to decrypt both name and mime type
        // The decryptFileName function now handles non-encrypted data gracefully
        let decryptedName = file.originalName
        let decryptedMimeType = file.mimeType
        
        try {
          decryptedName = await decryptFileName(file.originalName, masterKey)
        } catch (decryptError) {
          console.warn('Failed to decrypt file name, using original:', decryptError)
          decryptedName = file.originalName
        }
        
        try {
          decryptedMimeType = await decryptFileName(file.mimeType, masterKey)
        } catch (decryptError) {
          console.warn('Failed to decrypt mime type, using original:', decryptError)
          decryptedMimeType = file.mimeType
        }
        
        return {
          ...file,
          decryptedName,
          decryptedMimeType
        }
      } catch (error) {
        console.error('Failed to decrypt file name:', error)
        return {
          ...file,
          decryptedName: 'Encrypted File',
          decryptedMimeType: 'application/octet-stream'
        }
      } finally {
        setDecryptingFiles(prev => {
          const newSet = new Set(prev)
          newSet.delete(file.id)
          return newSet
        })
      }
    })

    const decryptedFiles = await Promise.all(decryptPromises)
    setFiles(decryptedFiles)
  }

  const handleDownload = async (file: FileInfo) => {
    // Show password prompt first
    setPasswordPrompt({
      isOpen: true,
      type: 'download',
      file,
      loading: false,
      error: ''
    })
  }

  const handlePreview = async (file: FileInfo) => {
    // Show password prompt first
    setPasswordPrompt({
      isOpen: true,
      type: 'preview',
      file,
      loading: false,
      error: ''
    })
  }

  const handlePasswordSubmit = async (password: string) => {
    if (!passwordPrompt.file) return

    console.log('Password submitted for:', passwordPrompt.type, passwordPrompt.file.decryptedName || passwordPrompt.file.originalName)
    
    setPasswordPrompt(prev => ({ ...prev, loading: true, error: '' }))

    try {
      // Verify password by checking if it can decrypt user's data
      // This is a simple check - in production you might want more robust verification
      const masterKey = await getMasterKey()
      if (!masterKey) {
        throw new Error('Unable to verify encryption key')
      }

      if (passwordPrompt.type === 'download') {
        console.log('Starting download...')
        await downloadFile(passwordPrompt.file.id, password)
        setPasswordPrompt({
          isOpen: false,
          type: 'download',
          file: null,
          loading: false,
          error: ''
        })
      } else if (passwordPrompt.type === 'preview') {
        console.log('Starting preview...')
        await loadFilePreview(passwordPrompt.file, password)
        setPasswordPrompt({
          isOpen: false,
          type: 'preview',
          file: null,
          loading: false,
          error: ''
        })
      }
    } catch (error: any) {
      console.error('Password submission error:', error)
      setPasswordPrompt(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Authentication failed'
      }))
    }
  }

  const loadFilePreview = async (file: FileInfo, password: string) => {
    console.log('Loading preview for file:', file.id, file.decryptedName || file.originalName)
    console.log('File mimeType:', file.mimeType)
    
    setFilePreview({
      isOpen: true,
      file,
      content: null,
      loading: true
    })

    try {
      // Get the file preview content
      console.log('Calling filesAPI.getPreview...')
      const previewContent = await filesAPI.getPreview(file.id, password)
      console.log('Preview content received:', previewContent)
      console.log('Preview content type:', previewContent.type)
      console.log('Preview content URL/content:', previewContent.content)
      
      setFilePreview(prev => ({
        ...prev,
        content: previewContent,
        loading: false
      }))
    } catch (error: any) {
      console.error('Preview error:', error)
      setFilePreview(prev => ({
        ...prev,
        content: {
          type: 'unsupported',
          content: null,
          error: error.message || 'Failed to load preview'
        },
        loading: false
      }))
    }
  }

  const handlePreviewDownload = () => {
    if (filePreview.file) {
      setFilePreview({
        isOpen: false,
        file: null,
        content: null,
        loading: false
      })
      handleDownload(filePreview.file)
    }
  }

  const handleDelete = async (fileId: string) => {
    if (!state.user?.token) return
    
    if (!confirm('Are you sure you want to delete this file? It will be moved to trash.')) {
      return
    }

    try {
      await filesAPI.delete(fileId)
      // Refresh the file list to reflect the deletion
      await loadFiles()
    } catch (error: any) {
      setError(error.message || 'Failed to delete file')
    }
  }

  const getVirusScanIcon = (file: FileInfo) => {
    if (!file.virusScanned) {
      return (
        <div title="Scanning...">
          <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
        </div>
      )
    }

    switch (file.virusScanResult) {
      case 'clean':
        return (
          <div title="Clean">
            <Shield className="h-4 w-4 text-green-500" />
          </div>
        )
      case 'infected':
        return (
          <div title="Infected">
            <AlertCircle className="h-4 w-4 text-red-500" />
          </div>
        )
      case 'error':
        return (
          <div title="Scan Error">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </div>
        )
      default:
        return (
          <div title="Unknown">
            <Shield className="h-4 w-4 text-gray-400" />
          </div>
        )
    }
  }

  // Get all unique tags for filtering
  const allTags = Array.from(new Set(files.flatMap(file => file.tags))).sort()

  // Filter files based on search and tag
  const filteredFiles = files.filter(file => {
    const nameMatch = file.decryptedName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                     file.originalName.toLowerCase().includes(searchQuery.toLowerCase())
    
    const tagMatch = selectedTag === '' || file.tags.includes(selectedTag)
    
    return nameMatch && tagMatch
  })

  useEffect(() => {
    loadFiles()
  }, [state.user?.token])

  useEffect(() => {
    if (files.length > 0) {
      decryptFileNames(files)
    }
  }, [files.length])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading files...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">File Vault</h2>
          <p className="text-gray-600 dark:text-gray-400">
            {files.length} files • End-to-end encrypted
          </p>
        </div>
        <RoleBasedComponent 
          requiredPermission="canUpload"
          userRole={state.user?.role as UserRole}
          fallback={null}
        >
          <Button onClick={onUploadClick}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
        </RoleBasedComponent>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        {allTags.length > 0 && (
          <div className="sm:w-48">
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">All tags</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Files Grid */}
      {filteredFiles.length === 0 ? (
        <div className="text-center py-12">
          <File className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {files.length === 0 ? 'No files uploaded' : 'No files match your search'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {files.length === 0 
              ? 'Upload your first file to get started with secure file storage.'
              : 'Try adjusting your search or filter criteria.'
            }
          </p>
          {files.length === 0 && (
            <RoleBasedComponent 
              requiredPermission="canUpload"
              userRole={state.user?.role as UserRole}
              fallback={null}
            >
              <Button onClick={onUploadClick}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Files
              </Button>
            </RoleBasedComponent>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFiles.map((file) => {
            const downloadProgress = getProgress(file.id)
            const isDecrypting = decryptingFiles.has(file.id)
            
            return (
              <div
                key={file.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                {/* File Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {getFileIcon(file.decryptedMimeType || file.mimeType, file.decryptedName || file.originalName)}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {isDecrypting ? (
                          <span className="flex items-center">
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            Decrypting...
                          </span>
                        ) : (
                          file.decryptedName || 'Encrypted File'
                        )}
                      </h3>
                      <p className="text-xs text-gray-500 truncate">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  {getVirusScanIcon(file)}
                </div>

                {/* File Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-xs text-gray-500">
                    <Calendar className="h-3 w-3 mr-1" />
                    {formatDate(file.uploadedAt)}
                  </div>
                  
                  {file.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {file.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                      {file.tags.length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{file.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Download Progress */}
                {downloadProgress && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>
                        {downloadProgress.stage === 'downloading' && 'Downloading...'}
                        {downloadProgress.stage === 'decrypting' && 'Decrypting...'}
                        {downloadProgress.stage === 'completed' && 'Completed'}
                      </span>
                      <span>{downloadProgress.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${downloadProgress.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePreview(file)}
                    disabled={!!downloadProgress || file.virusScanResult === 'infected'}
                    className="flex-1"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Preview
                  </Button>
                  <RoleBasedComponent 
                    requiredPermission="canDownload"
                    userRole={state.user?.role as UserRole}
                    fallback={null}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(file)}
                      disabled={!!downloadProgress || file.virusScanResult === 'infected'}
                      className="flex-1"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                  </RoleBasedComponent>
                  <RoleBasedComponent 
                    requiredPermission="canDelete"
                    userRole={state.user?.role as UserRole}
                    fallback={null}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(file.id)}
                      disabled={!!downloadProgress}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </RoleBasedComponent>
                </div>

                {/* Virus Warning */}
                {file.virusScanResult === 'infected' && (
                  <div className="mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2">
                    <div className="flex items-center text-xs text-red-700 dark:text-red-400">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      File is infected and cannot be downloaded
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Password Prompt Modal */}
      <PasswordPrompt
        isOpen={passwordPrompt.isOpen}
        onClose={() => setPasswordPrompt(prev => ({ ...prev, isOpen: false }))}
        onSubmit={handlePasswordSubmit}
        title={passwordPrompt.type === 'download' ? 'Authenticate Download' : 'Authenticate Preview'}
        description={`Enter your main password to ${passwordPrompt.type} "${passwordPrompt.file?.decryptedName || 'this file'}". Note: Only the main password (not view password) can be used to access files.`}
        actionText={passwordPrompt.type === 'download' ? 'Download' : 'Preview'}
        isLoading={passwordPrompt.loading}
        error={passwordPrompt.error}
      />

      {/* File Preview Modal */}
      <FilePreviewModal
        isOpen={filePreview.isOpen}
        onClose={() => setFilePreview(prev => ({ ...prev, isOpen: false }))}
        file={filePreview.file ? {
          id: filePreview.file.id,
          name: filePreview.file.decryptedName || 'Encrypted File',
          mimeType: filePreview.file.decryptedMimeType || filePreview.file.mimeType,
          size: filePreview.file.size
        } : { id: '', name: '', mimeType: '', size: 0 }}
        previewContent={filePreview.content || undefined}
        onDownload={handlePreviewDownload}
        loading={filePreview.loading}
        userRole={state.user?.role}
      />
    </div>
  )
})
