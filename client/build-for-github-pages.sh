#!/bin/bash
# Bash build script for GitHub Pages deployment

echo "🚀 Building Personal Vault for GitHub Pages (tridex.app)..."

# Set the environment for production
export NODE_ENV="production"
export VITE_BASE_PATH="/safee/"
export VITE_API_URL="https://safee-y8iw.onrender.com"
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

# Check if build was successful
if [ $? -eq 0 ]; then
    # Replace the placeholder in index.html with actual base path
    echo "🔧 Updating base path in index.html..."
    
    if [ -f "dist/index.html" ]; then
        sed -i "s|%VITE_BASE_PATH%|$VITE_BASE_PATH|g" dist/index.html
        sed -i "s|href=\"/favicon.ico\"|href=\"${VITE_BASE_PATH}favicon.ico\"|g" dist/index.html
        
        echo "✅ Base path updated in index.html"
        
        # GitHub Pages uses 404.html for SPA routing (already configured)
        echo "ℹ️ GitHub Pages will use 404.html for SPA routing"
        
        echo "✅ Build complete! Ready for GitHub Pages deployment"
        echo "📂 Upload ALL contents of dist/ directory to tridex.app repository /safee/ folder"
        echo "🔑 IMPORTANT: Files must be committed to the GitHub repository, not just uploaded to a server"
        echo "💡 Contact the repository owner to add these files to the main branch"
    else
        echo "❌ dist/index.html not found"
        exit 1
    fi
else
    echo "❌ Build failed"
    exit 1
fi
