import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { VaultPage } from './pages/VaultPage'
import { FilesPage } from './pages/FilesPage'
import { TrashPage } from './pages/TrashPage'
import { SettingsPage } from './pages/SettingsPage'
import { AccountRecoveryPage } from './pages/AccountRecoveryPage'
import TestingPage from './pages/TestingPage'
import './styles/tailwind.css'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { state } = useApp()
  
  // Show loading while app is initializing
  if (!state.isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }
  
  if (!state.user) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { state } = useApp()
  
  // Show loading while app is initializing
  if (!state.isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }
  
  if (state.user) {
    return <Navigate to="/vault" replace />
  }
  
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        } 
      />
      <Route 
        path="/register" 
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        } 
      />
      <Route 
        path="/recovery" 
        element={
          <PublicRoute>
            <AccountRecoveryPage />
          </PublicRoute>
        } 
      />
      
      {/* Protected routes */}
      <Route 
        path="/vault" 
        element={
          <ProtectedRoute>
            <VaultPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/files" 
        element={
          <ProtectedRoute>
            <FilesPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/trash" 
        element={
          <ProtectedRoute>
            <TrashPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/settings" 
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/testing" 
        element={
          <ProtectedRoute>
            <TestingPage />
          </ProtectedRoute>
        } 
      />
      
      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/vault" replace />} />
      <Route path="*" element={<Navigate to="/vault" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AppProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <AppRoutes />
        </div>
      </AppProvider>
    </Router>
  )
}

export default App
