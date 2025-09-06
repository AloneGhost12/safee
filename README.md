# 🔐 Safee - Secure Personal Vault

A zero-knowledge, end-to-end encrypted personal vault for securely storing and managing your files and notes.

## ✨ Features

- **🔒 End-to-End Encryption**: All files and notes are encrypted client-side before upload
- **📄 Secure PDF Viewer**: Preview encrypted PDFs inline without downloads
- **🖼️ Image Preview**: View encrypted images with zoom and rotation controls
- **📝 Notes Management**: Create and organize encrypted notes with tags
- **🗂️ File Organization**: Upload, organize, and manage files securely
- **🔐 Zero-Knowledge**: Server never sees your decrypted data
- **🎨 Modern UI**: Clean, responsive interface built with React and Tailwind CSS

## 🏗️ Architecture

### Client (Frontend)
- **Framework**: Vite + React + TypeScript
- **Styling**: Tailwind CSS
- **Crypto**: Web Crypto API with AES-GCM encryption
- **Features**: 
  - SecurePDFViewer for inline encrypted PDF preview
  - File upload with chunked encryption
  - Real-time notes editor
  - Responsive file manager

### Server (Backend)
- **Runtime**: Node.js 20 + Express + TypeScript
- **Database**: MongoDB with Mongoose
- **Storage**: Cloudinary/S3 for encrypted file storage
- **Security**: JWT authentication, CORS protection
- **API**: RESTful endpoints for auth, files, and notes

## 🚀 Recent Updates

### Secure PDF Viewer Implementation
- Added `SecurePDFViewer` component for encrypted PDF preview without downloads
- Enhanced `FilePreviewModal` to handle Uint8Array PDF data
- Modified API to return raw PDF data for secure inline viewing
- Implemented multiple fallback methods for PDF display
- Added comprehensive error handling and debugging
- Maintains end-to-end encryption while enabling inline preview
- Fixed blob URL handling and CORS restrictions
- Added PDF header validation and auto-detection of loading failures

## 🛠️ Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite for fast development and building
- Tailwind CSS for styling
- Lucide React for icons
- Web Crypto API for encryption

**Backend:**
- Node.js with Express
- TypeScript for type safety
- MongoDB with Mongoose
- JWT for authentication
- Cloudinary/S3 for file storage

## 🔧 Development

### Prerequisites
- Node.js 20+
- MongoDB instance
- Cloudinary/S3 credentials (optional)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/AloneGhost12/safee.git
   cd safee
   ```

2. **Install dependencies**
   ```bash
   # Install client dependencies
   cd client
   npm install
   
   # Install server dependencies
   cd ../server
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Copy environment files
   cp server/.env.example server/.env
   cp client/.env.production client/.env.local
   
   # Configure your MongoDB URL and other settings
   ```

4. **Start Development Servers**
   ```bash
   # Terminal 1: Start server
   cd server
   npm run dev
   
   # Terminal 2: Start client
   cd client
   npm run dev
   ```

5. **Access the Application**
   - Client: http://localhost:5173
   - Server: http://localhost:4002

## 🔐 Security Features

- **Client-Side Encryption**: All data encrypted before leaving your device
- **Zero-Knowledge Architecture**: Server cannot decrypt your data
- **Secure Key Derivation**: PBKDF2 with 100,000 iterations
- **AES-GCM Encryption**: Industry-standard encryption algorithm
- **Secure PDF Viewing**: PDFs decrypted in memory for preview only
- **CORS Protection**: Prevents unauthorized cross-origin requests

## 📱 Usage

1. **Register/Login**: Create an account or log into your existing vault
2. **Upload Files**: Drag and drop files - they're encrypted automatically
3. **Preview Files**: Click on PDFs and images for secure inline preview
4. **Create Notes**: Write encrypted notes with tag organization
5. **Manage Files**: Download, delete, or organize your encrypted files

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🛡️ Security

If you discover a security vulnerability, please email us at [security contact]. All security vulnerabilities will be promptly addressed.

---

**Built with ❤️ for privacy and security**
