# GitHub Auto-Update Setup Guide

This guide explains how to set up the complete GitHub auto-update functionality for the Stock Monitor desktop application.

## 📋 Prerequisites

Before setting up auto-updates, ensure you have:

- A GitHub account with a repository for your Stock Monitor app
- GitHub repository with admin/write permissions  
- Basic understanding of GitHub releases and tags
- Windows development environment (for testing)

## 🔧 Initial Configuration

### 1. Update Package.json Configuration

Edit `desktop-app/package.json` and update the publish section with your repository details:

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "YOUR_GITHUB_USERNAME",     // ← Replace with your GitHub username
      "repo": "YOUR_REPOSITORY_NAME",      // ← Replace with your repository name
      "private": false,                    // Set to true if private repository
      "releaseType": "release"
    }
  }
}
```

**Example:**
```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "johnsmith",
      "repo": "stock-monitor-app",
      "private": false,
      "releaseType": "release"
    }
  }
}
```

### 2. Repository Settings Configuration

#### Enable GitHub Actions
1. Go to your repository on GitHub
2. Navigate to **Settings** → **Actions** → **General**
3. Under "Actions permissions", select **"Allow all actions and reusable workflows"**
4. Under "Workflow permissions", select **"Read and write permissions"**
5. Check **"Allow GitHub Actions to create and approve pull requests"**
6. Click **Save**

#### Configure Repository Permissions
1. Go to **Settings** → **Actions** → **General**
2. Scroll down to "Workflow permissions"
3. Ensure **"Read and write permissions"** is selected
4. This allows the workflow to create releases and upload assets

## 🚀 Creating Releases

### Method 1: Automatic Release (Recommended)

1. **Update Version Number:**
   ```bash
   # In the desktop-app directory
   cd desktop-app
   npm version patch    # For bug fixes (1.0.0 → 1.0.1)
   npm version minor    # For new features (1.0.0 → 1.1.0)
   npm version major    # For breaking changes (1.0.0 → 2.0.0)
   ```

2. **Create and Push Git Tag:**
   ```bash
   git add -A
   git commit -m "Release version X.X.X"
   git tag v1.0.1       # Use the version number from step 1
   git push origin main
   git push origin v1.0.1
   ```

3. **Automatic Build:**
   - GitHub Actions will automatically detect the tag
   - The workflow will build and publish the release
   - Check the "Actions" tab to monitor progress

### Method 2: Manual Release

1. **Manual Workflow Trigger:**
   - Go to **Actions** tab in your repository
   - Select "Build and Release Desktop App"
   - Click **"Run workflow"**
   - Choose the branch and click **"Run workflow"**

## 📁 Release Process Details

### What Happens During Release

1. **Frontend Build:** The web application is built using `npm run build`
2. **Frontend Copy:** Built files are copied to `desktop-app/frontend/`
3. **Desktop Build:** Electron app is built with electron-builder
4. **Asset Upload:** Installation files are uploaded to GitHub release
5. **Auto-Update Setup:** Release is configured for automatic updates

### Generated Files

After a successful release, you'll find:
- **Windows Installer:** `StockMonitor-Setup-X.X.X.exe`
- **Auto-update Files:** `latest.yml` (contains update information)
- **Release Notes:** Automatically generated changelog

## 🔄 How Auto-Updates Work

### For End Users

1. **Automatic Checking:** App checks for updates every time it starts
2. **Background Download:** Updates download automatically when available
3. **User Notification:** Users are notified when update is ready
4. **Installation:** Updates install when app is closed/restarted

### Update Flow

```
App Startup → Check GitHub Releases → Download Update (if available) → Notify User → Install on Restart
```

### Update Notifications

Users will see notifications for:
- **Update Available:** When a new version is found
- **Download Progress:** While update is downloading  
- **Update Ready:** When download is complete and ready to install

## 🛠️ Development and Testing

### Testing Auto-Updates Locally

1. **Build a Test Release:**
   ```bash
   cd desktop-app
   npm run build
   ```

2. **Install Test Version:**
   - Install the generated `.exe` file
   - Run the application

3. **Create New Release:**
   - Increment version number
   - Create new release on GitHub
   - Test app should detect and download update

### Development Mode

Auto-updates are disabled in development mode to prevent interference during development:

```javascript
if (process.env.NODE_ENV === 'development') {
  log.info('[AutoUpdater] Skipping update check in development mode');
  return;
}
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Build Fails in GitHub Actions

**Symptoms:** Workflow fails during build process

**Solutions:**
- Check that all dependencies are properly listed in `package.json`
- Verify Node.js version compatibility
- Check build logs in Actions tab

#### 2. Updates Not Detected

**Symptoms:** App doesn't find new releases

**Solutions:**
- Verify `package.json` publish configuration is correct
- Check that releases are marked as "Latest release" on GitHub
- Ensure GitHub repository is public or access tokens are configured

#### 3. Download Fails

**Symptoms:** Update downloads fail or are corrupted

**Solutions:**
- Check internet connectivity
- Verify GitHub API rate limits aren't exceeded
- Ensure release assets were uploaded correctly

#### 4. Installation Fails

**Symptoms:** Update downloads but doesn't install

**Solutions:**
- Check Windows permissions (run as administrator)
- Verify antivirus isn't blocking installation
- Check disk space availability

### Debug Information

#### Enable Verbose Logging

Auto-updater logging is already configured in `main.js`:

```javascript
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
```

Logs are saved to: `%APPDATA%/stock-monitor-desktop/logs/`

#### Manual Update Check

You can trigger manual update checks from the app:

```javascript
// This is handled via IPC in the implementation
ipcRenderer.invoke('updater-check-for-updates');
```

## 📊 Monitoring and Analytics

### Release Metrics

Monitor your releases through:

1. **GitHub Insights:**
   - Go to repository **Insights** → **Traffic**
   - View download statistics for releases

2. **Release Downloads:**
   - Each release page shows download counts
   - Track adoption of new versions

3. **Action Workflows:**
   - Monitor build success rates
   - Check build duration and resource usage

## 🔐 Security Considerations

### Code Signing (Optional but Recommended)

For production releases, consider adding code signing:

1. **Obtain Code Signing Certificate:**
   - Purchase from a Certificate Authority
   - Or use self-signed certificates for internal distribution

2. **Configure GitHub Secrets:**
   ```
   WIN_CSC_LINK: Base64-encoded certificate file
   WIN_CSC_KEY_PASSWORD: Certificate password
   ```

3. **Update Workflow:**
   - Uncomment certificate lines in `.github/workflows/release.yml`
   - Add certificate environment variables

### Repository Security

- Keep repository access restricted to trusted contributors
- Use branch protection rules for main branch
- Review all changes before merging
- Regularly audit repository access

## 📝 Advanced Configuration

### Custom Update Channels

Configure different update channels (stable, beta, alpha):

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "YOUR_USERNAME",
      "repo": "YOUR_REPO",
      "channel": "latest"    // or "beta", "alpha"
    }
  }
}
```

### Update Scheduling

Modify update check frequency in `main.js`:

```javascript
// Check for updates every 4 hours instead of just on startup
setInterval(() => {
  checkForUpdates();
}, 4 * 60 * 60 * 1000);
```

### Custom Update UI

The current implementation sends events to the frontend for custom update notifications:

- `update-available` - New version found
- `update-download-progress` - Download progress updates  
- `update-downloaded` - Update ready to install
- `update-error` - Update process error

## 🆘 Support and Resources

### Documentation
- [Electron Auto-Updater](https://www.electronjs.org/docs/latest/api/auto-updater)
- [Electron Builder](https://www.electron.build/auto-update)
- [GitHub Actions](https://docs.github.com/en/actions)

### Community Support
- [Electron Discord](https://discord.gg/electron)
- [GitHub Community Forum](https://github.community/)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/electron)

---

## ✅ Checklist

Before going live with auto-updates:

- [ ] Repository configuration is complete
- [ ] Package.json publish settings are correct  
- [ ] GitHub Actions workflow runs successfully
- [ ] Test release created and validated
- [ ] Auto-update functionality tested with real installation
- [ ] Update notifications work correctly
- [ ] Error handling tested
- [ ] Documentation updated for end users

---

**Need Help?** If you encounter issues not covered in this guide, please create an issue in the repository with detailed information about your setup and the problem you're experiencing.