import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useApp, Note } from '@/context/AppContext'
import { notesAPI } from '@/lib/api'
import { 
  Save, 
  X, 
  Lock, 
  Tag,
  Plus,
  Trash2,
  AlertCircle
} from 'lucide-react'

interface NoteEditorProps {
  note: Note | null
  onClose: () => void
  onSave: () => void
}

export function NoteEditor({ note, onClose, onSave }: NoteEditorProps) {
  const { state, dispatch } = useApp()
  
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDirty, setIsDirty] = useState(false)

  const isEditing = !!note

  useEffect(() => {
    if (note) {
      loadNoteForEditing()
    } else {
      // New note
      setTitle('')
      setContent('')
      setTags([])
      setTagInput('')
      setError('')
      setIsDirty(false)
    }
  }, [note])

  const loadNoteForEditing = async () => {
    if (!note) return

    try {
      // Check if note is already decrypted
      const cachedNote = state.decryptedNotes.get(note.id)
      if (cachedNote) {
        setTitle(cachedNote.title)
        setContent(cachedNote.content)
        setTags(cachedNote.tags || [])
      } else {
        // For demo, use placeholder values
        setTitle(note.title || 'Encrypted Title')
        setContent('Encrypted content - would need master key to decrypt')
        setTags(['encrypted'])
      }
      setIsDirty(false)
    } catch (err: any) {
      setError('Failed to decrypt note: ' + err.message)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setIsDirty(true)
    switch (field) {
      case 'title':
        setTitle(value)
        break
      case 'content':
        setContent(value)
        break
    }
  }

  const handleAddTag = () => {
    const newTag = tagInput.trim()
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag])
      setTagInput('')
      setIsDirty(true)
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
    setIsDirty(true)
  }

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      const noteData = {
        title: title.trim(),
        content: content.trim(),
        tags: tags,
      }

      if (isEditing && note) {
        // Update existing note
        const response = await notesAPI.update(note.id, noteData)
        dispatch({ type: 'UPDATE_NOTE', payload: response.note })
      } else {
        // Create new note
        const response = await notesAPI.create(noteData)
        dispatch({ type: 'ADD_NOTE', payload: response.note })
      }

      setIsDirty(false)
      onSave()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save note')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!note || !window.confirm('Are you sure you want to delete this note?')) {
      return
    }

    setLoading(true)
    try {
      await notesAPI.delete(note.id)
      dispatch({ type: 'DELETE_NOTE', payload: note.id })
      onSave()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to delete note')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Are you sure you want to close?')) {
      return
    }
    onClose()
  }

  return (
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Lock className="h-5 w-5 mr-2 text-blue-600" />
            {isEditing ? 'Edit Note' : 'Create New Note'}
            {isDirty && <span className="text-yellow-600 ml-2">•</span>}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 'Edit your encrypted note details' : 'Create a new encrypted note with title, content, and tags'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter note title..."
              disabled={loading}
              className="text-lg font-medium"
            />
          </div>

          {/* Tags */}
          <div className="space-y-3">
            <Label>Tags</Label>
            
            {/* Tag input */}
            <div className="flex space-x-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag..."
                disabled={loading}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag()
                  }
                }}
              />
              <Button
                type="button"
                onClick={handleAddTag}
                disabled={!tagInput.trim() || loading}
                size="sm"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Current tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      disabled={loading}
                      className="ml-2 hover:text-blue-600 dark:hover:text-blue-300"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              placeholder="Write your note content..."
              disabled={loading}
              className="min-h-[300px] resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Content will be encrypted client-side before saving
            </p>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {isEditing && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
                size="sm"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
          
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || !title.trim()}
            >
              {loading ? (
                'Saving...'
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? 'Update' : 'Create'}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
