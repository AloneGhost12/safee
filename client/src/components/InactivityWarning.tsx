import React from 'react'
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react'
import { useApp } from '../context/AppContext'

interface InactivityWarningProps {
  onStayLoggedIn: () => void
}

export function InactivityWarning({ onStayLoggedIn }: InactivityWarningProps) {
  const { state } = useApp()

  if (!state.inactivityWarning || state.inactivityTimeRemaining <= 0) {
    return null
  }

  const minutes = Math.floor(state.inactivityTimeRemaining / 60)
  const seconds = state.inactivityTimeRemaining % 60

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center space-x-3 mb-4">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Session Timeout Warning
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You will be automatically logged out due to inactivity
            </p>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <Clock className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Time remaining:
            </span>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-mono font-bold text-red-600 dark:text-red-400">
              {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              minutes:seconds
            </div>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onStayLoggedIn}
            className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Stay Logged In
          </button>
          
          <button
            onClick={() => {
              // Let the timer expire naturally
            }}
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
          >
            Logout Now
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
          To prevent this warning, move your mouse or interact with the application
        </div>
      </div>
    </div>
  )
}
