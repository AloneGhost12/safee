# 🌟 Cloudinary Integration Guide

## Overview

Your encrypted vault now supports **dual storage options**:
- **S3/R2 Storage**: For general files, documents, and secure storage
- **Cloudinary Storage**: For images with automatic optimization and transformations

## 🔑 Setup Instructions

### 1. Environment Configuration

Add these Cloudinary credentials to your server `.env` file:


```

### 2. Start the Application

```bash
# Terminal 1: Start the server
cd server
npm start

# Terminal 2: Start the client
cd client
npm run dev
```

## 🚀 Features

### Storage Type Selection
When uploading files, users can choose between:
- **S3/R2 Storage**: Best for documents, PDFs, general files
- **Cloudinary Storage**: Best for images (automatic optimization)

### Image Optimization (Cloudinary)
- ✅ Automatic thumbnail generation
- ✅ Dynamic resizing and cropping
- ✅ Format optimization (WebP conversion)
- ✅ CDN delivery for fast loading
- ✅ Quality optimization

### Security
- 🔒 **End-to-end encryption** maintained for both storage types
- 🔒 Files encrypted client-side before upload
- 🔒 Encrypted metadata storage
- 🔒 Secure presigned URLs (S3) and direct URLs (Cloudinary)

## 📋 API Endpoints

### Cloudinary Endpoints

```typescript
// Direct upload to Cloudinary
POST /api/files/cloudinary/upload
Content-Type: multipart/form-data
Body: {
  file: File,
  encryptedName: string,
  encryptedMimeType: string,
  tags?: string[]
}

// Get signed upload URL for client-side uploads
POST /api/files/cloudinary/upload-url
Body: {
  fileName: string,
  fileSize: number,
  contentType: string,
  encryptedName: string,
  encryptedMimeType: string,
  tags?: string[]
}

// Get optimized image URL
GET /api/files/:fileId/optimized?width=300&height=300&quality=auto&format=webp
```

### Existing S3 Endpoints
All existing S3/R2 endpoints continue to work unchanged.

## 🎯 Usage Examples

### Upload with Storage Selection
Users can toggle between storage types in the upload dialog:
- **S3/R2**: For secure document storage
- **Cloudinary**: For optimized image storage

### Image Optimization
Cloudinary images automatically get:
- **Thumbnails**: Small, medium, large sizes
- **Format optimization**: Automatic WebP conversion
- **Quality optimization**: Automatic compression
- **Responsive delivery**: Different sizes for different devices

### File Download
The system automatically detects storage type and provides appropriate download URLs:
- **S3 files**: Presigned URLs with expiration
- **Cloudinary files**: Direct CDN URLs

## 🔧 Technical Details

### File Metadata
The database now stores storage type information:
```typescript
interface FileMetadata {
  storageType?: 's3' | 'cloudinary'
  s3Key?: string              // For S3 storage
  s3Bucket?: string           // For S3 storage
  cloudinaryPublicId?: string // For Cloudinary storage
  cloudinaryUrl?: string      // For Cloudinary storage
  thumbnailUrl?: string       // For Cloudinary thumbnails
  // ... other fields
}
```

### Virus Scanning
- **S3 files**: Full virus scanning with ClamAV integration
- **Cloudinary files**: Cloudinary's built-in security scanning

## 🎨 UI Features

### Upload Dialog
- **Storage Type Selector**: Radio buttons to choose between S3 and Cloudinary
- **Dynamic Help Text**: Explains when to use each storage type
- **Progress Tracking**: Shows upload progress for both storage types

### File Browser
- **Thumbnail Display**: Shows optimized thumbnails for Cloudinary images
- **Storage Type Indicators**: Visual indicators for storage type
- **Download Optimization**: Optimized URLs for faster downloads

## 🚀 Benefits

### For Images
- **Faster Loading**: CDN delivery and optimization
- **Responsive Images**: Automatic sizing for different devices
- **Format Optimization**: WebP for modern browsers, fallbacks for older ones
- **Bandwidth Savings**: Compressed images without quality loss

### For Documents
- **Security**: End-to-end encryption with S3 presigned URLs
- **Scalability**: Handles large files efficiently
- **Compliance**: Enterprise-grade security features

## 🔍 Monitoring

The server logs will show:
- ✅ Cloudinary configuration validation on startup
- 📊 Upload success/failure rates for both storage types
- 🔄 Automatic fallback handling if one service is unavailable

Your encrypted vault now provides the best of both worlds - secure document storage and optimized image delivery! 🎉
