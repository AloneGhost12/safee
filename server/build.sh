#!/bin/bash

echo "🔧 Starting Render build process..."

# Clean any potential conflicting files
echo "🧹 Cleaning any conflicting files..."
rm -rf node_modules/.package-lock.json
rm -rf node_modules/.cache

# Install dependencies if not already installed by Render
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
    echo "📦 Installing dependencies..."
    npm install --production=false
fi

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist

# Build with TypeScript
echo "🏗️  Building TypeScript..."
npx tsc --skipLibCheck true --noEmit false --noImplicitAny false

# Check if build succeeded
if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully!"
    echo "📂 Listing build output:"
    ls -la dist/ 2>/dev/null || echo "No dist directory found"
else
    echo "❌ TypeScript build failed"
    exit 1
fi

echo "🎉 Build process complete!"
