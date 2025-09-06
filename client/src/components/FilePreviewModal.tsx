import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { 
  X, 
  Download, 
  FileText, 
  Image as ImageIcon, 
  File, 
  AlertCircle,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Play,
  Volume2,
  Code,
  FileType,
  RefreshCw,
  ExternalLink
} from 'lucide-react'
import { SecurePDFViewer } from './SecurePDFViewer'

interface FilePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  file: {
    id: string
    name: string
    mimeType: string
    size: number
  }
  previewContent?: {
    type: 'text' | 'image' | 'pdf' | 'video' | 'audio' | 'code' | 'document' | 'unsupported'
    content: string | ArrayBuffer | Uint8Array | null
    error?: string
  }
  onDownload: () => void
  loading?: boolean
}

// PDF Preview Component with multiple fallback options
interface PDFPreviewComponentProps {
  pdfUrl: string
  fileName: string
  onDownload: () => void
}

function PDFPreviewComponent({ pdfUrl, fileName, onDownload }: PDFPreviewComponentProps) {
  // Check if this is a blob URL (from decrypted content)
  const isBlobUrl = pdfUrl.startsWith('blob:')
  
  // For blob URLs, we'll use direct embedding. For HTTP URLs, we can use external viewers
  const getInitialMethod = (url: string): 'direct' | 'google' | 'mozilla' => {
    if (isBlobUrl) {
      // For blob URLs (decrypted content), only use direct embedding
      console.log('Blob URL detected, using direct embedding only')
      return 'direct'
    }
    
    // For HTTP URLs, use the existing logic
    if (url.includes('localhost') ||
        url.includes('127.0.0.1') ||
        url.includes('file://')) {
      console.log('Local URL detected, starting with PDF.js')
      return 'mozilla'
    }
    
    console.log('Remote URL, starting with direct loading')
    return 'direct'
  }

  const [currentMethod, setCurrentMethod] = useState<'direct' | 'google' | 'mozilla' | 'error'>(() => 
    getInitialMethod(pdfUrl)
  )
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  // Extract the raw URL if it's a Google Docs viewer URL
  const getRawPdfUrl = (url: string) => {
    if (url.includes('docs.google.com/viewer')) {
      const match = url.match(/url=([^&]+)/)
      if (match) {
        return decodeURIComponent(match[1])
      }
    }
    return url
  }

  const rawPdfUrl = getRawPdfUrl(pdfUrl)

  // Timeout mechanism to prevent infinite loading and detect specific errors
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        if (isLoading) {
          console.log(`PDF loading timeout after 15 seconds with method: ${currentMethod}`)
          handleIframeError()
        }
      }, 15000) // 15 seconds timeout

      return () => clearTimeout(timeout)
    }
  }, [isLoading, currentMethod])

  // Enhanced black screen detection
  useEffect(() => {
    if (!isLoading && !hasError && currentMethod === 'direct') {
      // Wait a bit after iframe loads to check if it's actually showing content
      const checkBlackScreen = setTimeout(() => {
        const iframe = document.querySelector('iframe[title*="Preview of"]') as HTMLIFrameElement
        if (iframe) {
          try {
            // Try to access iframe content to see if it loaded properly
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
            if (!iframeDoc || !iframeDoc.body || iframeDoc.body.innerHTML.trim() === '') {
              console.log('Detected potential black screen with direct method, trying PDF.js...')
              handleIframeError()
            }
          } catch (e) {
            // CORS error means we can't check content, but this might indicate the PDF isn't loading
            console.log('CORS prevents content check, trying PDF.js as fallback...')
            setTimeout(() => {
              if (!isLoading && !hasError && currentMethod === 'direct') {
                handleIframeError()
              }
            }, 3000) // Give it a bit more time before fallback
          }
        }
      }, 5000) // Check after 5 seconds

      return () => clearTimeout(checkBlackScreen)
    }
  }, [isLoading, hasError, currentMethod])

  const tryNextMethod = () => {
    setIsLoading(true)
    setHasError(false)
    
    if (isBlobUrl) {
      // For blob URLs, we can't use external viewers due to CORS
      // If direct method fails, we're out of options
      console.log('Blob URL direct method failed, no external viewer fallback available')
      setCurrentMethod('error')
      return
    }
    
    // For HTTP URLs, try the normal fallback sequence
    switch (currentMethod) {
      case 'direct':
        console.log('Direct method failed, trying PDF.js...')
        setCurrentMethod('mozilla')
        break
      case 'google':
        setCurrentMethod('mozilla')
        break
      case 'mozilla':
        setCurrentMethod('error')
        break
      default:
        setCurrentMethod('error')
    }
  }

  const handleIframeLoad = () => {
    console.log('PDF iframe loaded successfully with method:', currentMethod)
    console.log('PDF URL being loaded:', getViewerUrl())
    setIsLoading(false)
    setHasError(false)
    
    // For blob URLs with embed, check if it actually loaded content
    if (isBlobUrl && currentMethod === 'direct') {
      setTimeout(() => {
        const embed = document.querySelector('embed[src^="blob:"]') as HTMLEmbedElement
        const fallback = document.getElementById(`pdf-fallback-${fileName.replace(/[^a-zA-Z0-9]/g, '')}`)
        
        if (embed && fallback) {
          // If embed has no content or very small size, show fallback
          if (embed.offsetHeight < 100) {
            console.log('PDF embed appears to have failed, showing fallback')
            fallback.style.opacity = '1'
            fallback.style.pointerEvents = 'auto'
          }
        }
      }, 3000) // Give it 3 seconds to load
    }
    
    // Additional debugging for black screen issues
    setTimeout(() => {
      const iframe = document.querySelector('iframe[title*="Preview of"]') as HTMLIFrameElement
      if (iframe) {
        console.log('Iframe dimensions:', iframe.offsetWidth, 'x', iframe.offsetHeight)
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
          if (iframeDoc) {
            console.log('Iframe document loaded, body content length:', iframeDoc.body?.innerHTML?.length || 0)
          } else {
            console.log('Cannot access iframe content (likely CORS)')
          }
        } catch (e) {
          console.log('CORS prevents iframe content inspection:', (e as Error).message || 'Unknown error')
        }
      }
    }, 2000)
  }

  const handleIframeError = () => {
    console.log('PDF iframe failed to load with method:', currentMethod)
    setIsLoading(false)
    setHasError(true)
    
    // For blob URLs, immediately show the fallback UI
    if (isBlobUrl && currentMethod === 'direct') {
      const fallback = document.getElementById(`pdf-fallback-${fileName.replace(/[^a-zA-Z0-9]/g, '')}`)
      if (fallback) {
        console.log('Showing fallback UI for failed blob URL PDF')
        fallback.style.opacity = '1'
        fallback.style.pointerEvents = 'auto'
      }
      return
    }
    
    // Auto-try next method for specific errors (like HTTP 400/415)
    if (currentMethod === 'google') {
      console.log('Google Docs viewer failed (likely HTTP 400/415 error), trying PDF.js viewer...')
      setTimeout(() => tryNextMethod(), 1000)
    } else if (currentMethod === 'direct') {
      console.log('Direct loading failed, trying PDF.js viewer (skipping Google Docs)...')
      setTimeout(() => tryNextMethod(), 1000)
    } else if (currentMethod === 'mozilla') {
      console.log('All PDF preview methods failed')
    }
  }

  const getViewerUrl = () => {
    const url = (() => {
      switch (currentMethod) {
        case 'direct':
          return rawPdfUrl
        case 'google':
          // Don't try Google Docs with blob URLs
          if (isBlobUrl) {
            return rawPdfUrl
          }
          return `https://docs.google.com/viewer?url=${encodeURIComponent(rawPdfUrl)}&embedded=true`
        case 'mozilla':
          // Don't try external PDF.js with blob URLs
          if (isBlobUrl) {
            return rawPdfUrl
          }
          return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(rawPdfUrl)}`
        default:
          return rawPdfUrl
      }
    })()
    
    console.log('PDF viewer URL:', url)
    return url
  }

  if (currentMethod === 'error') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <FileText className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">PDF Preview Unavailable</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            {isBlobUrl 
              ? "This decrypted PDF cannot be displayed in the browser viewer due to security restrictions."
              : "This PDF cannot be previewed in the browser. Common causes include:"
            }
          </p>
          {!isBlobUrl && (
            <ul className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-left">
              <li>• <strong>HTTP 400/415 Error:</strong> Google Docs Viewer rejected the PDF URL</li>
              <li>• <strong>CORS restrictions:</strong> Cross-origin resource sharing blocked</li>
              <li>• <strong>Malformed request:</strong> URL encoding or format issues</li>
              <li>• <strong>File protection:</strong> Password-protected or encrypted PDF</li>
              <li>• <strong>File corruption:</strong> Damaged or invalid PDF format</li>
              <li>• <strong>Size limits:</strong> PDF file exceeds viewer size restrictions</li>
              <li>• <strong>Network issues:</strong> Connectivity or timeout problems</li>
            </ul>
          )}
          {isBlobUrl && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              <p className="mb-2"><strong>Why this happens:</strong></p>
              <p>Browser security prevents external PDF viewers from accessing decrypted content. The file has been successfully decrypted but cannot be displayed inline.</p>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={onDownload} className="mx-auto">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            {!isBlobUrl && (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setCurrentMethod('direct')
                    setIsLoading(true)
                    setHasError(false)
                  }}
                  className="mx-auto"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.open(rawPdfUrl, '_blank')}
                  className="mx-auto"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* PDF Controls */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          PDF Preview ({currentMethod === 'direct' ? 'Direct Loading' : 
                       currentMethod === 'google' ? 'Google Docs Viewer' : 
                       'PDF.js Viewer'})
          {isLoading && <span className="ml-2 text-blue-500">Loading...</span>}
          {hasError && !isLoading && (
            <span className="ml-2 text-red-500">
              ({currentMethod === 'google' ? 'HTTP 400/415 Error - Trying PDF.js...' : 
                currentMethod === 'direct' ? 'Direct load failed - Trying PDF.js...' :
                'Failed - All methods exhausted'})
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {hasError && !isLoading && (
            <>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={tryNextMethod}
                disabled={currentMethod === 'mozilla'}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Try Different Viewer
              </Button>
              {currentMethod !== 'google' && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    setCurrentMethod('google')
                    setIsLoading(true)
                    setHasError(false)
                  }}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Force Google Docs
                </Button>
              )}
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  const iframe = document.querySelector('iframe[title*="Preview of"]') as HTMLIFrameElement
                  const url = getViewerUrl()
                  console.log('=== PDF DEBUG INFO ===')
                  console.log('Current method:', currentMethod)
                  console.log('PDF URL:', url)
                  console.log('Raw PDF URL:', rawPdfUrl)
                  console.log('Iframe exists:', !!iframe)
                  if (iframe) {
                    console.log('Iframe src:', iframe.src)
                    console.log('Iframe dimensions:', iframe.offsetWidth, 'x', iframe.offsetHeight)
                  }
                  console.log('Is loading:', isLoading)
                  console.log('Has error:', hasError)
                  console.log('=== END DEBUG ===')
                  alert('Debug info logged to console. Press F12 to view.')
                }}
              >
                <Code className="h-4 w-4 mr-1" />
                Debug Info
              </Button>
            </>
          )}
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => window.open(rawPdfUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Test PDF URL
          </Button>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 bg-opacity-75 z-10">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading PDF...</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Method: {currentMethod}</p>
          </div>
        </div>
      )}

      {/* Black screen detection helper */}
      {!isLoading && !hasError && (
        <div className="absolute top-2 right-2 z-20">
          <div className="bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
            {currentMethod === 'direct' ? 'Direct Loading' : 
             currentMethod === 'google' ? 'Google Docs' : 
             'PDF.js Viewer'}
          </div>
        </div>
      )}

      {/* PDF Viewer */}
      <div className="relative flex-1">
        {isBlobUrl && currentMethod === 'direct' ? (
          // For blob URLs (decrypted content), show a better UX
          <div className="w-full h-full border border-gray-200 dark:border-gray-700 rounded min-h-[600px] bg-gray-50 dark:bg-gray-900">
            {/* Attempt to show PDF but with prominent fallback */}
            <div className="relative w-full h-full">
              {/* Try to embed PDF */}
              <embed
                src={getViewerUrl()}
                type="application/pdf"
                className="w-full h-full absolute inset-0"
                style={{ zIndex: 1 }}
              />
              
              {/* Always show user-friendly overlay for decrypted PDFs */}
              <div className="absolute inset-0 flex flex-col" style={{ zIndex: 2 }}>
                {/* Header explaining successful decryption */}
                <div className="bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                        PDF Successfully Decrypted
                      </h3>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Your encrypted PDF has been decrypted and is ready to view
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Viewing options */}
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center max-w-md">
                    <FileText className="h-16 w-16 text-blue-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Choose Viewing Option
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                      Due to browser security restrictions, decrypted PDFs work best when downloaded or opened in a new window.
                    </p>
                    
                    <div className="space-y-3">
                      <Button onClick={onDownload} className="w-full" size="lg">
                        <Download className="h-4 w-4 mr-2" />
                        Download PDF (Recommended)
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          // Try to open in a new tab
                          try {
                            const newWindow = window.open('', '_blank')
                            if (newWindow) {
                              newWindow.document.write(`
                                <!DOCTYPE html>
                                <html>
                                  <head>
                                    <title>${fileName}</title>
                                    <style>
                                      body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
                                      .fallback { text-align: center; padding: 50px; }
                                    </style>
                                  </head>
                                  <body>
                                    <embed src="${getViewerUrl()}" type="application/pdf" width="100%" height="100vh" />
                                    <div class="fallback" style="display: none;">
                                      <h2>PDF Viewer Not Available</h2>
                                      <p>Your browser cannot display this PDF inline.</p>
                                      <p>Please download the file to view it properly.</p>
                                      <button onclick="window.close()">Close Window</button>
                                    </div>
                                    <script>
                                      setTimeout(() => {
                                        const embed = document.querySelector('embed');
                                        const fallback = document.querySelector('.fallback');
                                        if (embed && embed.offsetHeight < 100) {
                                          embed.style.display = 'none';
                                          fallback.style.display = 'block';
                                        }
                                      }, 2000);
                                    </script>
                                  </body>
                                </html>
                              `)
                              newWindow.document.close()
                            } else {
                              alert('Pop-up blocked. Please allow pop-ups for this site or download the PDF.')
                            }
                          } catch (error) {
                            console.error('Failed to open PDF in new window:', error)
                            alert('Cannot open in new window. Please download the PDF.')
                          }
                        }}
                        className="w-full"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Try in New Window
                      </Button>
                      
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                        <p>💡 <strong>Tip:</strong> Downloaded PDFs will open in your default PDF viewer with full functionality.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // For HTTP URLs, use iframe as before
          <iframe
            src={getViewerUrl()}
            className="w-full h-full border border-gray-200 dark:border-gray-700 rounded min-h-[600px]"
            title={`Preview of ${fileName}`}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        )}
      </div>

      {/* Footer info */}
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Having trouble viewing? Try downloading the PDF or opening it in a new tab.
      </div>
    </div>
  )
}

export function FilePreviewModal({ 
  isOpen, 
  onClose, 
  file, 
  previewContent, 
  onDownload, 
  loading = false 
}: FilePreviewModalProps) {
  console.log('FilePreviewModal render:', { isOpen, file: file?.name, previewContent, loading })
  
  const [imageZoom, setImageZoom] = useState(100)
  const [imageRotation, setImageRotation] = useState(0)

  // Cleanup blob URLs when modal closes or content changes
  useEffect(() => {
    return () => {
      if (previewContent?.content && typeof previewContent.content === 'string' && previewContent.content.startsWith('blob:')) {
        URL.revokeObjectURL(previewContent.content)
      }
    }
  }, [previewContent?.content])

  // Handle cleanup when closing
  const handleClose = () => {
    if (previewContent?.content && typeof previewContent.content === 'string' && previewContent.content.startsWith('blob:')) {
      URL.revokeObjectURL(previewContent.content)
    }
    onClose()
  }  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, handleClose])

  // Reset image controls when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setImageZoom(100)
      setImageRotation(0)
    }
  }, [isOpen])

  if (!isOpen) return null

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileTypeIcon = () => {
    if (file.mimeType.startsWith('image/')) return <ImageIcon className="h-5 w-5" />
    if (file.mimeType.includes('pdf')) return <FileText className="h-5 w-5" />
    if (file.mimeType.includes('text') || file.mimeType.includes('json') || file.mimeType.includes('xml')) return <FileText className="h-5 w-5" />
    if (file.mimeType.includes('video/')) return <Play className="h-5 w-5" />
    if (file.mimeType.includes('audio/')) return <Volume2 className="h-5 w-5" />
    if (file.mimeType.includes('javascript') || file.mimeType.includes('python') || file.mimeType.includes('java')) return <Code className="h-5 w-5" />
    if (file.mimeType.includes('document') || file.mimeType.includes('msword') || file.mimeType.includes('wordprocessingml')) return <FileType className="h-5 w-5" />
    return <File className="h-5 w-5" />
  }

  const renderPreviewContent = () => {
    console.log('Rendering preview content:', { loading, previewContent })
    
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading preview...</p>
          </div>
        </div>
      )
    }

    if (!previewContent) {
      console.log('No preview content available')
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <File className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No preview available</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Click download to view this file
            </p>
          </div>
        </div>
      )
    }

    if (previewContent.error) {
      console.log('Preview content error:', previewContent.error)
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-600 dark:text-red-400 mb-2">Preview Error</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{previewContent.error}</p>
          </div>
        </div>
      )
    }

    console.log('Rendering preview for type:', previewContent.type)

    switch (previewContent.type) {
      case 'text':
      case 'code':
        return (
          <div className="flex-1 overflow-auto p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <pre className={`text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap ${
              previewContent.type === 'code' ? 'font-mono' : 'font-mono'
            }`}>
              {previewContent.content as string}
            </pre>
          </div>
        )

      case 'image':
        console.log('Rendering image preview, content:', previewContent.content)
        console.log('Content type:', typeof previewContent.content)
        console.log('Content length:', (previewContent.content as string)?.length)
        
        return (
          <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            {/* Image Controls */}
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setImageZoom(Math.max(25, imageZoom - 25))}
                disabled={imageZoom <= 25}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[60px] text-center">
                {imageZoom}%
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setImageZoom(Math.min(400, imageZoom + 25))}
                disabled={imageZoom >= 400}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setImageRotation((imageRotation + 90) % 360)}
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>

            {/* Debug info */}
            <div className="mb-2 text-xs text-gray-500">
              Debug: {typeof previewContent.content === 'string' && (previewContent.content as string).length < 50 
                ? `Content: "${previewContent.content}"` 
                : `URL type: ${(previewContent.content as string)?.startsWith('http') ? 'HTTP URL' : 
                             (previewContent.content as string)?.startsWith('blob:') ? 'Blob URL' :
                             (previewContent.content as string)?.startsWith('data:') ? 'Data URL' : 'Unknown'}`}
            </div>

            {/* Image */}
            <div className="flex justify-center">
              {(previewContent.content as string)?.startsWith('http') || 
               (previewContent.content as string)?.startsWith('blob:') || 
               (previewContent.content as string)?.startsWith('data:') ? (
                <img
                  src={previewContent.content as string}
                  alt={file.name}
                  className="max-w-full h-auto border border-gray-200 dark:border-gray-700 rounded"
                  style={{
                    transform: `scale(${imageZoom / 100}) rotate(${imageRotation}deg)`,
                    transformOrigin: 'center',
                    transition: 'transform 0.2s ease-in-out'
                  }}
                  onError={(e) => {
                    console.error('Image failed to load:', previewContent.content)
                    console.error('Error event:', e)
                    
                    // If blob URL fails, try to reload the image with direct URL
                    if ((previewContent.content as string).startsWith('blob:')) {
                      console.log('Blob URL failed, trying to reload image preview...')
                      // Trigger a re-fetch of the preview without blob conversion
                      window.dispatchEvent(new CustomEvent('reloadImagePreview', { detail: { fileId: file.id } }))
                    }
                  }}
                  onLoad={() => {
                    console.log('Image loaded successfully:', previewContent.content)
                  }}
                />
              ) : (
                <div className="text-center p-8 border border-gray-200 dark:border-gray-700 rounded">
                  <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-red-600 dark:text-red-400 mb-2">Image Preview Error</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Invalid image URL: "{String(previewContent.content)}"
                  </p>
                  <Button onClick={onDownload} size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download Image
                  </Button>
                </div>
              )}
            </div>
          </div>
        )

      case 'pdf':
        return (
          <div className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            {previewContent.content ? (
              previewContent.content instanceof Uint8Array ? (
                // Handle decrypted PDF data
                <SecurePDFViewer 
                  pdfData={previewContent.content}
                  onDownload={onDownload}
                />
              ) : (
                // Handle PDF URL
                <PDFPreviewComponent 
                  pdfUrl={previewContent.content as string}
                  fileName={file.name}
                  onDownload={onDownload}
                />
              )
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <FileText className="h-16 w-16 text-red-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">PDF Preview Error</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Unable to load PDF preview. This might be due to CORS restrictions.
                  </p>
                  <Button onClick={onDownload} className="mx-auto">
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </div>
              </div>
            )}
          </div>
        )

      case 'video':
        return (
          <div className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg p-4 flex items-center justify-center">
            <video
              controls
              className="max-w-full max-h-full border border-gray-200 dark:border-gray-700 rounded"
              style={{ maxHeight: '70vh' }}
            >
              <source src={previewContent.content as string} type={file.mimeType} />
              Your browser does not support the video tag.
            </video>
          </div>
        )

      case 'audio':
        return (
          <div className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg p-4 flex flex-col items-center justify-center">
            <div className="mb-6">
              <Volume2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300 text-center">
                {file.name}
              </p>
            </div>
            <audio
              controls
              className="w-full max-w-md"
            >
              <source src={previewContent.content as string} type={file.mimeType} />
              Your browser does not support the audio tag.
            </audio>
          </div>
        )

      case 'document':
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileType className="h-16 w-16 text-blue-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Document Preview</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                This document format requires downloading to view the full content.
              </p>
              <Button onClick={onDownload} className="mx-auto">
                <Download className="h-4 w-4 mr-2" />
                Download to View
              </Button>
            </div>
          </div>
        )

      case 'unsupported':
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <File className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-2">Preview not supported</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                This file type cannot be previewed. You can download it to view.
              </p>
            </div>
          </div>
        )

      default:
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <File className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Unknown preview type</p>
            </div>
          </div>
        )
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl h-[80vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {getFileTypeIcon()}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {file.name}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {formatFileSize(file.size)} • {file.mimeType}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onDownload}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-hidden">
          {renderPreviewContent()}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>
              🔒 This file is end-to-end encrypted and securely decrypted for preview
            </span>
            <span>
              Press ESC to close
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
