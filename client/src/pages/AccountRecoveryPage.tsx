import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authAPI } from '@/lib/api'
import { useApp } from '@/context/AppContext'
import { Mail, Shield, HelpCircle, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react'

type RecoveryStep = 'choose' | 'email' | 'verify-email' | 'security-questions' | 'verify-questions' | 'success'

export function AccountRecoveryPage() {
  const { dispatch } = useApp()
  const [currentStep, setCurrentStep] = useState<RecoveryStep>('choose')
  const [email, setEmail] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [securityQuestions, setSecurityQuestions] = useState<string[]>([])
  const [questionAnswers, setQuestionAnswers] = useState<string[]>(['', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [bypassToken, setBypassToken] = useState('')
  
  const navigate = useNavigate()

  const handleEmailRecovery = async () => {
    if (!email) {
      setError('Please enter your email address')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await authAPI.requestEmailRecovery(email)
      setSuccess(response.message)
      setCurrentStep('verify-email')
    } catch (err: any) {
      setError(err.message || 'Failed to send recovery email')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyEmailCode = async () => {
    if (!recoveryCode || recoveryCode.length !== 6) {
      setError('Please enter the 6-digit recovery code')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await authAPI.verifyEmailRecovery(email, recoveryCode)
      setBypassToken(response.bypassToken)
      setSuccess(response.message)
      setCurrentStep('success')
    } catch (err: any) {
      setError(err.message || 'Invalid recovery code')
    } finally {
      setLoading(false)
    }
  }

  const handleSecurityQuestions = async () => {
    if (!email) {
      setError('Please enter your email address')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await authAPI.getSecurityQuestions(email)
      if (response.questions.length === 0) {
        setError('No security questions found for this account. Try email recovery instead.')
        return
      }
      setSecurityQuestions(response.questions)
      setCurrentStep('verify-questions')
    } catch (err: any) {
      setError(err.message || 'Failed to load security questions')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyQuestions = async () => {
    if (questionAnswers.some(answer => !answer.trim())) {
      setError('Please answer all security questions')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await authAPI.verifySecurityQuestions(email, questionAnswers)
      setBypassToken(response.bypassToken)
      setSuccess(response.message)
      setCurrentStep('success')
    } catch (err: any) {
      setError(err.message || 'Incorrect answers')
    } finally {
      setLoading(false)
    }
  }

  const handleGoToSettings = () => {
    // Store bypass token in sessionStorage and set it as current auth token
    if (bypassToken) {
      sessionStorage.setItem('recovery_bypass_token', bypassToken)
      // Temporarily set the bypass token as the auth token
      const tempUser = {
        id: 'temp-recovery', // Temporary ID for recovery session
        email,
        token: bypassToken,
        twoFactorEnabled: false // This will be updated when we get to settings
      }
      // Update the app context with the bypass token
      dispatch({ type: 'SET_USER', payload: tempUser })
    }
    navigate('/settings?tab=security&recovery=true')
  }

  const handleGoToVault = () => {
    // Store bypass token and set it as current auth token
    if (bypassToken) {
      sessionStorage.setItem('recovery_bypass_token', bypassToken)
      // Temporarily set the bypass token as the auth token
      const tempUser = {
        id: 'temp-recovery', // Temporary ID for recovery session
        email,
        token: bypassToken,
        twoFactorEnabled: false
      }
      // Update the app context with the bypass token
      dispatch({ type: 'SET_USER', payload: tempUser })
    }
    navigate('/vault')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-orange-600 rounded-full flex items-center justify-center">
            <HelpCircle className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            Account Recovery
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Lost access to your authenticator and backup codes?
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md text-sm flex items-start">
            <AlertTriangle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-md text-sm flex items-start">
            <CheckCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
            {success}
          </div>
        )}

        {currentStep === 'choose' && (
          <div className="space-y-6">
            <div>
              <Label htmlFor="email" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Choose Recovery Method
              </h3>
              
              <Button
                onClick={handleEmailRecovery}
                disabled={loading || !email}
                className="w-full justify-start"
                variant="outline"
              >
                <Mail className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Email Recovery Code</div>
                  <div className="text-sm text-gray-500">Get a temporary code via email</div>
                </div>
              </Button>

              <Button
                onClick={handleSecurityQuestions}
                disabled={loading || !email}
                className="w-full justify-start"
                variant="outline"
              >
                <HelpCircle className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Security Questions</div>
                  <div className="text-sm text-gray-500">Answer your security questions</div>
                </div>
              </Button>
            </div>

            <div className="text-center">
              <Link
                to="/login"
                className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 flex items-center justify-center"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to login
              </Link>
            </div>
          </div>
        )}

        {currentStep === 'verify-email' && (
          <div className="space-y-6">
            <div className="text-center">
              <Mail className="mx-auto h-12 w-12 text-blue-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Check Your Email
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                We sent a 6-digit recovery code to <strong>{email}</strong>
              </p>
            </div>

            <div>
              <Label htmlFor="recoveryCode" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Recovery Code
              </Label>
              <Input
                id="recoveryCode"
                type="text"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-lg tracking-widest"
                placeholder="000000"
                maxLength={6}
                required
              />
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Code expires in 15 minutes
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleVerifyEmailCode}
                disabled={loading || recoveryCode.length !== 6}
                className="w-full"
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </Button>

              <Button
                onClick={() => setCurrentStep('choose')}
                variant="outline"
                className="w-full"
              >
                Try Different Method
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'verify-questions' && (
          <div className="space-y-6">
            <div className="text-center">
              <HelpCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Security Questions
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Please answer your security questions
              </p>
            </div>

            <div className="space-y-4">
              {securityQuestions.map((question, index) => (
                <div key={index}>
                  <Label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    {question}
                  </Label>
                  <Input
                    type="text"
                    value={questionAnswers[index]}
                    onChange={(e) => {
                      const newAnswers = [...questionAnswers]
                      newAnswers[index] = e.target.value
                      setQuestionAnswers(newAnswers)
                    }}
                    className="w-full"
                    placeholder="Your answer"
                    required
                  />
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleVerifyQuestions}
                disabled={loading || questionAnswers.some(answer => !answer.trim())}
                className="w-full"
              >
                {loading ? 'Verifying...' : 'Verify Answers'}
              </Button>

              <Button
                onClick={() => setCurrentStep('choose')}
                variant="outline"
                className="w-full"
              >
                Try Different Method
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'success' && (
          <div className="space-y-6 text-center">
            <div>
              <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                Recovery Successful!
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                You can now manage your 2FA settings or generate new backup codes.
              </p>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h4 className="font-medium text-yellow-900 dark:text-yellow-200 mb-2">
                ⚠️ Important Next Steps
              </h4>
              <div className="text-sm text-yellow-800 dark:text-yellow-300 space-y-2">
                <p className="font-medium">⏰ You have 10 minutes to complete these actions:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Generate new backup codes immediately</li>
                  <li>Set up your authenticator app again</li>
                  <li>Consider setting up security questions if you haven't</li>
                  <li>Store your backup codes securely</li>
                </ul>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleGoToSettings}
                className="w-full"
              >
                <Shield className="h-4 w-4 mr-2" />
                Go to Security Settings
              </Button>

              <Button
                onClick={handleGoToVault}
                variant="outline" 
                className="w-full"
              >
                Continue to Vault
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
