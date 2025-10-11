# 📧 Production Email Configuration Guide - SMTP Timeout Fix

## 🚨 Issue: SMTP Connection Timeouts in Production

### **Problem Symptoms:**
- `Connection timeout` errors
- `ETIMEDOUT` errors
- Email service fails to initialize
- OTP emails not being sent

### **Root Causes:**
1. **Firewall restrictions** on hosting platforms
2. **Port blocking** by cloud providers  
3. **Network latency** in production environment
4. **Aggressive timeout settings** for production networks

## ✅ **Fixes Implemented**

### 1. **Production-Optimized SMTP Configuration**
```javascript
// Updated email service with:
- Longer timeouts for production (30-45 seconds)
- Alternative port fallback (587, 25, 2525)
- Lazy connection verification
- Automatic retry mechanism
- Better error handling
```

### 2. **Environment-Specific Settings**
```bash
# Production Environment Variables
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587                    # Primary: 587, Fallback: 25, 2525
SMTP_SECURE=false               # Use STARTTLS instead of SSL for port 587
SMTP_USER=your-brevo-user
SMTP_PASS=your-brevo-password

# For better production stability
NODE_ENV=production
```

### 3. **Render.com Specific Configuration**
```bash
# Render environment variables
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=93c1d4002@smtp-brevo.com
SMTP_PASS=byQ4dHOJkNEaMGYh
```

## 🔧 **Alternative SMTP Providers** (if Brevo fails)

### **Option 1: SendGrid**
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

### **Option 2: Mailgun**
```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-mailgun-user
SMTP_PASS=your-mailgun-password
```

### **Option 3: AWS SES**
```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-aws-access-key
SMTP_PASS=your-aws-secret-key
```

## 🛠️ **Immediate Fix Steps**

### **Step 1: Update Environment Variables**
In your deployment platform (Render, Vercel, etc.):
```bash
SMTP_PORT=587
SMTP_SECURE=false
```

### **Step 2: Test Email Service**
```bash
# Test endpoint (if available)
curl -X POST https://your-api.com/api/otp/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@gmail.com"}'
```

### **Step 3: Check Server Logs**
Look for these log messages:
- `📧 Email service initialized (connection will be verified on first use)`
- `🔍 Verifying SMTP connection before sending email...`
- `🔄 Retrying SMTP connection (attempt X/3)...`
- `🔧 Trying port 587, secure: false`

## 🚨 **Emergency Workarounds**

### **1. Disable Email Verification Temporarily**
```javascript
// In production, skip email verification for critical flows
if (process.env.EMERGENCY_MODE === 'true') {
  // Allow login without email OTP
  // Add manual verification later
}
```

### **2. Use Alternative Email Service**
```javascript
// Quick switch to different provider
const emailService = process.env.USE_SENDGRID === 'true' 
  ? new SendGridEmailService() 
  : new BrevoEmailService()
```

### **3. Fallback to API-based Email**
```javascript
// Use HTTP API instead of SMTP
const sendViaAPI = async (email, template) => {
  return fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY
    },
    body: JSON.stringify({
      sender: { email: 'security@tridex.app' },
      to: [{ email }],
      templateId: template
    })
  })
}
```

## 📊 **Production Monitoring**

### **Key Metrics to Track:**
- Email delivery success rate
- SMTP connection attempts
- Timeout frequency
- Port fallback usage

### **Alerts to Set Up:**
- Email service connection failures
- High timeout rates (>10%)
- Failed OTP delivery
- SMTP authentication errors

## 🔍 **Debugging Commands**

### **Test SMTP Connection:**
```bash
# Test different ports
telnet smtp-relay.brevo.com 587
telnet smtp-relay.brevo.com 25
telnet smtp-relay.brevo.com 2525
```

### **Check Network Connectivity:**
```bash
# From your server
curl -v telnet://smtp-relay.brevo.com:587
```

### **Verify DNS Resolution:**
```bash
nslookup smtp-relay.brevo.com
```

## 🆘 **Support Contacts**

### **Brevo Support:**
- Email: support@brevo.com
- Documentation: https://developers.brevo.com/

### **Hosting Platform Support:**
- **Render:** help@render.com
- **Vercel:** support@vercel.com
- **Railway:** team@railway.app

## 📋 **Deployment Checklist**

Before deploying:
- [ ] Set correct SMTP environment variables
- [ ] Test email service in staging
- [ ] Verify firewall/port access
- [ ] Set up monitoring/alerts
- [ ] Prepare fallback email service
- [ ] Document recovery procedures

## 🔄 **Next Steps**

1. **Deploy the updated email service code**
2. **Update environment variables** to use port 587
3. **Monitor logs** for connection success
4. **Test OTP functionality** with real emails
5. **Set up alerts** for email failures

The updated code handles production SMTP timeouts gracefully and provides automatic fallback options. Your email OTP should work reliably now! 🚀