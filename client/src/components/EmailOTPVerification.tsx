import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { emailOTPAPI } from '@/lib/api'
import { Mail, Clock, RefreshCw, Shield, CheckCircle, AlertCircle } from 'lucide-react'

interface EmailOTPVerificationProps {
  email: string
  purpose?: string
  onVerified: (sessionId?: string) => void
  onError: (error: string) => void
  onBack?: () => void
  title?: string
  description?: string
  autoSend?: boolean
}

export function EmailOTPVerification({
  email,
  purpose = 'email_verification',
  onVerified,
  onError,
  onBack,
  title = 'Email Verification Required',
  description = 'Please enter the verification code sent to your email',
  autoSend = true
}: EmailOTPVerificationProps) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [timeLeft, setTimeLeft] = useState(0)
  const [canResend, setCanResend] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [maxAttempts, setMaxAttempts] = useState(5)
  const [config, setConfig] = useState<{
    expirationMinutes: number
    maxAttempts: number
    resendDelaySeconds: number
    dailyLimit: number
  } | null>(null)

  // Load OTP configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const configData = await emailOTPAPI.getConfig()
        setConfig(configData)
        setMaxAttempts(configData.maxAttempts)
      } catch (error) {
        console.error('Failed to load OTP config:', error)
      }
    }
    loadConfig()
  }, [])

  // Auto-send OTP on mount if enabled
  useEffect(() => {
    if (autoSend && email) {
      sendOTP()
    }
  }, [email, autoSend])

  // Countdown timer for resend
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0 && !canResend) {
      setCanResend(true)
    }
  }, [timeLeft, canResend])

  const sendOTP = async () => {
    if (!email) {
      setError('Email address is required')
      return
    }

    setSending(true)
    setError('')
    setSuccess('')

    try {
      const response = await emailOTPAPI.sendOTP(email, purpose)
      setSuccess(`Verification code sent to ${email}`)
      setTimeLeft(response.canResendAfter || 60)
      setCanResend(false)
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to send verification code'
      setError(errorMessage)
      onError(errorMessage)
    } finally {
      setSending(false)
    }
  }

  const verifyOTP = async () => {
    if (!code || code.length !== 6) {
      setError('Please enter the 6-digit verification code')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await emailOTPAPI.verifyOTP(email, code, purpose)
      setSuccess('Email verified successfully!')
      
      // Call onVerified after a brief delay to show success message
      setTimeout(() => {
        onVerified(response.sessionId)
      }, 1000)
      
    } catch (error: any) {
      const errorMessage = error.message || 'Invalid verification code'
      setError(errorMessage)
      setAttempts(prev => prev + 1)
      
      // Clear the code input on error
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!canResend) return

    setSending(true)
    setError('')
    setSuccess('')

    try {
      const response = await emailOTPAPI.resendOTP(email, purpose)
      setSuccess('New verification code sent!')
      setTimeLeft(response.canResendAfter || 60)
      setCanResend(false)
      setCode('') // Clear existing code
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to resend verification code'
      setError(errorMessage)
    } finally {
      setSending(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const isMaxAttemptsReached = attempts >= maxAttempts

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
          <Mail className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {title}
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {description}
        </p>
      </div>

      {/* Email Display */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Verification code sent to:
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300 font-mono">
              {email}
            </p>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
          </div>
        </div>
      )}

      {/* OTP Input */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="otpCode" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Verification Code
          </Label>
          <div className="relative">
            <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              id="otpCode"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="pl-10 text-center text-lg tracking-widest"
              placeholder="000000"
              maxLength={6}
              disabled={loading || sending || isMaxAttemptsReached}
              autoComplete="one-time-code"
            />
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Enter the 6-digit code from your email
          </p>
        </div>

        {/* Attempts Warning */}
        {attempts > 0 && !isMaxAttemptsReached && (
          <div className="text-sm text-yellow-600 dark:text-yellow-400 text-center">
            {attempts === 1 ? '1 incorrect attempt' : `${attempts} incorrect attempts`}
            {maxAttempts - attempts > 0 && ` • ${maxAttempts - attempts} attempts remaining`}
          </div>
        )}

        {isMaxAttemptsReached && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  Maximum attempts reached
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  Please request a new verification code
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          onClick={verifyOTP}
          className="w-full"
          disabled={loading || sending || code.length !== 6 || isMaxAttemptsReached}
        >
          {loading ? 'Verifying...' : 'Verify Code'}
        </Button>

        {/* Resend Button */}
        <div className="flex items-center justify-center space-x-4">
          {timeLeft > 0 && !canResend ? (
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <Clock className="h-4 w-4" />
              <span>Resend in {formatTime(timeLeft)}</span>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResend}
              disabled={sending || !canResend}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`h-4 w-4 ${sending ? 'animate-spin' : ''}`} />
              <span>{sending ? 'Sending...' : 'Resend Code'}</span>
            </Button>
          )}
        </div>

        {/* Back Button */}
        {onBack && (
          <Button
            variant="ghost"
            onClick={onBack}
            className="w-full"
            disabled={loading || sending}
          >
            ← Back
          </Button>
        )}
      </div>

      {/* Configuration Info */}
      {config && (
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center space-y-1">
          <p>Code expires in {config.expirationMinutes} minutes</p>
          <p>Maximum {config.maxAttempts} attempts allowed</p>
          {config.dailyLimit && <p>Daily limit: {config.dailyLimit} requests</p>}
        </div>
      )}
    </div>
  )
}
