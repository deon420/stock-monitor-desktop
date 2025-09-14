/**
 * TypeScript definitions for the Electron API exposed via contextBridge
 * This ensures type safety for all IPC communication between renderer and main process
 */

export interface DatabaseResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
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

export interface AuthData {
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

export interface KeychainStatus {
  available: boolean;
  serviceName: string;
  credentialCount: number;
  platform: string;
  error?: string;
}

export interface APIResponse<T = any> {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
  url: string;
  json(): Promise<T>;
  text(): Promise<string>;
  clone(): APIResponse<T>;
}

export interface ElectronAPI {
  // HTTP API for authentication and data (fallback to external server)
  apiRequest(url: string, options?: RequestInit): Promise<APIResponse>;

  // Local Database API
  database: {
    products: {
      getAll(): Promise<DatabaseResult<any[]>>;
      add(productData: any): Promise<DatabaseResult<any>>;
      update(id: string, productData: any): Promise<DatabaseResult<any>>;
      delete(productId: string): Promise<DatabaseResult<{ success: boolean }>>;
      updatePrice(id: string, price: number, isInStock: boolean): Promise<DatabaseResult<any>>;
      getForMonitoring(platform?: string): Promise<DatabaseResult<any[]>>;
    };
    
    monitoring: {
      addCheck(
        productId: string, 
        price: number, 
        isInStock: boolean, 
        success: boolean, 
        errorMessage?: string
      ): Promise<DatabaseResult<{ id: string }>>;
      getHistory(productId: string, days: number): Promise<DatabaseResult<any[]>>;
      getAllChecks(limit?: number): Promise<DatabaseResult<any[]>>;
    };
    
    settings: {
      get(): Promise<DatabaseResult<any>>;
      update(settings: any): Promise<DatabaseResult<any>>;
    };
    
    notifications: {
      add(
        productId: string, 
        type: string, 
        title: string, 
        message: string, 
        data?: any
      ): Promise<DatabaseResult<{ id: string }>>;
      getAll(limit?: number): Promise<DatabaseResult<any[]>>;
      markAsRead(notificationId: string): Promise<DatabaseResult<boolean>>;
      markAllAsRead(): Promise<DatabaseResult<{ count: number }>>;
    };
    
    data: {
      export(): Promise<DatabaseResult<any>>;
      import(data: any): Promise<DatabaseResult<any>>;
    };
    
    stats(): Promise<DatabaseResult<any>>;
  };

  // Helper functions for database operations with error handling
  dbHelper: {
    safeCall<T>(operation: () => Promise<DatabaseResult<T>>): Promise<T>;
    isDesktop(): boolean;
    getStatus(): Promise<{
      available: boolean;
      error?: string;
      [key: string]: any;
    }>;
  };

  // Secure Keychain API
  keychain: {
    // Authentication data management (high-level operations)
    auth: {
      store(userId: string, authData: AuthData, rememberMe: boolean): Promise<KeychainResult<void>>;
      get(userId: string): Promise<KeychainResult<AuthData | null>>;
      clear(userId: string): Promise<KeychainResult<void>>;
    };
    
    // Individual token operations (low-level operations)
    tokens: {
      store(userId: string, tokenType: string, value: string): Promise<KeychainResult<void>>;
      get(userId: string, tokenType: string): Promise<KeychainResult<string | null>>;
      delete(userId: string, tokenType: string): Promise<KeychainResult<void>>;
    };
    
    // Login preferences (email remembering)
    preferences: {
      storeEmail(email: string): Promise<KeychainResult<void>>;
      getEmail(): Promise<KeychainResult<string | null>>;
      clearEmail(): Promise<KeychainResult<void>>;
    };
    
    // System management
    system: {
      getStatus(): Promise<KeychainResult<KeychainStatus>>;
      clearAll(): Promise<KeychainResult<void>>;
    };
  };

  // Helper functions for keychain operations with consistent error handling
  keychainHelper: {
    safeCall<T>(operation: () => Promise<KeychainResult<T>>): Promise<T>;
    isAvailable(): Promise<boolean>;
    getStatus(): Promise<KeychainStatus>;
    
    // Secure authentication data management with fallback
    storeAuthSafe(
      userId: string, 
      authData: AuthData, 
      rememberMe?: boolean
    ): Promise<MemoryStorageResult<void>>;
    
    getAuthSafe(userId: string): Promise<AuthData | null>;
    
    clearAuthSafe(userId: string): Promise<{
      success: boolean;
      keychain: boolean;
      memory: boolean;
      fallback?: boolean;
    }>;
  };

  // App lifecycle methods
  onUpdateAvailable(callback: (event: any) => void): void;
  onUpdateDownloaded(callback: (event: any) => void): void;

  // Notification system (if implemented)
  showNotification?(options: {
    title: string;
    body: string;
    type?: 'info' | 'warning' | 'error' | 'success';
  }): void;
}

// Global window interface extension
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Token types for keychain storage
export enum KEYCHAIN_TOKEN_TYPES {
  ACCESS_TOKEN = 'access_token',
  REFRESH_TOKEN = 'refresh_token',
  USER_DATA = 'user_data',
  REMEMBER_ME = 'remember_me',
  LOGIN_EMAIL = 'login_email',
}

export type KeychainTokenType = KEYCHAIN_TOKEN_TYPES;

// Export the type for use in other files
export default ElectronAPI;