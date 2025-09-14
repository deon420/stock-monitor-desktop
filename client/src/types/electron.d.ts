/**
 * TypeScript definitions for Electron API used in the client
 * Shared types between main and renderer processes
 */

import { AuthResponse, UserProfile } from "@shared/schema";

export interface ElectronAuthData {
  accessToken: string;
  refreshToken?: string | null;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    isAdmin: boolean;
  };
  rememberMe?: boolean;
  timestamp?: number;
}

export interface KeychainResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  available?: boolean;
}

export interface MemoryStorageResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  fallback?: boolean;
  memoryStorage?: boolean;
}

export interface KeychainStatus {
  available: boolean;
  serviceName: string;
  credentialCount: number;
  platform: string;
  error?: string;
}

export interface ElectronAPIResponse<T = any> {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
  url: string;
  json(): Promise<T>;
  text(): Promise<string>;
  clone(): ElectronAPIResponse<T>;
}

export interface ElectronAPI {
  // HTTP API for authentication and data
  apiRequest(url: string, options?: RequestInit): Promise<ElectronAPIResponse>;

  // Keychain Helper API (high-level secure operations)
  keychainHelper: {
    isAvailable(): Promise<boolean>;
    getStatus(): Promise<KeychainStatus>;
    
    // Secure authentication data management with automatic fallback
    storeAuthSafe(
      userId: string, 
      authData: ElectronAuthData | AuthResponse, 
      rememberMe?: boolean
    ): Promise<MemoryStorageResult<void>>;
    
    getAuthSafe(userId: string): Promise<ElectronAuthData | null>;
    
    clearAuthSafe(userId: string): Promise<{
      success: boolean;
      keychain: boolean;
      memory: boolean;
      fallback?: boolean;
    }>;

    safeCall<T>(operation: () => Promise<KeychainResult<T>>): Promise<T>;
  };

  // Direct Keychain API (low-level operations)
  keychain: {
    auth: {
      store(userId: string, authData: ElectronAuthData, rememberMe: boolean): Promise<KeychainResult<void>>;
      get(userId: string): Promise<KeychainResult<ElectronAuthData | null>>;
      clear(userId: string): Promise<KeychainResult<void>>;
    };
    
    tokens: {
      store(userId: string, tokenType: string, value: string): Promise<KeychainResult<void>>;
      get(userId: string, tokenType: string): Promise<KeychainResult<string | null>>;
      delete(userId: string, tokenType: string): Promise<KeychainResult<void>>;
    };
    
    preferences: {
      storeEmail(email: string): Promise<KeychainResult<void>>;
      getEmail(): Promise<KeychainResult<string | null>>;
      clearEmail(): Promise<KeychainResult<void>>;
    };
    
    system: {
      getStatus(): Promise<KeychainResult<KeychainStatus>>;
      clearAll(): Promise<KeychainResult<void>>;
    };
  };

  // Database API (if needed in client)
  database?: {
    products: {
      getAll(): Promise<any[]>;
      add(productData: any): Promise<any>;
      update(id: string, productData: any): Promise<any>;
      delete(productId: string): Promise<{ success: boolean }>;
    };
  };

  // Notification system (if implemented)
  showNotification?(options: {
    title: string;
    body: string;
    type?: 'info' | 'warning' | 'error' | 'success';
  }): void;
}

// Global window interface extension for React components
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

// Type guards for runtime checking
export const isElectronApp = (): boolean => {
  return typeof window !== 'undefined' && 'electronAPI' in window;
};

export const isKeychainAvailable = async (): Promise<boolean> => {
  if (!isElectronApp()) return false;
  
  try {
    return await window.electronAPI!.keychainHelper.isAvailable();
  } catch (error) {
    console.warn('[Types] Keychain availability check failed:', error);
    return false;
  }
};

// Export types for use throughout the application
export default ElectronAPI;