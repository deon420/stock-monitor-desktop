# BUILD INSTRUCTIONS

## ⚡ OUT OF THE BOX BUILD (Zero Manual Steps)

**Download the project ZIP from Replit and run these commands:**

```cmd
# 1. Extract ZIP and navigate to folder
cd your-extracted-folder

# 2. Install and build everything (automatic)
npm install
node scripts/build-all.mjs
```

**Your installer is ready:** `desktop-app/dist/Stock Monitor Setup 1.0.0.exe`

That's it! No manual file editing, no complex setup - just download and build.

## What You Get

### ✅ Web Demo (Frontend Only)
- **Purpose**: Frontend demonstration with temporary storage
- **Access**: Run `npm run dev` → http://localhost:5000
- **Features**: Add/delete products, UI preview (resets on refresh)

### 🚀 Desktop Application (Full Product)
- **Purpose**: Production-ready Windows application 
- **Features**: 
  - **Full Persistence**: SQLite database storage
  - **Email Alerts**: SendGrid integration for price notifications
  - **Enterprise Security**: AES-256-GCM encryption + Windows Credential Manager
  - **Anti-Bot Protection**: Comprehensive detection with detailed logging
  - **Professional Installer**: Branded Windows installer with shortcuts

## Prerequisites for Windows Build

### Required:
- **Node.js 18+**: [Download](https://nodejs.org/)
- **Python 3.x**: [Download](https://www.python.org/downloads/)
- **Visual Studio Build Tools**: [Download](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

### Optional (Enhanced Installer):
- **Inno Setup 6**: [Download](https://jrsoftware.org/isinfo.php) - Creates professional branded installer

## Step-by-Step Process

The `node scripts/build-all.mjs` command automatically:

1. **Installs Dependencies**: Root and desktop-app packages
2. **Builds Frontend**: React TypeScript frontend (10-11 seconds)
3. **Copies Assets**: Embedded frontend for desktop app
4. **Builds Desktop**: Electron application with native modules
5. **Creates Installers**: Portable + NSIS + Inno Setup (if available)

## Manual Process (If Needed)

If you prefer to run each step individually:

```cmd
# Build frontend
npm run build

# Copy frontend to desktop app  
node scripts/copy-frontend.mjs

# Build desktop application
cd desktop-app
npm install
npm run build-win
```

## Build Outputs

After successful build:

- **📱 Portable App**: `desktop-app/dist/win-unpacked/Stock Monitor.exe`
- **💾 Standard Installer**: `desktop-app/dist/Stock Monitor Setup 1.0.0.exe`  
- **🎨 Professional Installer**: Auto-generated if Inno Setup 6 detected

## Technology Stack

**Frontend**: React + TypeScript + Vite + shadcn/ui + Tailwind CSS  
**Backend**: Express + SQLite + Drizzle ORM  
**Desktop**: Electron 38.1.0 + electron-builder  
**Security**: AES-256-GCM + Windows Credential Manager + keytar  
**Email**: SendGrid integration with template support  

## Testing Your Build

### Web Demo Test:
```cmd
npm run dev
# Visit http://localhost:5000 - Add products, verify UI
```

### Desktop App Test:
```cmd
cd desktop-app/dist/win-unpacked
"Stock Monitor.exe"
# Full application with persistence and notifications
```

## Production Features

### 🔒 Security
- **AES-256-GCM encryption** for all sensitive data
- **Windows Credential Manager** integration via keytar
- **Secure session management** with HttpOnly cookies
- **CSP headers** and HTTPS enforcement

### 🤖 Anti-Bot Detection
- **AI-powered detection** with confidence scoring (0-1 scale)
- **Real-time alerts** with center-screen notifications
- **Comprehensive logging** for admin review
- **Solution suggestions** with user-configurable options

### 📧 Smart Notifications  
- **SendGrid integration** for reliable email delivery
- **Price alerts** when items drop below target
- **Stock notifications** when items become available
- **Custom templates** with professional formatting

### 📊 Advanced Monitoring
- **Multi-platform support**: Amazon + Walmart tracking
- **Intelligent scheduling**: Platform-optimized intervals
- **Exponential backoff** for failed requests
- **Concurrent job limiting** to avoid detection

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `build-all.mjs not found` | Run `npm install` and verify scripts folder exists |
| `electron-builder not found` | Build process installs this automatically |
| `Python not found` | Install Python 3.x and add to PATH |
| `MSBuild not found` | Install Visual Studio Build Tools |
| Build fails | Check all prerequisites installed |

## End User Experience

1. **User downloads**: `Stock Monitor Setup 1.0.0.exe` (single file)
2. **Runs installer**: Professional Windows installer with branding
3. **Auto-installation**: Creates shortcuts, registers file types
4. **First launch**: Simple email configuration wizard
5. **Ready to use**: Add products, set price targets, get alerts

**Installation Path**: `C:\Users\{username}\AppData\Local\Stock Monitor\`

## 🚀 Hosting Installer Files

### Web Download System

The Replit deployment now includes a complete installer hosting system:

- **Landing Page**: Users can download installers directly from the web interface
- **Download Endpoint**: `/downloads/latest/windows` automatically serves the latest version
- **Secure Downloads**: Files served with proper headers (`Content-Disposition: attachment`)
- **Version Management**: Support for multiple installer versions

### Uploading New Installers

After building locally, upload your installer to enable web downloads:

```bash
# 1. Build locally (as shown above)
npm install
node scripts/build-all.mjs

# 2. Your installer is ready at:
# desktop-app/dist/Stock Monitor Setup 1.0.0.exe

# 3. Upload to Replit downloads directory with proper naming:
# Format: Stock-Monitor-Setup-{VERSION}.exe
# Example: Stock-Monitor-Setup-1.0.1.exe
```

### Deployment Workflow

1. **Local Development**: Build and test locally using instructions above
2. **Upload Installer**: Copy `.exe` file to Replit's `/downloads` directory  
3. **Update Version**: Ensure filename follows `Stock-Monitor-Setup-{VERSION}.exe` format
4. **Test Download**: Verify download works from landing page
5. **User Access**: Users can now download directly from your Replit URL

### Download URLs

- **Landing Page**: `https://your-replit-url.repl.co/` (Download button)
- **Direct Latest**: `https://your-replit-url.repl.co/downloads/latest/windows`
- **Specific Version**: `https://your-replit-url.repl.co/downloads/Stock-Monitor-Setup-1.0.1.exe`

### File Structure

```
downloads/
├── README.md                           # Documentation
├── Stock-Monitor-Setup-1.0.0.exe      # Stable release  
├── Stock-Monitor-Setup-1.0.1.exe      # Latest release
├── v1.0.0/                            # Archived versions
└── v1.0.1/                            # Archived versions
```

**Benefits for End Users**:
- ✅ No command line tools required
- ✅ Single-click download and install
- ✅ Automatic updates via new uploads
- ✅ Professional installer experience
- ✅ Mobile-friendly download page