import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react'
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
  twoFactorEnabled?: boolean
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
  isInitialized: boolean
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
  | { type: 'SET_INITIALIZED'; payload: boolean }
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
  isInitialized: false,
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
    case 'SET_INITIALIZED':
      return { ...state, isInitialized: action.payload }
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
  const initializationRef = useRef(false)

  // Load user from localStorage on mount
  useEffect(() => {
    // Prevent multiple initialization attempts
    if (initializationRef.current) {
      console.log('⏭️ Skipping duplicate initialization attempt')
      return
    }
    
    initializationRef.current = true
    console.log('🔄 AppProvider initializing...')
    
    const initializeAuth = async () => {
      try {
        // Clear any stuck redirection flags
        sessionStorage.removeItem('redirecting-to-login')
        
        const savedUser = localStorage.getItem('user')
        if (savedUser) {
          console.log('👤 Found saved user in localStorage')
          try {
            const user = JSON.parse(savedUser)
            console.log('👤 Parsed user:', { id: user.id, email: user.email })
            
            // Validate the user object has required fields
            if (user.id && user.email && user.token) {
              dispatch({ type: 'SET_USER', payload: user })
              // Set the auth token for API requests
              setAuthToken(user.token)
              console.log('🔑 Auth token set')
            } else {
              console.warn('⚠️ Invalid user object in localStorage, clearing...')
              localStorage.removeItem('user')
              setAuthToken(null)
            }
          } catch (error) {
            console.error('❌ Failed to parse saved user:', error)
            localStorage.removeItem('user')
            setAuthToken(null)
          }
        } else {
          console.log('🚫 No saved user found')
          setAuthToken(null)
        }
      } catch (error) {
        console.error('❌ Error during auth initialization:', error)
        setAuthToken(null)
      } finally {
        dispatch({ type: 'SET_INITIALIZED', payload: true })
        console.log('✅ AppProvider initialized')
      }
    }

    initializeAuth()
  }, []) // Empty dependency array - only run once on mount

  // Save user to localStorage when it changes (but only after initialization)
  useEffect(() => {
    // Don't save during initialization or if we're in the middle of redirecting
    if (!state.isInitialized || sessionStorage.getItem('redirecting-to-login')) {
      return
    }
    
    if (state.user) {
      // Only save if user has all required fields
      if (state.user.id && state.user.email && state.user.token) {
        console.log('💾 Saving user to localStorage')
        localStorage.setItem('user', JSON.stringify(state.user))
        // Update auth token when user changes
        setAuthToken(state.user.token)
      } else {
        console.warn('⚠️ Attempting to save incomplete user object, skipping...')
      }
    } else {
      console.log('🗑️ Removing user from localStorage')
      localStorage.removeItem('user')
      setAuthToken(null)
    }
  }, [state.user, state.isInitialized])

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
