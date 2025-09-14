import crypto from 'crypto';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM, this is always 16
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * Secure encryption service for sensitive data like passwords
 * Uses AES-256-GCM with random IV and salt for each encryption
 */
export class CryptoService {
  private static instance: CryptoService;
  private readonly masterKey: Buffer;

  constructor() {
    // Generate or retrieve master key from environment
    const keyFromEnv = process.env.ENCRYPTION_KEY;
    
    if (keyFromEnv) {
      // Use existing key from environment
      this.masterKey = Buffer.from(keyFromEnv, 'hex');
      if (this.masterKey.length !== KEY_LENGTH) {
        throw new Error('Invalid encryption key length. Expected 32 bytes (64 hex characters)');
      }
    } else {
      // Generate a new random key (for development/testing)
      this.masterKey = crypto.randomBytes(KEY_LENGTH);
      console.warn('⚠️  No ENCRYPTION_KEY environment variable found. Generated temporary key.');
      console.warn('⚠️  Add this to your environment for persistent encryption:');
      console.warn(`ENCRYPTION_KEY=${this.masterKey.toString('hex')}`);
    }
  }

  static getInstance(): CryptoService {
    if (!CryptoService.instance) {
      CryptoService.instance = new CryptoService();
    }
    return CryptoService.instance;
  }

  /**
   * Derive encryption key from master key and salt using PBKDF2
   */
  private deriveKey(salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(this.masterKey, salt, 100000, KEY_LENGTH, 'sha256');
  }

  /**
   * Encrypt sensitive data (like passwords)
   * Returns base64-encoded string containing: salt + iv + tag + encryptedData
   */
  encrypt(plaintext: string): string {
    if (!plaintext || plaintext.trim() === '') {
      return ''; // Return empty string for empty input
    }

    try {
      // Generate random salt and IV for this encryption
      const salt = crypto.randomBytes(SALT_LENGTH);
      const iv = crypto.randomBytes(IV_LENGTH);
      
      // Derive key from master key and salt
      const key = this.deriveKey(salt);
      
      // Create cipher
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      cipher.setAAD(salt); // Use salt as additional authenticated data
      
      // Encrypt data
      let encrypted = cipher.update(plaintext, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      // Get authentication tag
      const tag = cipher.getAuthTag();
      
      // Combine salt + iv + tag + encrypted data
      const result = Buffer.concat([salt, iv, tag, encrypted]);
      
      return result.toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt sensitive data
   * Expects base64-encoded string containing: salt + iv + tag + encryptedData
   */
  decrypt(encryptedData: string): string {
    if (!encryptedData || encryptedData.trim() === '') {
      return ''; // Return empty string for empty input
    }

    try {
      // Decode from base64
      const buffer = Buffer.from(encryptedData, 'base64');
      
      // Extract components
      const salt = buffer.subarray(0, SALT_LENGTH);
      const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
      const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
      const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
      
      // Derive key from master key and salt
      const key = this.deriveKey(salt);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
      decipher.setAAD(salt); // Use salt as additional authenticated data
      decipher.setAuthTag(tag);
      
      // Decrypt data
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Hash passwords for user authentication (one-way)
   * Uses bcrypt-style approach with salt
   */
  hashPassword(password: string): string {
    const salt = crypto.randomBytes(16);
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256');
    return salt.toString('hex') + ':' + hash.toString('hex');
  }

  /**
   * Verify password against hash
   */
  verifyPassword(password: string, hashedPassword: string): boolean {
    try {
      const [saltHex, hashHex] = hashedPassword.split(':');
      const salt = Buffer.from(saltHex, 'hex');
      const hash = Buffer.from(hashHex, 'hex');
      
      const computedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256');
      return crypto.timingSafeEqual(hash, computedHash);
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const cryptoService = CryptoService.getInstance();

// Utility functions for easy access
export const encryptSensitiveData = (data: string): string => cryptoService.encrypt(data);
export const decryptSensitiveData = (encryptedData: string): string => cryptoService.decrypt(encryptedData);
export const hashPassword = (password: string): string => cryptoService.hashPassword(password);
export const verifyPassword = (password: string, hash: string): boolean => cryptoService.verifyPassword(password, hash);