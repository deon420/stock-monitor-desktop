const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { app } = require('electron');

let Database;
try {
  Database = require('better-sqlite3');
  console.log('✅ better-sqlite3 loaded successfully');
} catch (error) {
  console.error('❌ Failed to load better-sqlite3:', error.message);
  throw new Error('better-sqlite3 is required for local database storage');
}

// Encryption configuration (same as server-side)
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

class DesktopDatabase {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.masterKey = null;
    this.initializeEncryption();
  }
  
  /**
   * Initialize encryption key for secure credential storage
   */
  initializeEncryption() {
    // For desktop app, we'll generate a key tied to the user's system
    // In production, this should use OS keychain or hardware-backed storage
    const keyFromEnv = process.env.DESKTOP_ENCRYPTION_KEY;
    
    if (keyFromEnv) {
      this.masterKey = Buffer.from(keyFromEnv, 'hex');
      if (this.masterKey.length !== KEY_LENGTH) {
        throw new Error('Invalid desktop encryption key length');
      }
    } else {
      // Generate a new random key and store it securely
      this.masterKey = crypto.randomBytes(KEY_LENGTH);
      console.warn('⚠️ Generated new encryption key for desktop database');
      console.warn('⚠️ For production, implement OS keychain storage');
    }
  }
  
  /**
   * Derive encryption key from master key and salt
   */
  deriveKey(salt) {
    return crypto.pbkdf2Sync(this.masterKey, salt, 100000, KEY_LENGTH, 'sha256');
  }
  
  /**
   * Encrypt sensitive data like passwords
   */
  encryptSensitiveData(plaintext) {
    if (!plaintext || plaintext.trim() === '') {
      return '';
    }
    
    try {
      const salt = crypto.randomBytes(SALT_LENGTH);
      const iv = crypto.randomBytes(IV_LENGTH);
      const key = this.deriveKey(salt);
      
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      cipher.setAAD(salt);
      
      let encrypted = cipher.update(plaintext, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      const tag = cipher.getAuthTag();
      const result = Buffer.concat([salt, iv, tag, encrypted]);
      
      return result.toString('base64');
    } catch (error) {
      console.error('Desktop encryption failed:', error);
      throw new Error('Failed to encrypt sensitive data');
    }
  }
  
  /**
   * Decrypt sensitive data
   */
  decryptSensitiveData(encryptedData) {
    if (!encryptedData || encryptedData.trim() === '') {
      return '';
    }
    
    try {
      const buffer = Buffer.from(encryptedData, 'base64');
      
      const salt = buffer.subarray(0, SALT_LENGTH);
      const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
      const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
      const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
      
      const key = this.deriveKey(salt);
      
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
      decipher.setAAD(salt);
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      console.warn('Desktop decryption failed, assuming plain text (migration mode)');
      return encryptedData; // Fallback for migration
    }
  }

  /**
   * Initialize the database connection and create tables
   */
  async initialize() {
    try {
      // Use app.getPath('userData') for proper user data directory
      const userDataPath = app.getPath('userData');
      const dbPath = path.join(userDataPath, 'stock-monitor.db');
      
      // Ensure the directory exists
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }

      console.log(`📂 Database path: ${dbPath}`);
      
      // Create database connection
      this.db = new Database(dbPath);
      
      // Enable WAL mode for better concurrent access
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 1000');
      this.db.pragma('temp_store = memory');
      
      // Create tables
      this.createTables();
      
      // Insert default settings if none exist
      this.initializeDefaultSettings();
      
      this.isInitialized = true;
      console.log('✅ Desktop SQLite database initialized successfully');
      
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create all required tables
   */
  createTables() {
    console.log('📋 Creating database tables...');

    // Products table for monitoring
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        platform TEXT NOT NULL CHECK (platform IN ('amazon', 'walmart')),
        asin TEXT,
        currentPrice REAL,
        originalPrice REAL,
        targetPrice REAL,
        isInStock BOOLEAN DEFAULT 1,
        notifyOnPriceDrop BOOLEAN DEFAULT 1,
        notifyOnStockChange BOOLEAN DEFAULT 1,
        imageUrl TEXT,
        lastChecked DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Monitoring checks history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS monitoring_checks (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        productId TEXT NOT NULL,
        price REAL,
        isInStock BOOLEAN NOT NULL,
        success BOOLEAN DEFAULT 1,
        errorMessage TEXT,
        checkedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (productId) REFERENCES products (id) ON DELETE CASCADE
      )
    `);

    // User settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY,
        amazonCheckInterval INTEGER DEFAULT 20,
        walmartCheckInterval INTEGER DEFAULT 10,
        enableRandomization BOOLEAN DEFAULT 1,
        enableAudio BOOLEAN DEFAULT 1,
        audioNotificationSound TEXT DEFAULT 'notification',
        audioVolume INTEGER DEFAULT 80,
        enableEmail BOOLEAN DEFAULT 0,
        gmailEmail TEXT DEFAULT '',
        gmailAppPassword TEXT DEFAULT '',
        enableTaskTray BOOLEAN DEFAULT 0,
        enableProxy BOOLEAN DEFAULT 0,
        proxyUrl TEXT DEFAULT '',
        proxyUsername TEXT DEFAULT '',
        proxyPassword TEXT DEFAULT '',
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Notifications table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        productId TEXT,
        type TEXT NOT NULL CHECK (type IN ('price_drop', 'stock_change', 'price_target', 'error')),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        isRead BOOLEAN DEFAULT 0,
        data TEXT, -- JSON data for additional notification info
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (productId) REFERENCES products (id) ON DELETE SET NULL
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_products_platform ON products (platform);
      CREATE INDEX IF NOT EXISTS idx_products_lastChecked ON products (lastChecked);
      CREATE INDEX IF NOT EXISTS idx_monitoring_checks_productId ON monitoring_checks (productId);
      CREATE INDEX IF NOT EXISTS idx_monitoring_checks_checkedAt ON monitoring_checks (checkedAt);
      CREATE INDEX IF NOT EXISTS idx_notifications_createdAt ON notifications (createdAt);
      CREATE INDEX IF NOT EXISTS idx_notifications_isRead ON notifications (isRead);
    `);

    // Create triggers to update updatedAt timestamps
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_products_timestamp 
      AFTER UPDATE ON products
      FOR EACH ROW
      BEGIN
        UPDATE products SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_settings_timestamp 
      AFTER UPDATE ON user_settings
      FOR EACH ROW
      BEGIN
        UPDATE user_settings SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);

    console.log('✅ Database tables created successfully');
  }

  /**
   * Initialize default settings if none exist
   */
  initializeDefaultSettings() {
    const existingSettings = this.db.prepare('SELECT COUNT(*) as count FROM user_settings').get();
    
    if (existingSettings.count === 0) {
      console.log('📋 Initializing default settings...');
      this.db.prepare(`
        INSERT INTO user_settings (id) VALUES (1)
      `).run();
    }
  }

  /**
   * Product Operations
   */
  
  // Get all products
  getProducts() {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      SELECT * FROM products 
      ORDER BY createdAt DESC
    `);
    return stmt.all();
  }

  // Add a new product
  addProduct(productData) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      INSERT INTO products (
        name, url, platform, asin, originalPrice, targetPrice, 
        notifyOnPriceDrop, notifyOnStockChange, imageUrl
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      productData.name,
      productData.url,
      productData.platform,
      productData.asin || null,
      productData.originalPrice || null,
      productData.targetPrice || null,
      productData.notifyOnPriceDrop ? 1 : 0,
      productData.notifyOnStockChange ? 1 : 0,
      productData.imageUrl || null
    );
    
    return this.getProduct(result.lastInsertRowid);
  }

  // Get a single product by ID
  getProduct(id) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare('SELECT * FROM products WHERE id = ?');
    return stmt.get(id);
  }

  // Update product information
  updateProduct(id, productData) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const fields = [];
    const values = [];
    
    // Build dynamic update query based on provided fields
    Object.keys(productData).forEach(key => {
      if (productData[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(productData[key]);
      }
    });
    
    if (fields.length === 0) return this.getProduct(id);
    
    values.push(id);
    const stmt = this.db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    
    return this.getProduct(id);
  }

  // Update product price and stock status
  updateProductPrice(id, price, isInStock) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      UPDATE products 
      SET currentPrice = ?, isInStock = ?, lastChecked = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(price, isInStock ? 1 : 0, id);
    
    // Add monitoring check record
    this.addMonitoringCheck(id, price, isInStock, true);
    
    return this.getProduct(id);
  }

  // Delete a product
  deleteProduct(id) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare('DELETE FROM products WHERE id = ?');
    const result = stmt.run(id);
    return { success: result.changes > 0, changes: result.changes };
  }

  // Get products that need monitoring
  getProductsForMonitoring(platform = null) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    let query = `
      SELECT * FROM products 
      WHERE lastChecked IS NULL OR lastChecked < datetime('now', '-15 minutes')
    `;
    let params = [];
    
    if (platform) {
      query += ` AND platform = ?`;
      params.push(platform);
    }
    
    query += ` ORDER BY lastChecked ASC NULLS FIRST LIMIT 10`;
    
    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  /**
   * Monitoring Check Operations
   */
  
  // Add a monitoring check record
  addMonitoringCheck(productId, price, isInStock, success, errorMessage = null) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      INSERT INTO monitoring_checks (productId, price, isInStock, success, errorMessage)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(productId, price, isInStock ? 1 : 0, success ? 1 : 0, errorMessage);
    return result.lastInsertRowid;
  }

  // Get monitoring history for a product
  getMonitoringHistory(productId, days = 30) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      SELECT * FROM monitoring_checks
      WHERE productId = ? AND checkedAt >= datetime('now', '-' || ? || ' days')
      ORDER BY checkedAt DESC
    `);
    return stmt.all(productId, days);
  }

  // Get all monitoring checks (for admin/debugging)
  getAllMonitoringChecks(limit = 100) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      SELECT mc.*, p.name as productName 
      FROM monitoring_checks mc
      LEFT JOIN products p ON mc.productId = p.id
      ORDER BY mc.checkedAt DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }

  /**
   * User Settings Operations
   */
  
  // Get user settings
  getUserSettings() {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare('SELECT * FROM user_settings WHERE id = 1');
    const settings = stmt.get() || {};
    
    // Decrypt sensitive fields before returning
    if (settings.gmailAppPassword) {
      try {
        settings.gmailAppPassword = this.decryptSensitiveData(settings.gmailAppPassword);
      } catch (error) {
        console.warn('Failed to decrypt gmailAppPassword, returning empty');
        settings.gmailAppPassword = '';
      }
    }
    
    if (settings.proxyPassword) {
      try {
        settings.proxyPassword = this.decryptSensitiveData(settings.proxyPassword);
      } catch (error) {
        console.warn('Failed to decrypt proxyPassword, returning empty');
        settings.proxyPassword = '';
      }
    }
    
    return settings;
  }

  // Update user settings
  updateUserSettings(settings) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const fields = [];
    const values = [];
    
    // Build dynamic update query with encryption for sensitive fields
    Object.keys(settings).forEach(key => {
      if (settings[key] !== undefined && key !== 'id') {
        fields.push(`${key} = ?`);
        
        // Encrypt sensitive fields before storing
        if (key === 'gmailAppPassword' || key === 'proxyPassword') {
          try {
            const encryptedValue = this.encryptSensitiveData(settings[key]);
            values.push(encryptedValue);
            console.log(`🔒 Encrypted ${key} for secure storage`);
          } catch (error) {
            console.error(`Failed to encrypt ${key}:`, error);
            values.push(''); // Store empty string if encryption fails
          }
        } else {
          values.push(settings[key]);
        }
      }
    });
    
    if (fields.length === 0) return this.getUserSettings();
    
    const stmt = this.db.prepare(`UPDATE user_settings SET ${fields.join(', ')} WHERE id = 1`);
    stmt.run(...values);
    
    return this.getUserSettings();
  }

  /**
   * Notification Operations
   */
  
  // Add a notification
  addNotification(productId, type, title, message, data = null) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      INSERT INTO notifications (productId, type, title, message, data)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(productId, type, title, message, data ? JSON.stringify(data) : null);
    return result.lastInsertRowid;
  }

  // Get notifications (unread first)
  getNotifications(limit = 50) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      SELECT n.*, p.name as productName 
      FROM notifications n
      LEFT JOIN products p ON n.productId = p.id
      ORDER BY n.isRead ASC, n.createdAt DESC
      LIMIT ?
    `);
    return stmt.all(limit).map(notification => ({
      ...notification,
      data: notification.data ? JSON.parse(notification.data) : null
    }));
  }

  // Mark notification as read
  markNotificationAsRead(id) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare('UPDATE notifications SET isRead = 1 WHERE id = ?');
    return stmt.run(id).changes > 0;
  }

  // Mark all notifications as read
  markAllNotificationsAsRead() {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare('UPDATE notifications SET isRead = 1 WHERE isRead = 0');
    return stmt.run().changes;
  }

  // Delete old notifications (older than specified days)
  cleanupOldNotifications(days = 30) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      DELETE FROM notifications 
      WHERE createdAt < datetime('now', '-' || ? || ' days')
    `);
    return stmt.run(days).changes;
  }

  /**
   * Data Export/Import Operations
   */
  
  // Export all data to JSON
  exportData() {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    // Get settings but exclude sensitive credentials from export for security
    const settings = this.getUserSettings();
    const sanitizedSettings = { ...settings };
    delete sanitizedSettings.gmailAppPassword;
    delete sanitizedSettings.proxyPassword;
    
    return {
      products: this.getProducts(),
      settings: sanitizedSettings,
      notifications: this.getNotifications(1000),
      monitoringChecks: this.getAllMonitoringChecks(1000),
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  // Import data from JSON
  importData(data) {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(() => {
      // Clear existing data (optional - could be configurable)
      this.db.prepare('DELETE FROM monitoring_checks').run();
      this.db.prepare('DELETE FROM notifications').run();
      this.db.prepare('DELETE FROM products').run();
      
      // Import products
      if (data.products && data.products.length > 0) {
        const insertProduct = this.db.prepare(`
          INSERT INTO products (
            id, name, url, platform, asin, currentPrice, originalPrice, targetPrice,
            isInStock, notifyOnPriceDrop, notifyOnStockChange, imageUrl, 
            lastChecked, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        data.products.forEach(product => {
          insertProduct.run(
            product.id, product.name, product.url, product.platform, product.asin,
            product.currentPrice, product.originalPrice, product.targetPrice,
            product.isInStock, product.notifyOnPriceDrop, product.notifyOnStockChange,
            product.imageUrl, product.lastChecked, product.createdAt, product.updatedAt
          );
        });
      }
      
      // Import settings
      if (data.settings) {
        this.updateUserSettings(data.settings);
      }
      
      // Import notifications
      if (data.notifications && data.notifications.length > 0) {
        const insertNotification = this.db.prepare(`
          INSERT INTO notifications (id, productId, type, title, message, isRead, data, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        data.notifications.forEach(notification => {
          insertNotification.run(
            notification.id, notification.productId, notification.type, 
            notification.title, notification.message, notification.isRead,
            notification.data ? JSON.stringify(notification.data) : null,
            notification.createdAt
          );
        });
      }
    });
    
    transaction();
    return { success: true, message: 'Data imported successfully' };
  }

  /**
   * Database Statistics
   */
  getStats() {
    if (!this.isInitialized) throw new Error('Database not initialized');
    
    const productsCount = this.db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    const checksCount = this.db.prepare('SELECT COUNT(*) as count FROM monitoring_checks').get().count;
    const notificationsCount = this.db.prepare('SELECT COUNT(*) as count FROM notifications').get().count;
    const unreadNotificationsCount = this.db.prepare('SELECT COUNT(*) as count FROM notifications WHERE isRead = 0').get().count;
    
    return {
      products: productsCount,
      monitoringChecks: checksCount,
      notifications: notificationsCount,
      unreadNotifications: unreadNotificationsCount,
      databaseSize: this.getDatabaseSize()
    };
  }

  // Get database file size
  getDatabaseSize() {
    try {
      const userDataPath = app.getPath('userData');
      const dbPath = path.join(userDataPath, 'stock-monitor.db');
      const stats = fs.statSync(dbPath);
      return `${(stats.size / 1024 / 1024).toFixed(2)} MB`;
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.isInitialized = false;
      console.log('🔒 Database connection closed');
    }
  }
}

module.exports = { DesktopDatabase };