const keytar = require('keytar');
const log = require('electron-log');
const crypto = require('crypto');
const { app } = require('electron');

/**
 * Secure keychain service for managing authentication tokens
 * Uses OS native keychain (macOS), credential store (Windows), or libsecret (Linux)
 */
class KeychainService {
  constructor() {
    this.SERVICE_NAME = 'StockMonitor';
    this.TOKENS = {
      ACCESS_TOKEN: 'access_token',
      REFRESH_TOKEN: 'refresh_token',
      USER_DATA: 'user_data',
      REMEMBER_ME: 'remember_me',
      LOGIN_EMAIL: 'login_email',
      MASTER_KEY: 'master_key' // Key for envelope encryption
    };
    this.isAvailable = true;
    this.algorithm = 'aes-256-gcm';
    this.masterKey = null;
    this._checkAvailability();
    this._initializeMasterKey();
  }

  /**
   * Check if keychain is available on this system
   * @private
   */
  async _checkAvailability() {
    try {
      // Test keychain access with a simple operation
      await keytar.findCredentials(this.SERVICE_NAME);
      this.isAvailable = true;
      log.info('[Keychain] OS keychain is available');
    } catch (error) {
      log.warn('[Keychain] OS keychain not available:', error.message);
      this.isAvailable = false;
    }
  }

  /**
   * Initialize master key for envelope encryption
   * @private
   */
  async _initializeMasterKey() {
    if (!this.isAvailable) {
      log.warn('[Keychain] Cannot initialize master key - keychain unavailable');
      return;
    }

    try {
      // Try to get existing master key
      let masterKeyHex = await keytar.getPassword(this.SERVICE_NAME, 'app:master_key');
      
      if (!masterKeyHex) {
        // Generate new master key if none exists
        log.info('[Keychain] Generating new master key for envelope encryption');
        masterKeyHex = crypto.randomBytes(32).toString('hex');
        await keytar.setPassword(this.SERVICE_NAME, 'app:master_key', masterKeyHex);
      }
      
      this.masterKey = Buffer.from(masterKeyHex, 'hex');
      log.info('[Keychain] Master key initialized for envelope encryption');
    } catch (error) {
      log.error('[Keychain] Failed to initialize master key:', error.message);
      this.masterKey = null;
    }
  }

  /**
   * Encrypt data using AES-256-GCM envelope encryption
   * @private
   */
  _encryptData(data) {
    if (!this.masterKey) {
      throw new Error('Master key not available for encryption');
    }

    try {
      const plaintext = JSON.stringify(data);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipherGCM(this.algorithm, this.masterKey, iv);
      cipher.setAAD(Buffer.from('keychain-data'));

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm: this.algorithm
      };
    } catch (error) {
      log.error('[Keychain] Encryption failed:', error.message);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using AES-256-GCM envelope encryption
   * @private
   */
  _decryptData(encryptedData) {
    if (!this.masterKey) {
      throw new Error('Master key not available for decryption');
    }

    try {
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const decipher = crypto.createDecipherGCM(this.algorithm, this.masterKey, iv);
      decipher.setAAD(Buffer.from('keychain-data'));
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      log.error('[Keychain] Decryption failed:', error.message);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Store a token securely in the OS keychain with envelope encryption
   * @param {string} userId - User identifier (email)
   * @param {string} tokenType - Type of token (access_token, refresh_token, etc.)
   * @param {string} value - Token value or data to store
   * @returns {Promise<boolean>} Success status
   */
  async storeToken(userId, tokenType, value) {
    if (!this.isAvailable) {
      log.warn('[Keychain] Keychain not available, cannot store token');
      return false;
    }

    try {
      const account = `${userId}:${tokenType}`;
      
      // Use envelope encryption for sensitive tokens
      if (this.masterKey && ['access_token', 'refresh_token'].includes(tokenType)) {
        const encryptedData = this._encryptData({ value, timestamp: Date.now() });
        const encryptedValue = JSON.stringify(encryptedData);
        await keytar.setPassword(this.SERVICE_NAME, account, encryptedValue);
        log.info(`[Keychain] Stored encrypted ${tokenType} for user: ${userId}`);
      } else {
        // Store non-sensitive data as plaintext
        await keytar.setPassword(this.SERVICE_NAME, account, value);
        log.info(`[Keychain] Stored ${tokenType} for user: ${userId}`);
      }
      
      return true;
    } catch (error) {
      log.error(`[Keychain] Failed to store ${tokenType}:`, error.message);
      return false;
    }
  }

  /**
   * Retrieve a token from the OS keychain with envelope decryption
   * @param {string} userId - User identifier (email)
   * @param {string} tokenType - Type of token to retrieve
   * @returns {Promise<string|null>} Token value or null if not found
   */
  async getToken(userId, tokenType) {
    if (!this.isAvailable) {
      log.warn('[Keychain] Keychain not available, cannot retrieve token');
      return null;
    }

    try {
      const account = `${userId}:${tokenType}`;
      const storedData = await keytar.getPassword(this.SERVICE_NAME, account);
      
      if (!storedData) {
        return null;
      }
      
      // Try to decrypt if it looks like encrypted data
      if (this.masterKey && ['access_token', 'refresh_token'].includes(tokenType)) {
        try {
          const encryptedData = JSON.parse(storedData);
          if (encryptedData.encrypted && encryptedData.iv && encryptedData.authTag) {
            const decryptedData = this._decryptData(encryptedData);
            log.info(`[Keychain] Retrieved and decrypted ${tokenType} for user: ${userId}`);
            return decryptedData.value;
          }
        } catch (parseError) {
          // If parsing fails, treat as plaintext (backward compatibility)
          log.warn(`[Keychain] Failed to parse encrypted ${tokenType}, treating as plaintext`);
        }
      }
      
      // Return as plaintext if not encrypted or decryption failed
      if (storedData) {
        log.info(`[Keychain] Retrieved ${tokenType} for user: ${userId}`);
      }
      return storedData;
    } catch (error) {
      log.error(`[Keychain] Failed to retrieve ${tokenType}:`, error.message);
      return null;
    }
  }

  /**
   * Delete a specific token from the keychain
   * @param {string} userId - User identifier (email)
   * @param {string} tokenType - Type of token to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteToken(userId, tokenType) {
    if (!this.isAvailable) {
      log.warn('[Keychain] Keychain not available, cannot delete token');
      return false;
    }

    try {
      const account = `${userId}:${tokenType}`;
      const success = await keytar.deletePassword(this.SERVICE_NAME, account);
      if (success) {
        log.info(`[Keychain] Deleted ${tokenType} for user: ${userId}`);
      }
      return success;
    } catch (error) {
      log.error(`[Keychain] Failed to delete ${tokenType}:`, error.message);
      return false;
    }
  }

  /**
   * Store complete authentication data securely
   * @param {string} userId - User identifier (email)
   * @param {Object} authData - Authentication data object
   * @param {string} authData.accessToken - JWT access token
   * @param {string} authData.refreshToken - JWT refresh token
   * @param {Object} authData.user - User profile data
   * @param {boolean} rememberMe - Whether to store for persistent login
   * @returns {Promise<boolean>} Success status
   */
  async storeAuthData(userId, authData, rememberMe = false) {
    try {
      const operations = [];

      // Store access token (always temporary - in session only)
      if (authData.accessToken) {
        operations.push(
          this.storeToken(userId, this.TOKENS.ACCESS_TOKEN, authData.accessToken)
        );
      }

      // Store refresh token only if remember me is enabled
      if (authData.refreshToken && rememberMe) {
        operations.push(
          this.storeToken(userId, this.TOKENS.REFRESH_TOKEN, authData.refreshToken)
        );
      }

      // Store user data if remember me is enabled
      if (authData.user && rememberMe) {
        operations.push(
          this.storeToken(userId, this.TOKENS.USER_DATA, JSON.stringify(authData.user))
        );
      }

      // Store remember me preference
      operations.push(
        this.storeToken(userId, this.TOKENS.REMEMBER_ME, rememberMe.toString())
      );

      const results = await Promise.all(operations);
      const success = results.every(result => result === true);

      log.info(`[Keychain] Auth data storage ${success ? 'successful' : 'failed'} for user: ${userId}`);
      return success;

    } catch (error) {
      log.error('[Keychain] Failed to store auth data:', error.message);
      return false;
    }
  }

  /**
   * Retrieve complete authentication data
   * @param {string} userId - User identifier (email)
   * @returns {Promise<Object|null>} Auth data object or null
   */
  async getAuthData(userId) {
    try {
      const [accessToken, refreshToken, userData, rememberMe] = await Promise.all([
        this.getToken(userId, this.TOKENS.ACCESS_TOKEN),
        this.getToken(userId, this.TOKENS.REFRESH_TOKEN),
        this.getToken(userId, this.TOKENS.USER_DATA),
        this.getToken(userId, this.TOKENS.REMEMBER_ME)
      ]);

      // Parse user data if it exists
      let user = null;
      if (userData) {
        try {
          user = JSON.parse(userData);
        } catch (parseError) {
          log.warn('[Keychain] Failed to parse stored user data');
        }
      }

      const authData = {
        accessToken,
        refreshToken,
        user,
        rememberMe: rememberMe === 'true'
      };

      log.info(`[Keychain] Retrieved auth data for user: ${userId}`);
      return authData;

    } catch (error) {
      log.error('[Keychain] Failed to retrieve auth data:', error.message);
      return null;
    }
  }

  /**
   * Clear all authentication data for a user (logout)
   * @param {string} userId - User identifier (email)
   * @returns {Promise<boolean>} Success status
   */
  async clearAuthData(userId) {
    try {
      const operations = [
        this.deleteToken(userId, this.TOKENS.ACCESS_TOKEN),
        this.deleteToken(userId, this.TOKENS.REFRESH_TOKEN),
        this.deleteToken(userId, this.TOKENS.USER_DATA),
        this.deleteToken(userId, this.TOKENS.REMEMBER_ME)
      ];

      await Promise.all(operations);
      log.info(`[Keychain] Cleared all auth data for user: ${userId}`);
      return true;

    } catch (error) {
      log.error('[Keychain] Failed to clear auth data:', error.message);
      return false;
    }
  }

  /**
   * Store login email preference
   * @param {string} email - Email to remember
   * @returns {Promise<boolean>} Success status
   */
  async storeLoginEmail(email) {
    return await this.storeToken('app', this.TOKENS.LOGIN_EMAIL, email);
  }

  /**
   * Get stored login email preference
   * @returns {Promise<string|null>} Stored email or null
   */
  async getLoginEmail() {
    return await this.getToken('app', this.TOKENS.LOGIN_EMAIL);
  }

  /**
   * Clear stored login email preference
   * @returns {Promise<boolean>} Success status
   */
  async clearLoginEmail() {
    return await this.deleteToken('app', this.TOKENS.LOGIN_EMAIL);
  }

  /**
   * Get all stored credentials (for debugging/admin purposes)
   * @returns {Promise<Array>} Array of credential accounts
   */
  async getAllCredentials() {
    if (!this.isAvailable) {
      return [];
    }

    try {
      const credentials = await keytar.findCredentials(this.SERVICE_NAME);
      return credentials.map(cred => ({
        account: cred.account,
        // Don't return actual passwords for security
        hasPassword: !!cred.password
      }));
    } catch (error) {
      log.error('[Keychain] Failed to get credentials:', error.message);
      return [];
    }
  }

  /**
   * Check if keychain is available and working
   * @returns {boolean} Availability status
   */
  isKeychainAvailable() {
    return this.isAvailable;
  }

  /**
   * Get keychain service status and information
   * @returns {Object} Status information
   */
  async getStatus() {
    const status = {
      available: this.isAvailable,
      serviceName: this.SERVICE_NAME,
      credentialCount: 0,
      platform: process.platform
    };

    if (this.isAvailable) {
      try {
        const credentials = await this.getAllCredentials();
        status.credentialCount = credentials.length;
      } catch (error) {
        log.warn('[Keychain] Failed to get credential count');
      }
    }

    return status;
  }

  /**
   * Clear all stored credentials for the app (nuclear option)
   * @returns {Promise<boolean>} Success status
   */
  async clearAllCredentials() {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const credentials = await keytar.findCredentials(this.SERVICE_NAME);
      
      const deleteOperations = credentials.map(cred => 
        keytar.deletePassword(this.SERVICE_NAME, cred.account)
      );

      await Promise.all(deleteOperations);
      
      log.info(`[Keychain] Cleared all ${credentials.length} credentials`);
      return true;

    } catch (error) {
      log.error('[Keychain] Failed to clear all credentials:', error.message);
      return false;
    }
  }
}

module.exports = { KeychainService };