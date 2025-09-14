const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto');
const { DesktopDatabase } = require('./desktop-database');
const { KeychainService } = require('./keychain-service');
const { autoUpdater } = require('electron-updater');

// Enable crash reporting and logging
const log = require('electron-log');
log.transports.file.level = 'debug';
log.transports.console.level = 'debug';

// Configure auto-updater logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

let mainWindow;
let database;
let keychain;
let tray;
let isQuiting = false;
let trayEnabled = false;
let userSettings = null;

// ============================================
// AUTO-UPDATER CONFIGURATION AND HANDLERS
// ============================================

// Configure auto-updater settings
autoUpdater.checkForUpdatesAndNotify = true;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  log.info('[AutoUpdater] Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  log.info('[AutoUpdater] Update available:', info.version);
  log.info('[AutoUpdater] Release notes:', info.releaseNotes);
  
  // Show notification to user if window is available
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
      releaseDate: info.releaseDate
    });
  }
});

autoUpdater.on('update-not-available', (info) => {
  log.info('[AutoUpdater] Update not available. Current version:', info.version);
});

autoUpdater.on('error', (err) => {
  log.error('[AutoUpdater] Error occurred:', err.message);
  log.error('[AutoUpdater] Error stack:', err.stack);
  
  // Notify frontend of update error
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-error', {
      message: err.message,
      stack: err.stack
    });
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  const message = `Download speed: ${Math.round(progressObj.bytesPerSecond / 1024)}kb/s - Downloaded ${Math.round(progressObj.percent)}% (${Math.round(progressObj.transferred / 1024 / 1024)}MB/${Math.round(progressObj.total / 1024 / 1024)}MB)`;
  log.info(`[AutoUpdater] ${message}`);
  
  // Send progress to frontend
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-download-progress', {
      percent: Math.round(progressObj.percent),
      transferred: Math.round(progressObj.transferred / 1024 / 1024),
      total: Math.round(progressObj.total / 1024 / 1024),
      bytesPerSecond: Math.round(progressObj.bytesPerSecond / 1024)
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('[AutoUpdater] Update downloaded successfully:', info.version);
  log.info('[AutoUpdater] Update will be installed on next app restart');
  
  // Notify frontend that update is ready
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-downloaded', {
      version: info.version,
      releaseNotes: info.releaseNotes,
      releaseDate: info.releaseDate
    });
  }
});

// Function to check for updates manually
function checkForUpdates() {
  if (process.env.NODE_ENV === 'development') {
    log.info('[AutoUpdater] Skipping update check in development mode');
    return;
  }
  
  try {
    log.info('[AutoUpdater] Starting manual update check...');
    autoUpdater.checkForUpdatesAndNotify();
  } catch (error) {
    log.error('[AutoUpdater] Failed to check for updates:', error.message);
  }
}

// Function to install update and restart
function installUpdateAndRestart() {
  try {
    log.info('[AutoUpdater] Installing update and restarting...');
    autoUpdater.quitAndInstall();
  } catch (error) {
    log.error('[AutoUpdater] Failed to install update:', error.message);
  }
}

// Secure in-memory auth storage with encryption
class SecureMemoryStorage {
  constructor() {
    this.storage = new Map();
    this.encryptionKey = crypto.randomBytes(32);
    this.algorithm = 'aes-256-gcm';
  }

  encrypt(data) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipherGCM(this.algorithm, this.encryptionKey, iv);
    cipher.setAAD(Buffer.from('auth-data'));
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  decrypt(encryptedData) {
    try {
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const decipher = crypto.createDecipherGCM(this.algorithm, this.encryptionKey, iv);
      decipher.setAAD(Buffer.from('auth-data'));
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('[SecureMemory] Decryption failed:', error.message);
      return null;
    }
  }

  store(userId, authData, rememberMe = false) {
    try {
      const encrypted = this.encrypt({
        accessToken: authData.accessToken,
        refreshToken: rememberMe ? authData.refreshToken : null,
        user: authData.user,
        rememberMe,
        timestamp: Date.now()
      });
      
      this.storage.set(userId, encrypted);
      console.log(`[SecureMemory] Encrypted auth data stored for: ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('[SecureMemory] Store failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  get(userId) {
    try {
      const encryptedData = this.storage.get(userId);
      if (!encryptedData) {
        return { success: false, error: 'No data found' };
      }
      
      const decrypted = this.decrypt(encryptedData);
      if (!decrypted) {
        return { success: false, error: 'Failed to decrypt data' };
      }
      
      console.log(`[SecureMemory] Retrieved auth data for: ${userId}`);
      return { success: true, data: decrypted };
    } catch (error) {
      console.error('[SecureMemory] Get failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  clear(userId) {
    try {
      const existed = this.storage.delete(userId);
      console.log(`[SecureMemory] Cleared auth data for: ${userId} (existed: ${existed})`);
      return { success: true, existed };
    } catch (error) {
      console.error('[SecureMemory] Clear failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  clearAll() {
    try {
      const count = this.storage.size;
      this.storage.clear();
      console.log(`[SecureMemory] Cleared all auth data (${count} entries)`);
      return { success: true, count };
    } catch (error) {
      console.error('[SecureMemory] Clear all failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

let secureMemory;

// ============================================
// SYSTEM TRAY FUNCTIONALITY
// ============================================

// Create and setup system tray
function createTray() {
  try {
    log.info('Creating system tray...');
    
    // Create tray icon - use the app icon
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    let trayIcon;
    
    if (fs.existsSync(iconPath)) {
      trayIcon = nativeImage.createFromPath(iconPath);
      // Resize for tray on different platforms
      if (process.platform === 'darwin') {
        trayIcon = trayIcon.resize({ width: 16, height: 16 });
      } else {
        trayIcon = trayIcon.resize({ width: 24, height: 24 });
      }
    } else {
      // Create a simple fallback icon if file doesn't exist
      trayIcon = nativeImage.createEmpty();
      log.warn('Tray icon file not found, using fallback');
    }
    
    // Create the tray
    tray = new Tray(trayIcon);
    tray.setToolTip('Stock Monitor - Running in background');
    
    // Create context menu
    updateTrayMenu();
    
    // Handle tray click events
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          showWindow();
        }
      }
    });
    
    tray.on('double-click', () => {
      showWindow();
    });
    
    log.info('System tray created successfully');
    return true;
    
  } catch (error) {
    log.error('Failed to create system tray:', error);
    return false;
  }
}

// Update tray context menu
function updateTrayMenu() {
  if (!tray) return;
  
  try {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: mainWindow && mainWindow.isVisible() ? 'Hide Stock Monitor' : 'Show Stock Monitor',
        click: () => {
          if (mainWindow) {
            if (mainWindow.isVisible()) {
              mainWindow.hide();
            } else {
              showWindow();
            }
          }
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Open Dashboard',
        click: () => {
          showWindow();
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Quit Stock Monitor',
        click: () => {
          isQuiting = true;
          app.quit();
        }
      }
    ]);
    
    tray.setContextMenu(contextMenu);
  } catch (error) {
    log.error('Failed to update tray menu:', error);
  }
}

// Show window from tray
function showWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
    
    // Update tray menu to reflect window state
    updateTrayMenu();
  }
}

// Hide window to tray
function hideToTray() {
  if (mainWindow && trayEnabled) {
    mainWindow.hide();
    updateTrayMenu();
    
    // Show notification on first hide (optional)
    if (tray && process.platform === 'win32') {
      tray.displayBalloon({
        iconType: 'info',
        title: 'Stock Monitor',
        content: 'Application continues running in the background. Click the tray icon to open.'
      });
    }
  }
}

// Load user settings to check tray preference
async function loadUserSettings() {
  try {
    if (database && database.isInitialized) {
      const settingsResult = await database.getUserSettings();
      if (settingsResult.success && settingsResult.data) {
        userSettings = settingsResult.data;
        trayEnabled = userSettings.enableTaskTray || false;
        log.info(`[Settings] Tray enabled: ${trayEnabled}`);
        
        // Create/destroy tray based on settings
        if (trayEnabled && !tray) {
          createTray();
        } else if (!trayEnabled && tray) {
          destroyTray();
        }
      }
    }
  } catch (error) {
    log.error('[Settings] Failed to load user settings:', error);
    trayEnabled = false; // Default to disabled on error
  }
}

// Destroy system tray
function destroyTray() {
  if (tray) {
    log.info('Destroying system tray...');
    tray.destroy();
    tray = null;
  }
}

function createWindow() {
  try {
    log.info('Creating main window...');
    
    // Create the browser window
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js')
      },
      title: 'Stock Monitor',
      show: false, // Don't show until ready
      autoHideMenuBar: true
    });

    // Load the local frontend files
    const frontendPath = path.join(__dirname, 'frontend', 'index.html');
    
    log.info('Loading local frontend from:', frontendPath);
    
    // Check if the frontend files exist
    if (fs.existsSync(frontendPath)) {
      mainWindow.loadFile(frontendPath).catch(error => {
        log.error('Failed to load local frontend:', error);
        // Show error page if files are missing
        const errorHtml = `
          <html>
            <head>
              <title>Stock Monitor - Frontend Missing</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .error { color: #e74c3c; }
                .instruction { margin: 20px 0; }
              </style>
            </head>
            <body>
              <h1>Stock Monitor Desktop</h1>
              <p class="error">⚠️ Unable to load frontend files</p>
              <div class="instruction">
                <p>The frontend files are missing or corrupted.</p>
                <p>Expected location: ${frontendPath}</p>
              </div>
            </body>
          </html>
        `;
        mainWindow.loadURL(`data:text/html,${encodeURIComponent(errorHtml)}`);
      });
    } else {
      log.error('Frontend files not found at:', frontendPath);
      const errorHtml = `
        <html>
          <head>
            <title>Stock Monitor - Frontend Missing</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #e74c3c; }
              .instruction { margin: 20px 0; }
            </style>
          </head>
          <body>
            <h1>Stock Monitor Desktop</h1>
            <p class="error">⚠️ Frontend files not found</p>
            <div class="instruction">
              <p>Please build the frontend files first.</p>
              <p>Expected location: ${frontendPath}</p>
            </div>
          </body>
        </html>
      `;
      mainWindow.loadURL(`data:text/html,${encodeURIComponent(errorHtml)}`);
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
      log.info('Window ready, showing...');
      mainWindow.show();
      
      // Load user settings after window is ready
      loadUserSettings();
    });

    // Handle window minimize - hide to tray if enabled
    mainWindow.on('minimize', (event) => {
      if (trayEnabled && tray) {
        log.info('Window minimized, hiding to tray');
        event.preventDefault();
        hideToTray();
      }
    });

    // Handle window close - hide to tray if enabled, otherwise allow close
    mainWindow.on('close', (event) => {
      if (!isQuiting && trayEnabled && tray) {
        log.info('Window close prevented, hiding to tray');
        event.preventDefault();
        hideToTray();
      } else {
        log.info('Window closing normally');
      }
    });

    // Handle window closed
    mainWindow.on('closed', () => {
      log.info('Window closed');
      mainWindow = null;
    });

    log.info('Window created successfully');

  } catch (error) {
    log.error('Error creating window:', error);
  }
}

// Initialize database and app
async function initializeApp() {
  try {
    log.info('Initializing desktop database...');
    database = new DesktopDatabase();
    await database.initialize();
    log.info('Database initialized successfully');

    log.info('Initializing keychain service...');
    keychain = new KeychainService();
    await keychain._checkAvailability();
    log.info('Keychain service initialized successfully');

    log.info('Initializing secure memory storage...');
    secureMemory = new SecureMemoryStorage();
    log.info('Secure memory storage initialized successfully');
    
    log.info('App ready, creating window...');
    createWindow();
    
    // Start automatic update checking after a short delay to allow window to fully load
    setTimeout(() => {
      log.info('Starting automatic update checking...');
      checkForUpdates();
    }, 5000); // 5 second delay
  } catch (error) {
    log.error('Error initializing app:', error);
    // Show error dialog and still create window
    createWindow();
  }
}

// App event handlers
app.whenReady().then(initializeApp).catch(error => {
  log.error('Error in app.whenReady:', error);
});

app.on('window-all-closed', () => {
  log.info('All windows closed');
  
  // If tray is enabled and we have a tray, don't quit the app
  if (trayEnabled && tray) {
    log.info('Tray enabled - app will continue running in background');
    return;
  }
  
  // Otherwise follow normal behavior
  if (database) {
    database.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup database on app quit
app.on('before-quit', () => {
  log.info('App quitting, cleaning up...');
  
  // Mark as quiting to allow window to close
  isQuiting = true;
  
  // Cleanup resources
  if (database) {
    database.close();
  }
  
  // Destroy tray
  destroyTray();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    log.info('Activate event, creating window...');
    createWindow();
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  log.info('Another instance is running, quitting...');
  app.quit();
} else {
  app.on('second-instance', () => {
    log.info('Second instance attempted, focusing existing window...');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// IPC handlers for communication with frontend

// Main API request handler - routes all API calls through main process to bypass CORS
ipcMain.handle('apiRequest', async (event, { url, options = {} }) => {
  try {
    log.info(`[IPC API] ${options.method || 'GET'} ${url}`);
    
    // Configure axios request
    const serverUrl = process.env.SERVER_URL || process.env.AUTH_SERVER_URL || 'http://localhost:5000';
    const fullUrl = url.startsWith('http') ? url : `${serverUrl}${url}`;
    
    const axiosConfig = {
      method: options.method || 'GET',
      url: fullUrl,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Stock-Monitor-Desktop/1.0.0',
        ...options.headers
      },
      data: options.body ? JSON.parse(options.body) : undefined,
      timeout: 30000, // 30 seconds
      validateStatus: () => true // Don't throw on HTTP error status codes
    };
    
    const response = await axios(axiosConfig);
    
    log.info(`[IPC API] Response: ${response.status} ${response.statusText}`);
    
    // Return response in a format compatible with fetch Response
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
      url: fullUrl
    };
    
  } catch (error) {
    log.error('[IPC API] Request failed:', error.message);
    
    // Return error response in fetch-compatible format
    return {
      ok: false,
      status: error.code === 'ECONNREFUSED' ? 503 : 500,
      statusText: error.message,
      headers: {},
      data: { error: error.message },
      url: url
    };
  }
});

// ============================================
// DATABASE IPC HANDLERS
// ============================================

// Product operations
ipcMain.handle('db-get-products', async () => {
  try {
    if (!database?.isInitialized) {
      throw new Error('Database not initialized');
    }
    const products = database.getProducts();
    log.info(`[DB] Retrieved ${products.length} products`);
    return { success: true, data: products };
  } catch (error) {
    log.error('[DB] Get products failed:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-add-product', async (event, productData) => {
  try {
    if (!database?.isInitialized) {
      throw new Error('Database not initialized');
    }
    const product = database.addProduct(productData);
    log.info(`[DB] Added product: ${product.name}`);
    return { success: true, data: product };
  } catch (error) {
    log.error('[DB] Add product failed:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-update-product', async (event, { id, productData }) => {
  try {
    if (!database?.isInitialized) {
      throw new Error('Database not initialized');
    }
    const product = database.updateProduct(id, productData);
    log.info(`[DB] Updated product: ${id}`);
    return { success: true, data: product };
  } catch (error) {
    log.error('[DB] Update product failed:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-delete-product', async (event, productId) => {
  try {
    if (!database?.isInitialized) {
      throw new Error('Database not initialized');
    }
    const result = database.deleteProduct(productId);
    log.info(`[DB] Deleted product: ${productId}`);
    return { success: result.success, data: result };
  } catch (error) {
    log.error('[DB] Delete product failed:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-update-product-price', async (event, { id, price, isInStock }) => {
  try {
    if (!database?.isInitialized) {
      throw new Error('Database not initialized');
    }
    const product = database.updateProductPrice(id, price, isInStock);
    log.info(`[DB] Updated product price: ${id} -> $${price}`);
    return { success: true, data: product };
  } catch (error) {
    log.error('[DB] Update product price failed:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get-products-for-monitoring', async (event, platform) => {
  try {
    if (!database?.isInitialized) {
      throw new Error('Database not initialized');
    }
    const products = database.getProductsForMonitoring(platform);
    log.info(`[DB] Retrieved ${products.length} products for monitoring (${platform || 'all platforms'})`);
    return { success: true, data: products };
  } catch (error) {
    log.error('[DB] Get products for monitoring failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Monitoring operations
ipcMain.handle('db-add-monitoring-check', async (event, { productId, price, isInStock, success, errorMessage }) => {
  try {
    if (!database?.isInitialized) {
      throw new Error('Database not initialized');
    }
    const checkId = database.addMonitoringCheck(productId, price, isInStock, success, errorMessage);
    log.info(`[DB] Added monitoring check: ${checkId}`);
    return { success: true, data: { id: checkId } };
  } catch (error) {
    log.error('[DB] Add monitoring check failed:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get-monitoring-history', async (event, { productId, days }) => {
  try {
    if (!database?.isInitialized) {
      throw new Error('Database not initialized');
    }
    const history = database.getMonitoringHistory(productId, days);
    log.info(`[DB] Retrieved monitoring history for product: ${productId}`);
    return { success: true, data: history };
  } catch (error) {
    log.error('[DB] Get monitoring history failed:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get-all-monitoring-checks', async (event, limit) => {
  try {
    if (!database?.isInitialized) {
      throw new Error('Database not initialized');
    }
    const checks = database.getAllMonitoringChecks(limit);
    log.info(`[DB] Retrieved ${checks.length} monitoring checks`);
    return { success: true, data: checks };
  } catch (error) {
    log.error('[DB] Get all monitoring checks failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Settings operations
ipcMain.handle('db-get-user-settings', async () => {
  try {
    if (!database?.isInitialized) {
      throw new Error('Database not initialized');
    }
    const settings = database.getUserSettings();
    log.info('[DB] Retrieved user settings');
    return { success: true, data: settings };
  } catch (error) {
    log.error('[DB] Get user settings failed:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-update-user-settings', async (event, settings) => {
  try {
    if (!database?.isInitialized) {
      throw new Error('Database not initialized');
    }
    const updatedSettings = database.updateUserSettings(settings);
    log.info('[DB] Updated user settings');
    return { success: true, data: updatedSettings };
  } catch (error) {
    log.error('[DB] Update user settings failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Notification operations
ipcMain.handle('db-add-notification', async (event, { productId, type, title, message, data }) => {
  try {
    if (!database?.isInitialized) {
      throw new Error('Database not initialized');
    }
    const notificationId = database.addNotification(productId, type, title, message, data);
    log.info(`[DB] Added notification: ${notificationId}`);
    return { success: true, data: { id: notificationId } };
  } catch (error) {
    log.error('[DB] Add notification failed:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get-notifications', async (event, limit) => {
  try {
    if (!database?.isInitialized) {
      throw new Error('Database not initialized');
    }
    const notifications = database.getNotifications(limit);
    log.info(`[DB] Retrieved ${notifications.length} notifications`);
    return { success: true, data: notifications };
  } catch (error) {
    log.error('[DB] Get notifications failed:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-mark-notification-read', async (event, notificationId) => {
  try {
    if (!database?.isInitialized) {
      throw new Error('Database not initialized');
    }
    const result = database.markNotificationAsRead(notificationId);
    log.info(`[DB] Marked notification as read: ${notificationId}`);
    return { success: result };
  } catch (error) {
    log.error('[DB] Mark notification read failed:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-mark-all-notifications-read', async () => {
  try {
    if (!database?.isInitialized) {
      throw new Error('Database not initialized');
    }
    const count = database.markAllNotificationsAsRead();
    log.info(`[DB] Marked ${count} notifications as read`);
    return { success: true, data: { count } };
  } catch (error) {
    log.error('[DB] Mark all notifications read failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Data export/import operations
ipcMain.handle('db-export-data', async () => {
  try {
    if (!database?.isInitialized) {
      throw new Error('Database not initialized');
    }
    const data = database.exportData();
    log.info('[DB] Exported database data');
    return { success: true, data };
  } catch (error) {
    log.error('[DB] Export data failed:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-import-data', async (event, data) => {
  try {
    if (!database?.isInitialized) {
      throw new Error('Database not initialized');
    }
    const result = database.importData(data);
    log.info('[DB] Imported database data');
    return { success: true, data: result };
  } catch (error) {
    log.error('[DB] Import data failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Database statistics
ipcMain.handle('db-get-stats', async () => {
  try {
    if (!database?.isInitialized) {
      throw new Error('Database not initialized');
    }
    const stats = database.getStats();
    log.info('[DB] Retrieved database statistics');
    return { success: true, data: stats };
  } catch (error) {
    log.error('[DB] Get stats failed:', error.message);
    return { success: false, error: error.message };
  }
});


// ============================================
// KEYCHAIN IPC HANDLERS
// ============================================

// Store authentication data securely in OS keychain
ipcMain.handle('keychain-store-auth', async (event, { userId, authData, rememberMe }) => {
  try {
    if (!keychain) {
      throw new Error('Keychain service not initialized');
    }
    
    const success = await keychain.storeAuthData(userId, authData, rememberMe);
    log.info(`[Keychain] Store auth data ${success ? 'successful' : 'failed'} for user: ${userId}`);
    return { success, available: keychain.isKeychainAvailable() };
  } catch (error) {
    log.error('[Keychain] Store auth data failed:', error.message);
    return { success: false, error: error.message, available: keychain?.isKeychainAvailable() || false };
  }
});

// Retrieve authentication data from OS keychain
ipcMain.handle('keychain-get-auth', async (event, userId) => {
  try {
    if (!keychain) {
      throw new Error('Keychain service not initialized');
    }
    
    const authData = await keychain.getAuthData(userId);
    log.info(`[Keychain] Retrieved auth data for user: ${userId}`);
    return { success: true, data: authData, available: keychain.isKeychainAvailable() };
  } catch (error) {
    log.error('[Keychain] Get auth data failed:', error.message);
    return { success: false, error: error.message, available: keychain?.isKeychainAvailable() || false };
  }
});

// Clear authentication data from OS keychain (logout)
ipcMain.handle('keychain-clear-auth', async (event, userId) => {
  try {
    if (!keychain) {
      throw new Error('Keychain service not initialized');
    }
    
    const success = await keychain.clearAuthData(userId);
    log.info(`[Keychain] Clear auth data ${success ? 'successful' : 'failed'} for user: ${userId}`);
    return { success, available: keychain.isKeychainAvailable() };
  } catch (error) {
    log.error('[Keychain] Clear auth data failed:', error.message);
    return { success: false, error: error.message, available: keychain?.isKeychainAvailable() || false };
  }
});

// Store/retrieve individual tokens
ipcMain.handle('keychain-store-token', async (event, { userId, tokenType, value }) => {
  try {
    if (!keychain) {
      throw new Error('Keychain service not initialized');
    }
    
    const success = await keychain.storeToken(userId, tokenType, value);
    log.info(`[Keychain] Store token ${tokenType} ${success ? 'successful' : 'failed'}`);
    return { success, available: keychain.isKeychainAvailable() };
  } catch (error) {
    log.error(`[Keychain] Store token ${tokenType} failed:`, error.message);
    return { success: false, error: error.message, available: keychain?.isKeychainAvailable() || false };
  }
});

ipcMain.handle('keychain-get-token', async (event, { userId, tokenType }) => {
  try {
    if (!keychain) {
      throw new Error('Keychain service not initialized');
    }
    
    const token = await keychain.getToken(userId, tokenType);
    return { 
      success: true, 
      data: token, 
      available: keychain.isKeychainAvailable(),
      hasToken: !!token 
    };
  } catch (error) {
    log.error(`[Keychain] Get token ${tokenType} failed:`, error.message);
    return { success: false, error: error.message, available: keychain?.isKeychainAvailable() || false };
  }
});

ipcMain.handle('keychain-delete-token', async (event, { userId, tokenType }) => {
  try {
    if (!keychain) {
      throw new Error('Keychain service not initialized');
    }
    
    const success = await keychain.deleteToken(userId, tokenType);
    log.info(`[Keychain] Delete token ${tokenType} ${success ? 'successful' : 'failed'}`);
    return { success, available: keychain.isKeychainAvailable() };
  } catch (error) {
    log.error(`[Keychain] Delete token ${tokenType} failed:`, error.message);
    return { success: false, error: error.message, available: keychain?.isKeychainAvailable() || false };
  }
});

// Login email preference management
ipcMain.handle('keychain-store-login-email', async (event, email) => {
  try {
    if (!keychain) {
      throw new Error('Keychain service not initialized');
    }
    
    const success = await keychain.storeLoginEmail(email);
    log.info(`[Keychain] Store login email ${success ? 'successful' : 'failed'}`);
    return { success, available: keychain.isKeychainAvailable() };
  } catch (error) {
    log.error('[Keychain] Store login email failed:', error.message);
    return { success: false, error: error.message, available: keychain?.isKeychainAvailable() || false };
  }
});

ipcMain.handle('keychain-get-login-email', async () => {
  try {
    if (!keychain) {
      throw new Error('Keychain service not initialized');
    }
    
    const email = await keychain.getLoginEmail();
    return { 
      success: true, 
      data: email, 
      available: keychain.isKeychainAvailable(),
      hasEmail: !!email 
    };
  } catch (error) {
    log.error('[Keychain] Get login email failed:', error.message);
    return { success: false, error: error.message, available: keychain?.isKeychainAvailable() || false };
  }
});

ipcMain.handle('keychain-clear-login-email', async () => {
  try {
    if (!keychain) {
      throw new Error('Keychain service not initialized');
    }
    
    const success = await keychain.clearLoginEmail();
    log.info(`[Keychain] Clear login email ${success ? 'successful' : 'failed'}`);
    return { success, available: keychain.isKeychainAvailable() };
  } catch (error) {
    log.error('[Keychain] Clear login email failed:', error.message);
    return { success: false, error: error.message, available: keychain?.isKeychainAvailable() || false };
  }
});

// Keychain status and management
ipcMain.handle('keychain-get-status', async () => {
  try {
    if (!keychain) {
      return { 
        success: false, 
        error: 'Keychain service not initialized',
        available: false,
        data: { available: false, serviceName: 'StockMonitor', credentialCount: 0, platform: process.platform }
      };
    }
    
    const status = await keychain.getStatus();
    return { 
      success: true, 
      data: status, 
      available: keychain.isKeychainAvailable() 
    };
  } catch (error) {
    log.error('[Keychain] Get status failed:', error.message);
    return { success: false, error: error.message, available: false };
  }
});

ipcMain.handle('keychain-clear-all', async () => {
  try {
    if (!keychain) {
      throw new Error('Keychain service not initialized');
    }
    
    const success = await keychain.clearAllCredentials();
    log.info(`[Keychain] Clear all credentials ${success ? 'successful' : 'failed'}`);
    return { success, available: keychain.isKeychainAvailable() };
  } catch (error) {
    log.error('[Keychain] Clear all credentials failed:', error.message);
    return { success: false, error: error.message, available: keychain?.isKeychainAvailable() || false };
  }
});

// ============================================
// SECURE MEMORY STORAGE IPC HANDLERS
// ============================================

// Store authentication data in encrypted memory (fallback when keychain unavailable)
ipcMain.handle('memory-store-auth', async (event, { userId, authData, rememberMe }) => {
  try {
    if (!secureMemory) {
      throw new Error('Secure memory storage not initialized');
    }
    
    const result = secureMemory.store(userId, authData, rememberMe);
    log.info(`[Memory Storage] Store auth data ${result.success ? 'successful' : 'failed'} for: ${userId}`);
    return result;
  } catch (error) {
    log.error('[Memory Storage] Store auth data failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Retrieve authentication data from encrypted memory
ipcMain.handle('memory-get-auth', async (event, userId) => {
  try {
    if (!secureMemory) {
      throw new Error('Secure memory storage not initialized');
    }
    
    const result = secureMemory.get(userId);
    log.info(`[Memory Storage] Get auth data ${result.success ? 'successful' : 'failed'} for: ${userId}`);
    return result;
  } catch (error) {
    log.error('[Memory Storage] Get auth data failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Clear authentication data from encrypted memory
ipcMain.handle('memory-clear-auth', async (event, userId) => {
  try {
    if (!secureMemory) {
      throw new Error('Secure memory storage not initialized');
    }
    
    const result = secureMemory.clear(userId);
    log.info(`[Memory Storage] Clear auth data ${result.success ? 'successful' : 'failed'} for: ${userId}`);
    return result;
  } catch (error) {
    log.error('[Memory Storage] Clear auth data failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Clear all authentication data from encrypted memory
ipcMain.handle('memory-clear-all', async () => {
  try {
    if (!secureMemory) {
      throw new Error('Secure memory storage not initialized');
    }
    
    const result = secureMemory.clearAll();
    log.info(`[Memory Storage] Clear all auth data ${result.success ? 'successful' : 'failed'} (${result.count || 0} entries)`);
    return result;
  } catch (error) {
    log.error('[Memory Storage] Clear all auth data failed:', error.message);
    return { success: false, error: error.message };
  }
});

// ============================================
// SYSTEM TRAY IPC HANDLERS
// ============================================

// Get system tray status and configuration
ipcMain.handle('tray-get-status', async () => {
  try {
    const status = {
      available: true, // Tray is always available
      enabled: trayEnabled,
      created: !!tray,
      platform: process.platform,
      windowVisible: mainWindow ? mainWindow.isVisible() : false
    };
    
    log.info(`[Tray] Status requested - enabled: ${trayEnabled}, created: ${!!tray}`);
    return { success: true, data: status };
  } catch (error) {
    log.error('[Tray] Get status failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Toggle system tray functionality
ipcMain.handle('tray-toggle', async (event, enabled) => {
  try {
    log.info(`[Tray] Toggle requested - new state: ${enabled}`);
    
    const previousState = trayEnabled;
    trayEnabled = enabled;
    
    if (enabled && !tray) {
      // Enable tray - create it
      const success = createTray();
      if (!success) {
        trayEnabled = previousState; // Revert on failure
        throw new Error('Failed to create system tray');
      }
    } else if (!enabled && tray) {
      // Disable tray - destroy it
      destroyTray();
    }
    
    // Update user settings in database if available
    if (database && database.isInitialized) {
      try {
        const currentSettings = await database.getUserSettings();
        if (currentSettings.success && currentSettings.data) {
          const updatedSettings = { ...currentSettings.data, enableTaskTray: enabled };
          await database.updateUserSettings(updatedSettings);
          log.info(`[Tray] Updated settings in database: enableTaskTray = ${enabled}`);
        }
      } catch (dbError) {
        log.warn('[Tray] Failed to update settings in database:', dbError.message);
        // Don't fail the toggle operation if database update fails
      }
    }
    
    log.info(`[Tray] Toggle completed - enabled: ${trayEnabled}, tray exists: ${!!tray}`);
    return { 
      success: true, 
      data: { 
        enabled: trayEnabled, 
        created: !!tray,
        previousState 
      } 
    };
    
  } catch (error) {
    log.error('[Tray] Toggle failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Show window from tray or in general
ipcMain.handle('tray-show-window', async () => {
  try {
    log.info('[Tray] Show window requested');
    
    if (!mainWindow) {
      throw new Error('Main window not available');
    }
    
    showWindow();
    
    return { success: true, data: { visible: mainWindow.isVisible() } };
  } catch (error) {
    log.error('[Tray] Show window failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Hide window to tray
ipcMain.handle('tray-hide-window', async () => {
  try {
    log.info('[Tray] Hide window requested');
    
    if (!mainWindow) {
      throw new Error('Main window not available');
    }
    
    if (!trayEnabled || !tray) {
      throw new Error('System tray not enabled');
    }
    
    hideToTray();
    
    return { success: true, data: { visible: mainWindow.isVisible() } };
  } catch (error) {
    log.error('[Tray] Hide window failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Force refresh of settings (useful when settings change)
ipcMain.handle('tray-refresh-settings', async () => {
  try {
    log.info('[Tray] Refresh settings requested');
    
    await loadUserSettings();
    
    return { 
      success: true, 
      data: { 
        enabled: trayEnabled, 
        created: !!tray 
      } 
    };
  } catch (error) {
    log.error('[Tray] Refresh settings failed:', error.message);
    return { success: false, error: error.message };
  }
});

// ============================================
// AUTO-UPDATER IPC HANDLERS
// ============================================

// Manual check for updates
ipcMain.handle('updater-check-for-updates', async () => {
  try {
    log.info('[IPC AutoUpdater] Manual update check requested');
    checkForUpdates();
    return { success: true, message: 'Update check initiated' };
  } catch (error) {
    log.error('[IPC AutoUpdater] Manual update check failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Install update and restart
ipcMain.handle('updater-install-and-restart', async () => {
  try {
    log.info('[IPC AutoUpdater] Install and restart requested');
    installUpdateAndRestart();
    return { success: true, message: 'Update installation initiated' };
  } catch (error) {
    log.error('[IPC AutoUpdater] Install and restart failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Get current app version
ipcMain.handle('updater-get-version', async () => {
  try {
    const version = app.getVersion();
    log.info(`[IPC AutoUpdater] Current version: ${version}`);
    return { success: true, version };
  } catch (error) {
    log.error('[IPC AutoUpdater] Get version failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Get update status
ipcMain.handle('updater-get-status', async () => {
  try {
    const isDev = process.env.NODE_ENV === 'development';
    const status = {
      isDevelopment: isDev,
      updateCheckEnabled: !isDev,
      autoDownload: autoUpdater.autoDownload,
      autoInstallOnAppQuit: autoUpdater.autoInstallOnAppQuit
    };
    log.info('[IPC AutoUpdater] Status requested:', status);
    return { success: true, data: status };
  } catch (error) {
    log.error('[IPC AutoUpdater] Get status failed:', error.message);
    return { success: false, error: error.message };
  }
});

log.info('Stock Monitor starting...');