# Production Build Script for Render.com deployment
Write-Host "🚀 Building Personal Vault for Render.com production..." -ForegroundColor Green

# Set the environment for production deployment to Render.com
$env:NODE_ENV = "production"
$env:VITE_BASE_PATH = "/"
$env:VITE_API_URL = "https://safee-y8iw.onrender.com"
$env:VITE_APP_NAME = "Personal Vault"

Write-Host "Environment variables set for production:" -ForegroundColor Blue
Write-Host "  NODE_ENV: $env:NODE_ENV" -ForegroundColor Cyan
Write-Host "  VITE_BASE_PATH: $env:VITE_BASE_PATH" -ForegroundColor Cyan
Write-Host "  VITE_API_URL: $env:VITE_API_URL" -ForegroundColor Cyan
Write-Host "  VITE_APP_NAME: $env:VITE_APP_NAME" -ForegroundColor Cyan

# Clean previous build completely
Write-Host "🧹 Cleaning previous build..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "Previous dist directory removed" -ForegroundColor Green
}

# Clean node_modules/.vite cache
if (Test-Path "node_modules/.vite") {
    Remove-Item -Recurse -Force "node_modules/.vite"
    Write-Host "Vite cache cleared" -ForegroundColor Green
}

# Build the application
Write-Host "🔨 Building application..." -ForegroundColor Blue
npm run build

# Check if build was successful
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build successful!" -ForegroundColor Green
    
    # Verify the build output
    $indexPath = "dist/index.html"
    if (Test-Path $indexPath) {
        $content = Get-Content $indexPath -Raw
        
        # Check if the correct API URL is in the build
        if ($content -match "safee-y8iw.onrender.com") {
            Write-Host "✅ Correct API URL found in build" -ForegroundColor Green
        } else {
            Write-Host "⚠️ API URL might not be correctly set in build" -ForegroundColor Yellow
        }
        
        Write-Host "📊 Build Statistics:" -ForegroundColor Blue
        $distFiles = Get-ChildItem -Path "dist" -Recurse -File
        $totalSize = ($distFiles | Measure-Object -Property Length -Sum).Sum
        $totalSizeMB = [math]::Round($totalSize / 1MB, 2)
        
        Write-Host "  Total files: $($distFiles.Count)" -ForegroundColor Cyan
        Write-Host "  Total size: $totalSizeMB MB" -ForegroundColor Cyan
        
        # List main files
        Write-Host "📂 Main build files:" -ForegroundColor Blue
        Get-ChildItem -Path "dist" -File | ForEach-Object {
            $sizeMB = [math]::Round($_.Length / 1MB, 2)
            Write-Host "  $($_.Name) ($sizeMB MB)" -ForegroundColor Cyan
        }
        
        Write-Host "`n🎯 Build ready for Render.com deployment!" -ForegroundColor Green
        Write-Host "💡 The dist/ directory contains the production build" -ForegroundColor Cyan
        Write-Host "🚀 Render.com will automatically deploy from the repository" -ForegroundColor Cyan
        
    } else {
        Write-Host "❌ dist/index.html not found - build may have failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Build failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    exit 1
}

# Additional verification - check for any hardcoded wrong URLs
Write-Host "`n🔍 Checking for potential issues..." -ForegroundColor Blue

$jsFiles = Get-ChildItem -Path "dist/assets" -Filter "*.js" -File 2>$null
if ($jsFiles) {
    foreach ($file in $jsFiles) {
        $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
        if ($content -and $content -match "tridex\.app") {
            Write-Host "⚠️ Found potential hardcoded URL in $($file.Name)" -ForegroundColor Yellow
        }
    }
}

Write-Host "✅ Production build complete and verified!" -ForegroundColor Green