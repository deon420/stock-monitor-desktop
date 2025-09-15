# Stock Monitor Installers

This directory contains compiled Windows installers for end-user distribution.

## Directory Structure

```
downloads/
├── README.md                           # This file
├── Stock-Monitor-Setup-1.0.0.exe      # Current stable release
├── Stock-Monitor-Setup-1.0.1.exe      # Latest release
├── v1.0.0/                            # Archive of v1.0.0 assets
└── v1.0.1/                            # Archive of v1.0.1 assets
```

## How to Upload New Installers

1. **Build locally** using the instructions in `BUILD-INSTRUCTIONS.md`:
   ```bash
   npm install
   node scripts/build-all.mjs
   ```

2. **Locate your installer** at:
   ```
   desktop-app/dist/Stock Monitor Setup 1.0.0.exe
   ```

3. **Upload to this directory** with proper naming:
   - Format: `Stock-Monitor-Setup-{VERSION}.exe`
   - Example: `Stock-Monitor-Setup-1.0.2.exe`

4. **Archive old version** (optional but recommended):
   - Move previous installer to versioned subdirectory
   - Keep root level clean with only latest versions

## Download Endpoints

- **Latest Windows**: `/downloads/latest/windows` (auto-redirects)
- **Direct**: `/downloads/Stock-Monitor-Setup-{VERSION}.exe`
- **Web accessible**: https://your-replit-url.repl.co/downloads/latest/windows

## File Naming Convention

- **Format**: `Stock-Monitor-Setup-{MAJOR}.{MINOR}.{PATCH}.exe`
- **Examples**:
  - `Stock-Monitor-Setup-1.0.0.exe` (initial release)
  - `Stock-Monitor-Setup-1.0.1.exe` (bug fix)
  - `Stock-Monitor-Setup-1.1.0.exe` (feature update)
  - `Stock-Monitor-Setup-2.0.0.exe` (major version)

## Security Considerations

- Files served with `Content-Disposition: attachment` headers
- No directory listing enabled
- 24-hour browser cache for performance
- All downloads logged for security auditing

## User Experience

When users click "Download for Windows" on the landing page:
1. Browser initiates download immediately
2. File saved with proper `.exe` extension
3. User can run installer directly (may see Windows SmartScreen warning for unsigned software)
4. Installation proceeds with branded installer experience

---

**Note**: This directory is served by Express static middleware. Only place trusted, verified installer files here.