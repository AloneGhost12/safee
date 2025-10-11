# 📱 Mobile Email OTP Troubleshooting Guide

## Common Issues and Solutions for Mobile Email OTP

### 🔍 Quick Diagnostics

Run the diagnostic tool to identify issues:
```bash
node debug-mobile-otp-issues.js
```

### 🚨 Most Common Mobile OTP Issues

#### 1. **CORS (Cross-Origin Resource Sharing) Problems**
**Symptoms:** 
- OTP works in browser but fails in mobile app
- Console shows CORS errors
- Network requests blocked

**Solutions:**
- ✅ **Fixed:** Added mobile-specific CORS origins (capacitor://, ionic://, file://)
- ✅ **Fixed:** Allow requests without origin header (mobile apps)
- Check your mobile app's base URL configuration

#### 2. **Network Timeout Issues**
**Symptoms:**
- Requests timeout on mobile networks
- Works on WiFi but fails on cellular
- Slow response times

**Solutions:**
```javascript
// Increase timeout in mobile app
const apiCall = axios.post('/api/otp/send', data, {
  timeout: 15000 // 15 seconds for mobile networks
})

// Add retry logic
const retryRequest = async (fn, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === retries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}
```

#### 3. **Rate Limiting Too Aggressive**
**Symptoms:**
- First request works, subsequent fail with 429 errors
- "Too many requests" errors

**Solutions:**
- Wait 1-2 minutes between requests
- Implement exponential backoff in mobile app
- Check if multiple users share same IP (mobile networks)

#### 4. **Email Service Configuration**
**Symptoms:**
- Server responds 200 but no email received
- Email service errors in logs

**Solutions:**
- Verify SMTP credentials (Brevo configuration)
- Check spam/junk folders
- Test with different email providers

### 🔧 Environment Configuration

Ensure these environment variables are set:

```bash
# CORS Configuration for Mobile
ALLOWED_ORIGINS=http://localhost:5173,https://your-domain.com,capacitor://localhost,ionic://localhost

# Email Configuration
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password

# Rate Limiting (adjust for mobile)
OTP_RATE_LIMIT_MAX=5
OTP_RATE_LIMIT_WINDOW=15
```

### 📱 Mobile App Configuration

#### React Native / Expo
```javascript
// api.js
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:4004'  // Development
  : 'https://your-api.com'   // Production

// Configure axios for mobile
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  }
})

// Add request interceptor for debugging
api.interceptors.request.use(request => {
  console.log('📱 API Request:', request.method?.toUpperCase(), request.url)
  return request
})

// Add response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    console.log('❌ API Error:', error.response?.status, error.message)
    return Promise.reject(error)
  }
)
```

#### Ionic/Capacitor
```typescript
// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.yourapp.vault',
  appName: 'Vault',
  webDir: 'dist',
  server: {
    allowNavigation: [
      'https://your-api.com',
      'http://localhost:4004'  // Development only
    ]
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
}

export default config
```

### 🌐 Network Troubleshooting

#### Test Different Networks
1. **WiFi vs Cellular:** Test on both networks
2. **Corporate Networks:** May block external API calls
3. **VPN:** Try with/without VPN to rule out regional blocking

#### Check Firewall Issues
```bash
# Test API connectivity from mobile device browser
curl -X POST https://your-api.com/api/otp/send \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","purpose":"login"}'
```

### 🔍 Advanced Debugging

#### Server-Side Logging
Add this to your mobile requests:
```javascript
// Add debugging headers
const response = await api.post('/api/otp/send', {
  email: userEmail,
  purpose: 'login'
}, {
  headers: {
    'X-Device-Type': 'mobile',
    'X-Platform': Platform.OS, // iOS/Android
    'X-App-Version': '1.0.0'
  }
})
```

#### Client-Side Error Handling
```javascript
const sendOTP = async (email) => {
  try {
    const response = await api.post('/api/otp/send', {
      email,
      purpose: 'login'
    })
    
    console.log('✅ OTP sent successfully:', response.data)
    return { success: true, data: response.data }
    
  } catch (error) {
    console.error('❌ OTP send failed:', {
      status: error.response?.status,
      message: error.response?.data?.error || error.message,
      network: error.code,
      timeout: error.code === 'ECONNABORTED'
    })
    
    // Handle specific errors
    if (error.response?.status === 429) {
      return { 
        success: false, 
        error: 'Rate limited. Please wait before trying again.',
        retryAfter: 60 
      }
    }
    
    if (error.code === 'ECONNABORTED') {
      return { 
        success: false, 
        error: 'Request timeout. Check your internet connection.',
        retryable: true 
      }
    }
    
    return { 
      success: false, 
      error: error.response?.data?.error || 'Failed to send OTP'
    }
  }
}
```

### 🏥 Health Check Endpoints

Test these endpoints from your mobile app:

1. **Server Health:** `GET /api/health`
2. **OTP Config:** `GET /api/otp/config`
3. **Email Test:** `POST /api/otp/test-email` (development only)

### 📧 Email Provider Issues

#### Common Email Problems
- **Gmail:** Check spam folder, may delay delivery
- **Outlook/Hotmail:** Often blocks automated emails
- **Corporate Email:** May have strict security policies

#### Alternative Email Testing
```javascript
// Test with different email providers
const testEmails = [
  'test@gmail.com',
  'test@yahoo.com',
  'test@outlook.com'
]

for (const email of testEmails) {
  await sendOTP(email)
}
```

### 🚀 Production Checklist

Before deploying to mobile app stores:

- [ ] Test OTP on real devices (not simulators)
- [ ] Test on different networks (WiFi, 4G, 5G)
- [ ] Verify CORS configuration includes mobile origins
- [ ] Test email delivery with various providers
- [ ] Check rate limiting doesn't block legitimate users
- [ ] Implement proper error handling and retry logic
- [ ] Add offline detection and queue requests
- [ ] Test with slow network conditions

### 🆘 Emergency Fixes

If OTP is completely broken:

1. **Disable Rate Limiting Temporarily:**
   ```javascript
   // In OTP middleware
   if (process.env.EMERGENCY_MODE === 'true') {
     return next() // Skip rate limiting
   }
   ```

2. **Enable Debug Mode:**
   ```bash
   NODE_ENV=development
   DEBUG_OTP=true
   ```

3. **Fallback Authentication:**
   - Allow manual code entry
   - Implement alternative verification methods
   - Provide customer support option

### 📞 Support Information

If issues persist:
1. Run diagnostic tool: `node debug-mobile-otp-issues.js`
2. Check server logs for errors
3. Test with different mobile devices/networks
4. Contact email service provider (Brevo) support
5. Verify DNS and network connectivity

### 🔄 Regular Maintenance

- Monitor OTP delivery rates
- Check email service quotas
- Update CORS origins as needed
- Review rate limiting effectiveness
- Test with new mobile OS versions