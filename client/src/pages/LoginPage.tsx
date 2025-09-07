import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AccountLockoutWarning } from '@/components/AccountLockoutWarning'
import { authAPI } from '@/lib/api'
import { useApp } from '@/context/AppContext'
import { Eye, EyeOff, Lock, Mail, Shield, Key } from 'lucide-react'

export function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [requires2FA, setRequires2FA] = useState(false)
  const [requiresEmergencyVerification, setRequiresEmergencyVerification] = useState(false)
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [backupCode, setBackupCode] = useState('')
  const [accountLocked, setAccountLocked] = useState(false)
  const [lockoutTimeRemaining, setLockoutTimeRemaining] = useState(0)
  
  // Emergency verification fields
  const [username, setUsername] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  
  const { dispatch } = useApp()
  const navigate = useNavigate()

  const handleRetryAfterCooldown = () => {
    setAccountLocked(false)
    setLockoutTimeRemaining(0)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (requiresEmergencyVerification) {
      // Emergency verification step
      if (!identifier || !password || !username || !phoneNumber) {
        setError('Please fill in all verification fields')
        return
      }

      setLoading(true)
      setError('')

      try {
        const response = await authAPI.verifyEmergency(identifier, username, phoneNumber, password)
        
        // Check if user has 2FA enabled after emergency verification
        if (response.requires2FA) {
          setRequires2FA(true)
          setRequiresEmergencyVerification(false)
          setError('')
        } else {
          // Emergency verification successful, proceed with login
          const user = { 
            id: response.user?.id || 'user-id', 
            email: identifier,
            token: response.access,
            twoFactorEnabled: false
          }
          dispatch({ type: 'SET_USER', payload: user })
          navigate('/vault')
        }
      } catch (err: any) {
        setError(err.message || 'Emergency verification failed')
      } finally {
        setLoading(false)
      }
    } else if (!requires2FA) {
      // First step: identifier (username/email/phone) and password
      if (!identifier || !password) {
        setError('Please fill in all fields')
        return
      }

      setLoading(true)
      setError('')

      try {
        const response = await authAPI.login(identifier, password)
        
        // Check if user has 2FA enabled
        if (response.requires2FA) {
          setRequires2FA(true)
          setError('')
        } else {
          // No 2FA required, proceed with login
          const user = { 
            id: response.user?.id || 'user-id', 
            email: identifier, 
            token: response.access,
            twoFactorEnabled: false
          }
          dispatch({ type: 'SET_USER', payload: user })
          navigate('/vault')
        }
      } catch (err: any) {
        // Check if emergency verification is required
        if (err.status === 418 && err.response?.requiresEmergencyVerification) {
          setRequiresEmergencyVerification(true)
          setError('Unusual activity detected. Please verify your identity with additional information.')
        } else if (err.status === 423) {
          // Account is locked
          setAccountLocked(true)
          
          // Extract lockout time from error response
          const retryAfter = err.response?.retryAfter || 600 // Default to 10 minutes (600 seconds)
          setLockoutTimeRemaining(retryAfter)
          setError('') // Clear error as we'll show the lockout warning instead
        } else {
          setError(err.message || 'Login failed')
        }
      } finally {
        setLoading(false)
      }
    } else {
      // Second step: 2FA verification or backup code
      if (useBackupCode) {
        // Backup code login
        if (!backupCode || backupCode.trim().length === 0) {
          setError('Please enter a backup code')
          return
        }

        setLoading(true)
        setError('')

        try {
          const response = await authAPI.loginWithBackupCode(identifier, password, backupCode.trim())
          
          const user = { 
            id: response.user?.id || 'user-id', 
            email: identifier, 
            token: response.access,
            twoFactorEnabled: true
          }
          dispatch({ type: 'SET_USER', payload: user })
          
          // Show warning if few codes remain
          if (response.warningMessage) {
            setError(response.warningMessage)
            setTimeout(() => {
              navigate('/vault')
            }, 3000) // Navigate after 3 seconds to show warning
          } else {
            navigate('/vault')
          }
        } catch (err: any) {
          setError(err.message || 'Invalid backup code')
        } finally {
          setLoading(false)
        }
      } else {
        // Regular 2FA verification
        if (!twoFactorCode || twoFactorCode.length !== 6) {
          setError('Please enter the 6-digit verification code')
          return
        }

        setLoading(true)
        setError('')

        try {
          // Verify 2FA code
          const response = await authAPI.verify2FALogin(identifier, password, twoFactorCode)
          
          const user = { 
            id: response.user?.id || 'user-id', 
            email: identifier, 
            token: response.access,
            twoFactorEnabled: true
          }
          dispatch({ type: 'SET_USER', payload: user })
          navigate('/vault')
        } catch (err: any) {
          setError(err.message || 'Invalid verification code')
        } finally {
          setLoading(false)
        }
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            Sign in to your vault
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Secure notes, encrypted client-side
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {/* Account Lockout Warning */}
          <AccountLockoutWarning 
            lockoutTimeRemaining={lockoutTimeRemaining}
            onRetryAfterCooldown={handleRetryAfterCooldown}
          />

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {!requires2FA && !requiresEmergencyVerification ? (
              <>
                <div>
                  <Label htmlFor="identifier" className="sr-only">
                    Username, Email, or Phone
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <Input
                      id="identifier"
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="pl-10"
                      placeholder="Username, Email, or Phone"
                      required
                      autoComplete="username"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="password" className="sr-only">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      placeholder="Password"
                      required
                      autoComplete="current-password"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : useBackupCode ? (
              <div>
                <Label htmlFor="backupCode" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Backup Code
                </Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <Input
                    id="backupCode"
                    type="text"
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value.toUpperCase().replace(/[^A-F0-9-]/g, ''))}
                    className="pl-10 text-center"
                    placeholder="XXXX-XXXX"
                    maxLength={9}
                    required
                    disabled={loading}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Enter one of your 8-character backup codes
                </p>
              </div>
            ) : (
              <div>
                <Label htmlFor="twoFactorCode" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Two-Factor Authentication Code
                </Label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <Input
                    id="twoFactorCode"
                    type="text"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="pl-10 text-center text-lg tracking-widest"
                    placeholder="000000"
                    maxLength={6}
                    required
                    autoComplete="one-time-code"
                    disabled={loading}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
            )}
          </div>

          {/* Emergency Verification Section */}
          {requiresEmergencyVerification && (
            <div className="space-y-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Additional Verification Required
                </h3>
              </div>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                We detected unusual activity. Please verify your identity with the following information:
              </p>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="username" className="block text-sm font-medium text-gray-900 dark:text-white">
                    Username
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    required
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <Label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-900 dark:text-white">
                    Phone Number
                  </Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Enter your phone number"
                    required
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <Label htmlFor="emergencyIdentifier" className="block text-sm font-medium text-gray-900 dark:text-white">
                    Username, Email, or Phone
                  </Label>
                  <Input
                    id="emergencyIdentifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Confirm your username, email, or phone"
                    required
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <Label htmlFor="emergencyPassword" className="block text-sm font-medium text-gray-900 dark:text-white">
                    Password
                  </Label>
                  <Input
                    id="emergencyPassword"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Confirm your password"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || accountLocked}
            >
              {loading ? 'Verifying...' : requiresEmergencyVerification ? 'Verify Identity' : requires2FA ? 'Verify & Sign In' : 'Sign in'}
            </Button>
          </div>

          {requires2FA && (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setRequires2FA(false)
                  setTwoFactorCode('')
                  setBackupCode('')
                  setUseBackupCode(false)
                  setError('')
                }}
              >
                ← Back to login
              </Button>
              
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setUseBackupCode(!useBackupCode)
                    setTwoFactorCode('')
                    setBackupCode('')
                    setError('')
                  }}
                  className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                  {useBackupCode ? 'Use authenticator app instead' : 'Lost access? Use backup code'}
                </button>
              </div>
              
              <div className="text-center pt-2 border-t border-gray-200 dark:border-gray-600">
                <Link
                  to="/recovery"
                  className="text-sm text-red-600 hover:text-red-500 dark:text-red-400"
                >
                  Lost both phone and backup codes? Account recovery →
                </Link>
              </div>
            </div>
          )}

          {requiresEmergencyVerification && (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setRequiresEmergencyVerification(false)
                  setUsername('')
                  setPhoneNumber('')
                  setError('')
                }}
                disabled={loading}
              >
                ← Back to login
              </Button>
            </div>
          )}

          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                Sign up
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
