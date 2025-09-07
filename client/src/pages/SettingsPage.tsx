import { useState } from 'react'
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
  Smartphone
} from 'lucide-react'

export function SettingsPage() {
  const { state } = useApp()
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
      await authAPI.verify2FA(state.user.email, verificationCode)
      setTwoFactorEnabled(true)
      setQrCodeUrl('')
      setVerificationCode('')
      setSuccess('Two-factor authentication enabled successfully')
    } catch (err: any) {
      setError(err.message || 'Invalid verification code')
    } finally {
      setLoading(false)
    }
  }

  const handleDisable2FA = async () => {
    if (!state.user || !window.confirm('Are you sure you want to disable two-factor authentication?')) {
      return
    }

    setLoading(true)
    setError('')

    try {
      await authAPI.disable2FA(state.user.email)
      setTwoFactorEnabled(false)
      setSuccess('Two-factor authentication disabled')
    } catch (err: any) {
      setError(err.message || 'Failed to disable 2FA')
    } finally {
      setLoading(false)
    }
  }

  const handleExportData = async () => {
    try {
      // In a real app, this would export encrypted data
      const data = {
        notes: state.notes || [],
        exported_at: new Date().toISOString(),
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
      
      setSuccess('Data exported successfully')
    } catch (err: any) {
      setError('Failed to export data')
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
                      Two-Factor Authentication
                    </h3>
                    
                    {!twoFactorEnabled ? (
                      <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Add an extra layer of security to your account with two-factor authentication.
                        </p>
                        
                        {!qrCodeUrl ? (
                          <Button onClick={handleEnable2FA} disabled={loading} size="sm">
                            <Smartphone className="h-4 w-4 mr-2" />
                            Enable 2FA
                          </Button>
                        ) : (
                          <div className="space-y-4 max-w-md">
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                                Scan this QR code with your authenticator app:
                              </p>
                              <div className="bg-white p-4 rounded-lg inline-block">
                                <img 
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrCodeUrl)}`}
                                  alt="QR Code"
                                  className="w-24 h-24 sm:w-32 sm:h-32"
                                />
                              </div>
                            </div>
                            
                            <div>
                              <Label htmlFor="verification-code">Verification Code</Label>
                              <Input
                                id="verification-code"
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value)}
                                placeholder="Enter 6-digit code"
                                disabled={loading}
                              />
                            </div>
                            
                            <Button 
                              onClick={handleVerify2FA} 
                              disabled={loading || !verificationCode}
                              size="sm"
                            >
                              Verify and Enable
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center text-green-600 dark:text-green-400">
                          <Check className="h-5 w-5 mr-2" />
                          <span className="text-sm font-medium">Two-factor authentication is enabled</span>
                        </div>
                        
                        <Button variant="destructive" onClick={handleDisable2FA} disabled={loading} size="sm">
                          Disable 2FA
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
                      Download a backup of your encrypted notes and data.
                    </p>
                    <Button onClick={handleExportData} size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export All Data
                    </Button>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6 sm:pt-8">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Import Data
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Import notes from a backup file.
                    </p>
                    <Button variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Import Data
                    </Button>
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
