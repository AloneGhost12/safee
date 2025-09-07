# 2FA Troubleshooting Guide

## Current Issue: 2FA Not Working 🔐

Based on your earlier console logs showing rate limiting errors, here are the most likely causes and solutions:

## 🚨 Most Likely Causes

### 1. Rate Limiting (Most Likely)
**Problem**: Too many failed authentication attempts (429 errors)
**Solution**: **Wait 15 minutes** before trying 2FA operations

### 2. Invalid 6-Digit Codes
**Problem**: Codes from authenticator app not being accepted
**Common Causes**:
- Phone time not synchronized
- Using expired codes (30-second window)
- Typing errors in 6-digit code

### 3. Authentication Token Issues
**Problem**: Session expired or invalid
**Solution**: Log out and log back in

## 🔧 Step-by-Step Troubleshooting

### Step 1: Check Rate Limiting Status
**Wait 15 minutes** if you've seen 429 errors recently, then:

1. Go to your app at `https://tridex.app`
2. Open browser console (F12)
3. Run the debug script to check status

### Step 2: Verify Your Setup Process
**For Enabling 2FA**:

1. **Go to Settings** → Security tab
2. **Click "Enable 2FA"** 
3. **Wait for QR code** to appear
4. **Scan QR code** with authenticator app:
   - Google Authenticator ✅
   - Microsoft Authenticator ✅
   - Authy ✅
   - 1Password ✅
5. **Enter 6-digit code** from app immediately
6. **Click "Verify and Enable 2FA"**

### Step 3: Check Time Synchronization
**Critical for 2FA codes**:

1. **Check phone time**: Settings → Date & Time → Automatic
2. **Sync authenticator app**: Many apps have time sync options
3. **Use fresh codes**: Don't reuse codes, wait for new ones

### Step 4: Test with Debug Script
Run this in browser console on your app:

```javascript
// Copy and paste the debug script from debug-2fa-issues.js
// This will test all 2FA endpoints and show detailed error info
```

## 🛠️ Common Solutions

### Solution 1: Clear Rate Limiting
```javascript
// Run in browser console after waiting 15 minutes
localStorage.clear()
sessionStorage.clear()
location.reload()
```

### Solution 2: Resync Time (Android)
1. Open Google Authenticator
2. Tap three dots (⋮) → Settings
3. Tap "Time correction for codes"
4. Tap "Sync now"

### Solution 3: Resync Time (iPhone)
1. Settings → General → Date & Time
2. Enable "Set Automatically"
3. Wait a few seconds, then try new codes

### Solution 4: Re-setup 2FA
If codes still don't work:

1. **Disable 2FA** (if currently enabled)
2. **Wait 2 minutes**
3. **Re-enable 2FA** with fresh QR code
4. **Scan new QR code** in authenticator app
5. **Test with fresh code**

## 🔍 Debug Information Needed

If the issue persists, run this in browser console and share the output:

```javascript
// Basic status check
const user = JSON.parse(localStorage.getItem('user') || '{}')
console.log('User 2FA status:', user.twoFactorEnabled)

// Test API connectivity
fetch('/api/health', {
  headers: { 'Authorization': `Bearer ${user.token}` }
}).then(r => console.log('API Status:', r.status))
```

## 📱 Authenticator App Recommendations

### Best Apps for Your Setup:
1. **Google Authenticator** (Simple, reliable)
2. **Microsoft Authenticator** (Backup/sync features)
3. **Authy** (Multi-device sync)
4. **1Password** (If you use 1Password)

### App-Specific Issues:
- **Google Authenticator**: No backup - must re-scan if phone lost
- **Microsoft Authenticator**: May need Microsoft account
- **Authy**: Requires phone number verification
- **1Password**: Requires 1Password subscription

## 🚫 What NOT to Do

❌ **Don't repeatedly try failed codes** (causes rate limiting)  
❌ **Don't use screenshots of QR codes** (security risk)  
❌ **Don't share backup codes** (keep them secret)  
❌ **Don't ignore time sync warnings**  

## ✅ Expected Working Flow

### Enabling 2FA:
1. Click "Enable 2FA" → ⏳ Loading...
2. QR code appears → 📱 Scan with app
3. App shows 6-digit code → 🔢 Enter code
4. Success message → 🎉 2FA enabled
5. Backup codes displayed → 💾 Save securely

### Using 2FA (Login):
1. Enter email/password → 🔐 Login attempt
2. 2FA required prompt → 📱 Open authenticator app
3. Enter fresh 6-digit code → ✅ Access granted

## 🆘 Emergency Access

If you're locked out:
1. **Use backup codes** (if you saved them)
2. **Account recovery** (if setup)
3. **Contact support** with account verification

## Next Steps

1. **Wait 15 minutes** (if rate limited)
2. **Check phone time sync**
3. **Try fresh 2FA setup**
4. **Run debug script** for detailed diagnostics

The 2FA implementation looks correct in the code - the issue is likely environmental (rate limiting, time sync, or expired sessions).
