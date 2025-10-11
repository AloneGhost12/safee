// User roles and permissions (client-side)
export enum UserRole {
  ADMIN = 'admin',
  VIEWER = 'viewer'
}

export interface UserPermissions {
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

export const ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
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
    canCreateNotes: true,    // Only notes creation allowed
    canEditNotes: true,      // Can edit their own notes
    canDeleteNotes: false,   // Cannot delete notes
    canViewFiles: true,      // Can view files but not download
    canShare: false          // Cannot share files
  }
}

export function getUserPermissions(role: UserRole): UserPermissions {
  return ROLE_PERMISSIONS[role]
}

export function hasPermission(role: UserRole, permission: keyof UserPermissions): boolean {
  return ROLE_PERMISSIONS[role][permission]
}

// User type for client-side
export interface User {
  id: string
  email: string
  username: string
  role: UserRole
  permissions: UserPermissions
}