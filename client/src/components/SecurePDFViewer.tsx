import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, ExternalLink } from 'lucide-react'

interface SecurePDFViewerProps {
  pdfData: Uint8Array
  onDownload: () => void
}

export function SecurePDFViewer({ pdfData, onDownload }: SecurePDFViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forceLoad, setForceLoad] = useState(false)

  useEffect(() => {
    setupPDFBlob()
    return () => {
      // Cleanup blob URL
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
      }
    }
  }, [pdfData, forceLoad])
  
  // Auto-detect PDF loading failures and show fallback
  useEffect(() => {
    if (blobUrl && !loading && !error) {
      // Give the iframe some time to load, then check if it worked
      const timeout = setTimeout(() => {
        const iframe = document.querySelector('iframe[title="Secure PDF Viewer"]') as HTMLIFrameElement
        const fallback = document.getElementById('pdf-manual-fallback')
        
        if (iframe && fallback) {
          try {
            // Try to access iframe content to see if PDF loaded
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
            if (!iframeDoc || iframeDoc.body?.innerHTML?.trim() === '') {
              console.log('PDF iframe appears empty, showing manual fallback')
              iframe.style.display = 'none'
              fallback.style.display = 'flex'
            }
          } catch (e) {
            // CORS or other access issues might indicate PDF didn't load properly
            console.log('Cannot access iframe content, showing manual fallback:', e)
            iframe.style.display = 'none'
            fallback.style.display = 'flex'
          }
        }
      }, 3000) // Wait 3 seconds for PDF to load
      
      return () => clearTimeout(timeout)
    }
  }, [blobUrl, loading, error])

  const setupPDFBlob = () => {
    try {
      setLoading(true)
      setError(null)

      console.log('Setting up PDF blob, data size:', pdfData.length)
      
      // Skip header validation if force loading
      if (!forceLoad) {
        // Validate PDF data - check for PDF header
        // Convert first 8 bytes to string to check for PDF signature
        const headerBytes = pdfData.slice(0, 8)
        const pdfHeader = String.fromCharCode(...headerBytes)
        console.log('PDF header:', pdfHeader)
        console.log('PDF header bytes:', Array.from(headerBytes).map(b => b.toString(16)).join(' '))
        
        // Check for PDF magic number - should start with %PDF-
        if (!pdfHeader.startsWith('%PDF-')) {
          // Try alternative check - sometimes the data might have different encoding
          const alternativeHeader = new TextDecoder('utf-8', { fatal: false }).decode(headerBytes)
          console.log('Alternative PDF header:', alternativeHeader)
          
          if (!alternativeHeader.startsWith('%PDF-')) {
            // Show more detailed error for debugging
            console.error('Invalid PDF header detected:', {
              expectedStart: '%PDF-',
              actualHeader: pdfHeader,
              alternativeHeader: alternativeHeader,
              firstBytes: Array.from(headerBytes).map(b => `0x${b.toString(16)}`).join(' ')
            })
            throw new Error(`Invalid PDF data - missing PDF header. Found: "${pdfHeader}" (expected: "%PDF-")`)
          }
        }
      } else {
        console.log('Force loading PDF - skipping header validation')
      }

      // Create blob from decrypted PDF data
      const blob = new Blob([new Uint8Array(pdfData)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      console.log('Created PDF blob URL:', url)
      setBlobUrl(url)
      setLoading(false)
    } catch (err) {
      console.error('Error setting up PDF blob:', err)
      setError(`Failed to display PDF: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Preparing secure PDF viewer...</p>
        </div>
      </div>
    )
  }

  if (error || !blobUrl) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            PDF Display Error
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error || 'Failed to create PDF preview'}</p>
          
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-6 p-3 bg-gray-100 dark:bg-gray-800 rounded">
            <p><strong>Debug Info:</strong></p>
            <p>PDF data size: {pdfData.length} bytes</p>
            <p>Blob URL: {blobUrl ? 'Created' : 'Failed'}</p>
            <p>Error: {error || 'None'}</p>
          </div>
          
          <div className="space-y-3">
            <Button onClick={onDownload} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download PDF Instead
            </Button>
            
            {!forceLoad && error?.includes('missing PDF header') && (
              <Button 
                onClick={() => setForceLoad(true)} 
                variant="outline"
                className="w-full"
              >
                Force Load PDF (Skip Validation)
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg">
      {/* PDF Controls */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Secure PDF Viewer
          </h3>
        </div>

        <div className="flex items-center space-x-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onDownload}
          >
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
        </div>
      </div>

      {/* PDF Embed */}
      <div className="h-[500px] p-4">
        <div className="relative w-full h-full">
          {/* Try iframe first */}
          <iframe
            src={blobUrl}
            className="w-full h-full border border-gray-300 dark:border-gray-600 rounded"
            title="Secure PDF Viewer"
            onLoad={() => {
              console.log('PDF iframe loaded successfully')
            }}
            onError={(e) => {
              console.error('PDF iframe failed to load:', e)
              setError('Browser PDF viewer failed to load. Please download the PDF.')
            }}
          />
          
          {/* Fallback embed element */}
          <embed
            src={blobUrl}
            type="application/pdf"
            className="absolute inset-0 w-full h-full border border-gray-300 dark:border-gray-600 rounded"
            style={{ display: 'none' }}
            onLoad={() => {
              console.log('PDF embed loaded as fallback')
            }}
          />
          
          {/* Manual fallback instructions */}
          <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6" style={{ display: 'none' }} id="pdf-manual-fallback">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">📄</div>
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                PDF Ready for Viewing
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Your PDF has been decrypted successfully. If it doesn't display automatically, try one of the options below:
              </p>
              
              <div className="space-y-3">
                <Button 
                  onClick={() => window.open(blobUrl, '_blank')}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={onDownload}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
              
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                Some browsers require enabling PDF plugins or downloading for security reasons.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Security Notice */}
      <div className="p-3 bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800">
        <div className="flex items-center justify-center space-x-2 text-xs text-green-700 dark:text-green-400">
          <span>🔒</span>
          <span>Secure Viewer - PDF content is decrypted locally and displayed safely</span>
        </div>
      </div>
    </div>
  )
}
