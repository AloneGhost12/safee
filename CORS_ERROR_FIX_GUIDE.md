# CORS Error Fix Guide

## Problem
Your client at `https://tridex.app` is being blocked by CORS policy when trying to access your API at `https://safee-y8iw.onrender.com`.

## Root Cause
The `ALLOWED_ORIGINS` environment variable on your Render deployment is missing `https://tridex.app`.

## Solutions (Pick One)

### Solution 1: Update Render Environment Variables (Recommended)

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Find your service**: `vault-api` or similar
3. **Navigate to**: Environment tab
4. **Update the `ALLOWED_ORIGINS` variable to**:
   ```
   https://aloneghost12.github.io,https://aloneghost12.netlify.app,https://tridex.app
   ```
5. **Save and redeploy** the service
6. **Wait 2-3 minutes** for changes to take effect

### Solution 2: Force Redeploy with Current Config

If your render.yaml already has the correct configuration:

1. **Go to your Render service dashboard**
2. **Click "Manual Deploy"** 
3. **Deploy latest commit**
4. **Wait for deployment to complete**

### Solution 3: Emergency Code Fix (Temporary)

I've already applied an emergency CORS fix to your code. To deploy it:

```powershell
cd "C:\Users\ADHARSH NP\OneDrive\Pictures\New folder\vault\server"
npm run build
```

Then push to your repository to trigger Render deployment.

## Verification

After applying any solution, test with:

```powershell
cd "C:\Users\ADHARSH NP\OneDrive\Pictures\New folder\vault"
node scripts/verify-cors-config.js
```

You should see:
```
✅ CORS allowed
```
for all origins including `https://tridex.app`.

## Expected Results

After the fix:
- ✅ `https://tridex.app` → API requests work
- ✅ `https://aloneghost12.netlify.app` → API requests work  
- ✅ `https://aloneghost12.github.io` → API requests work

## Additional Notes

- The issue is server-side only - no client changes needed
- CORS is a browser security feature, not an API limitation
- The error occurs during the preflight OPTIONS request
- Environment variable changes require service restart/redeploy

## Troubleshooting

If issues persist:

1. **Check Render Logs**: Look for CORS-related errors
2. **Verify Environment**: Ensure `ALLOWED_ORIGINS` is set correctly
3. **Clear Browser Cache**: Hard refresh your client application
4. **Check Network Tab**: Verify the OPTIONS request is being sent

## Clean up (After Fix)

Once the main fix is deployed, you can remove the emergency CORS middleware:

1. Remove `emergencyCORSFix()` from `server/src/index.ts`
2. Delete `server/src/middleware/emergencyCORS.ts`
3. Redeploy

This ensures your CORS configuration remains clean and maintainable.
