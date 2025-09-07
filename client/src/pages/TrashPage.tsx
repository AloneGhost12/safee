import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useApp, Note } from '@/context/AppContext'
import { notesAPI, filesAPI } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { SharedLayout } from '@/components/SharedLayout'
import { 
  Trash2, 
  RotateCcw,
  AlertCircle,
  X,
  FileText,
  StickyNote
} from 'lucide-react'

interface DeletedFile {
  id: string
  originalName: string
  mimeType: string
  size: number
  uploadedAt: string
  deletedAt: string
  virusScanned: boolean
  virusScanResult?: 'clean' | 'infected' | 'error'
  tags: string[]
  isDeleted: boolean
}

export function TrashPage() {
  const { dispatch } = useApp()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deletedNotes, setDeletedNotes] = useState<Note[]>([])
  const [deletedFiles, setDeletedFiles] = useState<DeletedFile[]>([])

  // Load deleted items on component mount
  useEffect(() => {
    console.log('TrashPage mounted, loading deleted items...')
    loadDeletedItems()
  }, [])

  console.log('TrashPage render - deletedNotes:', deletedNotes.length, 'deletedFiles:', deletedFiles.length, 'loading:', loading)

  const loadDeletedItems = async () => {
    try {
      setLoading(true)
      setError('')

      console.log('Loading deleted items...')

      // Fetch deleted notes and files in parallel
      const [notesResponse, filesResponse] = await Promise.all([
        notesAPI.getDeleted(),
        filesAPI.getDeleted()
      ])

      console.log('Deleted notes response:', notesResponse)
      console.log('Deleted files response:', filesResponse)

      setDeletedNotes(notesResponse.notes)
      setDeletedFiles(filesResponse.files)

      console.log('Set deleted notes:', notesResponse.notes)
      console.log('Set deleted files:', filesResponse.files)
    } catch (err: any) {
      console.error('Error loading deleted items:', err)
      setError(err.message || 'Failed to load deleted items')
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async (itemId: string, type: 'note' | 'file') => {
    setLoading(true)
    setError('')

    try {
      if (type === 'note') {
        await notesAPI.restore(itemId)
        // Remove from local state
        setDeletedNotes(prev => prev.filter(note => note.id !== itemId))
        dispatch({ type: 'RESTORE_NOTE', payload: itemId })
      } else {
        await filesAPI.restore(itemId)
        // Remove from local state
        setDeletedFiles(prev => prev.filter(file => file.id !== itemId))
      }
    } catch (err: any) {
      setError(err.message || `Failed to restore ${type}`)
    } finally {
      setLoading(false)
    }
  }

  const handlePermanentDelete = async (itemId: string, type: 'note' | 'file') => {
    if (!window.confirm(`Are you sure? This will permanently delete the ${type} and cannot be undone.`)) {
      return
    }

    setLoading(true)
    setError('')

    try {
      if (type === 'note') {
        await notesAPI.permanentDelete(itemId)
        // Remove from local state
        setDeletedNotes(prev => prev.filter(note => note.id !== itemId))
        dispatch({ type: 'PERMANENTLY_DELETE_NOTE', payload: itemId })
      } else {
        await filesAPI.permanentDelete(itemId)
        // Remove from local state
        setDeletedFiles(prev => prev.filter(file => file.id !== itemId))
      }
    } catch (err: any) {
      setError(err.message || `Failed to permanently delete ${type}`)
    } finally {
      setLoading(false)
    }
  }

  const handleEmptyTrash = async () => {
    const totalItems = deletedNotes.length + deletedFiles.length
    if (totalItems === 0) return

    if (!window.confirm(`Are you sure you want to permanently delete all ${totalItems} items in trash? This cannot be undone.`)) {
      return
    }

    setLoading(true)
    setError('')

    try {
      // Delete all notes
      for (const note of deletedNotes) {
        await notesAPI.permanentDelete(note.id)
        dispatch({ type: 'PERMANENTLY_DELETE_NOTE', payload: note.id })
      }

      // Delete all files
      for (const file of deletedFiles) {
        await filesAPI.permanentDelete(file.id)
      }

      // Clear local state
      setDeletedNotes([])
      setDeletedFiles([])
    } catch (err: any) {
      setError(err.message || 'Failed to empty trash')
    } finally {
      setLoading(false)
    }
  }

  const headerActions = (
    <>
      {(deletedNotes.length > 0 || deletedFiles.length > 0) && (
        <Button
          variant="destructive"
          onClick={handleEmptyTrash}
          disabled={loading}
          size="sm"
        >
          <X className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Empty Trash</span>
        </Button>
      )}
    </>
  )

  return (
    <SharedLayout
      title={`Trash (${deletedNotes.length + deletedFiles.length})`}
      icon={<Trash2 className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />}
      headerActions={headerActions}
    >
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Loading deleted items...</p>
        </div>
      ) : deletedNotes.length === 0 && deletedFiles.length === 0 ? (
        <div className="text-center py-12">
          <Trash2 className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Trash is empty
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Deleted notes and files will appear here. You can restore them or delete them permanently.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Items in trash can be restored or permanently deleted. Permanent deletion cannot be undone.
          </p>

          {/* Deleted Notes Section */}
          {deletedNotes.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <StickyNote className="h-5 w-5 mr-2" />
                Deleted Notes ({deletedNotes.length})
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {deletedNotes.map((note) => (
                  <div
                    key={note.id}
                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {note.title || 'Untitled'}
                      </h4>
                      <span className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                        Note
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                      {note.content ? note.content.substring(0, 100) + '...' : 'No content'}
                    </p>

                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                      Deleted: {formatDate(note.updatedAt || note.createdAt)}
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestore(note.id, 'note')}
                        disabled={loading}
                        className="flex-1"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">Restore</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handlePermanentDelete(note.id, 'note')}
                        disabled={loading}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deleted Files Section */}
          {deletedFiles.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Deleted Files ({deletedFiles.length})
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {deletedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {file.originalName}
                      </h4>
                      <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                        File
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Size: {(file.size / 1024).toFixed(2)} KB
                    </p>

                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                      Deleted: {formatDate(file.deletedAt)}
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestore(file.id, 'file')}
                        disabled={loading}
                        className="flex-1"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">Restore</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handlePermanentDelete(file.id, 'file')}
                        disabled={loading}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </SharedLayout>
  )
}
