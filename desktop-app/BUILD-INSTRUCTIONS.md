# Stock Monitor Desktop App - Build Instructions

I apologize for the previous failed attempts. Here's how to build the REAL desktop app:

## What You're Getting
- **TRUE Electron desktop application** (not a web server!)
- **Opens in its own window** with no browser involvement
- **Proper Windows executable** when built correctly

## Requirements
- Windows 10/11 machine
- Node.js 18+ installed
- **Visual Studio Build Tools** (see prerequisites below)
- Git (optional)

## Prerequisites for Native Modules

This app uses native modules (better-sqlite3, keytar) that need compilation:

### Required Build Tools:
1. **Install Visual Studio Build Tools 2022** (or Visual Studio with C++ workload)
   - Download from: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
   - Select "C++ build tools" workload during installation
   - Or run: `npm install --global windows-build-tools` (legacy method)

2. **Python 3.x** (if not included with VS Build Tools)
   - Required for node-gyp compilation

### Native Module Compatibility:
- **better-sqlite3 v12.2.0**: Limited Electron 38 prebuilt support - will compile from source
- **keytar v7.9.0**: Deprecated, uses legacy prebuilds - will compile from source

### Auto-Compilation Process:
The build will automatically:
1. Detect missing prebuilt binaries for Electron 38
2. Compile better-sqlite3 and keytar from source using node-gyp
3. This requires Visual Studio Build Tools (hence the prerequisite above)

## Build Steps

1. **Extract the source code** from the downloaded tar.gz file
2. **Open Command Prompt or PowerShell** in the extracted folder
3. **Install dependencies:**
   ```cmd
   npm install
   ```

4. **Rebuild native modules for Electron:** (Critical for Windows compatibility)
   ```cmd
   npm install --save-dev @electron/rebuild
   npx electron-rebuild
   ```
   This step compiles better-sqlite3 and keytar specifically for Electron 38.

5. **Build the Windows executable:**
   ```cmd
   npm run build-win
   ```

6. **Find your desktop app:**
   - Installer: `dist/Stock Monitor Setup 1.0.0.exe`
   - Portable: `dist/win-unpacked/Stock Monitor.exe`

## What This Actually Does
- Creates a TRUE desktop application using Electron
- Loads the frontend directly from files (no HTTP server)
- Includes all necessary dependencies
- Creates both an installer and portable version

## Why Previous Versions Failed
- **pkg tool**: Can't handle native dependencies → instant crashes
- **Browser approach**: You wanted a desktop app, not browser automation
- **Cross-compilation**: Can't build Windows apps from Linux environment

## Testing
After building, run `Stock Monitor.exe` - it should:
- ✅ Open immediately in its own window
- ✅ Show the Stock Monitor interface
- ✅ Work completely offline
- ✅ Feel like a real desktop application

## If It Still Doesn't Work
Check the logs in: `%USERPROFILE%/AppData/Roaming/stock-monitor-desktop/logs/`

This approach will actually work because it's a proper Electron app built on Windows for Windows.