#!/bin/bash

echo "🔧 Starting Render build process..."

# Install all dependencies (including dev dependencies for TypeScript)
echo "📦 Installing dependencies..."
npm install

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist

# Build with TypeScript
echo "🏗️  Building TypeScript..."
npx tsc --skipLibCheck true --noEmit false --declaration false

# Check if build succeeded
if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully!"
    echo "📂 Listing build output:"
    ls -la dist/
else
    echo "❌ TypeScript build failed"
    exit 1
fi

echo "🎉 Build process complete!"
