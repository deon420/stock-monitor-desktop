# Stock Monitor - Complete Windows Deployment Guide

## Overview

This guide provides complete step-by-step instructions for building the Stock Monitor application for Windows deployment. The Stock Monitor is a React-based web application with an optional Electron desktop version that tracks product availability and prices across Amazon and Walmart.

**What You're Building:**
- ✅ **Modern React Web Application** - Full-featured web demo with responsive design
- ✅ **Electron Desktop Application** - Complete offline desktop app with persistence
- ✅ **Professional Windows Installer** - Custom GUI installer with modern styling
- ✅ **Production-Ready Package** - Properly signed, tested, and verified distribution

## Prerequisites

### Required Software
Install these tools in order before beginning:

1. **Node.js 20 LTS**
   - Download from: https://nodejs.org/en/download/
   - **Important**: Use LTS version 20.x (not 18.x or 22.x)
   - Verify installation: `node --version` (should show v20.x.x)

2. **Visual Studio Build Tools 2022**
   - **Required for**: Native module compilation (better-sqlite3, keytar)
   - Download: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
   - Select "C++ build tools" workload during installation
   - **Alternative**: Full Visual Studio with C++ development workload

3. **Inno Setup 6**
   - **Required for**: Creating professional Windows installer
   - Download: https://jrsoftware.org/isdl.php
   - Install to default location (C:\Program Files (x86)\Inno Setup 6\)

4. **Git** (recommended)
   - Download: https://git-scm.com/download/win
   - Useful for version control and cloning repositories

### System Requirements
- **OS**: Windows 10 version 1809 or later / Windows 11
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 2GB free space for build process
- **Permissions**: Administrator access for installing prerequisites

## Project Structure

```
stock-monitor/
├── client/                    # React frontend application
│   ├── src/
│   └── public/
├── desktop-app/              # Electron desktop application
│   ├── main.js               # Electron main process
│   ├── preload.js            # Electron preload script
│   ├── server/               # Embedded Express server
│   └── package.json          # Desktop app dependencies
├── server/                   # Backend API routes and logic
├── shared/                   # Shared types and schemas
├── scripts/
│   └── copy-frontend.mjs     # Cross-platform build script
├── package.json              # Root project dependencies
└── BUILD-INSTRUCTIONS.md     # This file
```

## Part 1: Manual Package.json Cleanup

### ⚠️ Critical Step: Root Package.json Cleanup

**Before building**, you must manually clean up the root `package.json` file to prevent dependency conflicts:

1. **Open `package.json` in your preferred text editor**

2. **Remove these dependencies** (they belong only in desktop-app):
   ```json
   "electron": "^38.1.0",
   "electron-builder": "^26.0.12", 
   "electron-log": "^5.4.3",
   ```

3. **Remove testing dependencies** (causing conflicts):
   ```json
   "jest": "^30.1.3",
   "@testing-library/jest-dom": "^6.8.0",
   "@testing-library/react": "^16.3.0", 
   "@types/jest": "^30.0.0",
   "ts-jest": "^29.4.1",
   ```

4. **Remove other unnecessary dependencies**:
   ```json
   "keytar": "^7.9.0",     // Desktop-specific
   "nexe": "^5.0.0-beta.4", // Not needed
   "pkg": "^5.8.1",        // Not needed
   ```

5. **Update devDependencies** (if present):
   ```json
   "@types/node": "^20.19.0"  // Change from "20.16.11"
   ```

### Why This Cleanup is Required
- **Prevents conflicts** between web and desktop dependencies
- **Reduces bundle size** for web deployment
- **Eliminates build errors** from incompatible modules
- **Ensures proper isolation** between web and desktop versions

## Part 2: Environment Setup and Installation

### Step 1: Extract and Navigate to Project
```cmd
:: Extract the downloaded project zip file
:: Open Command Prompt or PowerShell as Administrator
cd "C:\path\to\extracted\stock-monitor"
```

### Step 2: Verify Prerequisites
```cmd
:: Check Node.js version (should be 20.x.x)
node --version

:: Check npm version
npm --version

:: Verify Visual Studio Build Tools
where cl.exe
```

### Step 3: Clean Installation
```cmd
:: Remove any existing node_modules and lock files
rmdir /s /q node_modules 2>nul
del package-lock.json 2>nul

:: Install root project dependencies
npm install

:: Navigate to desktop app and install its dependencies
cd desktop-app
rmdir /s /q node_modules 2>nul
del package-lock.json 2>nul
npm install

:: Return to project root
cd ..
```

**Expected Output:**
- No error messages during installation
- All packages installed successfully
- Native modules compiled successfully

## Part 3: Build the Web Application

### Step 4: Build React Frontend
```cmd
:: From project root, build the Vite frontend
npm run build
```

**What this does:**
- Compiles TypeScript to JavaScript
- Bundles React components and assets
- Optimizes images and CSS
- Creates production build in `dist/` folder

**Expected Files Created:**
```
dist/
├── assets/
│   ├── index-[hash].js      # Main application bundle
│   └── index-[hash].css     # Compiled styles
└── index.html               # Entry point
```

### Step 5: Copy Frontend to Desktop App
```cmd
:: Use the cross-platform copy script
node scripts/copy-frontend.mjs
```

**What this does:**
- Verifies the web build completed successfully
- Copies all frontend assets to `desktop-app/frontend/`
- Ensures desktop app can run offline

**Expected Output:**
```
[copy-frontend] Starting cross-platform frontend copy process
[copy-frontend] Building Vite frontend...
[copy-frontend] ✓ Building Vite frontend completed
[copy-frontend] Using dist as source directory
[copy-frontend] Copying dist to desktop-app\frontend...
[copy-frontend] ✓ Copy completed successfully
[copy-frontend] Verifying copied files...
[copy-frontend] ✓ File verification completed
[copy-frontend] ✅ Frontend copy process completed successfully
```

## Part 4: Build the Desktop Application

### Step 6: Rebuild Native Modules for Electron
```cmd
:: Navigate to desktop-app directory
cd desktop-app

:: Install electron-rebuild if not present
npm install --save-dev @electron/rebuild

:: Rebuild native modules for Electron 38
npx electron-rebuild
```

**What this does:**
- Recompiles `better-sqlite3` for Electron's Node.js version
- Recompiles `keytar` for Electron's Node.js version
- Ensures native modules are compatible with Electron 38

**Expected Output:**
- ✅ Rebuilding module: better-sqlite3
- ✅ Rebuilding module: keytar
- ✅ All modules rebuilt successfully

### Step 7: Build Desktop Application
```cmd
:: Build the Windows desktop application
npm run build-win
```

**What this does:**
- Creates Electron application bundle
- Includes all dependencies and native modules
- Generates both installer and portable versions
- Signs the application (if configured)

**Expected Files Created:**
```
desktop-app/dist/
├── win-unpacked/                    # Portable application
│   ├── Stock Monitor.exe            # Main executable
│   ├── resources/
│   └── [electron runtime files]
└── Stock Monitor Setup 1.0.0.exe   # Standard installer
```

## Part 5: Create Custom Installer (Optional)

### Step 8: Build Custom Installer with Inno Setup
```cmd
:: From desktop-app directory
:: Compile the Inno Setup script
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer.iss
```

**What this creates:**
- Professional Windows installer with custom branding
- Modern welcome and completion pages
- Proper uninstall support
- Start menu shortcuts

**Expected Output:**
```
desktop-app/dist/
└── StockMonitor-Setup-1.0.0.exe    # Custom installer
```

## Part 6: Verification and Testing

### Step 9: Verify Build Results

**Check Web Application:**
1. Navigate to project root
2. Run: `npm run dev`
3. Open browser to `http://localhost:5000`
4. Verify the Stock Monitor interface loads correctly
5. Test adding/removing products in demo mode

**Check Desktop Application:**
1. Navigate to `desktop-app/dist/win-unpacked/`
2. Double-click `Stock Monitor.exe`
3. Verify it opens in its own window (not browser)
4. Test offline functionality
5. Check that it persists data between sessions

**Check Installer:**
1. Right-click installer → "Run as administrator"
2. Follow installation wizard
3. Launch from Start Menu
4. Verify application works identically to portable version

### Step 10: Security and Compatibility Testing

**Windows Security:**
- Expect Windows Defender SmartScreen warning (normal for unsigned apps)
- Choose "More info" → "Run anyway"
- Consider code signing certificate for production distribution

**Antivirus Compatibility:**
- Test with Windows Defender enabled
- Add build folder to exclusions if needed:
  ```cmd
  :: Add exclusion (run as administrator)
  powershell Add-MpPreference -ExclusionPath "C:\path\to\stock-monitor"
  ```

**User Account Control:**
- Installer requires administrator privileges
- Application runs with standard user privileges
- No elevation required for normal operation

## Expected File Structure After Build

```
stock-monitor/
├── dist/                                    # Web application build
├── desktop-app/
│   ├── dist/
│   │   ├── win-unpacked/
│   │   │   └── Stock Monitor.exe            # ✅ Portable executable
│   │   ├── Stock Monitor Setup 1.0.0.exe   # ✅ Standard installer
│   │   └── StockMonitor-Setup-1.0.0.exe    # ✅ Custom installer
│   └── frontend/                           # ✅ Copied web assets
└── node_modules/                           # ✅ Dependencies installed
```

## Deployment Options

### Option 1: Portable Application
- **File**: `desktop-app/dist/win-unpacked/Stock Monitor.exe`
- **Advantages**: No installation required, runs from any location
- **Best for**: Personal use, testing, USB deployment

### Option 2: Standard Installer
- **File**: `desktop-app/dist/Stock Monitor Setup 1.0.0.exe`
- **Advantages**: Standard Windows installer, automatic updates support
- **Best for**: Basic deployment, simple distribution

### Option 3: Custom Installer
- **File**: `desktop-app/dist/StockMonitor-Setup-1.0.0.exe`
- **Advantages**: Professional appearance, custom branding, modern UI
- **Best for**: Commercial distribution, professional deployment

### Option 4: Web Application
- **Deploy**: Upload `dist/` folder contents to web server
- **Advantages**: No installation, cross-platform, automatic updates
- **Best for**: SaaS deployment, demo purposes

## Troubleshooting Common Issues

### Build Failures

**"Cannot find module 'electron'"**
```cmd
:: Solution: Ensure electron is installed in desktop-app
cd desktop-app
npm install electron@^38.1.0 --save-dev
```

**"node-gyp rebuild failed"**
```cmd
:: Solution: Install Visual Studio Build Tools
:: Download from Microsoft, select C++ workload
:: Alternative: npm install --global windows-build-tools
```

**"better-sqlite3 binding failed"**
```cmd
:: Solution: Rebuild native modules
cd desktop-app
npm install @electron/rebuild --save-dev
npx electron-rebuild
```

### Runtime Issues

**Desktop app shows blank screen**
- Check if frontend was copied correctly
- Verify `desktop-app/frontend/index.html` exists
- Run: `node scripts/copy-frontend.mjs` to re-copy

**"Windows protected your PC" warning**
- Normal for unsigned executables
- Click "More info" → "Run anyway"
- Consider code signing for production

**Antivirus blocks execution**
- Add build folder to antivirus exclusions
- Whitelist the executable file
- Submit to antivirus vendor for analysis

### Development Issues

**Port already in use (5000)**
```cmd
:: Find and kill process using port 5000
netstat -ano | findstr :5000
taskkill /PID [process_id] /F
```

**Permission denied errors**
- Run Command Prompt as Administrator
- Check file/folder permissions
- Ensure no files are locked by running processes

## Production Deployment Checklist

### Before Distribution
- [ ] All builds complete without errors
- [ ] Web application tested in browser
- [ ] Desktop application tested standalone
- [ ] Installer creates proper shortcuts
- [ ] Application persists data correctly
- [ ] All dependencies included in build
- [ ] Antivirus scan completed (optional)

### Code Signing (Recommended for Production)
1. **Obtain Code Signing Certificate**
   - Purchase from trusted CA (DigiCert, Sectigo, etc.)
   - Cost: ~$200-500/year for standard certificates

2. **Configure electron-builder for signing**
   ```json
   // In desktop-app/package.json build section
   "win": {
     "certificateFile": "path/to/certificate.p12",
     "certificatePassword": "password",
     "publisherName": "Your Company Name"
   }
   ```

3. **Benefits of Code Signing**
   - Eliminates Windows security warnings
   - Builds trust with users
   - Required for Windows Store distribution
   - Enables SmartScreen reputation building

### Final Distribution
- Package installer with documentation
- Include version number in filename
- Test on clean Windows systems
- Create installation/usage guide
- Set up update mechanism (if needed)

## Support and Maintenance

### Application Logs Location
- **Desktop App**: `%USERPROFILE%/AppData/Roaming/stock-monitor-desktop/logs/`
- **Web App**: Browser Developer Tools Console

### Updating the Application
1. Modify source code as needed
2. Increment version in `desktop-app/package.json`
3. Re-run build process from Step 4
4. Test thoroughly before distribution

### Common Maintenance Tasks
- Update Node.js dependencies: `npm update`
- Rebuild for new Electron version: `npx electron-rebuild`
- Update installer version: Edit `installer.iss`
- Refresh web assets: `node scripts/copy-frontend.mjs`

---

## Summary

This guide provides complete instructions for building production-ready Windows deployments of the Stock Monitor application. The process creates both web and desktop versions with professional installers suitable for distribution.

**Key Success Factors:**
- Follow prerequisite installation exactly
- Complete manual package.json cleanup
- Verify each step before proceeding  
- Test all outputs before distribution

**Build Time Estimate:** 30-60 minutes (excluding downloads)

**Questions?** Check the troubleshooting section or review build logs for specific error messages.