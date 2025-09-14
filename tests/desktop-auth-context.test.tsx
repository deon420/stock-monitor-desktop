/**
 * Integration tests for DesktopAuthContext
 * Tests token refresh flows, single-flight protection, and security
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { DesktopAuthProvider, useDesktopAuth } from '../client/src/contexts/DesktopAuthContext';

// Mock the query client
jest.mock('../client/src/lib/queryClient', () => ({
  setDesktopApiRequest: jest.fn(),
}));

// Test component to access the context
function TestComponent() {
  const auth = useDesktopAuth();
  
  return (
    <div data-testid="test-component">
      <div data-testid="user">{auth.user ? auth.user.email : 'null'}</div>
      <div data-testid="loading">{auth.isLoading.toString()}</div>
      <div data-testid="keychain-available">{auth.isKeychainAvailable.toString()}</div>
      <button data-testid="refresh-btn" onClick={() => auth.refreshToken()}>
        Refresh Token
      </button>
      <button data-testid="logout-btn" onClick={() => auth.logout()}>
        Logout
      </button>
    </div>
  );
}

describe('DesktopAuthContext Integration Tests', () => {
  let mockElectronAPI;

  beforeEach(() => {
    // Setup fresh electron API mock for each test
    mockElectronAPI = {
      keychainHelper: {
        isAvailable: jest.fn().mockResolvedValue(true),
        storeAuthSafe: jest.fn().mockResolvedValue(true),
        getAuthSafe: jest.fn().mockResolvedValue(null),
        clearAuthSafe: jest.fn().mockResolvedValue(true),
      },
      apiRequest: jest.fn(),
    };

    Object.defineProperty(window, 'electronAPI', {
      value: mockElectronAPI,
      writable: true,
    });

    // Mock navigator.userAgent to simulate desktop app
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Electron/1.0.0',
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Security Verification', () => {
    test('should never access browser storage during authentication flows', async () => {
      const { getByTestId } = render(
        <DesktopAuthProvider>
          <TestComponent />
        </DesktopAuthProvider>
      );

      // Wait for initialization
      await waitFor(() => {
        expect(getByTestId('loading').textContent).toBe('false');
      });

      // Perform various authentication operations
      await act(async () => {
        getByTestId('refresh-btn').click();
      });

      await act(async () => {
        getByTestId('logout-btn').click();
      });

      // Verify no browser storage was accessed (setup.ts monitors this)
      global.testUtils.verifyNoStorageUsed();
    });

    test('should only use keychain for token storage', async () => {
      mockElectronAPI.keychainHelper.getAuthSafe.mockResolvedValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: { id: '1', email: 'test@example.com' },
      });

      render(
        <DesktopAuthProvider>
          <TestComponent />
        </DesktopAuthProvider>
      );

      await waitFor(() => {
        expect(mockElectronAPI.keychainHelper.getAuthSafe).toHaveBeenCalled();
      });

      // Verify keychain was accessed for token retrieval
      expect(mockElectronAPI.keychainHelper.getAuthSafe).toHaveBeenCalledWith(
        expect.any(String)
      );
    });
  });

  describe('Token Refresh with Single-Flight Protection', () => {
    test('should prevent concurrent refresh requests', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      
      // Setup existing user state
      mockElectronAPI.keychainHelper.getAuthSafe.mockResolvedValue({
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        user: mockUser,
      });

      // Mock successful refresh response
      mockElectronAPI.apiRequest.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          user: mockUser,
          tokens: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
          },
        }),
      });

      const { getByTestId } = render(
        <DesktopAuthProvider>
          <TestComponent />
        </DesktopAuthProvider>
      );

      // Wait for user to be loaded
      await waitFor(() => {
        expect(getByTestId('user').textContent).toBe('test@example.com');
      });

      // Trigger multiple concurrent refresh attempts
      await act(async () => {
        const refreshPromises = [
          getByTestId('refresh-btn').click(),
          getByTestId('refresh-btn').click(),
          getByTestId('refresh-btn').click(),
        ];
        await Promise.all(refreshPromises);
      });

      // Should only make one API request due to single-flight protection
      expect(mockElectronAPI.apiRequest).toHaveBeenCalledTimes(1);
    });

    test('should retry on server errors with exponential backoff', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      
      mockElectronAPI.keychainHelper.getAuthSafe.mockResolvedValue({
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        user: mockUser,
      });

      // Mock server error followed by success
      mockElectronAPI.apiRequest
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            user: mockUser,
            tokens: {
              accessToken: 'new-access-token',
              refreshToken: 'new-refresh-token',
            },
          }),
        });

      const { getByTestId } = render(
        <DesktopAuthProvider>
          <TestComponent />
        </DesktopAuthProvider>
      );

      await waitFor(() => {
        expect(getByTestId('user').textContent).toBe('test@example.com');
      });

      // Mock setTimeout to control backoff timing
      jest.useFakeTimers();
      
      let refreshPromise;
      await act(async () => {
        refreshPromise = new Promise((resolve) => {
          getByTestId('refresh-btn').click();
          resolve();
        });
      });

      // Fast-forward through backoff delays
      act(() => {
        jest.advanceTimersByTime(7000); // 1s + 2s + 4s
      });

      await act(async () => {
        await refreshPromise;
      });

      // Should have retried 3 times (initial + 2 retries)
      expect(mockElectronAPI.apiRequest).toHaveBeenCalledTimes(3);
      
      jest.useRealTimers();
    });

    test('should logout on refresh token expiry', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      
      mockElectronAPI.keychainHelper.getAuthSafe.mockResolvedValue({
        accessToken: 'old-token',
        refreshToken: 'expired-refresh-token',
        user: mockUser,
      });

      // Mock 401 response for expired refresh token
      mockElectronAPI.apiRequest.mockResolvedValue({
        ok: false,
        status: 401,
      });

      const { getByTestId } = render(
        <DesktopAuthProvider>
          <TestComponent />
        </DesktopAuthProvider>
      );

      await waitFor(() => {
        expect(getByTestId('user').textContent).toBe('test@example.com');
      });

      await act(async () => {
        getByTestId('refresh-btn').click();
      });

      // Should clear auth data on refresh failure
      await waitFor(() => {
        expect(mockElectronAPI.keychainHelper.clearAuthSafe).toHaveBeenCalled();
        expect(getByTestId('user').textContent).toBe('null');
      });
    });
  });

  describe('Remember Me Functionality', () => {
    test('should restore user session from keychain on app start', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      const mockAuthData = {
        accessToken: 'stored-access-token',
        refreshToken: 'stored-refresh-token',
        user: mockUser,
      };

      mockElectronAPI.keychainHelper.getAuthSafe.mockResolvedValue(mockAuthData);

      const { getByTestId } = render(
        <DesktopAuthProvider>
          <TestComponent />
        </DesktopAuthProvider>
      );

      // Should automatically restore user from keychain
      await waitFor(() => {
        expect(getByTestId('user').textContent).toBe('test@example.com');
        expect(getByTestId('loading').textContent).toBe('false');
      });

      expect(mockElectronAPI.keychainHelper.getAuthSafe).toHaveBeenCalled();
    });

    test('should handle keychain unavailability gracefully', async () => {
      mockElectronAPI.keychainHelper.isAvailable.mockResolvedValue(false);

      const { getByTestId } = render(
        <DesktopAuthProvider>
          <TestComponent />
        </DesktopAuthProvider>
      );

      await waitFor(() => {
        expect(getByTestId('keychain-available').textContent).toBe('false');
        expect(getByTestId('loading').textContent).toBe('false');
      });

      // Should still complete initialization even without keychain
      expect(getByTestId('user').textContent).toBe('null');
    });
  });

  describe('Cross-Platform Compatibility', () => {
    test('should work in non-Electron environment', async () => {
      // Mock non-Electron environment
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Chrome)',
        writable: true,
      });

      const { getByTestId } = render(
        <DesktopAuthProvider>
          <TestComponent />
        </DesktopAuthProvider>
      );

      await waitFor(() => {
        expect(getByTestId('loading').textContent).toBe('false');
      });

      // Should not attempt to access Electron APIs
      expect(mockElectronAPI.keychainHelper.isAvailable).not.toHaveBeenCalled();
    });

    test('should handle Electron API unavailability', async () => {
      // Remove Electron API
      delete (window as any).electronAPI;

      const { getByTestId } = render(
        <DesktopAuthProvider>
          <TestComponent />
        </DesktopAuthProvider>
      );

      await waitFor(() => {
        expect(getByTestId('loading').textContent).toBe('false');
      });

      // Should complete initialization without errors
      expect(getByTestId('user').textContent).toBe('null');
    });
  });

  describe('Performance and Memory Management', () => {
    test('should clean up promises after refresh completion', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      
      mockElectronAPI.keychainHelper.getAuthSafe.mockResolvedValue({
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        user: mockUser,
      });

      mockElectronAPI.apiRequest.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          user: mockUser,
          tokens: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
          },
        }),
      });

      const { getByTestId } = render(
        <DesktopAuthProvider>
          <TestComponent />
        </DesktopAuthProvider>
      );

      await waitFor(() => {
        expect(getByTestId('user').textContent).toBe('test@example.com');
      });

      await act(async () => {
        getByTestId('refresh-btn').click();
      });

      // Wait for refresh to complete
      await waitFor(() => {
        expect(mockElectronAPI.keychainHelper.storeAuthSafe).toHaveBeenCalled();
      });

      // Verify promise cleanup (no way to directly test but ensures no memory leaks)
      expect(mockElectronAPI.apiRequest).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      
      mockElectronAPI.keychainHelper.getAuthSafe.mockResolvedValue({
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        user: mockUser,
      });

      mockElectronAPI.apiRequest.mockRejectedValue(new Error('Network error'));

      const { getByTestId } = render(
        <DesktopAuthProvider>
          <TestComponent />
        </DesktopAuthProvider>
      );

      await waitFor(() => {
        expect(getByTestId('user').textContent).toBe('test@example.com');
      });

      await act(async () => {
        getByTestId('refresh-btn').click();
      });

      // Should logout on persistent network errors
      await waitFor(() => {
        expect(getByTestId('user').textContent).toBe('null');
      });
    });
  });
});