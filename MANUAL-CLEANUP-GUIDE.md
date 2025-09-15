# Manual Package.json Cleanup Guide

## Overview
This guide outlines the manual cleanup required for the root package.json file. The system restricts direct editing of package.json files, so these changes must be made manually.

## Root Package.json Cleanup Required

### Dependencies to Remove (move these to desktop-app only):
```json
// Remove these from root package.json dependencies:
"electron": "^38.1.0",
"electron-builder": "^26.0.12", 
"electron-log": "^5.4.3",
```

### Testing Dependencies to Remove (causing conflicts):
```json
// Remove these from root package.json dependencies:
"jest": "^30.1.3",
"@testing-library/jest-dom": "^6.8.0",
"@testing-library/react": "^16.3.0", 
"@types/jest": "^30.0.0",
"ts-jest": "^29.4.1",
```

### Other Dependencies to Remove (not needed):
```json
// Remove these from root package.json dependencies:
"keytar": "^7.9.0",  // Desktop-specific, keep in desktop-app only
"nexe": "^5.0.0-beta.4",  // Not needed
"pkg": "^5.8.1",  // Not needed
```

### DevDependencies to Update:
```json
// Update in devDependencies:
"@types/node": "^20.19.0",  // Change from "20.16.11"
```

## Completed Tasks ✅

### 1. Desktop-App Package.json Updated
- ✅ Updated to electron ^38.1.0 and electron-builder ^26.0.12
- ✅ Updated all dependencies to latest versions
- ✅ Changed build-frontend script to use cross-platform copy script
- ✅ Improved dependency versions for compatibility

### 2. Cross-Platform Copy Script Created
- ✅ Created `scripts/copy-frontend.mjs` 
- ✅ Works on both Windows and Unix systems
- ✅ Proper error handling and verification
- ✅ Tested and working correctly

### 3. Cleanup Tasks Completed  
- ✅ Removed `package-corrected.json` file
- ✅ Verified build scripts work correctly
- ✅ Frontend copy process working perfectly

## Usage Instructions

### Desktop App Build Process:
```bash
# From project root - build and copy frontend
node scripts/copy-frontend.mjs

# From desktop-app directory - build desktop app
cd desktop-app
npm run build
```

### Cross-Platform Copy Script Features:
- Automatically builds Vite frontend
- Handles both dist/ and dist/public/ source directories
- Creates frontend/ directory in desktop-app
- Verifies index.html exists
- Provides detailed logging
- Exits with error codes on failure

## Final State
After completing the manual root package.json cleanup, the project will have:
- Clean separation between web app and desktop app dependencies
- No dependency conflicts
- Working cross-platform build scripts
- Proper file organization for deployment

## Testing After Manual Cleanup
After making the manual changes to root package.json:
```bash
# Test clean install
rm -rf node_modules package-lock.json
npm install

# Test frontend build and copy
node scripts/copy-frontend.mjs

# Test desktop app build
cd desktop-app
npm install
npm run build
```