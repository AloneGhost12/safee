#!/bin/bash

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

echo "✅ Build complete! Ready for deployment to tridex.app"
echo "📂 Files are in dist/ directory"
