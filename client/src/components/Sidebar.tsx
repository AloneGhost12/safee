import { Button } from '@/components/ui/button'
import { useApp } from '@/context/AppContext'
import { useNavigate } from 'react-router-dom'
import { 
  Shield, 
  FileText, 
  FolderOpen,
  Trash2, 
  Settings, 
  LogOut,
  Menu,
  X,
  TestTube
} from 'lucide-react'

interface SidebarProps {
  open: boolean
  onToggle: () => void
  onLogout: () => void
}

export function Sidebar({ open, onToggle, onLogout }: SidebarProps) {
  const { state } = useApp()
  const navigate = useNavigate()

  const activeNotes = (state.notes || []).filter(note => !note.isDeleted).length
  const deletedNotes = (state.notes || []).filter(note => note.isDeleted).length

  return (
    <>
      {/* Mobile toggle button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 lg:hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md hover:bg-gray-50 dark:hover:bg-gray-700"
        aria-label={open ? 'Close menu' : 'Open menu'}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mr-2" />
              <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                Vault
              </span>
            </div>
            {/* Mobile close button inside sidebar */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="lg:hidden p-2"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 sm:p-4 space-y-1 sm:space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start text-sm sm:text-base h-10 sm:h-auto"
              onClick={() => navigate('/vault')}
            >
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 flex-shrink-0" />
              <span className="truncate">All Notes</span>
              <span className="ml-auto bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md text-xs flex-shrink-0">
                {activeNotes}
              </span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start text-sm sm:text-base h-10 sm:h-auto"
              onClick={() => navigate('/files')}
            >
              <FolderOpen className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 flex-shrink-0" />
              <span className="truncate">File Vault</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start text-sm sm:text-base h-10 sm:h-auto"
              onClick={() => navigate('/trash')}
            >
              <Trash2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 flex-shrink-0" />
              <span className="truncate">Trash</span>
              <span className="ml-auto bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md text-xs flex-shrink-0">
                {deletedNotes}
              </span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start text-sm sm:text-base h-10 sm:h-auto"
              onClick={() => navigate('/testing')}
            >
              <TestTube className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 flex-shrink-0" />
              <span className="truncate">Testing Dashboard</span>
            </Button>
          </nav>

          {/* Footer */}
          <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 space-y-1 sm:space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start text-sm sm:text-base h-10 sm:h-auto"
              onClick={() => navigate('/settings')}
            >
              <Settings className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 flex-shrink-0" />
              <span className="truncate">Settings</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm sm:text-base h-10 sm:h-auto"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 flex-shrink-0" />
              <span className="truncate">Sign Out</span>
            </Button>

            {/* User info */}
            {state.user && (
              <div className="pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate px-2">
                  {state.user.email}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 px-2">
                  🔐 Client-side encrypted
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}
    </>
  )
}
