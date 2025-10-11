import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmailOTPVerification } from '@/components/EmailOTPVerification'
import { authAPI } from '@/lib/api'
import { useApp } from '@/context/AppContext'
import { Eye, EyeOff, Lock, Mail, LogIn, User, Smartphone, Shield, ArrowRight } from 'lucide-react'

type AuthMethod = 'password' | '2fa' | 'email-otp'

export function LoginPageWithOTP() {
  const [step, setStep] = useState<'choose-method' | 'password' | '2fa' | 'email-otp' | 'verify-email'>('choose-method')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [tfaCode, setTfaCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userInfo, setUserInfo] = useState<any>(null)
  
  const { dispatch } = useApp()
  const navigate = useNavigate()

  const handleMethodSelect = (method: AuthMethod) => {
    setError('')
    
    if (method === 'email-otp') {
      setStep('email-otp')
    } else {
      setStep('password')
    }
  }

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await authAPI.login(identifier, password)
      
      if (response.requires2FA) {
        setUserInfo(response)
        setStep('2fa')
      } else {
        const user = { 
          id: response.user?.id || 'user-id', 
          email: response.user?.email || identifier,
          username: identifier,
          token: response.access 
        }
        dispatch({ type: 'SET_USER', payload: user })
        navigate('/vault')
      }
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailOTPRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      setError('Please enter your email address')
      return
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    setStep('verify-email')
    setError('')
  }

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await authAPI.verify2FA(userInfo.temp_token, tfaCode)
      
      const user = { 
        id: 'user-2fa-verified', 
        email: identifier,
        username: identifier,
        token: 'temp-2fa-token-' + Date.now()
      }
      dispatch({ type: 'SET_USER', payload: user })
      navigate('/vault')
    } catch (err: any) {
      setError(err.message || '2FA verification failed')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailVerified = async () => {
    setLoading(true)
    setError('')

    try {
      // In a real implementation, the server should authenticate the user
      // after successful email OTP verification
      const user = { 
        id: 'user-email-verified', 
        email,
        username: email.split('@')[0],
        token: 'email-otp-token-' + Date.now()
      }
      dispatch({ type: 'SET_USER', payload: user })
      navigate('/vault')
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailVerificationError = (error: string) => {
    setError(error)
  }

  const handleBackToMethods = () => {
    setStep('choose-method')
    setError('')
    setIdentifier('')
    setPassword('')
    setEmail('')
    setTfaCode('')
    setUserInfo(null)
  }

  const handleBackToPassword = () => {
    setStep('password')
    setError('')
    setTfaCode('')
  }

  const handleBackToEmailOTP = () => {
    setStep('email-otp')
    setError('')
  }

  // Method Selection Step
  if (step === 'choose-method') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
              Choose authentication method
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Select how you'd like to sign in to your vault
            </p>
          </div>

          <div className="space-y-4">
            <Button
              onClick={() => handleMethodSelect('password')}
              className="w-full h-16 flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-900 dark:text-blue-100 border border-blue-200 dark:border-blue-800"
              variant="outline"
            >
              <div className="flex items-center space-x-3">
                <Lock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <div className="text-left">
                  <p className="font-semibold">Password + 2FA</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">Traditional secure login</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5" />
            </Button>

            <Button
              onClick={() => handleMethodSelect('email-otp')}
              className="w-full h-16 flex items-center justify-between p-4 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-green-900 dark:text-green-100 border border-green-200 dark:border-green-800"
              variant="outline"
            >
              <div className="flex items-center space-x-3">
                <Mail className="h-6 w-6 text-green-600 dark:text-green-400" />
                <div className="text-left">
                  <p className="font-semibold">Email OTP</p>
                  <p className="text-xs text-green-700 dark:text-green-300">One-time password via email</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="text-xs text-amber-800 dark:text-amber-200">
                <p className="font-semibold mb-1">Security Features:</p>
                <p>Both methods provide enterprise-grade security with different convenience levels.</p>
              </div>
            </div>
          </div>

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
        </div>
      </div>
    )
  }

  // Email OTP Request Step
  if (step === 'email-otp') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-green-600 rounded-full flex items-center justify-center">
              <Mail className="h-8 w-8 text-white" />
            </div>
            <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
              Email OTP Login
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Enter your email to receive a verification code
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleEmailOTPRequest}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

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
                  placeholder="Enter your email address"
                  required
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Send Verification Code →'}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleBackToMethods}
                disabled={loading}
              >
                ← Back to Methods
              </Button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // Email Verification Step
  if (step === 'verify-email') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
          <EmailOTPVerification
            email={email}
            purpose="login"
            onVerified={handleEmailVerified}
            onError={handleEmailVerificationError}
            onBack={handleBackToEmailOTP}
            title="Verify Email Login"
            description="Enter the verification code sent to your email"
            autoSend={true}
          />
          
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}
          
          {loading && (
            <div className="text-center">
              <div className="inline-flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Signing you in...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Traditional Password Login Step
  if (step === 'password') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center">
              <LogIn className="h-8 w-8 text-white" />
            </div>
            <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
              Sign in to your vault
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Enter your credentials to continue
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handlePasswordAuth}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="identifier" className="sr-only">
                Username or Email
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="pl-10"
                  placeholder="Username or email"
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

            <div className="space-y-3">
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign in →'}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleBackToMethods}
                disabled={loading}
              >
                ← Back to Methods
              </Button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // 2FA Verification Step
  if (step === '2fa') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center">
              <Smartphone className="h-8 w-8 text-white" />
            </div>
            <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
              Two-factor authentication
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handle2FASubmit}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="tfaCode" className="sr-only">
                2FA Code
              </Label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  id="tfaCode"
                  type="text"
                  value={tfaCode}
                  onChange={(e) => setTfaCode(e.target.value)}
                  className="pl-10 text-center text-lg tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                  autoComplete="one-time-code"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Button
                type="submit"
                className="w-full"
                disabled={loading || tfaCode.length !== 6}
              >
                {loading ? 'Verifying...' : 'Verify & Sign in →'}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleBackToPassword}
                disabled={loading}
              >
                ← Back to Password
              </Button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return null
}
