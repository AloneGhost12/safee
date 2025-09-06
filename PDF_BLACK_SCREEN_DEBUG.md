# PDF Black Screen Issue - Troubleshooting Guide

## 🎯 Problem: PDF Preview Shows Black Screen

The 400 error is fixed, but now you're seeing a black screen instead of PDF content. This is a different issue that needs specific debugging.

## 🔧 Enhanced Debugging Features Added

### New Buttons Available:
1. **"Debug Info"** - Logs detailed diagnostic information to console
2. **"Test PDF URL"** - Opens PDF URL directly in new tab to test accessibility
3. **"Try Different Viewer"** - Cycles through available viewing methods
4. **"Force Google Docs"** - Manually tries Google Docs viewer

### Enhanced Logging:
- Detailed console logs about iframe loading
- PDF URL validation
- CORS detection
- Automatic black screen detection with fallback

## 📋 Step-by-Step Troubleshooting

### Step 1: Open Browser Developer Tools
```
1. Press F12 to open Developer Tools
2. Go to Console tab
3. Go to Network tab
4. Try to preview a PDF
5. Look for any red error messages
```

### Step 2: Use Debug Features
```
1. When you see black screen, click "Debug Info" button
2. Check console for detailed information
3. Click "Test PDF URL" to test if PDF loads directly
4. Try "Try Different Viewer" to test other methods
```

### Step 3: Check Network Tab
```
1. Look for PDF file request in Network tab
2. Check if request completed successfully (status 200)
3. Verify response size > 0
4. Check Content-Type is "application/pdf"
```

## 🔍 Common Causes & Solutions

### 1. CORS Issues (Most Common)
**Symptoms:** Black screen, CORS errors in console
**Solution:** System automatically detects and falls back to PDF.js

### 2. PDF URL Not Accessible
**Symptoms:** Network errors, 403/404 responses
**Solution:** Check if signed URLs expired, verify server configuration

### 3. Empty/Corrupted PDF
**Symptoms:** PDF loads but shows blank content
**Solution:** Test with different PDF file, download and verify content

### 4. Browser PDF Plugin Issues
**Symptoms:** Black screen with direct loading only
**Solution:** Use "Try Different Viewer" to switch to PDF.js

### 5. Large File Loading Issues
**Symptoms:** Partial loading, timeout errors
**Solution:** Optimize PDF size, increase timeout limits

## 🚀 Automatic Fixes Implemented

### Black Screen Detection:
- Automatically detects when direct loading results in black screen
- Falls back to PDF.js viewer after 5 seconds
- Provides CORS error handling

### Smart Fallback Logic:
```
Direct Loading → (if black screen) → PDF.js Viewer → (if still fails) → Error message
```

### Enhanced Error Messages:
- Specific guidance for different error types
- Clear instructions for manual troubleshooting
- Debug information readily available

## 🧪 Testing Instructions

### Test 1: Check Current Behavior
1. Open application at http://localhost:5179
2. Upload/select a PDF file
3. Click Preview and enter password
4. Observe behavior and check console

### Test 2: Manual Method Testing
1. If you see black screen, click "Try Different Viewer"
2. Test each method: Direct → PDF.js → Google Docs
3. Note which method works (if any)

### Test 3: URL Accessibility Test
1. Click "Test PDF URL" button
2. See if PDF opens correctly in new tab
3. If it doesn't open, the issue is with URL generation/access

### Test 4: Debug Information
1. Click "Debug Info" button when black screen appears
2. Check console for detailed diagnostic information
3. Share this information for further troubleshooting

## ⚡ Quick Fixes to Try

### Fix 1: Force PDF.js Method
If direct loading consistently shows black screen:
```javascript
// In FilePreviewModal.tsx, modify getInitialMethod to return 'mozilla'
return 'mozilla' // This forces PDF.js viewer
```

### Fix 2: Check Server CORS Headers
Ensure your server includes proper CORS headers for PDF URLs:
```javascript
// In server response headers
'Access-Control-Allow-Origin': '*'
'Access-Control-Allow-Methods': 'GET'
```

### Fix 3: Verify PDF URL Generation
Check server logs to ensure PDF URLs are generated correctly and are accessible.

## 🎯 Expected Results After Debugging

### If PDF.js Works:
- Content should display properly
- Method indicator shows "PDF.js Viewer"
- No console errors

### If All Methods Fail:
- Check if PDF URL opens in new tab
- Verify PDF file isn't corrupted
- Check server-side URL generation

### If Only Google Docs Works:
- May indicate CORS issues with direct/PDF.js loading
- Server CORS configuration needs attention

## 📊 Next Steps

1. **Use the debugging features** to identify the specific cause
2. **Test PDF URL accessibility** with "Test PDF URL" button
3. **Check browser console** for specific error messages
4. **Try different viewer methods** to isolate the issue
5. **Share debug info** if you need further assistance

The enhanced debugging should help pinpoint exactly what's causing the black screen issue!
