# PDF Blob URL Preview Fix

## Problem Description

The PDF preview was failing with the following error when trying to view decrypted PDFs:

```
Not allowed to load local resource: blob:http://localhost:5179/8d33b3ad-5910-4eea-9933-7b411ab398d1
Unexpected server response (0) while retrieving PDF
```

## Root Cause

When files are decrypted for preview, they are converted to blob URLs (e.g., `blob:http://localhost:5179/...`). External PDF viewers like Mozilla's PDF.js viewer hosted on `mozilla.github.io` cannot access these blob URLs due to **Cross-Origin Resource Sharing (CORS) security restrictions**.

### Why This Happens

1. **Blob URLs are origin-specific**: A blob URL created on `localhost:5180` can only be accessed from the same origin
2. **External viewers run on different origins**: Mozilla PDF.js runs on `mozilla.github.io`
3. **CORS blocks cross-origin blob access**: Browsers prevent external sites from accessing local blob URLs for security reasons

## Solution Implemented

### 1. Enhanced PDF Viewer Logic

**File**: `client/src/components/FilePreviewModal.tsx`

#### Blob URL Detection
```typescript
// Check if this is a blob URL (from decrypted content)
const isBlobUrl = pdfUrl.startsWith('blob:')
```

#### Method Selection Strategy
```typescript
const getInitialMethod = (url: string): 'direct' | 'google' | 'mozilla' => {
  if (isBlobUrl) {
    // For blob URLs (decrypted content), only use direct embedding
    console.log('Blob URL detected, using direct embedding only')
    return 'direct'
  }
  
  // For HTTP URLs, use external viewers as before
  // ...existing logic
}
```

#### Fallback Behavior
```typescript
const tryNextMethod = () => {
  if (isBlobUrl) {
    // For blob URLs, we can't use external viewers due to CORS
    // If direct method fails, we're out of options
    console.log('Blob URL direct method failed, no external viewer fallback available')
    setCurrentMethod('error')
    return
  }
  
  // For HTTP URLs, try the normal fallback sequence
  // ...existing fallback logic
}
```

### 2. Dual Rendering Approach

For blob URLs, we use a more reliable rendering method:

```typescript
{isBlobUrl && currentMethod === 'direct' ? (
  // For blob URLs, use object tag which is more reliable
  <object
    data={getViewerUrl()}
    type="application/pdf"
    className="w-full h-full border border-gray-200 dark:border-gray-700 rounded min-h-[600px]"
    onLoad={handleIframeLoad}
    onError={handleIframeError}
  >
    <div className="flex items-center justify-center h-[600px]">
      <div className="text-center">
        <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          PDF cannot be displayed inline in this browser
        </p>
        <Button onClick={onDownload}>
          <Download className="h-4 w-4 mr-2" />
          Download PDF to View
        </Button>
      </div>
    </div>
  </object>
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
```

#### Why `<object>` vs `<iframe>`?

- **`<object>` tag**: Better for blob URLs as it's designed for embedding binary content
- **`<iframe>` tag**: Better for external viewers but blocked by CORS for blob URLs

### 3. Enhanced Error Handling

Custom error messages for different scenarios:

```typescript
{isBlobUrl 
  ? "This decrypted PDF cannot be displayed in the browser viewer due to security restrictions."
  : "This PDF cannot be previewed in the browser. Common causes include:"
}
```

For blob URLs, we provide specific explanation:
```typescript
{isBlobUrl && (
  <div className="text-sm text-gray-600 dark:text-gray-400 mb-6">
    <p className="mb-2"><strong>Why this happens:</strong></p>
    <p>Browser security prevents external PDF viewers from accessing decrypted content. The file has been successfully decrypted but cannot be displayed inline.</p>
  </div>
)}
```

### 4. Viewer Method Restrictions

External viewers are now restricted based on URL type:

```typescript
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
```

## Technical Benefits

### 1. Security Compliance
- Respects browser CORS policies
- No attempts to bypass security restrictions
- Clear error messaging about security limitations

### 2. Better User Experience
- No more confusing CORS errors in console
- Clear explanation of why preview might not work
- Graceful fallback to download option

### 3. Reliable Fallback Strategy
- **HTTP URLs**: Can use external viewers (Google Docs, PDF.js)
- **Blob URLs**: Use direct embedding only
- **All URLs**: Always provide download option

### 4. Progressive Enhancement
- Attempts inline viewing first
- Falls back to download if viewing fails
- Maintains functionality for all file types

## Browser Compatibility

### Works Well With:
- ✅ Chrome/Edge (supports `<object>` for PDFs)
- ✅ Firefox (good PDF handling)
- ✅ Safari (basic PDF support)

### Graceful Degradation:
- If `<object>` tag fails to display PDF
- Shows fallback UI with download button
- User can still access the decrypted content

## Testing Results

After implementing this fix:

1. ✅ **Blob URL Error Eliminated**: No more CORS errors in console
2. ✅ **HTTP URLs Still Work**: External viewers still function for remote PDFs
3. ✅ **Clear Error Messages**: Users understand why preview might not work
4. ✅ **Download Always Available**: Users can always download decrypted content
5. ✅ **Progressive Enhancement**: Best available viewing method is automatically selected

## Alternative Solutions Considered

### 1. Data URL Conversion
**Approach**: Convert blob to data URL for external viewers
**Issues**: 
- Data URLs have size limits
- Poor performance for large PDFs
- Still blocked by some external viewers

### 2. Proxy Server
**Approach**: Server-side proxy to serve blob content
**Issues**:
- Requires server-side decryption (security risk)
- Adds complexity
- Defeats purpose of client-side encryption

### 3. Local PDF.js Integration
**Approach**: Bundle PDF.js locally
**Issues**:
- Large bundle size increase
- Maintenance overhead
- Current solution is simpler

## Future Enhancements

1. **Progressive Loading**: Implement streaming for large PDFs
2. **Thumbnail Generation**: Create preview thumbnails for quick identification
3. **Local PDF.js**: Consider bundling PDF.js for full control
4. **Enhanced Object Handling**: Better error detection for `<object>` tag failures

This fix ensures that decrypted PDFs can be previewed when possible, while providing clear feedback and reliable download options when preview isn't feasible due to browser security restrictions.
