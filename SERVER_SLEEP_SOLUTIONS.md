# Server Sleep Prevention Solutions

## Problem
Free hosting services (Render, Heroku, etc.) put servers to sleep after 15-30 minutes of inactivity, causing 2-3 minute wake-up delays.

## Solutions

### 1. UptimeRobot (Recommended - Free)
1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Create free account
3. Add new monitor:
   - Monitor Type: HTTP(s)
   - URL: `https://your-app-name.onrender.com/api/health`
   - Monitoring interval: 5 minutes
   - Name: "Tridex Server Keep-Alive"

### 2. Local Keep-Alive Service
Run `keep-alive-service.js` on your local machine:
```bash
node keep-alive-service.js
```

### 3. GitHub Actions Keep-Alive (Advanced)
Create `.github/workflows/keep-alive.yml` for automated pings.

### 4. Render Upgrade
- Render paid plans don't sleep
- Starts at $7/month for "Starter" plan

## Quick Test
Check if server is awake:
```bash
curl https://your-app-name.onrender.com/api/health
```

## Implementation Priority
1. **UptimeRobot** (Setup once, works forever)
2. **Local keep-alive** (Immediate solution)
3. **Consider paid hosting** (Best long-term solution)