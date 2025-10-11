import React from 'react'
import { UserRole } from '../types/permissions'

interface UserPermissions {
  canUpload: boolean
  canDownload: boolean
  canDelete: boolean
  canAccessSettings: boolean
  canCreateNotes: boolean
  canEditNotes: boolean
  canDeleteNotes: boolean
  canViewFiles: boolean
  canShare: boolean
}

interface RoleBasedComponentProps {
  children: React.ReactNode
  requiredPermission?: keyof UserPermissions
  userRole?: UserRole
  userPermissions?: UserPermissions
  fallback?: React.ReactNode
  showDisabled?: boolean // Show component but disabled
}

// Default permissions for roles
const ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  [UserRole.ADMIN]: {
    canUpload: true,
    canDownload: true,
    canDelete: true,
    canAccessSettings: true,
    canCreateNotes: true,
    canEditNotes: true,
    canDeleteNotes: true,
    canViewFiles: true,
    canShare: true
  },
  [UserRole.VIEWER]: {
    canUpload: false,
    canDownload: false,
    canDelete: false,
    canAccessSettings: false,
    canCreateNotes: true,
    canEditNotes: true,
    canDeleteNotes: false,
    canViewFiles: true,
    canShare: false
  }
}

export function RoleBasedComponent({ 
  children, 
  requiredPermission, 
  userRole = UserRole.ADMIN, 
  userPermissions,
  fallback = null,
  showDisabled = false
}: RoleBasedComponentProps) {
  // Use provided permissions or derive from role
  const permissions = userPermissions || ROLE_PERMISSIONS[userRole]
  
  // If no specific permission is required, show content
  if (!requiredPermission) {
    return <>{children}</>
  }
  
  // Check if user has the required permission
  const hasPermission = permissions[requiredPermission]
  
  if (!hasPermission) {
    if (showDisabled) {
      // Clone children and add disabled prop if possible
      return (
        <div className="opacity-50 pointer-events-none" title="Feature not available with current access level">
          {children}
        </div>
      )
    }
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

// Hook to get user permissions
export function useUserPermissions(userRole: UserRole = UserRole.ADMIN): UserPermissions {
  return ROLE_PERMISSIONS[userRole]
}

// Permission check function
export function hasPermission(
  permission: keyof UserPermissions, 
  userRole: UserRole = UserRole.ADMIN,
  userPermissions?: UserPermissions
): boolean {
  const permissions = userPermissions || ROLE_PERMISSIONS[userRole]
  return permissions[permission]
}

// Component for showing role badge
export function RoleBadge({ role }: { role: UserRole }) {
  const badgeStyles = {
    [UserRole.ADMIN]: 'bg-green-100 text-green-800 border-green-200',
    [UserRole.VIEWER]: 'bg-orange-100 text-orange-800 border-orange-200'
  }
  
  const roleLabels = {
    [UserRole.ADMIN]: 'Full Access',
    [UserRole.VIEWER]: 'View Only'
  }
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeStyles[role]}`}>
      {roleLabels[role]}
    </span>
  )
}

// Export types for use in other components
export { UserRole }
export type { UserPermissions }