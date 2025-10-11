# Email OTP System Configuration Guide

## Overview
The Email OTP (One-Time Password) system provides secure email-based authentication for your Vault application. It uses the Brevo SMTP service for reliable email delivery.

## Environment Variables

Add these variables to your server's `.env` file:

```env
# Brevo SMTP Configuration
BREVO_SMTP_HOST=smtp-relay.brevo.com
BREVO_SMTP_PORT=587
BREVO_SMTP_USER=your-brevo-smtp-user@smtp-brevo.com
BREVO_SMTP_PASS=your-brevo-api-key-here
BREVO_SMTP_FROM=noreply@your-domain.com

# Optional: OTP Configuration (defaults shown)
OTP_LENGTH=6
OTP_EXPIRATION_MINUTES=10
OTP_MAX_ATTEMPTS=5
OTP_RATE_LIMIT_WINDOW_MINUTES=15
OTP_RATE_LIMIT_MAX_REQUESTS=3
```

## API Endpoints

### Send OTP
```
POST /api/otp/send
Content-Type: application/json

{
  "email": "user@example.com",
  "purpose": "email_verification"
}
```

**Supported Purposes:**
- `login` - User login verification
- `registration` - New user email verification
- `password_reset` - Password reset verification
- `email_verification` - General email verification
- `account_recovery` - Account recovery verification

### Verify OTP
```
POST /api/otp/verify
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456",
  "purpose": "email_verification"
}
```

### Resend OTP
```
POST /api/otp/resend
Content-Type: application/json

{
  "email": "user@example.com",
  "purpose": "email_verification"
}
```

### Check OTP Status
```
GET /api/otp/status?email=user@example.com&purpose=email_verification
```

### Get OTP Configuration
```
GET /api/otp/config
```

### Clear OTP Verification (Session)
```
POST /api/otp/clear
Content-Type: application/json

{
  "email": "user@example.com",
  "purpose": "email_verification"
}
```

### Test Email Service (Development Only)
```
POST /api/otp/test-email
Content-Type: application/json

{
  "email": "test@example.com"
}
```

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "email": "user@example.com",
  "purpose": "email_verification",
  "expiresIn": "10 minutes"
}
```

### Error Response
```json
{
  "error": "Rate limit exceeded. Please wait before requesting again.",
  "remainingAttempts": 0,
  "resetTime": "2024-01-01T12:30:00.000Z"
}
```

### Verification Success Response
```json
{
  "success": true,
  "verified": true,
  "email": "user@example.com",
  "purpose": "email_verification"
}
```

## Rate Limiting

The OTP system includes comprehensive rate limiting:

- **Send OTP:** 3 requests per 15 minutes per email/IP combination
- **Verify OTP:** 5 attempts per OTP code
- **Resend OTP:** Additional rate limiting on top of send limits

## Security Features

1. **Audit Logging:** All OTP operations are logged for security monitoring
2. **IP Tracking:** Rate limiting and abuse prevention by IP address
3. **Session Integration:** OTP verification status stored in user session
4. **Secure Headers:** Security headers applied to all OTP routes
5. **Input Validation:** Comprehensive validation of all inputs
6. **Error Handling:** Secure error messages that don't leak information

## Integration Example

### Frontend Integration (React/TypeScript)
```typescript
// Send OTP
const sendOTP = async (email: string, purpose: string) => {
  const response = await fetch('/api/otp/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, purpose }),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to send OTP')
  }
  
  return response.json()
}

// Verify OTP
const verifyOTP = async (email: string, code: string, purpose: string) => {
  const response = await fetch('/api/otp/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, code, purpose }),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to verify OTP')
  }
  
  return response.json()
}

// Check verification status
const checkOTPStatus = async (email: string, purpose: string) => {
  const response = await fetch(
    `/api/otp/status?email=${encodeURIComponent(email)}&purpose=${encodeURIComponent(purpose)}`
  )
  
  if (!response.ok) {
    throw new Error('Failed to check OTP status')
  }
  
  return response.json()
}
```

## Testing

Run the test script to verify your setup:

```bash
cd server
npm run ts-node test/email-otp-test.ts
```

Or test individual endpoints with curl:

```bash
# Send OTP
curl -X POST http://localhost:3001/api/otp/send \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","purpose":"email_verification"}'

# Verify OTP (replace 123456 with actual code from email)
curl -X POST http://localhost:3001/api/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","code":"123456","purpose":"email_verification"}'
```

## Troubleshooting

### Common Issues

1. **Email not sending:**
   - Check Brevo SMTP credentials in `.env`
   - Verify network connectivity to smtp-relay.brevo.com:587
   - Check server logs for SMTP errors

2. **Rate limiting errors:**
   - Wait for the rate limit window to reset
   - Check IP address and email combinations
   - Review rate limit configuration

3. **OTP verification failing:**
   - Ensure OTP hasn't expired (10 minutes default)
   - Check for typos in email or code
   - Verify purpose parameter matches

4. **Database errors:**
   - Confirm MongoDB connection is working
   - Check database permissions
   - Verify collections are created properly

### Monitoring

Monitor these log types for system health:
- `otp_generated` - OTP creation events
- `otp_email_sent` - Email delivery confirmations
- `otp_verified` - Successful verifications
- `otp_rate_limited` - Rate limiting events
- `otp_failed_verification` - Failed verification attempts

## Security Considerations

1. **Production Setup:**
   - Use environment variables for all sensitive configuration
   - Enable HTTPS for all API calls
   - Configure proper CORS policies
   - Monitor rate limiting logs for abuse

2. **Email Security:**
   - Use a dedicated email service (Brevo recommended)
   - Implement SPF, DKIM, and DMARC records
   - Use professional "from" addresses

3. **Session Management:**
   - OTP verification status is session-based
   - Clear sessions appropriately
   - Implement session timeouts

## Next Steps

1. Configure your production email domain with Brevo
2. Set up monitoring and alerting for OTP failures
3. Integrate OTP verification into your authentication flow
4. Test the complete user journey
5. Document the OTP flow for your users
