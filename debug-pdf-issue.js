/**
 * Debug script to help identify PDF decryption issues
 * Run this in the browser console when experiencing PDF preview problems
 */

function debugPDFData(pdfData) {
  console.log('=== PDF Debug Analysis ===')
  console.log('Data type:', typeof pdfData)
  console.log('Data length:', pdfData.length)
  console.log('Is Uint8Array:', pdfData instanceof Uint8Array)
  console.log('Is ArrayBuffer:', pdfData instanceof ArrayBuffer)
  
  // Convert to Uint8Array if needed
  let bytes = pdfData
  if (pdfData instanceof ArrayBuffer) {
    bytes = new Uint8Array(pdfData)
  }
  
  // Check first 20 bytes
  const firstBytes = bytes.slice(0, 20)
  console.log('First 20 bytes (hex):', Array.from(firstBytes).map(b => b.toString(16).padStart(2, '0')).join(' '))
  console.log('First 20 bytes (ASCII):', String.fromCharCode(...firstBytes))
  
  // Try different ways to read the header
  console.log('Header as string:', String.fromCharCode(...bytes.slice(0, 8)))
  console.log('Header with TextDecoder:', new TextDecoder().decode(bytes.slice(0, 8)))
  console.log('Header with TextDecoder (latin1):', new TextDecoder('latin1').decode(bytes.slice(0, 8)))
  
  // Check for PDF signature
  const hasPDFSignature = String.fromCharCode(...bytes.slice(0, 4)) === '%PDF'
  console.log('Has PDF signature (%PDF):', hasPDFSignature)
  
  // Look for PDF signature anywhere in first 100 bytes
  const first100 = String.fromCharCode(...bytes.slice(0, 100))
  const pdfIndex = first100.indexOf('%PDF')
  console.log('PDF signature found at index:', pdfIndex)
  
  if (pdfIndex > 0) {
    console.log('PDF data may have extra bytes at the beginning')
    console.log('Bytes before PDF signature:', Array.from(bytes.slice(0, pdfIndex)).map(b => b.toString(16)).join(' '))
  }
  
  // Check for common file corruption patterns
  if (bytes.length < 1024) {
    console.log('⚠️ File is very small, may be corrupted')
  }
  
  if (bytes.every(b => b === 0)) {
    console.log('⚠️ File contains only null bytes')
  }
  
  // Check end of file for PDF trailer
  const lastBytes = bytes.slice(-20)
  const endString = String.fromCharCode(...lastBytes)
  console.log('Last 20 bytes:', endString)
  console.log('Has %%EOF:', endString.includes('%%EOF'))
  
  console.log('=== End PDF Debug Analysis ===')
}

// Export for use
if (typeof window !== 'undefined') {
  window.debugPDFData = debugPDFData
  console.log('PDF Debug utility loaded. Use debugPDFData(yourPDFData) to analyze PDF data.')
}

module.exports = { debugPDFData }
