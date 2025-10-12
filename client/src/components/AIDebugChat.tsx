import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  MessageCircle, 
  X, 
  Send, 
  Bot, 
  User, 
  Loader2, 
  AlertTriangle,
  CheckCircle,
  Info,
  Minimize2,
  Maximize2
} from 'lucide-react'
import { useApp } from '@/context/AppContext'

interface ChatMessage {
  id: string
  type: 'user' | 'ai'
  content: string
  timestamp: Date
  severity?: 'low' | 'medium' | 'high' | 'critical'
  canAutoFix?: boolean
  issueId?: string
}

interface AIDebugChatProps {
  onClose?: () => void
}

export function AIDebugChat({ onClose }: AIDebugChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'ai',
      content: '🤖 Hi! I\'m your AI Debug Assistant. I can help you troubleshoot issues with your app. Just describe what\'s not working and I\'ll analyze it for you!',
      timestamp: new Date()
    }
  ])
  const [currentMessage, setCurrentMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [systemStatus, setSystemStatus] = useState<{
    status: 'healthy' | 'degraded' | 'down'
    lastChecked: Date | null
  }>({ status: 'healthy', lastChecked: null })
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { state } = useApp()

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus()
    }
  }, [isOpen, isMinimized])

  // Load system status on component mount
  useEffect(() => {
    loadSystemStatus()
  }, [])

  const loadSystemStatus = async () => {
    try {
      const response = await fetch('/api/ai-debug/status', {
        headers: {
          'Authorization': `Bearer ${state.user?.token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setSystemStatus(data.status)
      }
    } catch (error) {
      console.error('Failed to load system status:', error)
    }
  }

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: currentMessage.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setCurrentMessage('')
    setIsLoading(true)

    try {
      // Send message to AI chat endpoint
      const response = await fetch('/api/ai-debug/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.user?.token}`
        },
        body: JSON.stringify({
          message: userMessage.content
        })
      })

      const data = await response.json()

      if (data.success) {
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: data.response,
          timestamp: new Date(),
          severity: data.severity,
          canAutoFix: data.canAutoFix,
          issueId: data.issueId
        }

        setMessages(prev => [...prev, aiMessage])
      } else {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: data.response || '❌ Sorry, I encountered an error analyzing your issue. Please try again.',
          timestamp: new Date(),
          severity: 'high'
        }

        setMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      console.error('Chat error:', error)
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: '❌ Connection error. Please check your internet connection and try again.',
        timestamp: new Date(),
        severity: 'high'
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleApplyAutoFix = async (issueId: string) => {
    try {
      setIsLoading(true)
      
      const response = await fetch('/api/ai-debug/auto-fix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.user?.token}`
        },
        body: JSON.stringify({ issueId })
      })

      const data = await response.json()

      const resultMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'ai',
        content: data.success 
          ? `✅ Auto-fix applied successfully!\n\n${data.result.message}\n\nApplied fixes:\n${data.result.appliedFixes.map((fix: string, i: number) => `${i + 1}. ${fix}`).join('\n')}`
          : `❌ Auto-fix failed: ${data.result.message}`,
        timestamp: new Date(),
        severity: data.success ? 'low' : 'medium'
      }

      setMessages(prev => [...prev, resultMessage])
      
      // Refresh system status after auto-fix
      await loadSystemStatus()
    } catch (error) {
      console.error('Auto-fix error:', error)
      
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'ai',
        content: '❌ Failed to apply auto-fix. Please try again.',
        timestamp: new Date(),
        severity: 'high'
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      case 'medium':
        return <Info className="h-4 w-4 text-yellow-500" />
      case 'low':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      default:
        return null
    }
  }

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return 'border-l-red-500 bg-red-50 dark:bg-red-900/20'
      case 'high':
        return 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/20'
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
      case 'low':
        return 'border-l-green-500 bg-green-50 dark:bg-green-900/20'
      default:
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/20'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500'
      case 'degraded':
        return 'text-yellow-500'
      case 'down':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-all duration-200 hover:scale-105"
          size="sm"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
        
        {systemStatus.status !== 'healthy' && (
          <div className="absolute -top-2 -left-2 h-4 w-4 rounded-full bg-red-500 animate-pulse" />
        )}
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 sm:w-96">
      <Card className="shadow-2xl border-2 bg-white dark:bg-gray-800">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-sm">AI Debug Assistant</CardTitle>
              <div className={`h-2 w-2 rounded-full ${getStatusColor(systemStatus.status)}`} />
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                className="h-8 w-8 p-0"
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsOpen(false)
                  onClose?.()
                }}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {!isMinimized && (
            <div className="text-xs text-gray-500">
              System: <span className={getStatusColor(systemStatus.status)}>
                {systemStatus.status}
              </span>
              {systemStatus.lastChecked && (
                <span className="ml-2">
                  • Last checked: {new Date(systemStatus.lastChecked).toLocaleTimeString()}
                </span>
              )}
            </div>
          )}
        </CardHeader>

        {!isMinimized && (
          <CardContent className="pb-4">
            {/* Messages */}
            <div className="h-64 overflow-y-auto mb-4 space-y-3 px-1">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      message.type === 'user'
                        ? 'bg-blue-600 text-white'
                        : `border-l-4 ${getSeverityColor(message.severity)} p-3`
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      {message.type === 'ai' && (
                        <div className="flex items-center space-x-1 mb-1">
                          <Bot className="h-3 w-3" />
                          {getSeverityIcon(message.severity)}
                        </div>
                      )}
                      {message.type === 'user' && (
                        <User className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <div className="whitespace-pre-wrap">{message.content}</div>
                        
                        {message.canAutoFix && message.issueId && (
                          <div className="mt-2">
                            <Button
                              size="sm"
                              onClick={() => handleApplyAutoFix(message.issueId!)}
                              disabled={isLoading}
                              className="text-xs"
                            >
                              {isLoading ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <CheckCircle className="h-3 w-3 mr-1" />
                              )}
                              Apply Auto-Fix
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <Bot className="h-3 w-3" />
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Analyzing...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex space-x-2">
              <Input
                ref={inputRef}
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Describe your issue..."
                disabled={isLoading}
                className="flex-1 text-sm"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!currentMessage.trim() || isLoading}
                size="sm"
                className="px-3"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}