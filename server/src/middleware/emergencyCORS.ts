/**
 * Emergency CORS fix - adds additional middleware to handle CORS for specific origins
 * This is a temporary workaround until the main CORS configuration is updated
 */

export function emergencyCORSFix() {
  return (req: any, res: any, next: any) => {
    const origin = req.headers.origin;
    const allowedEmergencyOrigins = [
      'https://tridex.app',
      'https://aloneghost12.netlify.app',
      'https://aloneghost12.github.io'
    ];

    // Check if this is an emergency origin that needs special handling
    if (origin && allowedEmergencyOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control,X-API-Version');
      res.setHeader('Access-Control-Expose-Headers', 'X-RateLimit-Limit,X-RateLimit-Remaining,X-RateLimit-Reset,Retry-After');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    next();
  };
}

// Alternative: Update the existing CORS middleware directly
export function updateCORSMiddleware() {
  console.log('⚠️  Applying emergency CORS fix for additional origins');
  console.log('🔧 Update your ALLOWED_ORIGINS environment variable and redeploy for permanent fix');
}
