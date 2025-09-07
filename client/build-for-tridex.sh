#!/bi# Set the environment for production
export NODE_ENV="production"
export VITE_BASE_PATH="/"
export VITE_API_URL="https://safee-y8iw.onrender.com"
export VITE_APP_NAME="Personal Vault"h

# Build script for tridex.app deployment with proper base path handling
echo "🚀 Building Personal Vault for tridex.app deployment..."

# Set the environment for production
export NODE_ENV=production
export VITE_BASE_PATH=/safee/
export VITE_API_URL=https://safee-y8iw.onrender.com
export VITE_APP_NAME="Personal Vault"

echo "📦 Environment variables set:"
echo "  VITE_BASE_PATH: $VITE_BASE_PATH"
echo "  VITE_API_URL: $VITE_API_URL"

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist

# Build the application
echo "🔨 Building application..."
npm run build

# Replace the placeholder in index.html with actual base path
echo "🔧 Updating base path in index.html..."
if [ -f "dist/index.html" ]; then
    sed -i "s|%VITE_BASE_PATH%|$VITE_BASE_PATH|g" dist/index.html
    echo "✅ Base path updated in index.html"
else
    echo "❌ dist/index.html not found"
    exit 1
fi

# Update favicon path if needed
echo "🎨 Updating favicon path..."
sed -i "s|href=\"/favicon.ico\"|href=\"${VITE_BASE_PATH}favicon.ico\"|g" dist/index.html

# Create .htaccess for Apache server (tridex.app)
echo "🔧 Creating .htaccess for Apache server..."
cat > dist/.htaccess << 'EOF'
RewriteEngine On
RewriteBase /safee/

# Handle client-side routing for SPA
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . index.html [L]

# Proper MIME types
<IfModule mod_mime.c>
    AddType application/javascript .js
    AddType text/css .css
    AddType application/json .json
</IfModule>

# Cache control for assets
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>

# Security headers
<IfModule mod_headers.c>
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"
</IfModule>
EOF

echo "✅ .htaccess created for Apache server"
echo "✅ Build complete! Ready for deployment to tridex.app"
echo "📂 Upload ALL contents of dist/ directory to tridex.app/safee/"
echo "🔑 IMPORTANT: Ensure .htaccess file is uploaded and Apache mod_rewrite is enabled"
