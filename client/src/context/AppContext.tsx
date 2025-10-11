import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react'
import { setAuthToken } from '../lib/api'
import { createInactivityDetector, stopGlobalInactivityDetector, InactivityDetector } from '../services/inactivityDetector'

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
  role: string
  permissions: string[]
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
  inactivityWarning: boolean
  inactivityTimeRemaining: number
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
  | { type: 'SET_INACTIVITY_WARNING'; payload: boolean }
  | { type: 'SET_INACTIVITY_TIME_REMAINING'; payload: number }
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
  inactivityWarning: false,
  inactivityTimeRemaining: 0,
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
    case 'SET_INACTIVITY_WARNING':
      return { ...state, inactivityWarning: action.payload }
    case 'SET_INACTIVITY_TIME_REMAINING':
      return { ...state, inactivityTimeRemaining: action.payload }
    case 'CLEAR_STATE':
      return { ...initialState, isInitialized: true }
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
  const isFirstMount = useRef(true)
  const lastInitializationTime = useRef<number>(0)
  const inactivityDetectorRef = useRef<InactivityDetector | null>(null)

  // Load user from localStorage on mount
  useEffect(() => {
    // Prevent rapid re-initialization (less than 1 second apart)
    const now = Date.now()
    if (now - lastInitializationTime.current < 1000) {
      console.log('⏭️ Skipping rapid re-initialization')
      return
    }
    
    // Prevent multiple initialization attempts
    if (initializationRef.current) {
      console.log('⏭️ Skipping duplicate initialization attempt')
      return
    }
    
    initializationRef.current = true
    lastInitializationTime.current = now
    console.log('🔄 AppProvider initializing...', { isFirstMount: isFirstMount.current })
    
    const initializeAuth = async () => {
      try {
        // Clear any stuck redirection flags on first mount only
        if (isFirstMount.current) {
          sessionStorage.removeItem('redirecting-to-login')
          isFirstMount.current = false
        }
        
        const savedUser = localStorage.getItem('user')
        if (savedUser) {
          console.log('👤 Found saved user in localStorage')
          try {
            const user = JSON.parse(savedUser)
            console.log('👤 Parsed user:', { id: user.id, email: user.email, hasToken: !!user.token })
            
            // Validate the user object has required fields
            if (user.id && user.email && user.token && user.role && user.permissions) {
              // Additional token validation - check if it looks like a JWT
              const tokenParts = user.token.split('.')
              if (tokenParts.length === 3) {
                dispatch({ type: 'SET_USER', payload: user })
                // Set the auth token for API requests
                setAuthToken(user.token)
                console.log('🔑 Auth token set and validated')
              } else {
                console.warn('⚠️ Invalid token format, clearing user data')
                localStorage.removeItem('user')
                setAuthToken(null)
              }
            } else {
              console.warn('⚠️ Invalid user object in localStorage, clearing...', {
                hasId: !!user.id,
                hasEmail: !!user.email,
                hasToken: !!user.token,
                hasRole: !!user.role,
                hasPermissions: !!user.permissions
              })
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
        // Add a small delay to prevent race conditions
        setTimeout(() => {
          dispatch({ type: 'SET_INITIALIZED', payload: true })
          console.log('✅ AppProvider initialized')
        }, 100)
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
      if (state.user.id && state.user.email && state.user.token && state.user.role && state.user.permissions) {
        console.log('💾 Saving user to localStorage')
        try {
          localStorage.setItem('user', JSON.stringify(state.user))
          // Update auth token when user changes
          setAuthToken(state.user.token)
        } catch (error) {
          console.error('❌ Failed to save user to localStorage:', error)
        }
      } else {
        console.warn('⚠️ Attempting to save incomplete user object, skipping...', {
          hasId: !!state.user.id,
          hasEmail: !!state.user.email,
          hasToken: !!state.user.token,
          hasRole: !!state.user.role,
          hasPermissions: !!state.user.permissions
        })
      }
    } else {
      console.log('🗑️ Removing user from localStorage')
      localStorage.removeItem('user')
      setAuthToken(null)
    }
  }, [state.user, state.isInitialized])

  // Reset initialization flag when unmounting (for development hot reload)
  useEffect(() => {
    return () => {
      initializationRef.current = false
    }
  }, [])

  // Handle auto-logout functionality
  const performAutoLogout = () => {
    console.log('🚪 Auto-logout triggered due to inactivity')
    dispatch({ type: 'SET_INACTIVITY_WARNING', payload: false })
    dispatch({ type: 'SET_INACTIVITY_TIME_REMAINING', payload: 0 })
    dispatch({ type: 'CLEAR_STATE' })
  }

  // Setup/teardown inactivity detection based on user login status
  useEffect(() => {
    if (!state.isInitialized) return

    if (state.user && state.user.token) {
      // User is logged in - start inactivity detection
      console.log('👤 User logged in - starting inactivity detection')
      
      // Stop any existing detector
      if (inactivityDetectorRef.current) {
        inactivityDetectorRef.current.stop()
      }

      // Create new inactivity detector
      inactivityDetectorRef.current = createInactivityDetector({
        timeoutMinutes: 10, // 10 minutes of inactivity
        onTimeout: performAutoLogout,
        onWarning: (remainingSeconds) => {
          console.log(`⚠️ Inactivity warning: ${remainingSeconds} seconds remaining`)
          dispatch({ type: 'SET_INACTIVITY_WARNING', payload: true })
          dispatch({ type: 'SET_INACTIVITY_TIME_REMAINING', payload: remainingSeconds })
          
          // Start countdown timer for the warning
          const countdownInterval = setInterval(() => {
            const remaining = inactivityDetectorRef.current?.getRemainingTime() || 0
            dispatch({ type: 'SET_INACTIVITY_TIME_REMAINING', payload: remaining })
            
            if (remaining <= 0) {
              clearInterval(countdownInterval)
            }
          }, 1000)
          
          // Clear countdown when warning time expires
          setTimeout(() => {
            clearInterval(countdownInterval)
          }, remainingSeconds * 1000)
        },
        warningBeforeTimeoutSeconds: 60 // Show warning 1 minute before logout
      })

      inactivityDetectorRef.current.start()
    } else {
      // User is logged out - stop inactivity detection
      console.log('🚫 User logged out - stopping inactivity detection')
      
      if (inactivityDetectorRef.current) {
        inactivityDetectorRef.current.stop()
        inactivityDetectorRef.current = null
      }
      
      // Clear inactivity warning state
      dispatch({ type: 'SET_INACTIVITY_WARNING', payload: false })
      dispatch({ type: 'SET_INACTIVITY_TIME_REMAINING', payload: 0 })
      
      // Also stop the global detector to be safe
      stopGlobalInactivityDetector()
    }

    // Cleanup on component unmount
    return () => {
      if (inactivityDetectorRef.current) {
        inactivityDetectorRef.current.stop()
        inactivityDetectorRef.current = null
      }
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
