# PowerShell build script for tridex.app deployment with proper base path handling
Write-Host "Building Personal Vault for tridex.app deployment..." -ForegroundColor Green

# Set the environment for production
$env:NODE_ENV = "production"
$env:VITE_BASE_PATH = "/"
$env:VITE_API_URL = "https://safee-y8iw.onrender.com"
$env:VITE_APP_NAME = "Personal Vault"

Write-Host "Environment variables set:" -ForegroundColor Blue
Write-Host "  VITE_BASE_PATH: $env:VITE_BASE_PATH" -ForegroundColor Cyan
Write-Host "  VITE_API_URL: $env:VITE_API_URL" -ForegroundColor Cyan

# Clean previous build
Write-Host "Cleaning previous build..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}

# Build the application
Write-Host "Building application..." -ForegroundColor Blue
npm run build

# Check if build was successful
if ($LASTEXITCODE -eq 0) {
    # Replace the placeholder in index.html with actual base path
    Write-Host "Updating base path in index.html..." -ForegroundColor Blue
    
    $indexPath = "dist/index.html"
    if (Test-Path $indexPath) {
        $content = Get-Content $indexPath -Raw
        $content = $content -replace "%VITE_BASE_PATH%", $env:VITE_BASE_PATH
        $content = $content -replace 'href="/favicon.ico"', "href=`"$env:VITE_BASE_PATH`favicon.ico`""
        Set-Content $indexPath $content
        
        Write-Host "Base path updated in index.html" -ForegroundColor Green
        
        # Create .htaccess for Apache server (tridex.app)
        Write-Host "Creating .htaccess for Apache server..." -ForegroundColor Blue
        $htaccess = @"
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
"@
        
        Set-Content "dist/.htaccess" $htaccess
        Write-Host ".htaccess created for Apache server" -ForegroundColor Green
        
        Write-Host "Build complete! Ready for deployment to tridex.app" -ForegroundColor Green
        Write-Host "Upload ALL contents of dist/ directory to tridex.app/safee/" -ForegroundColor Cyan
        Write-Host "IMPORTANT: Ensure .htaccess file is uploaded and Apache mod_rewrite is enabled" -ForegroundColor Yellow
    } else {
        Write-Host "dist/index.html not found" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Build failed" -ForegroundColor Red
    exit 1
}
