import React, { useState, useEffect } from 'react'
import { 
  Users, 
  Shield, 
  Activity, 
  Database, 
  AlertTriangle, 
  Lock, 
  Unlock, 
  Eye, 
  BarChart3,
  Clock,
  UserCheck,
  UserX
} from 'lucide-react'

interface AdminStats {
  totalUsers: number
  activeUsers: number
  lockedUsers: number
  totalFiles: number
  activeSessions: number
  recentSignups: number
  timestamp: string
}

interface User {
  _id: string
  email: string
  username: string
  role?: string
  createdAt: string
  lastLoginAt?: string
  accountLocked?: boolean
  accountLockedReason?: string
  failedLoginAttempts?: number
}

interface SecurityEvent {
  userId: string
  email: string
  username: string
  event: {
    eventType: string
    timestamp: string
    ipAddress?: string
    details?: string
  }
}

interface ActiveSession {
  sessionId: string
  userId: string
  email: string
  username: string
  createdAt: string
  expiresAt: string
  ipAddress?: string
  userAgent?: string
  lastActivity?: string
}

interface SystemHealth {
  database: string
  uptime: number
  memory: {
    rss: number
    heapTotal: number
    heapUsed: number
    external: number
    arrayBuffers: number
  }
  timestamp: string
  nodeVersion: string
  environment: string
}

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([])
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([])
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Mock admin token - in real app this would come from auth context
  const adminToken = localStorage.getItem('admin_token') || ''

  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const response = await fetch(`/api/admin${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      throw new Error(`Admin API Error: ${response.status}`)
    }

    return response.json()
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const [statsData, usersData, eventsData, sessionsData, healthData] = await Promise.all([
        apiCall('/stats'),
        apiCall('/users?limit=10'),
        apiCall('/security/events?limit=20'),
        apiCall('/sessions').catch(() => ({ sessions: [] })), // Graceful fallback
        apiCall('/system/health').catch(() => null) // Graceful fallback
      ])

      setStats(statsData)
      setUsers(usersData.users || [])
      setSecurityEvents(eventsData.events || [])
      setActiveSessions(sessionsData.sessions || [])
      setSystemHealth(healthData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  const handleLockUser = async (userId: string, reason: string) => {
    try {
      await apiCall(`/users/${userId}/lock`, {
        method: 'POST',
        body: JSON.stringify({ reason, duration: 60 }) // 1 hour lock
      })
      await loadDashboardData() // Refresh data
    } catch (err) {
      setError('Failed to lock user account')
    }
  }

  const handleUnlockUser = async (userId: string) => {
    try {
      await apiCall(`/users/${userId}/unlock`, {
        method: 'POST'
      })
      await loadDashboardData() // Refresh data
    } catch (err) {
      setError('Failed to unlock user account')
    }
  }

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await apiCall(`/sessions/${sessionId}`, {
        method: 'DELETE'
      })
      await loadDashboardData() // Refresh data
    } catch (err) {
      setError('Failed to revoke session')
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days}d ${hours}h ${minutes}m`
  }

  const handleViewUserDetails = async (userId: string) => {
    try {
      const userDetails = await apiCall(`/users/${userId}`)
      setSelectedUser(userDetails)
      setShowUserModal(true)
    } catch (err) {
      setError('Failed to load user details')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 text-lg">{error}</p>
          <button 
            onClick={loadDashboardData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                Last updated: {stats?.timestamp && new Date(stats.timestamp).toLocaleTimeString()}
              </span>
              <button 
                onClick={loadDashboardData}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <Activity className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', name: 'Overview', icon: BarChart3 },
              { id: 'users', name: 'User Management', icon: Users },
              { id: 'security', name: 'Security Events', icon: Shield },
              { id: 'sessions', name: 'Active Sessions', icon: Clock },
              { id: 'system', name: 'System Health', icon: Database }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <tab.icon className="h-4 w-4 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
                        <dd className="text-lg font-medium text-gray-900">{stats.totalUsers}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <UserCheck className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Active Users (30d)</dt>
                        <dd className="text-lg font-medium text-gray-900">{stats.activeUsers}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <UserX className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Locked Accounts</dt>
                        <dd className="text-lg font-medium text-gray-900">{stats.lockedUsers}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Database className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Files</dt>
                        <dd className="text-lg font-medium text-gray-900">{stats.totalFiles}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Activity className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Active Sessions</dt>
                        <dd className="text-lg font-medium text-gray-900">{stats.activeSessions}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Users className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">New Users (7d)</dt>
                        <dd className="text-lg font-medium text-gray-900">{stats.recentSignups}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">User Management</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Manage user accounts, permissions, and security settings.
                </p>
              </div>
              <ul className="divide-y divide-gray-200">
                {users.map((user) => (
                  <li key={user._id} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            user.accountLocked ? 'bg-red-100' : 'bg-blue-100'
                          }`}>
                            {user.accountLocked ? (
                              <Lock className="h-5 w-5 text-red-600" />
                            ) : (
                              <Users className="h-5 w-5 text-blue-600" />
                            )}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900">{user.email}</div>
                            {user.role === 'admin' && (
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Admin
                              </span>
                            )}
                            {user.accountLocked && (
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Locked
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            @{user.username} • Created {new Date(user.createdAt).toLocaleDateString()}
                          </div>
                          {user.lastLoginAt && (
                            <div className="text-xs text-gray-400">
                              Last login: {new Date(user.lastLoginAt).toLocaleDateString()}
                            </div>
                          )}
                          {user.accountLockedReason && (
                            <div className="text-xs text-red-600">
                              Lock reason: {user.accountLockedReason}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {user.accountLocked ? (
                          <button
                            onClick={() => handleUnlockUser(user._id)}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                          >
                            <Unlock className="h-4 w-4 mr-1" />
                            Unlock
                          </button>
                        ) : (
                          <button
                            onClick={() => handleLockUser(user._id, 'Manual admin lock')}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                          >
                            <Lock className="h-4 w-4 mr-1" />
                            Lock
                          </button>
                        )}
                        <button 
                          onClick={() => handleViewUserDetails(user._id)}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Details
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Security Events Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Security Events</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Monitor authentication attempts, security violations, and system activities.
                </p>
              </div>
              <ul className="divide-y divide-gray-200">
                {securityEvents.map((event, index) => (
                  <li key={index} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                            event.event.eventType === 'login_failure' ? 'bg-red-100' :
                            event.event.eventType === 'login_success' ? 'bg-green-100' :
                            'bg-yellow-100'
                          }`}>
                            {event.event.eventType === 'login_failure' ? (
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                            ) : event.event.eventType === 'login_success' ? (
                              <UserCheck className="h-4 w-4 text-green-600" />
                            ) : (
                              <Shield className="h-4 w-4 text-yellow-600" />
                            )}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {event.event.eventType.replace('_', ' ').toUpperCase()}
                          </div>
                          <div className="text-sm text-gray-500">
                            {event.email} • {event.event.ipAddress}
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(event.event.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      {event.event.details && (
                        <div className="text-xs text-gray-500 max-w-xs">
                          {event.event.details}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Active Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Active Sessions</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Monitor and manage active user sessions across the platform.
                </p>
              </div>
              <ul className="divide-y divide-gray-200">
                {activeSessions.map((session) => (
                  <li key={session.sessionId} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                            <Activity className="h-5 w-5 text-green-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900">{session.email}</div>
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            @{session.username} • IP: {session.ipAddress || 'Unknown'}
                          </div>
                          <div className="text-xs text-gray-400">
                            Created: {new Date(session.createdAt).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-400">
                            Expires: {new Date(session.expiresAt).toLocaleString()}
                          </div>
                          {session.userAgent && (
                            <div className="text-xs text-gray-400 truncate max-w-md">
                              {session.userAgent}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleRevokeSession(session.sessionId)}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                        >
                          <UserX className="h-4 w-4 mr-1" />
                          Revoke
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
                {activeSessions.length === 0 && (
                  <li className="px-4 py-8 text-center">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No active sessions found</p>
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* System Health Tab */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            {systemHealth ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">System Status</h3>
                    <dl className="space-y-3">
                      <div className="flex justify-between">
                        <dt className="text-sm font-medium text-gray-500">Database</dt>
                        <dd className={`text-sm ${
                          systemHealth.database === 'healthy' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          <div className="flex items-center">
                            {systemHealth.database === 'healthy' ? (
                              <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                            ) : (
                              <div className="w-2 h-2 bg-red-400 rounded-full mr-2"></div>
                            )}
                            {systemHealth.database}
                          </div>
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm font-medium text-gray-500">Uptime</dt>
                        <dd className="text-sm text-gray-900">{formatUptime(systemHealth.uptime)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm font-medium text-gray-500">Node.js Version</dt>
                        <dd className="text-sm text-gray-900">{systemHealth.nodeVersion}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm font-medium text-gray-500">Environment</dt>
                        <dd className="text-sm text-gray-900 capitalize">{systemHealth.environment}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm font-medium text-gray-500">Last Check</dt>
                        <dd className="text-sm text-gray-900">
                          {new Date(systemHealth.timestamp).toLocaleString()}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Memory Usage</h3>
                    <dl className="space-y-3">
                      <div className="flex justify-between">
                        <dt className="text-sm font-medium text-gray-500">RSS</dt>
                        <dd className="text-sm text-gray-900">{formatBytes(systemHealth.memory.rss)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm font-medium text-gray-500">Heap Total</dt>
                        <dd className="text-sm text-gray-900">{formatBytes(systemHealth.memory.heapTotal)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm font-medium text-gray-500">Heap Used</dt>
                        <dd className="text-sm text-gray-900">{formatBytes(systemHealth.memory.heapUsed)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm font-medium text-gray-500">External</dt>
                        <dd className="text-sm text-gray-900">{formatBytes(systemHealth.memory.external)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm font-medium text-gray-500">Array Buffers</dt>
                        <dd className="text-sm text-gray-900">{formatBytes(systemHealth.memory.arrayBuffers)}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6 text-center">
                  <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">System health data unavailable</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Check admin permissions or server connectivity
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">User Details</h3>
                <button
                  onClick={() => setShowUserModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedUser.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Username</label>
                    <p className="mt-1 text-sm text-gray-900">@{selectedUser.username}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedUser.role || 'User'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Account Status</label>
                    <p className={`mt-1 text-sm ${selectedUser.accountLocked ? 'text-red-600' : 'text-green-600'}`}>
                      {selectedUser.accountLocked ? 'Locked' : 'Active'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Created</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {new Date(selectedUser.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Login</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedUser.lastLoginAt 
                        ? new Date(selectedUser.lastLoginAt).toLocaleString()
                        : 'Never'
                      }
                    </p>
                  </div>
                  {selectedUser.failedLoginAttempts !== undefined && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Failed Login Attempts</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedUser.failedLoginAttempts}</p>
                    </div>
                  )}
                  {selectedUser.accountLockedReason && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Lock Reason</label>
                      <p className="mt-1 text-sm text-red-600">{selectedUser.accountLockedReason}</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Close
                </button>
                {selectedUser.accountLocked ? (
                  <button
                    onClick={() => {
                      handleUnlockUser(selectedUser._id)
                      setShowUserModal(false)
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
                  >
                    Unlock Account
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleLockUser(selectedUser._id, 'Manual admin lock')
                      setShowUserModal(false)
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
                  >
                    Lock Account
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard
