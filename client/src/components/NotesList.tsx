import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useApp, Note } from '@/context/AppContext'
import { useCrypto } from '@/hooks/useCrypto'
import { formatDate, truncateText } from '@/lib/utils'
import { 
  FileText, 
  Lock, 
  Unlock, 
  Calendar, 
  Tag,
  MoreVertical,
  Trash2,
  Edit
} from 'lucide-react'

interface NotesListProps {
  notes: Note[]
  onSelectNote: (note: Note) => void
}

export function NotesList({ notes, onSelectNote }: NotesListProps) {
  const { state } = useApp()
  const { decryptNote } = useCrypto()
  const [decryptingNotes, setDecryptingNotes] = useState<Set<string>>(new Set())

  // Auto-decrypt notes as they become visible
  useEffect(() => {
    decryptVisibleNotes()
  }, [notes])

  const decryptVisibleNotes = async () => {
    // For demo purposes, we'll skip actual decryption
    // In a real app, you'd need the master key to decrypt
    // For now, we'll just show placeholder decrypted content
    
    for (const note of notes.slice(0, 10)) { // Only decrypt first 10 for performance
      if (!state.decryptedNotes.has(note.id) && !decryptingNotes.has(note.id)) {
        // Mock decryption for demo
        const mockDecryptedNote = {
          ...note,
          title: `Decrypted: ${note.title || 'Untitled'}`,
          content: `This is decrypted content for note ${note.id}...`,
          tags: ['demo', 'encrypted'],
          isEncrypted: false,
        }
        
        // Simulate decryption in state
        setTimeout(() => {
          // In real app, use: dispatch({ type: 'SET_DECRYPTED_NOTE', payload: { id: note.id, note: mockDecryptedNote } })
        }, 100)
      }
    }
  }

  const handleNoteClick = (note: Note) => {
    onSelectNote(note)
  }

  const renderNoteCard = (note: Note) => {
    const cachedNote = state.decryptedNotes.get(note.id)
    const isDecrypted = !!cachedNote
    const displayNote = cachedNote || note

    return (
      <div
        key={note.id}
        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all duration-200 cursor-pointer group"
        onClick={() => handleNoteClick(note)}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <h3 className="font-medium text-gray-900 dark:text-white truncate">
              {isDecrypted ? displayNote.title : (
                <span className="flex items-center text-gray-500">
                  <Lock className="h-3 w-3 mr-1" />
                  Encrypted Title
                </span>
              )}
            </h3>
          </div>
          
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isDecrypted ? (
              <Unlock className="h-4 w-4 text-green-500" />
            ) : (
              <Lock className="h-4 w-4 text-gray-400" />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation()
                // Handle note actions menu
              }}
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Content Preview */}
        <div className="mb-3">
          {isDecrypted ? (
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
              {truncateText(displayNote.content, 150)}
            </p>
          ) : (
            <div className="text-sm text-gray-400 italic flex items-center">
              <Lock className="h-3 w-3 mr-1" />
              Content encrypted - click to decrypt and view
            </div>
          )}
        </div>

        {/* Tags */}
        {isDecrypted && displayNote.tags && displayNote.tags.length > 0 && (
          <div className="flex items-center flex-wrap gap-1 mb-3">
            <Tag className="h-3 w-3 text-gray-400" />
            {displayNote.tags.slice(0, 3).map((tag: string) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                {tag}
              </span>
            ))}
            {displayNote.tags.length > 3 && (
              <span className="text-xs text-gray-500">
                +{displayNote.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center">
            <Calendar className="h-3 w-3 mr-1" />
            {formatDate(note.updatedAt || note.createdAt)}
          </div>
          
          <div className="flex items-center space-x-2">
            {note.isEncrypted && (
              <span className="flex items-center text-green-600 dark:text-green-400">
                <Lock className="h-3 w-3 mr-1" />
                Encrypted
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No notes found
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          {state.searchQuery || state.selectedTags.length > 0
            ? 'Try adjusting your search or tag filters'
            : 'Create your first encrypted note to get started'
          }
        </p>
        {!state.searchQuery && state.selectedTags.length === 0 && (
          <Button onClick={() => onSelectNote(null as any)}>
            <FileText className="h-4 w-4 mr-2" />
            Create Note
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Notes ({notes.length})
        </h2>
        
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {state.decryptedNotes.size > 0 && (
            <span className="flex items-center">
              <Unlock className="h-4 w-4 mr-1 text-green-500" />
              {state.decryptedNotes.size} decrypted
            </span>
          )}
        </div>
      </div>

      {/* Notes Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {notes.map(renderNoteCard)}
      </div>

      {/* Load more button if there are many notes */}
      {notes.length > 50 && (
        <div className="text-center pt-6">
          <Button variant="outline">
            Load More Notes
          </Button>
        </div>
      )}
    </div>
  )
}
