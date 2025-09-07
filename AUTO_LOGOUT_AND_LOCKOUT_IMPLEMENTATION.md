# 🛡️ Auto-Logout and Account Lockout Implementation

## Overview

This document describes the implementation of two critical security features:

1. **Auto-logout after 10 minutes of inactivity**
2. **Account lockout after 5 incorrect password attempts with 10-minute cooldown**

## Features Implemented

### 1. Auto-Logout Feature

#### How it Works
- Tracks user activity (mouse movements, clicks, keyboard input, scrolling)
- Automatically logs out users after **10 minutes** of inactivity
- Shows a warning dialog **1 minute** before logout
- Users can extend their session by clicking "Stay Logged In"

#### Implementation Details

**Client-Side Service (`InactivityDetector`)**
- Located: `client/src/services/inactivityDetector.ts`
- Monitors multiple activity events: `mousedown`, `mousemove`, `keypress`, `scroll`, `touchstart`, `click`
- Configurable timeout duration (set to 10 minutes)
- Throttled activity detection to prevent excessive timer resets
- Singleton pattern for app-wide usage

**App Context Integration**
- Located: `client/src/context/AppContext.tsx`
- Automatically starts inactivity detection when user logs in
- Stops detection when user logs out
- Manages warning state and countdown timer

**Warning Component**
- Located: `client/src/components/InactivityWarning.tsx`
- Modal dialog showing countdown timer
- "Stay Logged In" button to reset timer
- "Logout Now" button for immediate logout

#### User Experience
1. User logs in and navigates to protected pages
2. Inactivity timer starts automatically
3. After 9 minutes of inactivity, warning dialog appears
4. Countdown shows remaining time (1 minute)
5. User can choose to stay logged in or logout
6. If no action taken, automatic logout occurs after 10 minutes

### 2. Account Lockout Feature

#### How it Works
- Tracks failed login attempts per user account
- Locks account after **5 consecutive failed attempts**
- Lockout duration: **10 minutes**
- Shows countdown timer on login page during lockout
- Prevents all login attempts (even with correct password) during lockout

#### Implementation Details

**Backend Security Manager**
- Located: `server/src/utils/security.ts`
- Tracks failed attempts in user document
- Automatic account locking after 5 failed attempts
- Auto-unlock after 10-minute timeout
- Security event logging for audit trail

**Database Fields Added**
- `failedLoginAttempts`: Number of consecutive failed attempts
- `accountLocked`: Boolean flag for lock status
- `accountLockedUntil`: Timestamp when lock expires
- `accountLockedReason`: Reason for lockout

**API Response Enhancement**
- HTTP 423 status for locked accounts
- `retryAfter` field with remaining seconds
- `lockoutExpiresAt` timestamp for client reference

**Client-Side Lockout Display**
- Located: `client/src/components/AccountLockoutWarning.tsx`
- Real-time countdown timer
- Security tips for users
- Automatic re-enabling of login form after cooldown

#### User Experience
1. User enters incorrect password
2. System tracks failed attempts
3. After 5 failed attempts, account is locked
4. Login page shows lockout warning with countdown
5. Login form is disabled during lockout
6. After 10 minutes, lockout automatically expires
7. User can attempt login again

## Security Benefits

### Auto-Logout
- **Prevents unauthorized access** to unattended devices
- **Reduces session hijacking risk** by limiting session duration
- **Protects sensitive data** when users forget to logout
- **Complies with security standards** requiring session timeouts

### Account Lockout
- **Prevents brute force attacks** by limiting login attempts
- **Reduces password guessing attacks** with temporary lockouts
- **Provides user feedback** about security events
- **Logs security events** for monitoring and analysis

## Configuration

### Auto-Logout Settings
```typescript
// In InactivityDetector configuration
{
  timeoutMinutes: 10,                    // 10 minutes of inactivity
  warningBeforeTimeoutSeconds: 60,       // 1 minute warning
  activityEvents: ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
}
```

### Account Lockout Settings
```typescript
// In SecurityManager class
private static readonly MAX_FAILED_ATTEMPTS = 5      // 5 failed attempts trigger lockout
private static readonly LOCKOUT_DURATION_MINUTES = 10 // 10 minute lockout duration
```

## Testing

### Manual Testing

#### Auto-Logout Test
1. Log in to the application
2. Navigate to `/vault` or any protected page
3. Wait 9 minutes without any activity
4. Warning dialog should appear with 1-minute countdown
5. Test "Stay Logged In" button to reset timer
6. Test automatic logout after countdown expires

#### Account Lockout Test
1. Navigate to login page
2. Enter a valid email/username with incorrect password
3. Repeat 5 times to trigger account lockout
4. Verify lockout warning appears with countdown
5. Verify login form is disabled
6. Wait 10 minutes for automatic unlock
7. Verify ability to login again

### Automated Testing

Use the provided test script:
```javascript
// In browser console on login page
// Copy and paste the content of test-auto-logout-lockout.js
```

The test script will:
- Create test user accounts
- Simulate failed login attempts
- Verify lockout triggers correctly
- Test lockout duration and recovery

## Files Modified/Created

### New Files
- `client/src/services/inactivityDetector.ts` - Inactivity detection service
- `client/src/components/InactivityWarning.tsx` - Auto-logout warning dialog
- `client/src/components/AccountLockoutWarning.tsx` - Account lockout display
- `test-auto-logout-lockout.js` - Browser-based test script

### Modified Files
- `server/src/utils/security.ts` - Updated lockout duration to 10 minutes
- `server/src/routes/auth.ts` - Enhanced lockout response with timing info
- `client/src/context/AppContext.tsx` - Integrated inactivity detection
- `client/src/components/SharedLayout.tsx` - Added warning component
- `client/src/pages/LoginPage.tsx` - Added lockout display and handling

## Security Considerations

### Auto-Logout
- Timer resets on any user activity to prevent false logouts
- Warning provides 1-minute grace period for user response
- Secure cleanup of sensitive data on logout
- No sensitive data stored in browser after logout

### Account Lockout
- Lockout applies to the user account, not IP address
- Even correct passwords are rejected during lockout
- Lockout duration is reasonable (10 minutes) to prevent DoS
- Security events are logged for audit purposes
- Automatic unlock prevents permanent lockouts

## Monitoring and Maintenance

### Logs to Monitor
- Failed login attempts leading to lockouts
- Auto-logout events from inactivity
- Security events in user audit trail
- Unusual activity patterns

### Metrics to Track
- Average session duration before auto-logout
- Frequency of account lockouts
- False positive lockouts (user error vs. attacks)
- User satisfaction with timeout durations

## Future Enhancements

### Potential Improvements
1. **Configurable timeouts** - Allow users to set preferred timeout durations
2. **Activity-based timeouts** - Different timeouts for different activities
3. **Progressive lockout** - Increasing lockout duration for repeated offenses
4. **IP-based lockout** - Additional protection against distributed attacks
5. **Device trust** - Longer timeouts for trusted devices
6. **Notification system** - Email alerts for account lockouts

### Admin Features
1. **Lockout management** - Admin ability to unlock accounts manually
2. **Timeout configuration** - Admin control over timeout settings
3. **Security dashboard** - Real-time monitoring of security events
4. **User activity logs** - Detailed session and activity tracking

## Conclusion

The implemented auto-logout and account lockout features significantly enhance the security posture of the application by:

- Protecting against unauthorized access to unattended sessions
- Preventing brute force password attacks
- Providing user-friendly security measures with clear feedback
- Maintaining security without severely impacting user experience

Both features are production-ready and follow security best practices while maintaining usability and providing clear user feedback throughout the security processes.
