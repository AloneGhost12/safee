import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface AdminUser {
  id: string
  email: string
  role: 'admin' | 'super_admin'
  permissions: string[]
}

interface AdminContextType {
  adminUser: AdminUser | null
  adminToken: string | null
  isAdmin: boolean
  isSuperAdmin: boolean
  hasPermission: (permission: string) => boolean
  loginAdmin: (token: string, user: AdminUser) => void
  logoutAdmin: () => void
  loading: boolean
}

const AdminContext = createContext<AdminContextType | undefined>(undefined)

export const useAdmin = () => {
  const context = useContext(AdminContext)
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider')
  }
  return context
}

interface AdminProviderProps {
  children: ReactNode
}

export const AdminProvider: React.FC<AdminProviderProps> = ({ children }) => {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [adminToken, setAdminToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing admin session on mount
    const token = localStorage.getItem('admin_token')
    const userStr = localStorage.getItem('admin_user')
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr)
        setAdminToken(token)
        setAdminUser(user)
        
        // Validate token with server
        validateAdminToken(token)
      } catch (error) {
        console.error('Invalid admin session data:', error)
        logoutAdmin()
      }
    }
    
    setLoading(false)
  }, [])

  const validateAdminToken = async (token: string) => {
    try {
      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Invalid admin token')
      }
    } catch (error) {
      console.error('Admin token validation failed:', error)
      logoutAdmin()
    }
  }

  const loginAdmin = (token: string, user: AdminUser) => {
    setAdminToken(token)
    setAdminUser(user)
    localStorage.setItem('admin_token', token)
    localStorage.setItem('admin_user', JSON.stringify(user))
  }

  const logoutAdmin = () => {
    setAdminToken(null)
    setAdminUser(null)
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
  }

  const hasPermission = (permission: string): boolean => {
    if (!adminUser) return false
    if (adminUser.role === 'super_admin') return true
    return adminUser.permissions.includes(permission)
  }

  const value: AdminContextType = {
    adminUser,
    adminToken,
    isAdmin: !!adminUser,
    isSuperAdmin: adminUser?.role === 'super_admin',
    hasPermission,
    loginAdmin,
    logoutAdmin,
    loading
  }

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  )
}

interface RequireAdminProps {
  children: ReactNode
  permission?: string
  fallback?: ReactNode
}

export const RequireAdmin: React.FC<RequireAdminProps> = ({ 
  children, 
  permission, 
  fallback 
}) => {
  const { isAdmin, hasPermission, loading } = useAdmin()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isAdmin) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-6">You need admin privileges to access this page.</p>
          <button 
            onClick={() => window.location.href = '/admin/login'}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Admin Login
          </button>
        </div>
      </div>
    )
  }

  if (permission && !hasPermission(permission)) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Insufficient Permissions</h2>
          <p className="text-gray-600">You don't have permission to access this resource.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
