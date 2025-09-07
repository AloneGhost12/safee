import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApp } from '@/context/AppContext'
import { authAPI } from '@/lib/api'
import { SharedLayout } from '@/components/SharedLayout'
import { 
  Settings, 
  Shield, 
  Key,
  Download,
  Upload,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
  Smartphone,
  X,
  HelpCircle
} from 'lucide-react'

export function SettingsPage() {
  const { state, dispatch } = useApp()
  const [activeTab, setActiveTab] = useState('security')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Security settings
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  
  // 2FA settings
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [backupCodesInfo, setBackupCodesInfo] = useState<{
    unusedCodesCount: number
    totalCodes: number
    generated?: string
  } | null>(null)
  
  // Security questions
  const [securityQuestions, setSecurityQuestions] = useState([
    { question: '', answer: '' },
    { question: '', answer: '' },
    { question: '', answer: '' }
  ])
  const [hasSecurityQuestions, setHasSecurityQuestions] = useState(false)

  // Load 2FA status when component mounts
  useEffect(() => {
    const load2FAStatus = async () => {
      if (!state.user) return
      
      try {
        // Use the 2FA status from user context first, then fall back to localStorage
        if (state.user.twoFactorEnabled !== undefined) {
          setTwoFactorEnabled(state.user.twoFactorEnabled)
        } else {
          const saved2FAStatus = localStorage.getItem(`2fa_enabled_${state.user.id}`)
          if (saved2FAStatus === 'true') {
            setTwoFactorEnabled(true)
            // Update user context with 2FA status
            dispatch({ 
              type: 'SET_USER', 
              payload: { ...state.user, twoFactorEnabled: true } 
            })
          }
        }
      } catch (error) {
        console.error('Failed to load 2FA status:', error)
      }
    }

    load2FAStatus()
  }, [state.user, dispatch])

  // Load backup codes info
  const loadBackupCodesInfo = async () => {
    if (!state.user || !twoFactorEnabled) return
    
    try {
      const info = await authAPI.getBackupCodesInfo()
      setBackupCodesInfo(info)
    } catch (error) {
      console.error('Failed to load backup codes info:', error)
    }
  }

  // Load backup codes info when 2FA is enabled
  useEffect(() => {
    if (twoFactorEnabled) {
      loadBackupCodesInfo()
    }
  }, [twoFactorEnabled, state.user])

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all password fields')
      return
    }
    
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }
    
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // In a real app, you'd call an API to change password
      // For now, just simulate success
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setSuccess('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setError(err.message || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  const handleEnable2FA = async () => {
    if (!state.user) return
    
    setLoading(true)
    setError('')

    try {
      const response = await authAPI.enable2FA(state.user.email)
      setQrCodeUrl(response.otpauth_url)
    } catch (err: any) {
      setError(err.message || 'Failed to enable 2FA')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify2FA = async () => {
    if (!state.user || !verificationCode) {
      setError('Please enter verification code')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await authAPI.verify2FA(state.user.email, verificationCode)
      setTwoFactorEnabled(true)
      
      // Save 2FA status to localStorage
      localStorage.setItem(`2fa_enabled_${state.user.id}`, 'true')
      
      // Update user context with 2FA status
      dispatch({ 
        type: 'SET_USER', 
        payload: { ...state.user, twoFactorEnabled: true } 
      })
      
      // Handle backup codes if returned
      if (response.backupCodes) {
        setBackupCodes(response.backupCodes)
        setShowBackupCodes(true)
      }
      
      setQrCodeUrl('')
      setVerificationCode('')
      setSuccess('Two-factor authentication enabled successfully! Save your backup codes in a secure location.')
      
      // Load backup codes info
      loadBackupCodesInfo()
    } catch (err: any) {
      setError(err.message || 'Invalid verification code')
    } finally {
      setLoading(false)
    }
  }

  const handleDisable2FA = async () => {
    if (!state.user || !window.confirm('Are you sure you want to disable two-factor authentication? This will make your account less secure.')) {
      return
    }

    setLoading(true)
    setError('')

    try {
      await authAPI.disable2FA(state.user.email)
      setTwoFactorEnabled(false)
      
      // Clear backup codes
      setBackupCodes([])
      setBackupCodesInfo(null)
      setShowBackupCodes(false)
      
      // Remove 2FA status from localStorage
      localStorage.removeItem(`2fa_enabled_${state.user.id}`)
      
      // Update user context with 2FA status
      dispatch({ 
        type: 'SET_USER', 
        payload: { ...state.user, twoFactorEnabled: false } 
      })
      
      setSuccess('Two-factor authentication disabled')
    } catch (err: any) {
      setError(err.message || 'Failed to disable 2FA')
    } finally {
      setLoading(false)
    }
  }

  const handleRegenerateBackupCodes = async () => {
    if (!state.user || !window.confirm('Are you sure you want to regenerate backup codes? This will invalidate all existing codes.')) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await authAPI.regenerateBackupCodes(state.user.email)
      setBackupCodes(response.backupCodes)
      setShowBackupCodes(true)
      setSuccess('New backup codes generated successfully! Save them in a secure location.')
      
      // Reload backup codes info
      loadBackupCodesInfo()
    } catch (err: any) {
      setError(err.message || 'Failed to regenerate backup codes')
    } finally {
      setLoading(false)
    }
  }

  const handleSetupSecurityQuestions = async () => {
    if (!state.user) return

    // Validate questions and answers
    const validQuestions = securityQuestions.filter(sq => 
      sq.question.trim().length >= 10 && sq.answer.trim().length >= 3
    )

    if (validQuestions.length !== 3) {
      setError('Please provide 3 complete security questions with answers (questions min 10 chars, answers min 3 chars)')
      return
    }

    setLoading(true)
    setError('')

    try {
      await authAPI.setupSecurityQuestions(state.user.email, validQuestions)
      setHasSecurityQuestions(true)
      setSuccess('Security questions saved successfully!')
      
      // Clear the form
      setSecurityQuestions([
        { question: '', answer: '' },
        { question: '', answer: '' },
        { question: '', answer: '' }
      ])
    } catch (err: any) {
      setError(err.message || 'Failed to save security questions')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadBackupCodes = () => {
    if (!backupCodes.length) return
    
    const codesText = `Personal Vault - Two-Factor Authentication Backup Codes
Generated: ${new Date().toLocaleDateString()}

IMPORTANT: 
- Keep these codes safe and secure
- Each code can only be used once
- Use these codes if you lose access to your authenticator app

Backup Codes:
${backupCodes.map((code, index) => `${index + 1}. ${code}`).join('\n')}

Store these codes in a secure location and do not share them with anyone.`

    const blob = new Blob([codesText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vault-backup-codes-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Check if user has security questions
  useEffect(() => {
    const checkSecurityQuestions = async () => {
      if (!state.user) return
      
      try {
        const response = await authAPI.getSecurityQuestions(state.user.email)
        setHasSecurityQuestions(response.questions.length > 0)
      } catch (error) {
        console.error('Failed to check security questions:', error)
      }
    }

    checkSecurityQuestions()
  }, [state.user])

  const handleExportData = async () => {
    try {
      setLoading(true)
      setError('')
      
      // Create comprehensive backup data
      const data = {
        version: '1.0',
        notes: state.notes || [],
        user: {
          email: state.user?.email,
          id: state.user?.id
        },
        metadata: {
          exported_at: new Date().toISOString(),
          total_notes: (state.notes || []).length,
          export_type: 'full_backup'
        }
      }
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vault-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      setSuccess(`Data exported successfully! Downloaded ${(state.notes || []).length} notes.`)
    } catch (err: any) {
      setError('Failed to export data: ' + (err.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const handleImportData = async () => {
    try {
      setError('')
      setSuccess('')
      
      // Create file input element
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return
        
        setLoading(true)
        
        try {
          const text = await file.text()
          const importedData = JSON.parse(text)
          
          // Validate imported data structure
          if (!importedData.notes || !Array.isArray(importedData.notes)) {
            throw new Error('Invalid backup file format')
          }
          
          // Import notes
          let importedCount = 0
          const existingNoteIds = new Set((state.notes || []).map(note => note.id))
          
          for (const note of importedData.notes) {
            // Skip notes that already exist
            if (!existingNoteIds.has(note.id)) {
              dispatch({ type: 'ADD_NOTE', payload: note })
              importedCount++
            }
          }
          
          if (importedCount === 0) {
            setSuccess('All notes from the backup already exist in your vault.')
          } else {
            setSuccess(`Successfully imported ${importedCount} notes from backup file.`)
          }
          
        } catch (parseError: any) {
          setError('Failed to import data: ' + (parseError.message || 'Invalid file format'))
        } finally {
          setLoading(false)
        }
      }
      
      input.click()
    } catch (err: any) {
      setError('Failed to import data: ' + (err.message || 'Unknown error'))
    }
  }

  const tabs = [
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'data', label: 'Data & Privacy', icon: Download },
    { id: 'account', label: 'Account', icon: Settings },
  ]

  return (
    <SharedLayout
      title="Settings"
      icon={<Settings className="h-5 w-5 sm:h-6 sm:w-6" />}
    >
      <div className="max-w-4xl mx-auto">
        {/* Messages */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-md flex items-center">
            <Check className="h-5 w-5 mr-2" />
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
          {/* Settings Sidebar */}
          <div className="lg:col-span-1">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'text-gray-900 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3" />
                    <span className="text-xs sm:text-sm">{tab.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
              {activeTab === 'security' && (
                <div className="space-y-6 sm:space-y-8">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Change Password
                    </h3>
                    <div className="space-y-4 max-w-md">
                      <div>
                        <Label htmlFor="current-password">Current Password</Label>
                        <div className="relative">
                          <Input
                            id="current-password"
                            type={showPasswords ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            disabled={loading}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords(!showPasswords)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                          >
                            {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="new-password">New Password</Label>
                        <Input
                          id="new-password"
                          type={showPasswords ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          disabled={loading}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="confirm-password">Confirm New Password</Label>
                        <Input
                          id="confirm-password"
                          type={showPasswords ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          disabled={loading}
                        />
                      </div>
                      
                      <Button onClick={handlePasswordChange} disabled={loading} size="sm">
                        <Key className="h-4 w-4 mr-2" />
                        {loading ? 'Changing...' : 'Change Password'}
                      </Button>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6 sm:pt-8">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Two-Factor Authentication (2FA)
                    </h3>
                    
                    {!twoFactorEnabled ? (
                      <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                            🔒 What is Two-Factor Authentication?
                          </h4>
                          <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
                            2FA adds an extra layer of security by requiring both your password and a 6-digit code from your phone to log in.
                          </p>
                          <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                            <p>• <strong>Step 1:</strong> Download an authenticator app (Google Authenticator, Microsoft Authenticator, etc.)</p>
                            <p>• <strong>Step 2:</strong> Scan the QR code that appears after clicking "Enable 2FA"</p>
                            <p>• <strong>Step 3:</strong> Enter the 6-digit code from your app to verify</p>
                          </div>
                          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                            <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-1">📱 Recommended Apps:</p>
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                              Google Authenticator • Microsoft Authenticator • Authy • 1Password
                            </p>
                          </div>
                        </div>
                        
                        {!qrCodeUrl ? (
                          <div className="space-y-3">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Ready to secure your account? Click below to get started.
                            </p>
                            <Button onClick={handleEnable2FA} disabled={loading} size="sm">
                              <Smartphone className="h-4 w-4 mr-2" />
                              {loading ? 'Setting up...' : 'Enable 2FA'}
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-4 max-w-md">
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                              <h4 className="font-medium text-green-900 dark:text-green-200 mb-2">
                                📱 Setup Instructions
                              </h4>
                              <ol className="text-sm text-green-800 dark:text-green-300 space-y-1 list-decimal list-inside">
                                <li>Open your authenticator app</li>
                                <li>Tap "Add account" or "Scan QR code"</li>
                                <li>Scan the QR code below with your phone</li>
                                <li>Enter the 6-digit code that appears</li>
                              </ol>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                                🔲 Scan this QR code with your authenticator app:
                              </p>
                              <div className="bg-white p-4 rounded-lg inline-block border">
                                <img 
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrCodeUrl)}`}
                                  alt="QR Code for 2FA Setup"
                                  className="w-32 h-32 sm:w-40 sm:h-40"
                                />
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                Can't scan? Most apps also allow manual entry of the secret key.
                              </p>
                            </div>
                            
                            <div>
                              <Label htmlFor="verification-code" className="text-sm font-medium">
                                🔢 Enter Verification Code
                              </Label>
                              <Input
                                id="verification-code"
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value)}
                                placeholder="Enter 6-digit code from your app"
                                disabled={loading}
                                maxLength={6}
                                className="text-center text-lg font-mono tracking-wider"
                              />
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                The code changes every 30 seconds
                              </p>
                            </div>
                            
                            <Button 
                              onClick={handleVerify2FA} 
                              disabled={loading || !verificationCode || verificationCode.length !== 6}
                              size="sm"
                              className="w-full"
                            >
                              {loading ? 'Verifying...' : 'Verify and Enable 2FA'}
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                          <div className="flex items-center text-green-600 dark:text-green-400 mb-2">
                            <Check className="h-5 w-5 mr-2" />
                            <span className="font-medium">Two-factor authentication is enabled</span>
                          </div>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            Your account is now protected with 2FA. You'll need both your password and your phone to log in.
                          </p>
                        </div>
                        
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                          <h4 className="font-medium text-yellow-900 dark:text-yellow-200 mb-2">
                            ⚠️ Important Security Notes
                          </h4>
                          <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1 list-disc list-inside">
                            <li>Keep your authenticator app backed up</li>
                            <li>Save your recovery codes in a safe place</li>
                            <li>Don't lose access to your phone</li>
                          </ul>
                        </div>

                        {/* Backup Codes Section */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-3 flex items-center">
                            <Key className="h-4 w-4 mr-2" />
                            Recovery Backup Codes
                          </h4>
                          
                          {backupCodesInfo && (
                            <div className="mb-3">
                              <p className="text-sm text-blue-800 dark:text-blue-300">
                                You have <strong>{backupCodesInfo.unusedCodesCount}</strong> unused backup codes out of {backupCodesInfo.totalCodes} total.
                              </p>
                              {backupCodesInfo.generated && (
                                <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                                  Generated: {new Date(backupCodesInfo.generated).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          )}

                          <div className="space-y-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={handleRegenerateBackupCodes}
                              disabled={loading}
                            >
                              <Key className="h-4 w-4 mr-2" />
                              {loading ? 'Generating...' : 'Generate New Codes'}
                            </Button>
                            
                            <p className="text-xs text-blue-700 dark:text-blue-400">
                              Use backup codes to sign in if you lose access to your authenticator app.
                            </p>
                          </div>
                        </div>

                        {/* Show backup codes when generated */}
                        {showBackupCodes && backupCodes.length > 0 && (
                          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                            <h4 className="font-medium text-red-900 dark:text-red-200 mb-3 flex items-center">
                              <AlertCircle className="h-4 w-4 mr-2" />
                              Your Backup Codes
                            </h4>
                            
                            <div className="bg-white dark:bg-gray-800 border rounded p-3 mb-3">
                              <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                                {backupCodes.map((code, index) => (
                                  <div key={index} className="text-gray-900 dark:text-gray-100">
                                    {index + 1}. {code}
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 mb-3">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleDownloadBackupCodes}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setShowBackupCodes(false)}
                              >
                                <X className="h-4 w-4 mr-2" />
                                Hide
                              </Button>
                            </div>
                            
                            <div className="text-xs text-red-700 dark:text-red-400 space-y-1">
                              <p>⚠️ <strong>Save these codes immediately!</strong></p>
                              <p>• Each code can only be used once</p>
                              <p>• Store them in a secure location separate from your phone</p>
                              <p>• Don't share these codes with anyone</p>
                            </div>
                          </div>
                        )}
                        
                        <Button variant="destructive" onClick={handleDisable2FA} disabled={loading} size="sm">
                          {loading ? 'Disabling...' : 'Disable 2FA'}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Security Questions Section */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-6">
                    <div className="flex items-center mb-4">
                      <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        Security Questions
                      </h3>
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Set up security questions as an additional recovery method if you lose access to your 2FA device and backup codes.
                    </p>

                    {hasSecurityQuestions ? (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex items-center text-green-600 dark:text-green-400 mb-2">
                          <Check className="h-5 w-5 mr-2" />
                          <span className="font-medium">Security questions are set up</span>
                        </div>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          You can use these questions for account recovery if you lose access to all other methods.
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-3"
                          onClick={() => {
                            setHasSecurityQuestions(false)
                            setSecurityQuestions([
                              { question: '', answer: '' },
                              { question: '', answer: '' },
                              { question: '', answer: '' }
                            ])
                          }}
                        >
                          Update Questions
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                            📋 Setup Instructions
                          </h4>
                          <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
                            <li>Create 3 unique security questions</li>
                            <li>Use questions only you know the answer to</li>
                            <li>Avoid easily guessable information</li>
                            <li>Remember your answers exactly</li>
                          </ul>
                        </div>

                        {securityQuestions.map((sq, index) => (
                          <div key={index} className="space-y-2">
                            <Label className="text-sm font-medium text-gray-900 dark:text-white">
                              Security Question {index + 1}
                            </Label>
                            <Input
                              type="text"
                              value={sq.question}
                              onChange={(e) => {
                                const newQuestions = [...securityQuestions]
                                newQuestions[index] = { ...newQuestions[index], question: e.target.value }
                                setSecurityQuestions(newQuestions)
                              }}
                              placeholder="e.g., What was the name of your first pet?"
                              className="mb-2"
                            />
                            <Input
                              type="text"
                              value={sq.answer}
                              onChange={(e) => {
                                const newQuestions = [...securityQuestions]
                                newQuestions[index] = { ...newQuestions[index], answer: e.target.value }
                                setSecurityQuestions(newQuestions)
                              }}
                              placeholder="Your answer (case-sensitive)"
                            />
                          </div>
                        ))}

                        <Button 
                          onClick={handleSetupSecurityQuestions}
                          disabled={loading || securityQuestions.some(sq => sq.question.length < 10 || sq.answer.length < 3)}
                          size="sm"
                        >
                          {loading ? 'Saving...' : 'Save Security Questions'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'data' && (
                <div className="space-y-6 sm:space-y-8">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Export Data
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Download a complete backup of your notes and data in JSON format.
                    </p>
                    <Button 
                      onClick={handleExportData} 
                      size="sm"
                      disabled={loading}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {loading ? 'Exporting...' : 'Export All Data'}
                    </Button>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6 sm:pt-8">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Import Data
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Import notes from a backup file. Only new notes will be imported (duplicates will be skipped).
                    </p>
                    <div className="space-y-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleImportData}
                        disabled={loading}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {loading ? 'Importing...' : 'Import Data'}
                      </Button>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Supported format: JSON backup files exported from this app
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6 sm:pt-8">
                    <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-4">
                      Danger Zone
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Permanently delete your account and all associated data.
                    </p>
                    <Button variant="destructive" size="sm">
                      Delete Account
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === 'account' && (
                <div className="space-y-6 sm:space-y-8">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Account Information
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <Label>Email</Label>
                        <p className="text-sm text-gray-900 dark:text-white font-mono break-all">
                          {state.user?.email}
                        </p>
                      </div>
                      
                      <div>
                        <Label>Account Created</Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date().toLocaleDateString()} (Demo)
                        </p>
                      </div>
                      
                      <div>
                        <Label>Total Notes</Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {(state.notes || []).length}
                        </p>
                      </div>
                      
                      <div>
                        <Label>Two-Factor Authentication</Label>
                        <div className="flex items-center space-x-2">
                          {twoFactorEnabled ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              <Check className="h-3 w-3 mr-1" />
                              Enabled
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                              <X className="h-3 w-3 mr-1" />
                              Disabled
                            </span>
                          )}
                          <button
                            onClick={() => setActiveTab('security')}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Manage
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </SharedLayout>
  )
}
