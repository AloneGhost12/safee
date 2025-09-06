import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { setAuthToken } from '../lib/api'

export interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
  isDeleted?: boolean
  isEncrypted?: boolean
}

export interface User {
  id: string
  email: string
  token?: string
}

interface AppState {
  user: User | null
  notes: Note[]
  decryptedNotes: Map<string, Note>
  loading: boolean
  error: string | null
  selectedTags: string[]
  searchQuery: string
  currentNote: Note | null
}

type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_NOTES'; payload: Note[] }
  | { type: 'ADD_NOTE'; payload: Note }
  | { type: 'UPDATE_NOTE'; payload: Note }
  | { type: 'DELETE_NOTE'; payload: string }
  | { type: 'RESTORE_NOTE'; payload: string }
  | { type: 'PERMANENTLY_DELETE_NOTE'; payload: string }
  | { type: 'SET_DECRYPTED_NOTE'; payload: { id: string; note: Note } }
  | { type: 'REMOVE_DECRYPTED_NOTE'; payload: string }
  | { type: 'SET_SELECTED_TAGS'; payload: string[] }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_CURRENT_NOTE'; payload: Note | null }
  | { type: 'CLEAR_STATE' }

const initialState: AppState = {
  user: null,
  notes: [],
  decryptedNotes: new Map(),
  loading: false,
  error: null,
  selectedTags: [],
  searchQuery: '',
  currentNote: null,
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'SET_USER':
      return { ...state, user: action.payload }
    case 'SET_NOTES':
      return { ...state, notes: action.payload }
    case 'ADD_NOTE':
      return { ...state, notes: [...(state.notes || []), action.payload] }
    case 'UPDATE_NOTE':
      return {
        ...state,
        notes: (state.notes || []).map(note =>
          note.id === action.payload.id ? action.payload : note
        ),
      }
    case 'DELETE_NOTE':
      return {
        ...state,
        notes: (state.notes || []).map(note =>
          note.id === action.payload ? { ...note, isDeleted: true } : note
        ),
      }
    case 'RESTORE_NOTE':
      return {
        ...state,
        notes: (state.notes || []).map(note =>
          note.id === action.payload ? { ...note, isDeleted: false } : note
        ),
      }
    case 'PERMANENTLY_DELETE_NOTE':
      return {
        ...state,
        notes: (state.notes || []).filter(note => note.id !== action.payload),
      }
    case 'SET_DECRYPTED_NOTE':
      const newDecryptedNotes = new Map(state.decryptedNotes)
      newDecryptedNotes.set(action.payload.id, action.payload.note)
      return { ...state, decryptedNotes: newDecryptedNotes }
    case 'REMOVE_DECRYPTED_NOTE':
      const updatedDecryptedNotes = new Map(state.decryptedNotes)
      updatedDecryptedNotes.delete(action.payload)
      return { ...state, decryptedNotes: updatedDecryptedNotes }
    case 'SET_SELECTED_TAGS':
      return { ...state, selectedTags: action.payload }
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload }
    case 'SET_CURRENT_NOTE':
      return { ...state, currentNote: action.payload }
    case 'CLEAR_STATE':
      return initialState
    default:
      return state
  }
}

const AppContext = createContext<{
  state: AppState
  dispatch: React.Dispatch<AppAction>
} | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser)
        dispatch({ type: 'SET_USER', payload: user })
        // Set the auth token for API requests
        if (user.token) {
          setAuthToken(user.token)
        }
      } catch (error) {
        console.error('Failed to parse saved user:', error)
        localStorage.removeItem('user')
      }
    }
  }, [])

  // Save user to localStorage when it changes
  useEffect(() => {
    if (state.user) {
      localStorage.setItem('user', JSON.stringify(state.user))
      // Update auth token when user changes
      if (state.user.token) {
        setAuthToken(state.user.token)
      }
    } else {
      localStorage.removeItem('user')
      setAuthToken(null)
    }
  }, [state.user])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
