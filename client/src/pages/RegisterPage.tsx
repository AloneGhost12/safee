import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmailOTPVerification } from '@/components/EmailOTPVerification'
import { DualPasswordForm } from '@/components/DualPasswordForm'
import { authAPI } from '@/lib/api'
import { useApp } from '@/context/AppContext'
import { Eye, EyeOff, Lock, Mail, UserPlus, User, Phone, Shield } from 'lucide-react'

export function RegisterPage() {
  const [step, setStep] = useState<'register' | 'verify-email'>('register')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  
  const { dispatch } = useApp()
  const navigate = useNavigate()

  // Password strength validation
  const getPasswordStrength = (pwd: string) => {
    const checks = {
      length: pwd.length >= 8,
      lowercase: /(?=.*[a-z])/.test(pwd),
      uppercase: /(?=.*[A-Z])/.test(pwd),
      number: /(?=.*\d)/.test(pwd)
    }
    return checks
  }

  const passwordChecks = getPasswordStrength(password)

  const validateForm = () => {
    if (!username || !email || !phoneNumber || !password || !confirmPassword) {
      return 'Please fill in all fields'
    }
    
    if (username.length < 3) {
      return 'Username must be at least 3 characters long'
    }
    
    if (password.length < 8) {
      return 'Password must be at least 8 characters long'
    }
    
    // Check password complexity requirements
    if (!/(?=.*[a-z])/.test(password)) {
      return 'Password must contain at least one lowercase letter'
    }
    
    if (!/(?=.*[A-Z])/.test(password)) {
      return 'Password must contain at least one uppercase letter'
    }
    
    if (!/(?=.*\d)/.test(password)) {
      return 'Password must contain at least one number'
    }
    
    if (password !== confirmPassword) {
      return 'Passwords do not match'
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Please enter a valid email address'
    }
    
    if (!/^\+?[\d\s\-\(\)]+$/.test(phoneNumber)) {
      return 'Please enter a valid phone number'
    }
    
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    // Move to email verification step
    setStep('verify-email')
    setError('')
    setSuccessMessage('Please verify your email address to complete registration')
  }

  const handleEmailVerified = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await authAPI.signup(username, email, phoneNumber, password)
      
      // Store user info with token
      const user = { 
        id: response.user?.id || 'user-id', 
        email, 
        username,
        token: response.access 
      }
      dispatch({ type: 'SET_USER', payload: user })
      
      navigate('/vault')
    } catch (err: any) {
      setError(err.message || 'Registration failed')
      // Go back to registration form if signup fails
      setStep('register')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailVerificationError = (error: string) => {
    setError(error)
  }

  const handleBackToRegister = () => {
    setStep('register')
    setError('')
    setSuccessMessage('')
  }

  if (step === 'verify-email') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
          <EmailOTPVerification
            email={email}
            purpose="registration"
            onVerified={handleEmailVerified}
            onError={handleEmailVerificationError}
            onBack={handleBackToRegister}
            title="Verify Your Email"
            description="We've sent a verification code to complete your registration"
            autoSend={true}
          />
          
          {successMessage && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-md text-sm">
              {successMessage}
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}
          
          {loading && (
            <div className="text-center">
              <div className="inline-flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Creating your account...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-green-600 rounded-full flex items-center justify-center">
            <UserPlus className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            Create your secure vault
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Email verification required for security
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  
  const { dispatch } = useApp()
  const navigate = useNavigate()

  // Password strength validation
  const getPasswordStrength = (pwd: string) => {
    const checks = {
      length: pwd.length >= 8,
      lowercase: /(?=.*[a-z])/.test(pwd),
      uppercase: /(?=.*[A-Z])/.test(pwd),
      number: /(?=.*\d)/.test(pwd)
    }
    return checks
  }

  const passwordChecks = getPasswordStrength(password)

  const validateForm = () => {
    if (!username || !email || !phoneNumber || !password || !confirmPassword) {
      return 'Please fill in all fields'
    }
    
    if (username.length < 3) {
      return 'Username must be at least 3 characters long'
    }
    
    if (password.length < 8) {
      return 'Password must be at least 8 characters long'
    }
    
    // Check password complexity requirements
    if (!/(?=.*[a-z])/.test(password)) {
      return 'Password must contain at least one lowercase letter'
    }
    
    if (!/(?=.*[A-Z])/.test(password)) {
      return 'Password must contain at least one uppercase letter'
    }
    
    if (!/(?=.*\d)/.test(password)) {
      return 'Password must contain at least one number'
    }
    
    if (password !== confirmPassword) {
      return 'Passwords do not match'
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Please enter a valid email address'
    }
    
    if (!/^\+?[\d\s\-\(\)]+$/.test(phoneNumber)) {
      return 'Please enter a valid phone number'
    }
    
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    // Move to email verification step
    setStep('verify-email')
    setError('')
    setSuccessMessage('Please verify your email address to complete registration')
  }

  const handleEmailVerified = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await authAPI.signup(username, email, phoneNumber, password)
      
      // Store user info with token
      const user = { 
        id: response.user?.id || 'user-id', 
        email, 
        username,
        token: response.access 
      }
      dispatch({ type: 'SET_USER', payload: user })
      
      navigate('/vault')
    } catch (err: any) {
      setError(err.message || 'Registration failed')
      // Go back to registration form if signup fails
      setStep('register')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailVerificationError = (error: string) => {
    setError(error)
  }

  const handleBackToRegister = () => {
    setStep('register')
    setError('')
    setSuccessMessage('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-green-600 rounded-full flex items-center justify-center">
            <UserPlus className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            Create your secure vault
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Enhanced security with username, email, and phone verification
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="username" className="sr-only">
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10"
                  placeholder="Username (min 3 characters)"
                  required
                  autoComplete="username"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email" className="sr-only">
                Email address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  placeholder="Email address"
                  required
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="phoneNumber" className="sr-only">
                Phone Number
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="pl-10"
                  placeholder="Phone number (+1234567890)"
                  required
                  autoComplete="tel"
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
                  placeholder="Password (min 8 characters)"
                  required
                  autoComplete="new-password"
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
              
              {/* Password Strength Indicator */}
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="text-xs space-y-1">
                    <div className={`flex items-center ${passwordChecks.length ? 'text-green-600' : 'text-gray-400'}`}>
                      <span className="mr-2">{passwordChecks.length ? '✓' : '○'}</span>
                      At least 8 characters
                    </div>
                    <div className={`flex items-center ${passwordChecks.lowercase ? 'text-green-600' : 'text-gray-400'}`}>
                      <span className="mr-2">{passwordChecks.lowercase ? '✓' : '○'}</span>
                      Lowercase letter
                    </div>
                    <div className={`flex items-center ${passwordChecks.uppercase ? 'text-green-600' : 'text-gray-400'}`}>
                      <span className="mr-2">{passwordChecks.uppercase ? '✓' : '○'}</span>
                      Uppercase letter
                    </div>
                    <div className={`flex items-center ${passwordChecks.number ? 'text-green-600' : 'text-gray-400'}`}>
                      <span className="mr-2">{passwordChecks.number ? '✓' : '○'}</span>
                      Number
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="sr-only">
                Confirm Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10"
                  placeholder="Confirm password"
                  required
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p className="mb-2 font-semibold">Security Requirements:</p>
            <p>• Username: Minimum 3 characters (used for emergency verification)</p>
            <p>• Phone: Required for account recovery and unusual activity alerts</p>
            <p>• Password: At least 8 characters with uppercase, lowercase, and number</p>
            <p>• All fields are required for enhanced security features</p>
          </div>

          <div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-medium text-green-600 hover:text-green-500 dark:text-green-400"
              >
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
