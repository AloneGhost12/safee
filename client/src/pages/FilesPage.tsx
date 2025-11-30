import React, { useState, useRef } from 'react'
import { FileUpload } from '@/components/FileUpload'
import { FileManager, FileManagerRef } from '@/components/FileManager'
import { SharedLayout } from '@/components/SharedLayout'
import { Button } from '@/components/ui/button'
import { Upload, List, FolderOpen } from 'lucide-react'

export const FilesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'browse' | 'upload'>('browse')
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const fileManagerRef = useRef<FileManagerRef>(null)

  const handleUploadClick = () => {
    setUploadDialogOpen(true)
  }

  const handleUploadClose = () => {
    setUploadDialogOpen(false)
  }

  const handleUploadComplete = async () => {
    // Refresh the file list to show newly uploaded files
    await fileManagerRef.current?.refreshFiles()
    setUploadDialogOpen(false)
    setActiveTab('browse')
  }

  const headerActions = (
    <div className="flex space-x-2">
      <Button
        variant={activeTab === 'browse' ? 'default' : 'outline'}
        onClick={async () => {
          if (activeTab !== 'browse') {
            setActiveTab('browse')
          } else {
            await fileManagerRef.current?.refreshFiles()
          }
        }}
        title={activeTab === 'browse' ? 'Refresh file list' : 'Show file list'}
        className="flex items-center space-x-2"
        size="sm"
      >
        <List className="h-4 w-4" />
        <span className="hidden sm:inline">Browse Files</span>
      </Button>
      <Button
        variant={activeTab === 'upload' ? 'default' : 'outline'}
        onClick={handleUploadClick}
        className="flex items-center space-x-2"
        size="sm"
      >
        <Upload className="h-4 w-4" />
        <span className="hidden sm:inline">Upload Files</span>
      </Button>
    </div>
  )

  return (
    <SharedLayout
      title="Encrypted File Vault"
      icon={<FolderOpen className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />}
      headerActions={headerActions}
    >
      <div className="bg-card rounded-lg border shadow-sm">
        <div className="p-4 sm:p-6">
          <FileManager ref={fileManagerRef} onUploadClick={handleUploadClick} />
        </div>
      </div>

      <FileUpload 
        open={uploadDialogOpen}
        onClose={handleUploadClose}
        onUploadComplete={handleUploadComplete}
      />
    </SharedLayout>
  )
}
