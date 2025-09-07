import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { authAPI } from '@/lib/api'
import { useApp } from '@/context/AppContext'

interface SharedLayoutProps {
  children: React.ReactNode
  title?: string
  icon?: React.ReactNode
  headerActions?: React.ReactNode
}

export function SharedLayout({ children, title, icon, headerActions }: SharedLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { state, dispatch } = useApp()
  const navigate = useNavigate()

  // Close sidebar on large screens by default, keep closed on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true)
      } else {
        setSidebarOpen(false)
      }
    }

    // Set initial state
    handleResize()

    // Listen for window resize
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex">
        {/* Sidebar */}
        <Sidebar 
          open={sidebarOpen}
          onToggle={handleSidebarToggle}
          onLogout={handleLogout}
        />

        {/* Main content */}
        <div className={`flex-1 transition-all duration-300 ${
          sidebarOpen ? 'lg:ml-64' : 'ml-0'
        }`}>
          {/* Header */}
          {title && (
            <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
              <div className="px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                      {icon && <span className="mr-2">{icon}</span>}
                      {title}
                    </h1>
                    {state.user && (
                      <span className="hidden sm:inline text-sm text-gray-500 dark:text-gray-400">
                        {state.user.email}
                      </span>
                    )}
                  </div>

                  {headerActions && (
                    <div className="flex items-center space-x-2 sm:space-x-4">
                      {headerActions}
                    </div>
                  )}
                </div>
              </div>
            </header>
          )}

          {/* Main content area */}
          <main className="p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
