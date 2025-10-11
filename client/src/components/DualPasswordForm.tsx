import React, { useState } from 'react'
import { Eye, EyeOff, Info, Shield, User, Lock } from 'lucide-react'

interface DualPasswordFormProps {
  onPasswordChange: (mainPassword: string, viewPassword: string) => void
  mainPassword: string
  viewPassword: string
}

export function DualPasswordForm({ onPasswordChange, mainPassword, viewPassword }: DualPasswordFormProps) {
  const [showMainPassword, setShowMainPassword] = useState(false)
  const [showViewPassword, setShowViewPassword] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  const handleMainPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onPasswordChange(e.target.value, viewPassword)
  }

  const handleViewPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onPasswordChange(mainPassword, e.target.value)
  }

  return (
    <div className="space-y-6">
      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">Dual Password Security</h3>
            <p className="text-sm text-blue-700 mt-1">
              Create two passwords for different access levels: one for full access and one for view-only access.
            </p>
            <button
              type="button"
              onClick={() => setShowInfo(!showInfo)}
              className="text-blue-600 text-xs underline mt-2 flex items-center"
            >
              <Info className="h-3 w-3 mr-1" />
              {showInfo ? 'Hide details' : 'Learn more'}
            </button>
          </div>
        </div>
        
        {showInfo && (
          <div className="mt-4 pl-8 space-y-3 text-sm text-blue-700">
            <div className="flex items-start space-x-2">
              <User className="h-4 w-4 text-green-600 mt-0.5" />
              <div>
                <strong>Main Password (Admin Access):</strong>
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li>Upload and download files</li>
                  <li>Create, edit, and delete notes</li>
                  <li>Access all settings</li>
                  <li>Full account control</li>
                </ul>
              </div>
            </div>
            
            <div className="flex items-start space-x-2">
              <Eye className="h-4 w-4 text-orange-600 mt-0.5" />
              <div>
                <strong>View Password (Limited Access):</strong>
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li>View files only (no download)</li>
                  <li>Create and edit notes only</li>
                  <li>No access to settings</li>
                  <li>Cannot upload or delete content</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mt-3">
              <p className="text-xs text-yellow-800">
                💡 <strong>Use case:</strong> Share the view password with others to let them see your content 
                without giving them full access to your account.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Password */}
      <div>
        <label htmlFor="mainPassword" className="block text-sm font-medium text-gray-700 mb-2">
          <User className="h-4 w-4 inline mr-2" />
          Main Password (Full Access)
        </label>
        <div className="relative">
          <input
            id="mainPassword"
            type={showMainPassword ? 'text' : 'password'}
            value={mainPassword}
            onChange={handleMainPasswordChange}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 pr-10"
            placeholder="Enter your main password"
            required
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            onClick={() => setShowMainPassword(!showMainPassword)}
          >
            {showMainPassword ? (
              <EyeOff className="h-4 w-4 text-gray-400" />
            ) : (
              <Eye className="h-4 w-4 text-gray-400" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          This password gives you complete control over your account
        </p>
      </div>

      {/* View Password */}
      <div>
        <label htmlFor="viewPassword" className="block text-sm font-medium text-gray-700 mb-2">
          <Eye className="h-4 w-4 inline mr-2" />
          View Password (Optional - View Only Access)
        </label>
        <div className="relative">
          <input
            id="viewPassword"
            type={showViewPassword ? 'text' : 'password'}
            value={viewPassword}
            onChange={handleViewPasswordChange}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-orange-500 focus:border-orange-500 pr-10"
            placeholder="Enter view-only password (optional)"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            onClick={() => setShowViewPassword(!showViewPassword)}
          >
            {showViewPassword ? (
              <EyeOff className="h-4 w-4 text-gray-400" />
            ) : (
              <Eye className="h-4 w-4 text-gray-400" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Share this password for limited access to your content
        </p>
      </div>

      {/* Password Strength Indicators */}
      {mainPassword && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Lock className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">Password Strength:</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-medium">Main Password:</span>
              <div className={`mt-1 h-2 rounded ${mainPassword.length >= 8 ? 'bg-green-200' : 'bg-red-200'}`}>
                <div 
                  className={`h-full rounded transition-all ${
                    mainPassword.length >= 12 ? 'bg-green-500 w-full' :
                    mainPassword.length >= 8 ? 'bg-yellow-500 w-3/4' :
                    mainPassword.length >= 6 ? 'bg-orange-500 w-1/2' :
                    'bg-red-500 w-1/4'
                  }`}
                />
              </div>
            </div>
            {viewPassword && (
              <div>
                <span className="font-medium">View Password:</span>
                <div className={`mt-1 h-2 rounded ${viewPassword.length >= 6 ? 'bg-green-200' : 'bg-red-200'}`}>
                  <div 
                    className={`h-full rounded transition-all ${
                      viewPassword.length >= 10 ? 'bg-green-500 w-full' :
                      viewPassword.length >= 6 ? 'bg-yellow-500 w-3/4' :
                      viewPassword.length >= 4 ? 'bg-orange-500 w-1/2' :
                      'bg-red-500 w-1/4'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}