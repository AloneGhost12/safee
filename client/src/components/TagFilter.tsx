import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useApp } from '@/context/AppContext'
import { X, Tag as TagIcon } from 'lucide-react'

export function TagFilter() {
  const { state, dispatch } = useApp()
  const [allTags, setAllTags] = useState<string[]>([])

  useEffect(() => {
    extractAllTags()
  }, [state.notes, state.decryptedNotes])

  const extractAllTags = async () => {
    const tagSet = new Set<string>()
    
    for (const note of (state.notes || [])) {
      if (note.isDeleted) continue
      
      // Check if note is cached/decrypted
      const cachedNote = state.decryptedNotes.get(note.id)
      if (cachedNote && cachedNote.tags) {
        cachedNote.tags.forEach((tag: string) => tagSet.add(tag))
      }
    }
    
    setAllTags(Array.from(tagSet).sort())
  }

  const handleTagToggle = (tag: string) => {
    const isSelected = state.selectedTags.includes(tag)
    let newSelectedTags: string[]
    
    if (isSelected) {
      newSelectedTags = state.selectedTags.filter(t => t !== tag)
    } else {
      newSelectedTags = [...state.selectedTags, tag]
    }
    
    dispatch({ type: 'SET_SELECTED_TAGS', payload: newSelectedTags })
  }

  const handleClearAllTags = () => {
    dispatch({ type: 'SET_SELECTED_TAGS', payload: [] })
  }

  const getTagCount = (tag: string) => {
    return (state.notes || []).filter(note => {
      if (note.isDeleted) return false
      const cachedNote = state.decryptedNotes.get(note.id)
      return cachedNote && cachedNote.tags && cachedNote.tags.includes(tag)
    }).length
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <TagIcon className="h-5 w-5 mr-2" />
          Tags
        </h3>
        
        {state.selectedTags.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAllTags}
            className="text-xs"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Selected tags */}
      {state.selectedTags.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Active filters:</p>
          <div className="flex flex-wrap gap-2">
            {state.selectedTags.map((tag) => (
              <Badge
                key={tag}
                variant="default"
                className="cursor-pointer"
                onClick={() => handleTagToggle(tag)}
              >
                {tag}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* All available tags */}
      <div className="space-y-2">
        {allTags.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            No tags found. Tags will appear here as you create notes with tags.
          </p>
        ) : (
          allTags.map((tag) => {
            const isSelected = state.selectedTags.includes(tag)
            const count = getTagCount(tag)
            
            return (
              <div
                key={tag}
                className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                onClick={() => handleTagToggle(tag)}
              >
                <span className={`text-sm ${
                  isSelected 
                    ? 'text-blue-700 dark:text-blue-300 font-medium' 
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {tag}
                </span>
                <span className={`text-xs px-2 py-1 rounded-md ${
                  isSelected
                    ? 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                }`}>
                  {count}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Quick stats */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <div className="flex justify-between">
            <span>Total notes:</span>
            <span>{(state.notes || []).filter(n => !n.isDeleted).length}</span>
          </div>
          <div className="flex justify-between">
            <span>Unique tags:</span>
            <span>{allTags.length}</span>
          </div>
          {state.selectedTags.length > 0 && (
            <div className="flex justify-between font-medium text-blue-600 dark:text-blue-400">
              <span>Filtered notes:</span>
              <span>
                {(state.notes || []).filter(note => {
                  if (note.isDeleted) return false
                  const cachedNote = state.decryptedNotes.get(note.id)
                  if (!cachedNote) return false
                  return state.selectedTags.every(selectedTag =>
                    cachedNote.tags && cachedNote.tags.includes(selectedTag)
                  )
                }).length}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Create the Badge component since it's not imported
interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'secondary'
  className?: string
  onClick?: () => void
}

const Badge = ({ children, variant = 'default', className = '', ...props }: BadgeProps) => {
  const baseClasses = 'inline-flex items-center px-2 py-1 rounded-md text-xs font-medium transition-colors'
  const variantClasses = {
    default: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    secondary: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  }
  
  return (
    <span 
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
