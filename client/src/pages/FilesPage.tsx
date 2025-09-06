import React, { useState, useRef } from 'react'
import { FileUpload } from '@/components/FileUpload'
import { FileManager, FileManagerRef } from '@/components/FileManager'
import { Button } from '@/components/ui/button'
import { Upload, List } from 'lucide-react'

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Encrypted File Vault</h1>
        <div className="flex space-x-2">
          <Button
            variant={activeTab === 'browse' ? 'default' : 'outline'}
            onClick={() => setActiveTab('browse')}
            className="flex items-center space-x-2"
          >
            <List className="h-4 w-4" />
            <span>Browse Files</span>
          </Button>
          <Button
            variant={activeTab === 'upload' ? 'default' : 'outline'}
            onClick={handleUploadClick}
            className="flex items-center space-x-2"
          >
            <Upload className="h-4 w-4" />
            <span>Upload Files</span>
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border shadow-sm">
        <div className="p-6">
          <FileManager ref={fileManagerRef} onUploadClick={handleUploadClick} />
        </div>
      </div>

      <FileUpload 
        open={uploadDialogOpen}
        onClose={handleUploadClose}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  )
}
