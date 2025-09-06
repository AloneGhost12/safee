# 🚀 Personal Vault - Complete Deployment Guide

## 📋 Overview

This guide covers deploying the Personal Vault application to production environments:
- **Server API**: Render.com (Backend)
- **Client App**: Vercel or Netlify (Frontend)
- **Local Development**: Docker Compose

---

## 🛠️ Prerequisites

### Required Accounts
- [Render.com](https://render.com) account for API hosting
- [Vercel](https://vercel.com) or [Netlify](https://netlify.com) account for client hosting
- [MongoDB Atlas](https://mongodb.com/atlas) for database
- [Cloudinary](https://cloudinary.com) account (optional, for image optimization)
- [AWS S3](https://aws.amazon.com/s3) or [Cloudflare R2](https://cloudflare.com/r2) (optional, for file storage)

### Development Tools
- Node.js 18+ and npm
- Docker and Docker Compose
- Git

---

## 🏗️ Local Development Setup

### 1. Environment Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd vault

# Copy environment templates
cp server/.env.example server/.env
cp client/.env.production.example client/.env.local
```

### 2. Configure Environment Variables

Edit `server/.env`:
```env
# Required
MONGO_URI=mongodb://admin:password@localhost:27017/vault?authSource=admin
JWT_ACCESS_SECRET=your-super-secret-access-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080

# Optional integrations
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### 3. Docker Compose Development

```bash
# Start all services
docker-compose up -d

# Start with development client (Vite dev server)
docker-compose --profile dev up -d

# View logs
docker-compose logs -f server
docker-compose logs -f client

# Stop all services
docker-compose down
```

### 4. Traditional Development

```bash
# Terminal 1: Start MongoDB (or use Docker)
docker run -d -p 27017:27017 --name vault-mongo \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:6.0

# Terminal 2: Start server
cd server
npm install
npm run dev

# Terminal 3: Start client
cd client
npm install
npm run dev
```

---

## 🌐 Production Deployment

### A. Server Deployment (Render)

#### 1. Automatic Deployment with render.yaml

```bash
# Push render.yaml to your repository
git add render.yaml
git commit -m "Add Render deployment config"
git push origin main

# Connect repository to Render dashboard
# Render will automatically read render.yaml and create services
```

#### 2. Manual Render Setup

1. **Connect Repository**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the `server` folder as root directory

2. **Configure Build Settings**
   ```
   Build Command: npm ci && npm run build
   Start Command: npm start
   ```

3. **Set Environment Variables**
   ```env
   NODE_ENV=production
   PORT=4000
   HOST=0.0.0.0
   MONGO_URI=<your-mongodb-atlas-connection-string>
   JWT_ACCESS_SECRET=<generate-strong-secret>
   JWT_REFRESH_SECRET=<generate-strong-secret>
   SESSION_COOKIE_NAME=pv_sess
   ALLOWED_ORIGINS=https://your-client-domain.com
   TRUST_PROXY=true
   TRUSTED_PROXIES=127.0.0.1,::1
   
   # Optional integrations
   CLOUDINARY_CLOUD_NAME=dtzhskby3
   CLOUDINARY_API_KEY=279872768346294
   CLOUDINARY_API_SECRET=R2ioEHtBBs-6Kwmj-pbCL5Er3CQ
   S3_ENDPOINT=<your-s3-endpoint>
   S3_BUCKET=<your-bucket-name>
   S3_ACCESS_KEY_ID=<your-access-key>
   S3_SECRET_ACCESS_KEY=<your-secret-key>
   ```

#### 3. Database Setup (MongoDB Atlas)

1. Create a MongoDB Atlas cluster
2. Create a database user
3. Whitelist Render's IP addresses (or use 0.0.0.0/0 for simplicity)
4. Get connection string and add to `MONGO_URI`

### B. Client Deployment

#### Option 1: Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from client directory
cd client
vercel --prod

# Or use GitHub integration
# 1. Connect repository to Vercel
# 2. Set root directory to 'client'
# 3. Vercel will read vercel.json automatically
```

**Vercel Environment Variables:**
```env
VITE_API_URL=https://safe-vault-qn1g.onrender.com
VITE_APP_NAME=Personal Vault
```

#### Option 2: Netlify Deployment

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy from client directory
cd client
npm run build
netlify deploy --prod --dir=dist

# Or use GitHub integration
# 1. Connect repository to Netlify
# 2. Set base directory to 'client'
# 3. Netlify will read netlify.toml automatically
```

**Netlify Environment Variables:**
```env
VITE_API_URL=https://safe-vault-qn1g.onrender.com
VITE_APP_NAME=Personal Vault
NODE_VERSION=18
```

---

## 🔧 Environment Variables Reference

### Server Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | ✅ | Runtime environment | `production` |
| `PORT` | ✅ | Server port | `4000` |
| `HOST` | ❌ | Server host | `0.0.0.0` |
| `MONGO_URI` | ✅ | MongoDB connection string | `mongodb+srv://...` |
| `JWT_ACCESS_SECRET` | ✅ | JWT access token secret | `your-super-secret-key` |
| `JWT_REFRESH_SECRET` | ✅ | JWT refresh token secret | `your-other-secret-key` |
| `SESSION_COOKIE_NAME` | ❌ | Session cookie name | `pv_sess` |
| `ALLOWED_ORIGINS` | ✅ | CORS allowed origins | `https://your-app.com` |
| `TRUST_PROXY` | ❌ | Trust proxy headers | `true` |
| `TRUSTED_PROXIES` | ❌ | Trusted proxy IPs | `127.0.0.1,::1` |

#### Optional Integrations

| Variable | Service | Description |
|----------|---------|-------------|
| `CLOUDINARY_CLOUD_NAME` | Cloudinary | Cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary | API key |
| `CLOUDINARY_API_SECRET` | Cloudinary | API secret |
| `S3_ENDPOINT` | S3/R2 | Storage endpoint |
| `S3_BUCKET` | S3/R2 | Bucket name |
| `S3_REGION` | S3/R2 | Region |
| `S3_ACCESS_KEY_ID` | S3/R2 | Access key |
| `S3_SECRET_ACCESS_KEY` | S3/R2 | Secret key |

### Client Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_API_URL` | ✅ | Backend API URL | `https://safe-vault-qn1g.onrender.com` |
| `VITE_APP_NAME` | ❌ | Application name | `Personal Vault` |

---

## 🏗️ Build Scripts Reference

### Server Scripts

```bash
# Development
npm run dev                    # Start development server with hot reload
npm run build                  # Build TypeScript to JavaScript
npm run start                  # Start production server
npm run start:production       # Start with NODE_ENV=production

# Docker
npm run docker:build          # Build Docker image
npm run docker:run            # Run Docker container

# Testing & Quality
npm run test                   # Run tests
npm run test:coverage          # Run tests with coverage
npm run lint                   # Lint code
npm run security:check         # Security audit

# Health
npm run health:check           # Check server health
```

### Client Scripts

```bash
# Development
npm run dev                    # Start Vite dev server
npm run build                  # Build for production
npm run preview                # Preview production build
npm run serve                  # Serve on custom port

# Docker
npm run docker:build          # Build production Docker image
npm run docker:dev            # Build and run development container

# Deployment
npm run deploy:vercel         # Deploy to Vercel
npm run deploy:netlify        # Deploy to Netlify

# Testing
npm run test                  # Run unit tests
npm run test:e2e             # Run E2E tests
npm run test:coverage        # Coverage report
```

---

## ✅ Post-Deployment Verification Checklist

### 🔍 Functional Testing

#### Server Health Checks
- [ ] **API Health**: `GET https://your-api.render.com/api/health`
- [ ] **Database Connection**: Check MongoDB Atlas connections
- [ ] **CORS Configuration**: Test from client domain
- [ ] **Authentication**: Test signup/login flow
- [ ] **File Upload**: Test file upload endpoints
- [ ] **Rate Limiting**: Verify rate limits are active

#### Client Functionality
- [ ] **App Loading**: Client loads without errors
- [ ] **API Communication**: Client connects to server API
- [ ] **Authentication Flow**: Login/signup works
- [ ] **File Operations**: Upload/download/delete files
- [ ] **Notes Management**: Create/edit/delete notes
- [ ] **Responsive Design**: Test on mobile/desktop

### 🔒 Security Verification

#### Headers & HTTPS
- [ ] **HTTPS**: All traffic encrypted (check certificate)
- [ ] **Security Headers**: CSP, HSTS, X-Frame-Options present
- [ ] **CORS**: Only allowed origins accepted
- [ ] **Cookie Security**: Secure, HttpOnly, SameSite flags

#### Authentication & Authorization
- [ ] **JWT Tokens**: Proper expiration and refresh
- [ ] **Session Management**: Secure cookie handling
- [ ] **Password Security**: Argon2 hashing verified
- [ ] **Rate Limiting**: Login attempts limited

### 🚀 Performance Testing

#### Load Testing
- [ ] **Response Times**: API responses < 200ms
- [ ] **Static Assets**: CDN delivery working
- [ ] **Database Queries**: Efficient indexes used
- [ ] **Memory Usage**: Server memory stable

#### Monitoring Setup
- [ ] **Error Tracking**: Error logs configured
- [ ] **Health Monitoring**: Uptime checks active
- [ ] **Performance Metrics**: Response time tracking
- [ ] **Alert Configuration**: Critical error alerts

### 📊 Deployment Commands Summary

```bash
# Quick deployment verification
curl -f https://safe-vault-qn1g.onrender.com/api/health
curl -f https://your-client-domain.com/health

# Check server logs (Render)
# Go to Render dashboard → Service → Logs

# Check client build (Local)
cd client && npm run build
cd server && npm run build

# Test Docker builds (Local)
docker-compose up --build
```

---

## 🆘 Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Node version compatibility
node --version  # Should be 18+
```

#### CORS Errors
```bash
# Update ALLOWED_ORIGINS on server
ALLOWED_ORIGINS=https://your-actual-client-domain.com

# Check client API URL
echo $VITE_API_URL
```

#### Database Connection
```bash
# Test MongoDB connection
# Use MongoDB Compass or CLI to verify connectivity
mongosh "your-connection-string"
```

#### Environment Variables
```bash
# Check Render environment variables in dashboard
# Verify client environment variables in build logs
```

### Support Resources

- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Netlify Documentation](https://docs.netlify.com)
- [MongoDB Atlas Docs](https://docs.atlas.mongodb.com)

---

## 🎉 Deployment Complete!

Your Personal Vault is now deployed and ready for production use. Remember to:

1. **Monitor**: Set up alerts for uptime and errors
2. **Backup**: Regular database backups
3. **Update**: Keep dependencies updated
4. **Scale**: Monitor usage and scale as needed

**Your URLs:**
- API: `https://safe-vault-qn1g.onrender.com`
- Client: `https://your-app.vercel.app` or `https://your-app.netlify.app`

Happy vaulting! 🔐✨
