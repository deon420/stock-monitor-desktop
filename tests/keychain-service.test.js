/**
 * Comprehensive integration tests for KeychainService
 * Tests encryption, security, and token management flows
 */

const KeychainService = require('../desktop-app/keychain-service.js');
const keytar = require('keytar');
const crypto = require('crypto');

describe('KeychainService Integration Tests', () => {
  let keychainService;
  const mockUserId = 'test@example.com';
  const mockTokens = {
    accessToken: 'mock-access-token-12345',
    refreshToken: 'mock-refresh-token-67890',
  };

  beforeEach(async () => {
    keychainService = new KeychainService();
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait for initialization
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Security Verification', () => {
    test('should never access localStorage or sessionStorage', async () => {
      // This test is critical for security compliance
      await keychainService.storeToken(mockUserId, 'access_token', mockTokens.accessToken);
      await keychainService.getToken(mockUserId, 'access_token');
      await keychainService.clearUser(mockUserId);
      
      // Verify no browser storage was accessed (setup.ts monitors this)
      global.testUtils.verifyNoStorageUsed();
    });

    test('should use OS keychain when available', async () => {
      keytar.findCredentials.mockResolvedValue([]);
      const service = new KeychainService();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(service.isAvailable).toBe(true);
      expect(keytar.findCredentials).toHaveBeenCalled();
    });

    test('should handle keychain unavailability gracefully', async () => {
      keytar.findCredentials.mockRejectedValue(new Error('Keychain unavailable'));
      const service = new KeychainService();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(service.isAvailable).toBe(false);
    });
  });

  describe('Envelope Encryption', () => {
    test('should encrypt sensitive tokens before keychain storage', async () => {
      const mockCipher = {
        setAAD: jest.fn(),
        update: jest.fn().mockReturnValue('encrypted-data'),
        final: jest.fn().mockReturnValue(''),
        getAuthTag: jest.fn().mockReturnValue(Buffer.from('auth-tag')),
      };
      
      crypto.createCipherGCM.mockReturnValue(mockCipher);
      crypto.randomBytes.mockReturnValue(Buffer.from('mock-iv'));
      keytar.setPassword.mockResolvedValue();
      keytar.getPassword.mockResolvedValue('mock-master-key');

      await keychainService.storeToken(mockUserId, 'access_token', mockTokens.accessToken);

      expect(crypto.createCipherGCM).toHaveBeenCalledWith('aes-256-gcm', expect.any(Buffer), expect.any(Buffer));
      expect(mockCipher.setAAD).toHaveBeenCalledWith(Buffer.from('keychain-data'));
      expect(keytar.setPassword).toHaveBeenCalled();
    });

    test('should decrypt tokens when retrieving from keychain', async () => {
      const mockDecipher = {
        setAAD: jest.fn(),
        setAuthTag: jest.fn(),
        update: jest.fn().mockReturnValue('{"value":"decrypted-token","timestamp":'),
        final: jest.fn().mockReturnValue('1234567890}'),
      };

      crypto.createDecipherGCM.mockReturnValue(mockDecipher);
      
      const encryptedPayload = JSON.stringify({
        encrypted: 'encrypted-data',
        iv: 'mock-iv-hex',
        authTag: 'mock-auth-tag-hex',
        algorithm: 'aes-256-gcm'
      });
      
      keytar.getPassword
        .mockResolvedValueOnce('mock-master-key') // For master key
        .mockResolvedValueOnce(encryptedPayload); // For token data

      const result = await keychainService.getToken(mockUserId, 'access_token');

      expect(crypto.createDecipherGCM).toHaveBeenCalledWith('aes-256-gcm', expect.any(Buffer), expect.any(Buffer));
      expect(mockDecipher.setAuthTag).toHaveBeenCalled();
      expect(result).toBe('decrypted-token');
    });

    test('should handle decryption failures gracefully', async () => {
      crypto.createDecipherGCM.mockImplementation(() => {
        throw new Error('Decryption failed');
      });
      
      keytar.getPassword
        .mockResolvedValueOnce('mock-master-key')
        .mockResolvedValueOnce('invalid-encrypted-data');

      const result = await keychainService.getToken(mockUserId, 'access_token');
      expect(result).toBe('invalid-encrypted-data'); // Falls back to plaintext
    });
  });

  describe('Token Management', () => {
    test('should store and retrieve tokens correctly', async () => {
      keytar.setPassword.mockResolvedValue();
      keytar.getPassword.mockResolvedValue(mockTokens.accessToken);

      const storeResult = await keychainService.storeToken(mockUserId, 'access_token', mockTokens.accessToken);
      const retrieveResult = await keychainService.getToken(mockUserId, 'access_token');

      expect(storeResult).toBe(true);
      expect(retrieveResult).toBe(mockTokens.accessToken);
      expect(keytar.setPassword).toHaveBeenCalledWith(
        'Stock Monitor',
        `${mockUserId}:access_token`,
        expect.any(String)
      );
    });

    test('should handle storage failures', async () => {
      keytar.setPassword.mockRejectedValue(new Error('Storage failed'));

      const result = await keychainService.storeToken(mockUserId, 'access_token', mockTokens.accessToken);

      expect(result).toBe(false);
    });

    test('should return null for non-existent tokens', async () => {
      keytar.getPassword.mockResolvedValue(null);

      const result = await keychainService.getToken(mockUserId, 'access_token');

      expect(result).toBeNull();
    });

    test('should clear user tokens', async () => {
      keytar.findCredentials.mockResolvedValue([
        { account: `${mockUserId}:access_token`, password: 'token1' },
        { account: `${mockUserId}:refresh_token`, password: 'token2' },
        { account: 'other@user.com:access_token', password: 'token3' },
      ]);
      keytar.deletePassword.mockResolvedValue(true);

      await keychainService.clearUser(mockUserId);

      expect(keytar.deletePassword).toHaveBeenCalledTimes(2);
      expect(keytar.deletePassword).toHaveBeenCalledWith('Stock Monitor', `${mockUserId}:access_token`);
      expect(keytar.deletePassword).toHaveBeenCalledWith('Stock Monitor', `${mockUserId}:refresh_token`);
    });
  });

  describe('Master Key Management', () => {
    test('should generate new master key if none exists', async () => {
      keytar.getPassword
        .mockResolvedValueOnce(null) // No existing master key
        .mockResolvedValueOnce(undefined); // Return for findCredentials
      keytar.setPassword.mockResolvedValue();
      crypto.randomBytes.mockReturnValue(Buffer.from('new-master-key-32-bytes-long!'));

      const service = new KeychainService();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(keytar.setPassword).toHaveBeenCalledWith(
        'Stock Monitor',
        'app:master_key',
        expect.any(String)
      );
    });

    test('should use existing master key if available', async () => {
      const existingKey = 'existing-master-key-hex';
      keytar.getPassword
        .mockResolvedValueOnce(existingKey) // Existing master key
        .mockResolvedValueOnce(undefined); // Return for findCredentials
      keytar.setPassword.mockResolvedValue();

      const service = new KeychainService();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not create new key
      expect(keytar.setPassword).not.toHaveBeenCalledWith(
        'Stock Monitor',
        'app:master_key',
        expect.any(String)
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle keychain service errors gracefully', async () => {
      keytar.setPassword.mockRejectedValue(new Error('Keychain error'));

      const result = await keychainService.storeToken(mockUserId, 'access_token', mockTokens.accessToken);

      expect(result).toBe(false);
    });

    test('should handle missing keychain gracefully', async () => {
      const service = new KeychainService();
      service.isAvailable = false;

      const storeResult = await service.storeToken(mockUserId, 'access_token', mockTokens.accessToken);
      const getResult = await service.getToken(mockUserId, 'access_token');

      expect(storeResult).toBe(false);
      expect(getResult).toBeNull();
    });
  });

  describe('Performance and Memory', () => {
    test('should not leak sensitive data in memory', async () => {
      const sensitiveData = 'very-sensitive-access-token';
      
      await keychainService.storeToken(mockUserId, 'access_token', sensitiveData);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Verify sensitive data is not in plaintext in service instance
      const serviceString = JSON.stringify(keychainService);
      expect(serviceString).not.toContain(sensitiveData);
    });

    test('should handle concurrent operations safely', async () => {
      keytar.setPassword.mockResolvedValue();
      keytar.getPassword.mockResolvedValue(mockTokens.accessToken);

      // Simulate concurrent operations
      const operations = [
        keychainService.storeToken(mockUserId, 'access_token', mockTokens.accessToken),
        keychainService.getToken(mockUserId, 'access_token'),
        keychainService.storeToken(mockUserId, 'refresh_token', mockTokens.refreshToken),
        keychainService.getToken(mockUserId, 'refresh_token'),
      ];

      const results = await Promise.all(operations);

      // All operations should complete without interference
      expect(results[0]).toBe(true); // store access token
      expect(results[1]).toBe(mockTokens.accessToken); // get access token
      expect(results[2]).toBe(true); // store refresh token
      expect(results[3]).toBe(mockTokens.accessToken); // get refresh token (mocked)
    });
  });
});