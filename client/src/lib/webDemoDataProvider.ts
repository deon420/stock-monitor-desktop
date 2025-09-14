// Web Demo Data Provider - implements IDataProvider using in-memory state
// Resets on page refresh, no persistence, no API calls

import { IDataProvider, Product, ProductInput, AppSettings } from './dataProvider'
import { mockProducts, mockSettings } from './mockData'

export class WebDemoDataProvider implements IDataProvider {
  private products: Product[] = []
  private settings: AppSettings = { ...mockSettings }
  private nextId = 10 // Start after mock data IDs

  constructor() {
    // Initialize with mock data on instantiation
    this.products = [...mockProducts]
    console.log('[WebDemoDataProvider] Initialized with', this.products.length, 'mock products')
  }

  async getProducts(): Promise<Product[]> {
    console.log('[WebDemoDataProvider] Getting products:', this.products.length)
    // Return a copy to prevent external mutation
    return [...this.products]
  }

  async addProduct(productData: ProductInput): Promise<Product> {
    console.log('[WebDemoDataProvider] Adding product:', productData.name)
    
    const newProduct: Product = {
      id: (this.nextId++).toString(),
      name: productData.name,
      url: productData.url,
      platform: productData.platform,
      asin: productData.asin,
      status: "unknown",
      lastChecked: new Date(),
      notifyForStock: productData.platform === "walmart", // Default based on platform
      notifyForPrice: productData.platform === "amazon",
      // Add some random demo price for visual effect
      currentPrice: Math.round((Math.random() * 200 + 20) * 100) / 100
    }

    this.products.push(newProduct)
    console.log('[WebDemoDataProvider] Product added, total:', this.products.length)
    return newProduct
  }

  async deleteProduct(productId: string): Promise<{ success: boolean }> {
    console.log('[WebDemoDataProvider] Deleting product:', productId)
    
    const initialLength = this.products.length
    this.products = this.products.filter(p => p.id !== productId)
    const success = this.products.length < initialLength
    
    console.log('[WebDemoDataProvider] Delete result:', success, 'remaining:', this.products.length)
    return { success }
  }

  async updateProduct(productId: string, updates: Partial<Product>): Promise<Product> {
    console.log('[WebDemoDataProvider] Updating product:', productId, updates)
    
    const productIndex = this.products.findIndex(p => p.id === productId)
    if (productIndex === -1) {
      throw new Error(`Product with ID ${productId} not found`)
    }

    // Update the product with the provided changes
    this.products[productIndex] = {
      ...this.products[productIndex],
      ...updates,
      lastChecked: new Date() // Always update last checked time
    }

    return this.products[productIndex]
  }

  async getSettings(): Promise<AppSettings> {
    console.log('[WebDemoDataProvider] Getting settings')
    return { ...this.settings }
  }

  async updateSettings(settingsUpdate: Partial<AppSettings>): Promise<AppSettings> {
    console.log('[WebDemoDataProvider] Updating settings:', settingsUpdate)
    this.settings = { ...this.settings, ...settingsUpdate }
    return { ...this.settings }
  }

  async getProductHistory(productId: string, days: number = 30): Promise<any[]> {
    console.log('[WebDemoDataProvider] Getting product history for:', productId)
    // Return mock history data for demo purposes
    const product = this.products.find(p => p.id === productId)
    if (!product) {
      return []
    }

    // Generate some demo history data
    const history = []
    for (let i = 0; i < Math.min(days, 10); i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      history.push({
        id: `history-${productId}-${i}`,
        productId,
        timestamp: date,
        price: product.currentPrice ? product.currentPrice + (Math.random() - 0.5) * 20 : null,
        isInStock: Math.random() > 0.2, // 80% chance of being in stock
        success: true
      })
    }
    
    return history
  }

  isReady(): boolean {
    return true // Always ready since it's just in-memory
  }

  getProviderType(): 'web-demo' | 'desktop' | 'api' {
    return 'web-demo'
  }

  /**
   * Demo-specific methods for simulating real-time updates
   */
  
  simulatePriceChange(productId: string, newPrice?: number): Product | null {
    const product = this.products.find(p => p.id === productId)
    if (!product || !product.currentPrice) return null

    const updatedPrice = newPrice || Math.max(10, product.currentPrice * (0.8 + Math.random() * 0.4))
    product.previousPrice = product.currentPrice
    product.currentPrice = Math.round(updatedPrice * 100) / 100
    product.lastChecked = new Date()

    console.log('[WebDemoDataProvider] Simulated price change for', product.name, 'from', product.previousPrice, 'to', product.currentPrice)
    return product
  }

  simulateStockChange(productId: string, newStatus?: Product['status']): Product | null {
    const product = this.products.find(p => p.id === productId)
    if (!product) return null

    const statuses: Product['status'][] = ['in-stock', 'out-of-stock', 'low-stock']
    product.status = newStatus || statuses[Math.floor(Math.random() * statuses.length)]
    product.lastChecked = new Date()

    console.log('[WebDemoDataProvider] Simulated stock change for', product.name, 'to', product.status)
    return product
  }
}