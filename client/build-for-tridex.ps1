# PowerShell build script for tridex.app deployment with proper base path handling
Write-Host "🚀 Building Personal Vault for tridex.app deployment..." -ForegroundColor Green

# Set the environment for production
$env:NODE_ENV = "production"
$env:VITE_BASE_PATH = "/safee/"
$env:VITE_API_URL = "https://safee-y8iw.onrender.com"
$env:VITE_APP_NAME = "Personal Vault"

Write-Host "📦 Environment variables set:" -ForegroundColor Blue
Write-Host "  VITE_BASE_PATH: $env:VITE_BASE_PATH" -ForegroundColor Cyan
Write-Host "  VITE_API_URL: $env:VITE_API_URL" -ForegroundColor Cyan

# Clean previous build
Write-Host "🧹 Cleaning previous build..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}

# Build the application
Write-Host "🔨 Building application..." -ForegroundColor Blue
npm run build

# Check if build was successful
if ($LASTEXITCODE -eq 0) {
    # Replace the placeholder in index.html with actual base path
    Write-Host "🔧 Updating base path in index.html..." -ForegroundColor Blue
    
    $indexPath = "dist/index.html"
    if (Test-Path $indexPath) {
        $content = Get-Content $indexPath -Raw
        $content = $content -replace "%VITE_BASE_PATH%", $env:VITE_BASE_PATH
        $content = $content -replace 'href="/favicon.ico"', "href=`"$env:VITE_BASE_PATH`favicon.ico`""
        Set-Content $indexPath $content
        
        Write-Host "✅ Base path updated in index.html" -ForegroundColor Green
        Write-Host "✅ Build complete! Ready for deployment to tridex.app" -ForegroundColor Green
        Write-Host "📂 Files are in dist/ directory" -ForegroundColor Cyan
    } else {
        Write-Host "❌ dist/index.html not found" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}
