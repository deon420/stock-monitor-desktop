// Desktop-specific data provider that uses local SQLite database via IPC
// This provider mimics the HTTP API format but uses local database operations

// Standard IPC response format
interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

interface DesktopAPI {
  database: {
    products: {
      getAll: () => Promise<IPCResponse<any[]>>;
      add: (productData: any) => Promise<IPCResponse<any>>;
      update: (id: string, productData: any) => Promise<IPCResponse<any>>;
      delete: (productId: string) => Promise<IPCResponse<{ success: boolean; changes: number }>>;
      updatePrice: (id: string, price: number, isInStock: boolean) => Promise<IPCResponse<any>>;
      getForMonitoring: (platform?: string) => Promise<IPCResponse<any[]>>;
    };
    monitoring: {
      addCheck: (productId: string, price: number, isInStock: boolean, success: boolean, errorMessage?: string) => Promise<IPCResponse<{ id: string }>>;
      getHistory: (productId: string, days?: number) => Promise<IPCResponse<any[]>>;
      getAllChecks: (limit?: number) => Promise<IPCResponse<any[]>>;
    };
    settings: {
      get: () => Promise<IPCResponse<any>>;
      update: (settings: any) => Promise<IPCResponse<any>>;
    };
    notifications: {
      add: (productId: string, type: string, title: string, message: string, data?: any) => Promise<IPCResponse<any>>;
      getAll: (limit?: number) => Promise<IPCResponse<any[]>>;
      markAsRead: (notificationId: string) => Promise<IPCResponse<{ success: boolean }>>;
      markAllAsRead: () => Promise<IPCResponse<{ count: number }>>;
    };
    data: {
      export: () => Promise<IPCResponse<any>>;
      import: (data: any) => Promise<IPCResponse<{ success: boolean; message: string }>>;
    };
    stats: () => Promise<IPCResponse<any>>;
  };
  dbHelper: {
    safeCall: <T>(operation: () => Promise<IPCResponse<T>>) => Promise<T>;
    isDesktop: () => boolean;
    getStatus: () => Promise<{ available: boolean; [key: string]: any }>;
  };
}

declare global {
  interface Window {
    electronAPI?: DesktopAPI;
  }
}

/**
 * Check if we're running in desktop environment
 */
export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && 'electronAPI' in window && !!window.electronAPI?.dbHelper?.isDesktop();
}

/**
 * Get the desktop API if available
 */
export function getDesktopAPI(): DesktopAPI | null {
  return window.electronAPI || null;
}

/**
 * Desktop Data Provider - provides HTTP API compatible interface using local database
 */
export class DesktopDataProvider {
  private api: DesktopAPI;

  constructor() {
    const api = getDesktopAPI();
    if (!api) {
      throw new Error('Desktop API not available');
    }
    this.api = api;
  }

  /**
   * Safe wrapper that handles database responses consistently
   */
  private async safeCall<T>(operation: () => Promise<IPCResponse<T>>): Promise<T> {
    return this.api.dbHelper.safeCall(operation);
  }

  /**
   * Product Operations - HTTP API compatible interface
   */
  
  // GET /api/products
  async getProducts(): Promise<any[]> {
    try {
      const result = await this.api.database.products.getAll();
      console.log('[DesktopData] Retrieved products:', result);
      
      // Handle both { success, data } format and direct array format
      if (result && result.success !== undefined) {
        return result.success ? (result.data || []) : [];
      }
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('[DesktopData] Get products failed:', error);
      return [];
    }
  }

  // POST /api/products
  async addProduct(productData: any): Promise<any> {
    return this.safeCall(() => this.api.database.products.add(productData));
  }

  // PUT /api/products/:id
  async updateProduct(id: string, productData: any): Promise<any> {
    return this.safeCall(() => this.api.database.products.update(id, productData));
  }

  // DELETE /api/products/:id
  async deleteProduct(id: string): Promise<{ success: boolean }> {
    const result = await this.safeCall(() => this.api.database.products.delete(id));
    return { success: result.success && result.changes > 0 };
  }

  // PUT /api/products/:id/price
  async updateProductPrice(id: string, price: number, isInStock: boolean): Promise<any> {
    return this.safeCall(() => this.api.database.products.updatePrice(id, price, isInStock));
  }

  /**
   * Monitoring Operations
   */
  
  // GET /api/products/:id/history
  async getProductHistory(productId: string, days: number = 30): Promise<any[]> {
    return this.safeCall(() => this.api.database.monitoring.getHistory(productId, days));
  }

  // POST /api/monitoring/check
  async addMonitoringCheck(productId: string, price: number, isInStock: boolean, success: boolean, errorMessage?: string): Promise<any> {
    return this.safeCall(() => this.api.database.monitoring.addCheck(productId, price, isInStock, success, errorMessage));
  }

  // GET /api/monitoring/checks
  async getAllMonitoringChecks(limit: number = 100): Promise<any[]> {
    return this.safeCall(() => this.api.database.monitoring.getAllChecks(limit));
  }

  // GET /api/products/monitoring/:platform
  async getProductsForMonitoring(platform?: string): Promise<any[]> {
    return this.safeCall(() => this.api.database.products.getForMonitoring(platform));
  }

  /**
   * Settings Operations
   */
  
  // GET /api/settings
  async getSettings(): Promise<any> {
    return this.safeCall(() => this.api.database.settings.get());
  }

  // PUT /api/settings
  async updateSettings(settings: any): Promise<any> {
    return this.safeCall(() => this.api.database.settings.update(settings));
  }

  /**
   * Notification Operations
   */
  
  // GET /api/notifications
  async getNotifications(limit: number = 50): Promise<any[]> {
    return this.safeCall(() => this.api.database.notifications.getAll(limit));
  }

  // POST /api/notifications
  async addNotification(productId: string, type: string, title: string, message: string, data?: any): Promise<any> {
    return this.safeCall(() => this.api.database.notifications.add(productId, type, title, message, data));
  }

  // PUT /api/notifications/:id/read
  async markNotificationAsRead(notificationId: string): Promise<{ success: boolean }> {
    const result = await this.safeCall(() => this.api.database.notifications.markAsRead(notificationId));
    return { success: result.success };
  }

  // PUT /api/notifications/read-all
  async markAllNotificationsAsRead(): Promise<{ count: number }> {
    const result = await this.safeCall(() => this.api.database.notifications.markAllAsRead());
    return { count: result.count };
  }

  /**
   * Data Operations
   */
  
  // GET /api/data/export
  async exportData(): Promise<any> {
    return this.safeCall(() => this.api.database.data.export());
  }

  // POST /api/data/import
  async importData(data: any): Promise<{ success: boolean; message: string }> {
    return this.safeCall(() => this.api.database.data.import(data));
  }

  /**
   * Database Status and Statistics
   */
  
  // GET /api/stats
  async getStats(): Promise<any> {
    return this.safeCall(() => this.api.database.stats());
  }

  // Check database status
  async getDatabaseStatus(): Promise<{ available: boolean; [key: string]: any }> {
    try {
      return await this.api.dbHelper.getStatus();
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Legacy compatibility methods
   */
  
  // For compatibility with existing React components that expect HTTP response format
  async fetchProducts(): Promise<{ products: any[] }> {
    const products = await this.getProducts();
    return { products };
  }

  async createProduct(productData: any): Promise<{ product: any }> {
    const product = await this.addProduct(productData);
    return { product };
  }
}

/**
 * Create desktop data provider instance
 */
export function createDesktopDataProvider(): DesktopDataProvider | null {
  try {
    if (isDesktopApp()) {
      return new DesktopDataProvider();
    }
    return null;
  } catch (error) {
    console.error('[DesktopData] Failed to create desktop data provider:', error);
    return null;
  }
}

/**
 * Hook for using desktop data provider in React components
 */
export function useDesktopDataProvider(): DesktopDataProvider | null {
  if (!isDesktopApp()) {
    return null;
  }

  try {
    return new DesktopDataProvider();
  } catch (error) {
    console.error('[DesktopData] Desktop data provider not available:', error);
    return null;
  }
}

// Export singleton instance for convenience
export const desktopDataProvider = createDesktopDataProvider();