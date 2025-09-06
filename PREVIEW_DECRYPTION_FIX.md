# File Preview Decryption Fix

## Problem Description

The file preview system was failing to display images and PDFs because:

1. **Encrypted Content**: Files uploaded to the vault are encrypted client-side before storage
2. **Server Returns Encrypted URLs**: The preview endpoint was returning direct URLs to encrypted blob content
3. **No Client-Side Decryption**: The client was trying to display encrypted content directly, resulting in:
   - Images showing as broken/failed to load
   - PDFs showing black screens or failing to render
   - Content type being "string" instead of proper binary data

## Root Cause Analysis

The issue occurred because:

1. **File Upload Process**:
   - Files are encrypted using AES-GCM on the client side
   - Encrypted blobs are uploaded to Cloudinary/S3
   - File metadata (encrypted name, mime type) is stored in database

2. **Preview Endpoint Behavior**:
   - Server was returning direct URLs to encrypted content
   - For text files: Server tried to fetch and decrypt (but has no decryption capability)
   - For binary files: Direct URLs pointed to encrypted data

3. **Client Preview Rendering**:
   - Client received URLs to encrypted content
   - Attempted to render encrypted data directly
   - No decryption step in the preview flow

## Solution Implemented

### 1. Client-Side Decryption in Preview API

**File**: `client/src/lib/api.ts`

- Modified `getPreview` function to handle decryption
- For all file types (text, code, image, pdf, video, audio):
  1. Download encrypted content from server-provided URL
  2. Derive master key using same approach as file upload
  3. Fetch file metadata for decryption parameters
  4. Decrypt content using `decryptFile` function
  5. For text files: Extract text content
  6. For binary files: Create blob URL from decrypted content

**Key Changes**:
```typescript
// Download encrypted content
const contentResponse = await fetch(response.content)
const encryptedBlob = await contentResponse.blob()

// Derive master key (same as upload process)
const keyMaterial = await window.crypto.subtle.importKey(/* ... */)
const masterKey = await window.crypto.subtle.deriveKey(/* ... */)

// Get file metadata for decryption
const fileMetadata = await request(`/files/${fileId}/metadata`)

// Decrypt file
const { file: decryptedFile, mimeType } = await decryptFile(encryptedBlob, metadata, masterKey)

// Handle different content types
if (response.type === 'text' || response.type === 'code') {
  const text = await decryptedFile.text()
  return { type: response.type, content: text }
} else {
  const blobUrl = URL.createObjectURL(decryptedFile)
  return { type: response.type, content: blobUrl }
}
```

### 2. Server-Side Changes

**File**: `server/src/routes/files.ts`

#### Added File Metadata Endpoint
```typescript
router.get('/:fileId/metadata', requireAuth, async (req, res) => {
  // Returns file metadata needed for decryption
  res.json({
    id: file._id?.toHexString(),
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    encryptedName: file.encryptedName,
    encryptedMimeType: file.mimeType, // Currently stored encrypted
    uploadedAt: file.uploadedAt,
  })
})
```

#### Updated Preview Endpoint
- **Text/Code Files**: Return download URL instead of trying to decrypt server-side
- **Binary Files**: Continue returning download URLs
- **Let client handle all decryption**: Server no longer attempts decryption

**Before**:
```typescript
// Server tried to fetch and decrypt text
const response = await fetch(downloadResponse.downloadUrl)
const text = await response.text() // This was encrypted garbage
previewContent = text.slice(0, 100000)
```

**After**:
```typescript
// Server just returns URL for client to handle
previewContent = downloadResponse.downloadUrl
```

### 3. Fixed Property Access Issues

- Corrected `file.name` → `file.originalName`
- Fixed `file.encryptedMimeType` → `file.mimeType` (stored encrypted)
- Updated all debug logging to use correct properties

## Technical Details

### Encryption/Decryption Flow

1. **Upload** (Client → Server → Storage):
   ```
   File → Encrypt (AES-GCM) → Upload → Store encrypted blob
   ```

2. **Preview** (Storage → Server → Client):
   ```
   Request → Server returns encrypted URL → Client downloads → Client decrypts → Display
   ```

### Key Derivation Consistency

Both upload and preview use the same master key derivation:
```typescript
const keyMaterial = await window.crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(user.id.padEnd(32, '0')),
  { name: 'PBKDF2' },
  false,
  ['deriveBits', 'deriveKey']
)

const masterKey = await window.crypto.subtle.deriveKey({
  name: 'PBKDF2',
  salt: new TextEncoder().encode('vault-salt'),
  iterations: 100000,
  hash: 'SHA-256'
}, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
```

### File Types Handled

- **Text/Code**: Decrypted and returned as string content
- **Images**: Decrypted and returned as blob URL for `<img>` tags
- **PDFs**: Decrypted and returned as blob URL for PDF viewers
- **Video/Audio**: Decrypted and returned as blob URL for media players

## Benefits of This Approach

1. **Security**: Decryption happens client-side, server never sees unencrypted content
2. **Consistency**: Same encryption/decryption flow for all file operations
3. **Performance**: Only downloads what's needed for preview
4. **Compatibility**: Works with all file types that were previously failing

## Testing

After implementing this fix:

1. ✅ Images now load and display correctly in preview modal
2. ✅ PDFs render properly in the PDF viewer
3. ✅ Text files show decrypted content
4. ✅ Video/audio files play with decrypted content
5. ✅ Error handling for decryption failures
6. ✅ Proper cleanup of blob URLs to prevent memory leaks

## Error Handling

The implementation includes robust error handling:

- **Download failures**: Falls back to direct URL (with error message)
- **Decryption failures**: Shows error in preview with fallback
- **Missing metadata**: Graceful degradation
- **Invalid keys**: Clear error messages in console

## Memory Management

- Blob URLs are properly cleaned up using `URL.revokeObjectURL()`
- Cleanup happens when modal closes or content changes
- Prevents memory leaks from accumulated blob URLs

## Next Steps

1. **Monitor Performance**: Track decryption times for large files
2. **Optimize for Large Files**: Consider streaming decryption for very large files
3. **Cache Decrypted Content**: Implement temporary caching for recently decrypted files
4. **Progress Indicators**: Add progress bars for large file decryption

This fix resolves the core issue where encrypted files couldn't be previewed, enabling the full file preview functionality while maintaining end-to-end encryption security.
