import React, { useState, useEffect } from 'react'
import { Clock, Lock, AlertTriangle } from 'lucide-react'

interface AccountLockoutWarningProps {
  lockoutTimeRemaining?: number
  onRetryAfterCooldown?: () => void
}

export function AccountLockoutWarning({ lockoutTimeRemaining, onRetryAfterCooldown }: AccountLockoutWarningProps) {
  const [timeRemaining, setTimeRemaining] = useState(lockoutTimeRemaining || 0)

  useEffect(() => {
    if (lockoutTimeRemaining) {
      setTimeRemaining(lockoutTimeRemaining)
    }
  }, [lockoutTimeRemaining])

  useEffect(() => {
    if (timeRemaining <= 0) return

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = Math.max(0, prev - 1)
        if (newTime === 0 && onRetryAfterCooldown) {
          onRetryAfterCooldown()
        }
        return newTime
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timeRemaining, onRetryAfterCooldown])

  if (timeRemaining <= 0) {
    return null
  }

  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60

  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          <Lock className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
            Account Temporarily Locked
          </h3>
          <p className="text-sm text-red-700 dark:text-red-300 mb-3">
            Your account has been temporarily locked due to 5 consecutive failed login attempts. 
            You can try again after the cooldown period.
          </p>
          
          <div className="flex items-center space-x-2 mb-2">
            <Clock className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium text-red-700 dark:text-red-300">
              Time remaining:
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="text-2xl font-mono font-bold text-red-600 dark:text-red-400">
              {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
            </div>
            <span className="text-sm text-red-600 dark:text-red-400">
              minutes:seconds
            </span>
          </div>
        </div>
      </div>
      
      <div className="mt-4 flex items-start space-x-2">
        <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-red-600 dark:text-red-400">
          <p className="font-medium mb-1">Security Tips:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Make sure you're using the correct username/email and password</li>
            <li>Check if Caps Lock is enabled</li>
            <li>Try using your email address instead of username (or vice versa)</li>
            <li>If you continue having issues, consider using account recovery</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
