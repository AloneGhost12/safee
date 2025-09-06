# Personal Vault - Deployment Setup Script (PowerShell)
# This script helps set up the deployment environment on Windows

param(
    [switch]$WithTests
)

# Colors for output
$Colors = @{
    Red = 'Red'
    Green = 'Green'
    Yellow = 'Yellow'
    Blue = 'Blue'
    White = 'White'
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor $Colors.Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor $Colors.Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor $Colors.Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor $Colors.Blue
}

function Check-Prerequisites {
    Write-Info "Checking prerequisites..."
    
    # Check Node.js
    try {
        $nodeVersion = node --version
        Write-Success "Node.js found: $nodeVersion"
    }
    catch {
        Write-Error "Node.js not found. Please install Node.js 18+"
        exit 1
    }
    
    # Check npm
    try {
        $npmVersion = npm --version
        Write-Success "npm found: $npmVersion"
    }
    catch {
        Write-Error "npm not found"
        exit 1
    }
    
    # Check Docker (optional)
    try {
        docker --version | Out-Null
        Write-Success "Docker found"
    }
    catch {
        Write-Warning "Docker not found (optional for local development)"
    }
    
    # Check Git
    try {
        git --version | Out-Null
        Write-Success "Git found"
    }
    catch {
        Write-Error "Git not found"
        exit 1
    }
}

function Setup-Environment {
    Write-Info "Setting up environment files..."
    
    # Server environment
    if (-not (Test-Path "server\.env")) {
        if (Test-Path "server\.env.example") {
            Copy-Item "server\.env.example" "server\.env"
            Write-Success "Created server\.env from template"
        }
        else {
            Write-Warning "server\.env.example not found"
        }
    }
    else {
        Write-Warning "server\.env already exists"
    }
    
    # Client environment
    if (-not (Test-Path "client\.env.local")) {
        if (Test-Path "client\.env.production") {
            Copy-Item "client\.env.production" "client\.env.local"
            Write-Success "Created client\.env.local from template"
        }
        else {
            Write-Warning "client\.env.production not found"
        }
    }
    else {
        Write-Warning "client\.env.local already exists"
    }
}

function Install-Dependencies {
    Write-Info "Installing dependencies..."
    
    # Server dependencies
    Write-Info "Installing server dependencies..."
    Set-Location server
    npm ci
    Write-Success "Server dependencies installed"
    Set-Location ..
    
    # Client dependencies
    Write-Info "Installing client dependencies..."
    Set-Location client
    npm ci
    Write-Success "Client dependencies installed"
    Set-Location ..
}

function Build-Applications {
    Write-Info "Building applications..."
    
    # Build server
    Write-Info "Building server..."
    Set-Location server
    npm run build
    Write-Success "Server built successfully"
    Set-Location ..
    
    # Build client
    Write-Info "Building client..."
    Set-Location client
    npm run build
    Write-Success "Client built successfully"
    Set-Location ..
}

function Run-Tests {
    Write-Info "Running tests..."
    
    # Server tests
    Write-Info "Running server tests..."
    Set-Location server
    npm run test:unit
    Write-Success "Server tests passed"
    Set-Location ..
    
    # Client tests
    Write-Info "Running client tests..."
    Set-Location client
    npm run test:unit
    Write-Success "Client tests passed"
    Set-Location ..
}

function Setup-Docker {
    try {
        docker --version | Out-Null
        Write-Info "Setting up Docker environment..."
        
        # Check if docker-compose is available
        try {
            docker-compose --version | Out-Null
            Write-Success "Docker Compose found"
        }
        catch {
            Write-Warning "Docker Compose not found, trying docker compose..."
            try {
                docker compose version | Out-Null
                Write-Success "Docker Compose (plugin) found"
            }
            catch {
                Write-Error "Docker Compose not available"
                return
            }
        }
        
        Write-Info "You can start local development with:"
        Write-Info "  docker-compose up -d"
        Write-Info "  or"
        Write-Info "  docker compose up -d"
    }
    catch {
        Write-Warning "Docker not available, skipping Docker setup"
    }
}

function Generate-Checklist {
    Write-Info "Generating deployment checklist..."
    
    $checklistContent = @'
# 🚀 Deployment Checklist

## Pre-Deployment
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database connection tested
- [ ] Security audit completed
- [ ] Performance benchmarked

## Server Deployment (Render)
- [ ] Repository connected to Render
- [ ] Environment variables set
- [ ] Database (MongoDB Atlas) configured
- [ ] Health check endpoint working
- [ ] Logs monitoring set up

## Client Deployment (Vercel/Netlify)
- [ ] Repository connected
- [ ] Build settings configured
- [ ] Environment variables set
- [ ] CORS configured on server
- [ ] CDN and caching verified

## Post-Deployment
- [ ] Smoke tests passed
- [ ] Performance monitoring active
- [ ] Error tracking configured
- [ ] Backup procedures tested
- [ ] Security headers verified

## Final Verification
- [ ] Authentication flow works
- [ ] File upload/download works
- [ ] Note creation/editing works
- [ ] Mobile responsiveness checked
- [ ] Cross-browser compatibility verified
'@
    
    $checklistContent | Out-File -FilePath "DEPLOYMENT_CHECKLIST.md" -Encoding UTF8
    Write-Success "Deployment checklist created: DEPLOYMENT_CHECKLIST.md"
}

function Main {
    Write-Host ""
    Write-Info "Starting deployment setup process..."
    Write-Host ""
    
    Check-Prerequisites
    Write-Host ""
    
    Setup-Environment
    Write-Host ""
    
    Install-Dependencies
    Write-Host ""
    
    Build-Applications
    Write-Host ""
    
    if ($WithTests) {
        Run-Tests
        Write-Host ""
    }
    
    Setup-Docker
    Write-Host ""
    
    Generate-Checklist
    Write-Host ""
    
    Write-Success "Deployment setup completed successfully!"
    Write-Host ""
    Write-Info "Next steps:"
    Write-Info "1. Edit server\.env with your actual environment variables"
    Write-Info "2. Edit client\.env.local with your API URL"
    Write-Info "3. Set up your MongoDB Atlas database"
    Write-Info "4. Deploy to Render (server) and Vercel/Netlify (client)"
    Write-Info "5. Follow the DEPLOYMENT.md guide for detailed instructions"
    Write-Host ""
    Write-Info "For local development:"
    Write-Info "  Server: cd server; npm run dev"
    Write-Info "  Client: cd client; npm run dev"
    Write-Info "  Docker: docker-compose up -d"
    Write-Host ""
    Write-Success "Happy deploying! 🎉"
}

# Display header
Write-Host "🚀 Personal Vault Deployment Setup" -ForegroundColor $Colors.Blue
Write-Host "==================================" -ForegroundColor $Colors.Blue

# Run main function
Main
