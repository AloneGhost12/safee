#!/bin/bash

# Personal Vault - Deployment Setup Script
# This script helps set up the deployment environment

set -e

echo "🚀 Personal Vault Deployment Setup"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js found: $NODE_VERSION"
    else
        print_error "Node.js not found. Please install Node.js 18+"
        exit 1
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_success "npm found: $NPM_VERSION"
    else
        print_error "npm not found"
        exit 1
    fi
    
    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        print_success "Docker found"
    else
        print_warning "Docker not found (optional for local development)"
    fi
    
    # Check Git
    if command -v git &> /dev/null; then
        print_success "Git found"
    else
        print_error "Git not found"
        exit 1
    fi
}

# Setup environment files
setup_environment() {
    print_info "Setting up environment files..."
    
    # Server environment
    if [ ! -f "server/.env" ]; then
        if [ -f "server/.env.example" ]; then
            cp server/.env.example server/.env
            print_success "Created server/.env from template"
        else
            print_warning "server/.env.example not found"
        fi
    else
        print_warning "server/.env already exists"
    fi
    
    # Client environment
    if [ ! -f "client/.env.local" ]; then
        if [ -f "client/.env.production" ]; then
            cp client/.env.production client/.env.local
            print_success "Created client/.env.local from template"
        else
            print_warning "client/.env.production not found"
        fi
    else
        print_warning "client/.env.local already exists"
    fi
}

# Install dependencies
install_dependencies() {
    print_info "Installing dependencies..."
    
    # Server dependencies
    print_info "Installing server dependencies..."
    cd server
    npm ci
    print_success "Server dependencies installed"
    cd ..
    
    # Client dependencies
    print_info "Installing client dependencies..."
    cd client
    npm ci
    print_success "Client dependencies installed"
    cd ..
}

# Build applications
build_applications() {
    print_info "Building applications..."
    
    # Build server
    print_info "Building server..."
    cd server
    npm run build
    print_success "Server built successfully"
    cd ..
    
    # Build client
    print_info "Building client..."
    cd client
    npm run build
    print_success "Client built successfully"
    cd ..
}

# Run tests
run_tests() {
    print_info "Running tests..."
    
    # Server tests
    print_info "Running server tests..."
    cd server
    npm run test:unit
    print_success "Server tests passed"
    cd ..
    
    # Client tests
    print_info "Running client tests..."
    cd client
    npm run test:unit
    print_success "Client tests passed"
    cd ..
}

# Docker setup
setup_docker() {
    if command -v docker &> /dev/null; then
        print_info "Setting up Docker environment..."
        
        # Check if docker-compose is available
        if command -v docker-compose &> /dev/null; then
            print_success "Docker Compose found"
        else
            print_warning "Docker Compose not found, trying docker compose..."
            if docker compose version &> /dev/null; then
                print_success "Docker Compose (plugin) found"
            else
                print_error "Docker Compose not available"
                return 1
            fi
        fi
        
        print_info "You can start local development with:"
        print_info "  docker-compose up -d"
        print_info "  or"
        print_info "  docker compose up -d"
    else
        print_warning "Docker not available, skipping Docker setup"
    fi
}

# Generate deployment checklist
generate_checklist() {
    print_info "Generating deployment checklist..."
    
    cat > DEPLOYMENT_CHECKLIST.md << 'EOF'
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
EOF
    
    print_success "Deployment checklist created: DEPLOYMENT_CHECKLIST.md"
}

# Main deployment setup
main() {
    echo ""
    print_info "Starting deployment setup process..."
    echo ""
    
    check_prerequisites
    echo ""
    
    setup_environment
    echo ""
    
    install_dependencies
    echo ""
    
    build_applications
    echo ""
    
    if [ "$1" = "--with-tests" ]; then
        run_tests
        echo ""
    fi
    
    setup_docker
    echo ""
    
    generate_checklist
    echo ""
    
    print_success "Deployment setup completed successfully!"
    echo ""
    print_info "Next steps:"
    print_info "1. Edit server/.env with your actual environment variables"
    print_info "2. Edit client/.env.local with your API URL"
    print_info "3. Set up your MongoDB Atlas database"
    print_info "4. Deploy to Render (server) and Vercel/Netlify (client)"
    print_info "5. Follow the DEPLOYMENT.md guide for detailed instructions"
    echo ""
    print_info "For local development:"
    print_info "  Server: cd server && npm run dev"
    print_info "  Client: cd client && npm run dev"
    print_info "  Docker: docker-compose up -d"
    echo ""
    print_success "Happy deploying! 🎉"
}

# Run main function with all arguments
main "$@"
