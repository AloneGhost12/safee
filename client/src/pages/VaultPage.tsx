import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useApp } from '@/context/AppContext'
import { notesAPI, authAPI } from '@/lib/api'
import { useCrypto } from '@/hooks/useCrypto'
import { NotesList } from '@/components/NotesList'
import { NoteEditor } from '@/components/NoteEditor'
import { TagFilter } from '@/components/TagFilter'
import { Sidebar } from '@/components/Sidebar'
import { 
  Search, 
  Plus, 
  Settings, 
  LogOut, 
  Shield, 
  RefreshCw,
  AlertCircle
} from 'lucide-react'

export function VaultPage() {
  const { state, dispatch } = useApp()
  const { decryptNote } = useCrypto()
  const navigate = useNavigate()
  
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showNoteEditor, setShowNoteEditor] = useState(false)

  useEffect(() => {
    if (!state.user) {
      navigate('/login')
      return
    }
    loadNotes()
  }, [state.user])

  const loadNotes = async () => {
    if (!state.user) {
      navigate('/login')
      return
    }

    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })

    try {
      const response = await notesAPI.getAll()
      dispatch({ type: 'SET_NOTES', payload: response.notes })
    } catch (error: any) {
      if (error.status === 401) {
        // Token refresh will be handled automatically by the API layer
        handleLogout()
      } else {
        dispatch({ type: 'SET_ERROR', payload: error.message })
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  const handleLogout = async () => {
    try {
      await authAPI.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      dispatch({ type: 'CLEAR_STATE' })
      navigate('/login')
    }
  }

  const handleSearchChange = (query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: query })
  }

  const filteredNotes = (state.notes || []).filter(note => {
    if (note.isDeleted) return false
    
    // Search filter
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase()
      const cachedNote = state.decryptedNotes.get(note.id)
      if (cachedNote) {
        const matchesTitle = cachedNote.title.toLowerCase().includes(query)
        const matchesContent = cachedNote.content.toLowerCase().includes(query)
        const matchesTags = cachedNote.tags.some((tag: string) => 
          tag.toLowerCase().includes(query)
        )
        if (!matchesTitle && !matchesContent && !matchesTags) {
          return false
        }
      }
    }

    // Tag filter
    if (state.selectedTags.length > 0) {
      const cachedNote = state.decryptedNotes.get(note.id)
      if (cachedNote) {
        const hasSelectedTags = state.selectedTags.every(selectedTag =>
          cachedNote.tags.includes(selectedTag)
        )
        if (!hasSelectedTags) return false
      }
    }

    return true
  })

  const handleCreateNote = () => {
    dispatch({ type: 'SET_CURRENT_NOTE', payload: null })
    setShowNoteEditor(true)
  }

  if (state.loading && (state.notes || []).length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading your vault...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex">
        {/* Sidebar */}
        <Sidebar 
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          onLogout={handleLogout}
        />

        {/* Main content */}
        <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
          {/* Header */}
          <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                    <Shield className="h-6 w-6 mr-2 text-blue-600" />
                    Personal Vault
                  </h1>
                  {state.user && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {state.user.email}
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      type="text"
                      placeholder="Search notes..."
                      value={state.searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>

                  {/* Actions */}
                  <Button onClick={handleCreateNote} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New Note
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/settings')}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="p-6">
            {state.error && (
              <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                {state.error}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadNotes}
                  className="ml-auto"
                >
                  Retry
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Tag Filter */}
              <div className="lg:col-span-1">
                <TagFilter />
              </div>

              {/* Notes List */}
              <div className="lg:col-span-3">
                <NotesList
                  notes={filteredNotes}
                  onSelectNote={(note) => {
                    dispatch({ type: 'SET_CURRENT_NOTE', payload: note })
                    setShowNoteEditor(true)
                  }}
                />
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Note Editor Modal */}
      {showNoteEditor && (
        <NoteEditor
          note={state.currentNote}
          onClose={() => {
            setShowNoteEditor(false)
            dispatch({ type: 'SET_CURRENT_NOTE', payload: null })
          }}
          onSave={loadNotes}
        />
      )}
    </div>
  )
}
