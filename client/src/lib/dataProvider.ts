// Data Provider Interface - defines common operations for both web demo and desktop app

export interface Product {
  id: string
  name: string
  url: string
  platform: "amazon" | "walmart"
  currentPrice?: number
  previousPrice?: number
  status: "in-stock" | "out-of-stock" | "low-stock" | "unknown"
  lastChecked: Date
  notifyForStock: boolean
  notifyForPrice: boolean
  asin?: string
}

export interface ProductInput {
  name: string
  url: string
  platform: "amazon" | "walmart"
  asin?: string
}

export interface AppSettings {
  amazonCheckInterval: number // minutes
  walmartCheckInterval: number // minutes
  enableRandomization: boolean
  enableAudio: boolean
  priceDropSound: string
  stockAlertSound: string
  audioVolume: number
  enableEmail: boolean
  gmailEmail: string
  gmailAppPassword: string
  testEmailSent: boolean
}

export interface IDataProvider {
  /**
   * Get all products
   */
  getProducts(): Promise<Product[]>

  /**
   * Add a new product
   */
  addProduct(productData: ProductInput): Promise<Product>

  /**
   * Delete a product by ID
   */
  deleteProduct(productId: string): Promise<{ success: boolean }>

  /**
   * Update a product
   */
  updateProduct(productId: string, updates: Partial<Product>): Promise<Product>

  /**
   * Get application settings
   */
  getSettings(): Promise<AppSettings>

  /**
   * Update application settings
   */
  updateSettings(settings: Partial<AppSettings>): Promise<AppSettings>

  /**
   * Get product price history
   */
  getProductHistory(productId: string, days?: number): Promise<any[]>

  /**
   * Check if provider is ready/available
   */
  isReady(): boolean

  /**
   * Provider type identifier
   */
  getProviderType(): 'web-demo' | 'desktop' | 'api'
}