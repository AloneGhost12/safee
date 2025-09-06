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
        className="fixed top-4 left-4 z-50 lg:hidden"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-blue-600 mr-2" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                Vault
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => navigate('/vault')}
            >
              <FileText className="h-5 w-5 mr-3" />
              All Notes
              <span className="ml-auto bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md text-xs">
                {activeNotes}
              </span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => navigate('/files')}
            >
              <FolderOpen className="h-5 w-5 mr-3" />
              File Vault
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => navigate('/trash')}
            >
              <Trash2 className="h-5 w-5 mr-3" />
              Trash
              <span className="ml-auto bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md text-xs">
                {deletedNotes}
              </span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => navigate('/testing')}
            >
              <TestTube className="h-5 w-5 mr-3" />
              Testing Dashboard
            </Button>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => navigate('/settings')}
            >
              <Settings className="h-5 w-5 mr-3" />
              Settings
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={onLogout}
            >
              <LogOut className="h-5 w-5 mr-3" />
              Sign Out
            </Button>

            {/* User info */}
            {state.user && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {state.user.email}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
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
        />
      )}
    </>
  )
}
