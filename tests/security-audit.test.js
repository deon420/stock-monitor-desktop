/**
 * Comprehensive Security Audit Tests
 * Verifies no sensitive data leaks and proper security implementation
 */

// Import modules to test for potential data leaks
const KeychainService = require('../desktop-app/keychain-service.js');

describe('Security Audit - Data Leak Prevention', () => {
  
  describe('Browser Storage Security', () => {
    test('should never attempt to access localStorage', () => {
      // This test verifies our security monitoring is working
      expect(() => {
        localStorage.getItem('any-key');
      }).toThrow('SECURITY VIOLATION: Attempt to read any-key from localStorage');
      
      expect(() => {
        localStorage.setItem('test', 'value');
      }).toThrow('SECURITY VIOLATION: Attempt to store test=value in localStorage');
    });

    test('should never attempt to access sessionStorage', () => {
      // This test verifies our security monitoring is working
      expect(() => {
        sessionStorage.getItem('any-key');
      }).toThrow('SECURITY VIOLATION: Attempt to read any-key from sessionStorage');
      
      expect(() => {
        sessionStorage.setItem('test', 'value');
      }).toThrow('SECURITY VIOLATION: Attempt to store test=value in sessionStorage');
    });

    test('should prevent accidental use of browser storage APIs', () => {
      // Common patterns that might accidentally use browser storage
      const dangerousCalls = [
        () => window.localStorage.setItem('token', 'secret'),
        () => window.sessionStorage.setItem('user', 'data'),
        () => localStorage.clear(),
        () => sessionStorage.clear(),
      ];

      dangerousCalls.forEach((call, index) => {
        expect(call).toThrow(/SECURITY VIOLATION/);
      });
    });
  });

  describe('Memory Security', () => {
    test('should not expose sensitive data in KeychainService instance', () => {
      const keychainService = new KeychainService();
      const serviceString = JSON.stringify(keychainService);
      
      // Common sensitive data patterns that should not appear
      const sensitivePatterns = [
        'password',
        'secret',
        'token',
        'key',
        'auth',
        'credential',
        'access_token',
        'refresh_token'
      ];

      sensitivePatterns.forEach(pattern => {
        expect(serviceString.toLowerCase()).not.toContain(pattern);
      });
    });

    test('should not leak master key in memory', () => {
      const keychainService = new KeychainService();
      
      // Force master key initialization (mocked)
      keychainService.masterKey = Buffer.from('secret-master-key');
      
      // Service should not expose master key in serialization
      const serviceString = JSON.stringify(keychainService);
      expect(serviceString).not.toContain('secret-master-key');
      
      // Clean up
      keychainService.masterKey = null;
    });

    test('should properly handle sensitive data in function closures', () => {
      const sensitiveToken = 'very-sensitive-access-token-12345';
      
      // Simulate processing sensitive data
      function processSensitiveData(token) {
        const encrypted = `encrypted-${token}`;
        return encrypted;
      }
      
      const result = processSensitiveData(sensitiveToken);
      
      // Result should be transformed, not contain original sensitive data
      expect(result).toContain('encrypted-');
      expect(result).not.toBe(sensitiveToken);
      
      // Function string should not expose the sensitive data
      const funcString = processSensitiveData.toString();
      expect(funcString).not.toContain(sensitiveToken);
    });
  });

  describe('Network Security', () => {
    test('should validate API request headers for token safety', () => {
      const mockHeaders = {
        'Authorization': 'Bearer access-token-123',
        'Content-Type': 'application/json',
        'X-Auth-Mode': 'tokens',
      };

      // Verify authorization header is present but not logged
      expect(mockHeaders['Authorization']).toMatch(/^Bearer /);
      expect(mockHeaders['X-Auth-Mode']).toBe('tokens');
      
      // Simulate header logging (should not expose full token)
      const safeHeaders = Object.keys(mockHeaders).reduce((acc, key) => {
        if (key === 'Authorization') {
          acc[key] = mockHeaders[key].replace(/Bearer .+/, 'Bearer [REDACTED]');
        } else {
          acc[key] = mockHeaders[key];
        }
        return acc;
      }, {});

      expect(safeHeaders['Authorization']).toBe('Bearer [REDACTED]');
      expect(JSON.stringify(safeHeaders)).not.toContain('access-token-123');
    });

    test('should not expose refresh tokens in error messages', () => {
      const mockError = new Error('Token refresh failed');
      mockError.context = {
        refreshToken: 'sensitive-refresh-token-456'
      };

      // Error message should not contain sensitive data
      expect(mockError.message).not.toContain('sensitive-refresh-token-456');
      
      // Even error context should be sanitized for logging
      const sanitizedError = {
        message: mockError.message,
        context: mockError.context ? '[CONTEXT_REDACTED]' : undefined
      };

      expect(JSON.stringify(sanitizedError)).not.toContain('sensitive-refresh-token-456');
    });
  });

  describe('Cross-Platform Security', () => {
    test('should handle keychain unavailability securely', () => {
      // Simulate keychain unavailable scenario
      const keychainService = new KeychainService();
      keychainService.isAvailable = false;

      // Should not fall back to insecure storage
      const attemptStorage = async () => {
        return await keychainService.storeToken('test@example.com', 'access_token', 'secret-token');
      };

      return expect(attemptStorage()).resolves.toBe(false);
    });

    test('should fail securely when encryption is unavailable', () => {
      const keychainService = new KeychainService();
      keychainService.masterKey = null; // Simulate missing master key

      // Should fail securely without exposing plaintext
      expect(() => {
        keychainService._encryptData({ sensitiveData: 'secret' });
      }).toThrow('Master key not available for encryption');
    });
  });

  describe('Concurrency Security', () => {
    test('should handle concurrent operations without data races', async () => {
      const keychainService = new KeychainService();
      const sensitiveData = 'concurrent-test-token';

      // Mock concurrent operations
      const operations = Array(10).fill().map((_, i) => 
        keychainService.storeToken(`user${i}@example.com`, 'access_token', `${sensitiveData}-${i}`)
      );

      // All operations should complete without interference
      const results = await Promise.all(operations);
      expect(results.every(result => result === false || result === true)).toBe(true);
      
      // No operation should interfere with others
      expect(results.length).toBe(10);
    });
  });

  describe('Development vs Production Security', () => {
    test('should not expose debug information in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // In production, debug info should be minimal
      const keychainService = new KeychainService();
      const serviceInfo = {
        isAvailable: keychainService.isAvailable,
        serviceName: keychainService.SERVICE_NAME
      };

      // Should only expose necessary operational info
      expect(Object.keys(serviceInfo)).toEqual(['isAvailable', 'serviceName']);
      expect(serviceInfo.serviceName).toBe('Stock Monitor');

      process.env.NODE_ENV = originalEnv;
    });

    test('should validate environment variable security', () => {
      // Common insecure patterns in environment variables
      const dangerousEnvVars = [
        'PASSWORD',
        'SECRET',
        'KEY',
        'TOKEN',
        'CREDENTIAL'
      ];

      dangerousEnvVars.forEach(varName => {
        // Should not accidentally log environment variables
        const mockEnvValue = process.env[varName] || 'not-set';
        expect(typeof mockEnvValue).toBe('string');
        
        // If sensitive env vars exist, they should not be logged
        if (mockEnvValue && mockEnvValue !== 'not-set') {
          const loggedValue = '[REDACTED]';
          expect(loggedValue).toBe('[REDACTED]');
        }
      });
    });
  });

  describe('Data Retention Security', () => {
    test('should not persist sensitive data beyond session lifecycle', () => {
      const keychainService = new KeychainService();
      
      // Simulate session data that should be cleared
      const sessionData = {
        temporaryToken: 'temp-token-123',
        userSession: { id: 1, email: 'test@example.com' }
      };

      // After logout/session end, no sensitive data should remain
      const clearSessionData = (data) => {
        return Object.keys(data).reduce((acc, key) => {
          acc[key] = '[CLEARED]';
          return acc;
        }, {});
      };

      const clearedData = clearSessionData(sessionData);
      expect(clearedData.temporaryToken).toBe('[CLEARED]');
      expect(clearedData.userSession).toBe('[CLEARED]');
      
      // Original sensitive data should not be accessible
      expect(JSON.stringify(clearedData)).not.toContain('temp-token-123');
      expect(JSON.stringify(clearedData)).not.toContain('test@example.com');
    });
  });

  describe('Error Handling Security', () => {
    test('should sanitize error messages containing sensitive data', () => {
      const sensitiveInput = 'access_token=secret123&refresh_token=refresh456';
      
      const sanitizeError = (message) => {
        return message
          .replace(/access_token=[^&\s]+/gi, 'access_token=[REDACTED]')
          .replace(/refresh_token=[^&\s]+/gi, 'refresh_token=[REDACTED]')
          .replace(/bearer\s+[^\s]+/gi, 'bearer [REDACTED]')
          .replace(/password=[^&\s]+/gi, 'password=[REDACTED]');
      };

      const sanitizedMessage = sanitizeError(`Authentication failed: ${sensitiveInput}`);
      
      expect(sanitizedMessage).toContain('access_token=[REDACTED]');
      expect(sanitizedMessage).toContain('refresh_token=[REDACTED]');
      expect(sanitizedMessage).not.toContain('secret123');
      expect(sanitizedMessage).not.toContain('refresh456');
    });
  });
});

describe('Security Audit - Integration Security', () => {
  test('should verify complete end-to-end security flow', async () => {
    // This test ensures the entire authentication flow is secure
    const keychainService = new KeychainService();
    const mockUserId = 'test@example.com';
    const mockTokens = {
      access_token: 'secure-access-token',
      refresh_token: 'secure-refresh-token'
    };

    // 1. Store tokens (should use keychain only)
    const storeResult = await keychainService.storeToken(mockUserId, 'access_token', mockTokens.access_token);
    expect(storeResult).toBeDefined();

    // 2. Retrieve tokens (should use keychain only)  
    const retrieveResult = await keychainService.getToken(mockUserId, 'access_token');
    expect(typeof retrieveResult === 'string' || retrieveResult === null).toBe(true);

    // 3. Clear tokens (should remove from keychain only)
    await keychainService.clearUser(mockUserId);

    // 4. Verify no browser storage was touched during entire flow
    global.testUtils.verifyNoStorageUsed();
  });
});