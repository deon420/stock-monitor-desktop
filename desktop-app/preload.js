const { contextBridge, ipcRenderer } = require('electron');

// Debug logging for preload script
console.log('[Preload] Preload script starting...');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
try {
  console.log('[Preload] Exposing electronAPI to main world...');
  contextBridge.exposeInMainWorld('electronAPI', {
  
  // HTTP API for authentication and data (fallback to external server)
  apiRequest: async (url, options = {}) => {
    try {
      console.log(`[Desktop API] Making IPC request to: ${url}`);
      
      // Use IPC to make the request through the main process (bypasses CORS)
      const ipcResponse = await ipcRenderer.invoke('apiRequest', {
        url,
        options
      });
      
      console.log(`[Desktop API] IPC Response status: ${ipcResponse.status}`);
      
      // Create a fetch-compatible Response object
      const responseObj = {
        ok: ipcResponse.ok,
        status: ipcResponse.status,
        statusText: ipcResponse.statusText,
        headers: ipcResponse.headers,
        url: ipcResponse.url,
        
        // Implement fetch Response methods
        json: async () => ipcResponse.data,
        text: async () => {
          if (typeof ipcResponse.data === 'string') {
            return ipcResponse.data;
          }
          return JSON.stringify(ipcResponse.data);
        },
        blob: async () => {
          throw new Error('blob() not supported in desktop mode');
        },
        arrayBuffer: async () => {
          throw new Error('arrayBuffer() not supported in desktop mode');
        },
        clone: () => {
          return { ...responseObj };
        }
      };
      
      return responseObj;
      
    } catch (error) {
      console.error('Desktop API IPC request error:', error);
      throw error;
    }
  },

  // ============================================
  // LOCAL DATABASE API
  // ============================================
  
  // Database API object for local SQLite operations
  database: {
    // Product operations
    products: {
      getAll: () => ipcRenderer.invoke('db-get-products'),
      add: (productData) => ipcRenderer.invoke('db-add-product', productData),
      update: (id, productData) => ipcRenderer.invoke('db-update-product', { id, productData }),
      delete: (productId) => ipcRenderer.invoke('db-delete-product', productId),
      updatePrice: (id, price, isInStock) => ipcRenderer.invoke('db-update-product-price', { id, price, isInStock }),
      getForMonitoring: (platform) => ipcRenderer.invoke('db-get-products-for-monitoring', platform)
    },
    
    // Monitoring operations
    monitoring: {
      addCheck: (productId, price, isInStock, success, errorMessage) => 
        ipcRenderer.invoke('db-add-monitoring-check', { productId, price, isInStock, success, errorMessage }),
      getHistory: (productId, days) => ipcRenderer.invoke('db-get-monitoring-history', { productId, days }),
      getAllChecks: (limit) => ipcRenderer.invoke('db-get-all-monitoring-checks', limit)
    },
    
    // Settings operations
    settings: {
      get: () => ipcRenderer.invoke('db-get-user-settings'),
      update: (settings) => ipcRenderer.invoke('db-update-user-settings', settings)
    },
    
    // Notification operations
    notifications: {
      add: (productId, type, title, message, data) => 
        ipcRenderer.invoke('db-add-notification', { productId, type, title, message, data }),
      getAll: (limit) => ipcRenderer.invoke('db-get-notifications', limit),
      markAsRead: (notificationId) => ipcRenderer.invoke('db-mark-notification-read', notificationId),
      markAllAsRead: () => ipcRenderer.invoke('db-mark-all-notifications-read')
    },
    
    // Data operations
    data: {
      export: () => ipcRenderer.invoke('db-export-data'),
      import: (data) => ipcRenderer.invoke('db-import-data', data)
    },
    
    // Statistics
    stats: () => ipcRenderer.invoke('db-get-stats')
  },
  
  // Helper functions for database operations with error handling
  dbHelper: {
    // Wrapper that handles database responses consistently
    async safeCall(operation) {
      try {
        const result = await operation();
        if (result && result.success !== undefined) {
          // Handle standard { success, data, error } format
          if (result.success) {
            return result.data;
          } else {
            throw new Error(result.error || 'Database operation failed');
          }
        }
        // Return raw result if not in standard format
        return result;
      } catch (error) {
        console.error('[Desktop DB] Operation failed:', error.message);
        throw error;
      }
    },
    
    // Check if we're in desktop environment
    isDesktop: () => true,
    
    // Get database status
    async getStatus() {
      try {
        const stats = await ipcRenderer.invoke('db-get-stats');
        return {
          available: stats.success,
          ...stats.data
        };
      } catch (error) {
        return {
          available: false,
          error: error.message
        };
      }
    }
  },
  
  // ============================================
  // SECURE KEYCHAIN API
  // ============================================
  
  // Keychain API object for secure OS-level credential storage
  keychain: {
    // Authentication data management (high-level operations)
    auth: {
      store: (userId, authData, rememberMe) => 
        ipcRenderer.invoke('keychain-store-auth', { userId, authData, rememberMe }),
      get: (userId) => 
        ipcRenderer.invoke('keychain-get-auth', userId),
      clear: (userId) => 
        ipcRenderer.invoke('keychain-clear-auth', userId)
    },
    
    // Individual token operations (low-level operations)
    tokens: {
      store: (userId, tokenType, value) => 
        ipcRenderer.invoke('keychain-store-token', { userId, tokenType, value }),
      get: (userId, tokenType) => 
        ipcRenderer.invoke('keychain-get-token', { userId, tokenType }),
      delete: (userId, tokenType) => 
        ipcRenderer.invoke('keychain-delete-token', { userId, tokenType })
    },
    
    // Login preferences (email remembering)
    preferences: {
      storeEmail: (email) => 
        ipcRenderer.invoke('keychain-store-login-email', email),
      getEmail: () => 
        ipcRenderer.invoke('keychain-get-login-email'),
      clearEmail: () => 
        ipcRenderer.invoke('keychain-clear-login-email')
    },
    
    // System management
    system: {
      getStatus: () => 
        ipcRenderer.invoke('keychain-get-status'),
      clearAll: () => 
        ipcRenderer.invoke('keychain-clear-all')
    }
  },
  
  // Helper functions for keychain operations with consistent error handling
  keychainHelper: {
    // Wrapper that handles keychain responses consistently
    async safeCall(operation) {
      try {
        const result = await operation();
        if (result && result.success !== undefined) {
          // Handle standard { success, data, error, available } format
          if (result.success) {
            return result.data;
          } else {
            // Check if keychain is available before throwing error
            if (result.available === false) {
              console.warn('[Desktop Keychain] OS keychain not available, falling back to memory storage');
              throw new Error('Keychain not available on this system');
            }
            throw new Error(result.error || 'Keychain operation failed');
          }
        }
        // Return raw result if not in standard format
        return result;
      } catch (error) {
        console.error('[Desktop Keychain] Operation failed:', error.message);
        throw error;
      }
    },
    
    // Check if keychain is available on this system
    async isAvailable() {
      try {
        const status = await ipcRenderer.invoke('keychain-get-status');
        return status.available || false;
      } catch (error) {
        console.warn('[Desktop Keychain] Availability check failed:', error.message);
        return false;
      }
    },
    
    // Get keychain status and information
    async getStatus() {
      try {
        const result = await ipcRenderer.invoke('keychain-get-status');
        return {
          available: result.available || false,
          ...result.data
        };
      } catch (error) {
        return {
          available: false,
          error: error.message,
          serviceName: 'StockMonitor',
          credentialCount: 0,
          platform: 'unknown'
        };
      }
    },
    
    // Store authentication data with secure fallback
    async storeAuthSafe(userId, authData, rememberMe = false) {
      try {
        const result = await ipcRenderer.invoke('keychain-store-auth', { 
          userId, 
          authData, 
          rememberMe 
        });
        
        if (!result.available) {
          // Keychain not available - store in encrypted memory only
          console.warn('[Desktop Keychain] Keychain unavailable - tokens stored in secure memory only');
          // Store in encrypted main process memory via IPC
          const memoryResult = await ipcRenderer.invoke('memory-store-auth', {
            userId,
            authData: {
              accessToken: authData.accessToken,
              refreshToken: rememberMe ? authData.refreshToken : null, // Only store refresh token if remember me
              user: authData.user
            },
            rememberMe
          });
          return { success: memoryResult.success, fallback: true, memoryStorage: true };
        }
        
        return result;
      } catch (error) {
        console.error('[Desktop Keychain] Store auth failed:', error.message);
        // Store in encrypted main process memory as secure fallback
        try {
          const memoryResult = await ipcRenderer.invoke('memory-store-auth', {
            userId,
            authData: {
              accessToken: authData.accessToken,
              refreshToken: rememberMe ? authData.refreshToken : null,
              user: authData.user
            },
            rememberMe
          });
          return { success: memoryResult.success, fallback: true, memoryStorage: true };
        } catch (memError) {
          console.error('[Desktop Keychain] All storage methods failed:', memError.message);
          return { success: false, error: 'Unable to securely store authentication data' };
        }
      }
    },
    
    // Get authentication data with secure fallback
    async getAuthSafe(userId) {
      try {
        const result = await ipcRenderer.invoke('keychain-get-auth', userId);
        
        if (!result.available || !result.success) {
          // Try encrypted memory storage fallback
          console.info('[Desktop Keychain] Keychain unavailable, checking secure memory storage');
          const memoryResult = await ipcRenderer.invoke('memory-get-auth', userId);
          return memoryResult.success ? memoryResult.data : null;
        }
        
        return result.data;
      } catch (error) {
        console.warn('[Desktop Keychain] Get auth failed, trying secure memory fallback:', error.message);
        // Try encrypted memory storage fallback
        try {
          const memoryResult = await ipcRenderer.invoke('memory-get-auth', userId);
          return memoryResult.success ? memoryResult.data : null;
        } catch (memError) {
          console.error('[Desktop Keychain] All retrieval methods failed:', memError.message);
          return null;
        }
      }
    },
    
    // Clear authentication data from both keychain and secure memory
    async clearAuthSafe(userId) {
      try {
        const keychainResult = await ipcRenderer.invoke('keychain-clear-auth', userId);
        const memoryResult = await ipcRenderer.invoke('memory-clear-auth', userId);
        
        return {
          success: keychainResult.success || memoryResult.success,
          keychain: keychainResult.success,
          memory: memoryResult.success
        };
      } catch (error) {
        console.warn('[Desktop Keychain] Clear auth failed:', error.message);
        // Ensure memory is cleared even if keychain fails
        try {
          await ipcRenderer.invoke('memory-clear-auth', userId);
        } catch (memError) {
          console.error('[Desktop Keychain] Failed to clear memory storage:', memError.message);
        }
        return { success: true, fallback: true };
      }
    }
  },
  
  // ============================================
  // SYSTEM TRAY API
  // ============================================
  
  // System tray API object for managing system tray functionality
  tray: {
    // Get current tray status and configuration
    getStatus: () => ipcRenderer.invoke('tray-get-status'),
    
    // Toggle tray functionality on/off
    toggle: (enabled) => ipcRenderer.invoke('tray-toggle', enabled),
    
    // Window management methods
    window: {
      show: () => ipcRenderer.invoke('tray-show-window'),
      hide: () => ipcRenderer.invoke('tray-hide-window')
    },
    
    // Force refresh of tray settings (useful when settings change)
    refreshSettings: () => ipcRenderer.invoke('tray-refresh-settings')
  },
  
  // Helper functions for tray operations with consistent error handling
  trayHelper: {
    // Wrapper that handles tray responses consistently
    async safeCall(operation) {
      try {
        const result = await operation();
        if (result && result.success !== undefined) {
          // Handle standard { success, data, error } format
          if (result.success) {
            return result.data;
          } else {
            throw new Error(result.error || 'Tray operation failed');
          }
        }
        // Return raw result if not in standard format
        return result;
      } catch (error) {
        console.error('[Desktop Tray] Operation failed:', error.message);
        throw error;
      }
    },
    
    // Check if tray is available on this system
    async isAvailable() {
      try {
        const status = await ipcRenderer.invoke('tray-get-status');
        return status.success && status.data.available;
      } catch (error) {
        console.warn('[Desktop Tray] Availability check failed:', error.message);
        return false;
      }
    },
    
    // Get comprehensive tray status
    async getStatus() {
      try {
        const result = await ipcRenderer.invoke('tray-get-status');
        return {
          available: result.success && result.data.available,
          enabled: result.data?.enabled || false,
          created: result.data?.created || false,
          platform: result.data?.platform || 'unknown',
          windowVisible: result.data?.windowVisible || false,
          ...result.data
        };
      } catch (error) {
        return {
          available: false,
          enabled: false,
          created: false,
          platform: 'unknown',
          windowVisible: false,
          error: error.message
        };
      }
    },
    
    // Safely toggle tray functionality with error handling
    async toggleSafe(enabled) {
      try {
        const result = await ipcRenderer.invoke('tray-toggle', enabled);
        if (result.success) {
          console.log(`[Desktop Tray] Toggle successful - enabled: ${result.data.enabled}`);
          return result.data;
        } else {
          throw new Error(result.error || 'Failed to toggle tray');
        }
      } catch (error) {
        console.error('[Desktop Tray] Toggle failed:', error.message);
        throw error;
      }
    },
    
    // Safely show window with error handling
    async showWindowSafe() {
      try {
        const result = await ipcRenderer.invoke('tray-show-window');
        if (result.success) {
          console.log('[Desktop Tray] Window shown successfully');
          return result.data;
        } else {
          throw new Error(result.error || 'Failed to show window');
        }
      } catch (error) {
        console.error('[Desktop Tray] Show window failed:', error.message);
        throw error;
      }
    },
    
    // Safely hide window to tray with error handling
    async hideWindowSafe() {
      try {
        const result = await ipcRenderer.invoke('tray-hide-window');
        if (result.success) {
          console.log('[Desktop Tray] Window hidden to tray successfully');
          return result.data;
        } else {
          throw new Error(result.error || 'Failed to hide window to tray');
        }
      } catch (error) {
        console.error('[Desktop Tray] Hide window failed:', error.message);
        throw error;
      }
    }
  },
  
  // App lifecycle methods
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback)
});

  console.log('[Preload] electronAPI successfully exposed to main world');
} catch (error) {
  console.error('[Preload] Failed to expose electronAPI:', error);
}

console.log('[Preload] Preload script completed');