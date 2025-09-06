# Image Preview Issue - "image_2.jpg" Instead of Image

## 🎯 Problem Summary
You're seeing the filename "image_2.jpg" displayed instead of the actual image when using the preview function.

## 🔧 Enhanced Debugging Added

### Client-Side Debugging:
- **Console Logs**: Added detailed logging to show what content is received
- **Visual Debug Info**: Shows content type and format in the preview
- **Error Handling**: Better error messages when image URL is invalid
- **URL Validation**: Checks if content is a valid URL (http/https/blob/data)

### Server-Side Debugging:
- **Download Response Logging**: Shows what URL is generated
- **Content Validation**: Verifies URL format before sending to client
- **Error Handling**: Catches and logs invalid download responses

## 📋 How to Debug This Issue

### Step 1: Test Image Preview
1. Open your application at `http://localhost:5179`
2. Try to preview an image file
3. **Watch these locations for debug info:**

### Step 2: Check Browser Console (F12)
Look for these debug messages:
```
Rendering image preview, content: [should show URL]
Content type: string
Content length: [should be > 20 for URLs]
Debug: URL type: HTTP URL (good) or Content: "image_2.jpg" (bad)
```

### Step 3: Check Server Console/Terminal
Look for these debug messages:
```
[DEBUG] Download response for image_2.jpg: { downloadUrl: "https://...", expiresIn: 3600 }
[DEBUG] Image preview URL for image_2.jpg: https://...
[DEBUG] Preview response for image_2.jpg: { type: "image", contentType: "string", ... }
```

### Step 4: Check Network Tab (F12 > Network)
1. Look for POST request to `/api/files/[id]/preview`
2. Check the response body - `content` field should contain full URL
3. If content is just "image_2.jpg", the server issue is confirmed

## 🔍 Possible Root Causes

### 1. **Download URL Generation Failed**
- **Symptoms**: Server logs show invalid/empty downloadResponse
- **Cause**: S3/Cloudinary configuration issue
- **Fix**: Check storage service credentials and configuration

### 2. **Server Returning Filename Instead of URL**
- **Symptoms**: Network tab shows content as just filename
- **Cause**: Logic error in server-side URL generation
- **Fix**: Check server logs for URL generation process

### 3. **Storage Service Integration Issue**
- **Symptoms**: Download works but preview doesn't
- **Cause**: Different code paths for download vs preview
- **Fix**: Verify both use same URL generation method

### 4. **File Storage Type Confusion**
- **Symptoms**: Some files work, others don't
- **Cause**: Mix of S3 and Cloudinary files with different handling
- **Fix**: Check if file has s3Key or cloudinaryUrl

## 🚀 Quick Fixes to Try

### Fix 1: Force Download URL in Browser
1. Copy URL from server debug logs
2. Paste directly in browser address bar
3. See if image loads outside application
4. This confirms if URL generation is working

### Fix 2: Check File Storage Configuration
```bash
# Check environment variables
echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY
echo $AWS_REGION
echo $CLOUDINARY_CLOUD_NAME
```

### Fix 3: Test Different File Types
1. Try previewing a different image
2. Test with newly uploaded vs existing files
3. Compare S3 vs Cloudinary files (if you use both)

### Fix 4: Check File Object in Database
The file object should have either:
- `s3Key` property for S3 files
- `cloudinaryUrl` property for Cloudinary files

## 🎯 Expected vs Current Behavior

### Expected Behavior:
```javascript
// Server should return:
{
  "type": "image",
  "content": "https://bucket.s3.amazonaws.com/path/to/image.jpg?X-Amz-Algorithm=...",
  "mimeType": "image/jpeg",
  "size": 12345
}

// Client should receive full URL and display image
```

### Current Issue:
```javascript
// Server likely returning:
{
  "type": "image", 
  "content": "image_2.jpg",  // ❌ Just filename, not URL
  "mimeType": "image/jpeg",
  "size": 12345
}

// Client tries to load "image_2.jpg" as src, which fails
```

## 📊 Diagnostic Checklist

**Run these checks and share the results:**

- [ ] Browser console shows debug info when previewing image
- [ ] Server console shows download URL generation
- [ ] Network tab shows preview API response content
- [ ] Image URL opens when pasted directly in browser
- [ ] Download function works for the same image
- [ ] Issue occurs with all images or just specific ones
- [ ] Check if files are stored in S3 or Cloudinary

## 🆘 What to Share for Further Help

1. **Browser console output** when previewing image
2. **Server console logs** showing debug information
3. **Network tab screenshot** showing preview API response
4. **Storage type** you're using (S3/Cloudinary/Local)
5. **Whether download works** but preview doesn't

The enhanced debugging should pinpoint exactly where the URL is getting lost!
