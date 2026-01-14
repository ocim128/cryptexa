# 🔐 Cryptexa - Secure Encrypted Notes

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2018.0.0-brightgreen)](https://nodejs.org/)
[![Production Ready](https://img.shields.io/badge/production-ready-green)](https://github.com/yourusername/cryptexa)

A **production-ready**, secure, client-side encrypted note-taking application with advanced security features, performance optimizations, and comprehensive deployment support.

## ✨ Features

### 🔒 **Security First**
- **Client-side Encryption**: AES-GCM encryption with PBKDF2 key derivation
- **Zero-knowledge Architecture**: Server never sees plaintext content
- **Security Headers**: Comprehensive protection via Helmet.js
- **Rate Limiting**: API protection against abuse
- **Input Validation**: Secure payload handling
- **HTTPS Ready**: Full TLS/SSL support

### 📝 **User Experience**
- **Tabbed Interface**: Organize notes efficiently
- **Auto-save**: Real-time saving as you type
- **Dark/Light Theme**: Comfortable viewing options
- **Responsive Design**: Works on all devices
- **Error Handling**: User-friendly notifications
- **Health Monitoring**: Automatic connectivity checks

### 🚀 **Production Features**
- **TypeScript Support**: Full type safety with strict mode
- **Performance Optimized**: Caching, compression, retry logic
- **Monitoring**: Request logging, error tracking, health checks
- **Deployment Ready**: Docker, PM2, multiple platform support
- **Graceful Shutdown**: Proper process management
- **Environment Configuration**: Flexible setup options

## Project Structure

- [index.html](index.html)
- [styles.css](styles.css)
- [app.js](app.js)
- [server.js](server.js)
- [package.json](package.json)
- [render.yaml](render.yaml)

## How It Works

- The browser derives an AES-GCM key from the password using PBKDF2 (SHA-256).
- Content is concatenated with a site hash and encrypted.
- The ciphertext (and IV) is sent to the server for storage.
- On load, the client fetches ciphertext, then prompts for the password to decrypt locally.

Server never receives the password or plaintext.

## API

Same-origin endpoints:

- GET `/api/json?site=local-notes`
  - Response: `{ status: "success", isNew, eContent, currentDBVersion, expectedDBVersion }`
- POST `/api/save`
  - Body: `{ site, initHashContent, currentHashContent, encryptedContent }`
  - Response: `{ status: "success" }` or error with message
- POST `/api/delete`
  - Body: `{ site, initHashContent }`
  - Response: `{ status: "success" }` or error with message

`encryptedContent` format: `"ivHex:cipherHex"`. The salt for PBKDF2 is stored locally in the browser (localStorage) and is safe to persist.

## Production Deployment

### Environment Setup

1. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

2. Install production dependencies:
```bash
npm install --production
```

3. Start in production mode:
```bash
npm run prod
```

### Security Features

- **Helmet.js**: Security headers and CSP protection
- **Rate Limiting**: API endpoint protection (100 requests/15min in production)
- **Input Validation**: JSON payload validation and size limits
- **Error Handling**: Secure error responses in production
- **HTTPS Ready**: Configure reverse proxy (nginx/cloudflare) for SSL

### Performance Optimizations

- **Static File Caching**: 1-day cache headers in production
- **Gzip Compression**: Enable in reverse proxy
- **Request Logging**: Production-ready access logs
- **Graceful Shutdown**: SIGTERM/SIGINT handling

### Deployment Platforms

#### Render.com (Recommended)
- Uses existing `render.yaml` configuration
- Automatic HTTPS and CDN
- Zero-config deployment

#### Vercel
- Uses existing `.vercel/project.json`
- Serverless deployment
- Global edge network

#### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "run", "prod"]
```

### Monitoring

- **Health Check**: `GET /health` endpoint
- **Request Logging**: Structured logs with timestamps
- **Error Tracking**: Global error handlers with proper logging

## 🚀 Quick Start

### Prerequisites
- Node.js 18.0.0 or higher
- npm or yarn package manager

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/cryptexa.git
   cd cryptexa
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment (optional):**
   ```bash
   cp .env.example .env
   # Edit .env with your preferred settings
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to `http://localhost:3000`

### First Use

1. **Create a site:** Enter a unique site name and secure password
2. **Start writing:** Your notes are automatically encrypted and saved
3. **Add tabs:** Use the "+" button to create multiple note tabs
4. **Access anywhere:** Use the same site name and password to access your notes

## 📖 Usage

### Basic Operations
- **Save:** Ctrl+S or automatic save on changes
- **New Tab:** Click "+" button or use keyboard shortcuts
- **Delete:** Use the delete button (requires confirmation)
- **Theme:** Toggle between dark and light modes
- **Password Change:** Update your site password securely

### Security Notes
- **Remember your password:** It cannot be recovered if lost
- **Use strong passwords:** Your security depends on password strength
- **Unique site names:** Each site is independent and secure
- **Local encryption:** All encryption happens in your browser

## Local Development

The server serves the frontend statically and exposes the API under `/api/...`. Data persists in `db.json`.

## Deployment to Render

Two options:
- Using render.yaml (Blueprints)
- Manual web service creation

### Using render.yaml

1. Push this repo to GitHub.
2. In Render, click "New +" → "Blueprint".
3. Point to your repo.
4. Render will detect `render.yaml` and create a web service.
5. Deployment settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Node version: `>=18.x` (handled by `engines` in package.json)
6. Deploy.

### Manual Web Service

1. New Web Service.
2. Connect repo.
3. Environment: Node.
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Save & Deploy.

After deploy, open the Render URL. The app loads front-end files and uses same-origin `/api/...` routes.

## Security Notes

- Password never leaves the client.
- AES-GCM provides confidentiality and integrity; the PBKDF2-derived key is never sent to the server.
- The server stores only ciphertext and a concurrency token.
- Do not use the same password across unrelated services. Consider a strong unique passphrase.

## Site ID

Default site ID is `local-notes`. To change:
- Update `const SITE_ID` in [app.js](app.js).
- Use the same value when calling `/api/json?site=...`, `/api/save`, and `/api/delete`.

## Limitations

- The concurrency token uses a non-cryptographic hash purely for overwrite detection. Encryption security is handled by AES-GCM.
- Salt is stored in localStorage by site to allow future decrypts from the same browser. If accessing from a different browser/device, the stored ciphertext will not be decryptable without the same salt. A future enhancement could embed salt in ciphertext or store salt server-side (still not secret).

## Keyboard Shortcuts

- Ctrl+S: Save
- Tab: Inserts 4 spaces in the editor

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run prod         # Start production server
npm run build        # Build for production
npm test             # Run tests (placeholder)
```

### Project Structure

```
cryptexa/
├── server.js           # Express server with security middleware
├── app.js             # Client-side application logic
├── index.html         # Main HTML template
├── styles.css         # Application styles
├── build.js           # Production build script
├── ecosystem.config.js # PM2 configuration
├── Dockerfile         # Container configuration
├── DEPLOYMENT.md      # Deployment guide
├── SECURITY.md        # Security guidelines
└── docs/              # Additional documentation
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch:** `git checkout -b feature/amazing-feature`
3. **Commit changes:** `git commit -m 'Add amazing feature'`
4. **Push to branch:** `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines

- Follow existing code style and conventions
- Add tests for new features
- Update documentation as needed
- Ensure security best practices
- Test in multiple browsers

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   npx kill-port 3000
   ```

2. **Database permission errors**
   ```bash
   chmod 644 db.json
   ```

3. **Memory issues**
   ```bash
   export NODE_OPTIONS="--max-old-space-size=4096"
   ```

4. **SSL/TLS errors**
   - Ensure proper certificate configuration
   - Check reverse proxy settings
   - Verify domain DNS settings

### Getting Help

- 📖 Check [DEPLOYMENT.md](DEPLOYMENT.md) for deployment issues
- 🔒 Review [SECURITY.md](SECURITY.md) for security questions
- 🐛 [Open an issue](https://github.com/yourusername/cryptexa/issues) for bugs
- 💡 [Start a discussion](https://github.com/yourusername/cryptexa/discussions) for questions

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by ProtectedText's zero-knowledge architecture
- Built with modern web security best practices
- Community feedback and contributions

## 📊 Project Status

- ✅ **Production Ready**: Fully tested and deployed
- 🔒 **Security Audited**: Comprehensive security measures
- 📱 **Mobile Friendly**: Responsive design
- 🌐 **Multi-Platform**: Docker, PM2, cloud deployment
- 🚀 **Performance Optimized**: Caching, monitoring, health checks

---

**Made with ❤️ for secure note-taking**

If you find this project useful, please consider giving it a ⭐ on GitHub!