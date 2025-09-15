import { useState, useEffect, Suspense, lazy } from "react"
import DashboardHeader from "./DashboardHeader"
import StatsCards from "./StatsCards"
import ProductCard from "./ProductCard"

// Code split modal components and forms for better bundle optimization
const AddProductForm = lazy(() => import("./AddProductForm"))
const EditProductModal = lazy(() => import("./EditProductModal"))
const ProductHistoryModal = lazy(() => import("./ProductHistoryModal"))
const StockAlertModal = lazy(() => import("./StockAlertModal"))
const PriceDropAlertModal = lazy(() => import("./PriceDropAlertModal"))
const Settings = lazy(() => import("./Settings"))
const NotificationHistory = lazy(() => import("./NotificationHistory"))
import { AccessControl, AccessStatusBadge, ProtectedFeature } from "./AccessControl"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { audioPlayer } from "@/utils/audioPlayer"
import { Play } from "lucide-react"
import { useNotifications } from "@/contexts/NotificationsContext"
import { useDataProvider } from "@/contexts/DataProviderContext"
import { Product, ProductInput, AppSettings } from "@/lib/dataProvider"
import { WebDemoDataProvider } from "@/lib/webDemoDataProvider"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"


export default function Dashboard() {
  // Use DataProvider context
  const { dataProvider, isReady, providerType, error: providerError } = useDataProvider()
  const isMobile = useIsMobile()
  
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [isMonitoring, setIsMonitoring] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [stockAlert, setStockAlert] = useState<Product | null>(null)
  const [priceDropAlert, setPriceDropAlert] = useState<Product | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // State for Edit and History modals
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null)
  
  // Settings state
  const [settings, setSettings] = useState<AppSettings>({
    amazonCheckInterval: 20,
    walmartCheckInterval: 10,
    enableRandomization: true,
    enableAudio: true,
    priceDropSound: "chime",
    stockAlertSound: "bell", 
    audioVolume: 80,
    enableEmail: false,
    gmailEmail: "",
    gmailAppPassword: "",
    testEmailSent: false
  })
  
  // Load products when data provider is ready
  useEffect(() => {
    async function loadProducts() {
      if (!dataProvider || !isReady) return
      
      try {
        setLoading(true)
        setError(null)
        console.log('[Dashboard] Loading products from provider:', providerType)
        const productList = await dataProvider.getProducts()
        setProducts(productList)
        console.log('[Dashboard] Loaded', productList.length, 'products')
      } catch (err) {
        console.error('[Dashboard] Failed to load products:', err)
        setError(err instanceof Error ? err.message : 'Failed to load products')
        setProducts([]) // Fallback to empty array
      } finally {
        setLoading(false)
      }
    }
    
    loadProducts()
  }, [dataProvider, isReady, providerType])
  
  // Load settings when data provider is ready
  useEffect(() => {
    async function loadSettings() {
      if (!dataProvider || !isReady) return
      
      try {
        const appSettings = await dataProvider.getSettings()
        setSettings(appSettings)
        console.log('[Dashboard] Settings loaded')
      } catch (err) {
        console.error('[Dashboard] Failed to load settings:', err)
        // Continue with default settings
      }
    }
    
    loadSettings()
  }, [dataProvider, isReady])

  // Use shared notifications context
  const { notifications, addNotification, markAsRead, markAllAsRead } = useNotifications()
  
  const unreadNotificationCount = notifications.filter(n => !n.read).length

  // Update filtered products when products change
  useEffect(() => {
    filterProducts(searchQuery, {})
  }, [products, searchQuery])

  // Product operations using DataProvider
  const handleAddProduct = async (productInput: ProductInput) => {
    if (!dataProvider) {
      console.error('[Dashboard] Data provider not available')
      return
    }
    
    try {
      setLoading(true)
      console.log('[Dashboard] Adding product:', productInput.name)
      const newProduct = await dataProvider.addProduct(productInput)
      
      // Update local state
      setProducts(prev => [...prev, newProduct])
      setShowAddForm(false)
      console.log('[Dashboard] Product added successfully')
    } catch (err) {
      console.error('[Dashboard] Failed to add product:', err)
      setError(err instanceof Error ? err.message : 'Failed to add product')
    } finally {
      setLoading(false)
    }
  }
  
  const handleDeleteProduct = async (productId: string) => {
    if (!dataProvider) {
      console.error('[Dashboard] Data provider not available')
      return
    }
    
    // Prevent double-deletion by checking if product still exists
    if (!products.find(p => p.id === productId)) return
    
    try {
      setLoading(true)
      console.log('[Dashboard] Deleting product:', productId)
      const result = await dataProvider.deleteProduct(productId)
      
      if (result.success) {
        // Update local state
        setProducts(prev => prev.filter(p => p.id !== productId))
        console.log('[Dashboard] Product deleted successfully')
      } else {
        console.error('[Dashboard] Delete operation failed')
      }
    } catch (err) {
      console.error('[Dashboard] Failed to delete product:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete product')
    } finally {
      setLoading(false)
    }
  }
  
  const handleUpdateProduct = async (productId: string, updates: Partial<Product>) => {
    if (!dataProvider) {
      console.error('[Dashboard] Data provider not available')
      return
    }
    
    try {
      setLoading(true)
      console.log('[Dashboard] Updating product:', productId, updates)
      const updatedProduct = await dataProvider.updateProduct(productId, updates)
      
      // Update local state
      setProducts(prev => prev.map(p => p.id === productId ? updatedProduct : p))
      console.log('[Dashboard] Product updated successfully')
    } catch (err) {
      console.error('[Dashboard] Failed to update product:', err)
      setError(err instanceof Error ? err.message : 'Failed to update product')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    filterProducts(query, {})
  }

  const handleFilterChange = (filters: { platform?: string; status?: string }) => {
    filterProducts(searchQuery, filters)
  }

  const filterProducts = (query: string, filters: { platform?: string; status?: string }) => {
    let filtered = products || []

    // Search filter
    if (query.trim()) {
      filtered = filtered.filter((product: Product) => 
        product.name.toLowerCase().includes(query.toLowerCase())
      )
    }

    // Platform filter
    if (filters.platform) {
      filtered = filtered.filter((product: Product) => product.platform === filters.platform)
    }

    // Status filter
    if (filters.status) {
      filtered = filtered.filter((product: Product) => product.status === filters.status)
    }

    setFilteredProducts(filtered)
  }


  // Demo simulation - simplified for React Query compatibility
  const handleSimulateStockChange = async () => {
    console.log('[Dashboard] Stock change simulation triggered')
    // Add a demo notification
    const newNotification = {
      id: Date.now().toString(),
      type: "stock_alert" as const,
      productId: "demo",
      productName: "Demo Product",
      platform: "amazon" as const,
      timestamp: new Date(),
      data: { inStock: true },
      read: false
    }
    addNotification(newNotification)
  }
  
  
  // Simulate a price drop (for demo purposes)
  const handleSimulatePriceDrop = async () => {
    const eligibleProducts = products.filter((p: Product) => p.currentPrice && p.notifyForPrice)
    if (eligibleProducts.length > 0) {
      const randomProduct = eligibleProducts[Math.floor(Math.random() * eligibleProducts.length)]
      const newPrice = Math.max(10, (randomProduct.currentPrice! * 0.8)) // 20% price drop
      const updatedProducts = products.map((p: Product) => 
        p.id === randomProduct.id 
          ? { ...p, previousPrice: p.currentPrice, currentPrice: newPrice }
          : p
      )
      // For demo purposes, just update the filtered products (local state only)
      setFilteredProducts(updatedProducts)
      setPriceDropAlert(updatedProducts.find((p: Product) => p.id === randomProduct.id) || null)
      
      // Play price drop audio notification if settings allow
      if (settings?.enableAudio) {
        await audioPlayer.playPriceDropAlert({
          enableAudio: settings.enableAudio,
          priceDropSound: settings.priceDropSound || "chime",
          audioVolume: settings.audioVolume || 80
        })
      }
      
      // Add notification to history
      const savings = (randomProduct.currentPrice! - newPrice)
      const discountPercent = Math.round((savings / randomProduct.currentPrice!) * 100)
      const newNotification = {
        id: Date.now().toString(),
        type: "price_drop" as const,
        productId: randomProduct.id,
        productName: randomProduct.name,
        platform: randomProduct.platform,
        timestamp: new Date(),
        data: {
          currentPrice: newPrice,
          previousPrice: randomProduct.currentPrice,
          savings,
          discountPercent,
          productUrl: randomProduct.url
        },
        read: false
      }
      addNotification(newNotification)
    }
  }

  const handleEditProductClick = (id: string) => {
    console.log('Edit product:', id)
    const product = products.find(p => p.id === id)
    if (product) {
      setEditProduct(product)
    }
  }

  const handleDeleteProductClick = (id: string) => {
    console.log('Delete product:', id)
    handleDeleteProduct(id)
  }

  const handleViewHistory = (id: string) => {
    console.log('View history for product:', id)
    const product = products.find(p => p.id === id)
    if (product) {
      setHistoryProduct(product)
    }
  }

  const handleNotificationSettingsChange = async (productId: string, notificationSettings: { notifyForStock: boolean; notifyForPrice: boolean }) => {
    console.log('Updating notification settings for product:', productId, notificationSettings)
    await handleUpdateProduct(productId, notificationSettings)
  }

  const handleSettingsChange = async (newSettings: Partial<AppSettings>) => {
    console.log('Settings updated:', newSettings)
    
    if (dataProvider) {
      try {
        const updatedSettings = await dataProvider.updateSettings(newSettings)
        setSettings(updatedSettings)
      } catch (err) {
        console.error('[Dashboard] Failed to save settings:', err)
        // Update local state anyway for immediate feedback
        setSettings(prev => ({ ...prev, ...newSettings }))
      }
    } else {
      // Update local state if no provider available
      setSettings(prev => ({ ...prev, ...newSettings }))
    }
  }

  const handleMarkNotificationAsRead = (notificationId: string) => {
    markAsRead(notificationId)
  }

  const handleMarkAllNotificationsAsRead = () => {
    markAllAsRead()
  }

  const handleSaveEditProduct = async (id: string, updates: Partial<Product>) => {
    console.log('Saving product updates:', id, updates)
    await handleUpdateProduct(id, updates)
    setEditProduct(null)
  }

  // Calculate stats
  const inStockCount = products.filter(p => p.status === "in-stock").length
  const outOfStockCount = products.filter(p => p.status === "out-of-stock").length
  
  // Show loading state if provider is not ready or data is loading
  if (!isReady || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg mb-2">Loading Stock Monitor...</p>
          <p className="text-sm text-muted-foreground">
            {providerType === 'loading' ? 'Initializing...' : `Using ${providerType} provider`}
          </p>
        </div>
      </div>
    )
  }
  
  // Show error state if provider failed to initialize
  if (providerError && !dataProvider) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg mb-2 text-destructive">Failed to Initialize</p>
          <p className="text-sm text-muted-foreground">{providerError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <DashboardHeader
          onAddProduct={() => setShowAddForm(true)}
          onSearch={handleSearch}
          onFilterChange={handleFilterChange}
          isMonitoring={isMonitoring}
          onToggleMonitoring={() => setIsMonitoring(!isMonitoring)}
          onShowNotifications={() => setShowNotifications(true)}
          onShowSettings={() => setShowSettings(true)}
          notificationCount={unreadNotificationCount}
        />

        {/* Stats */}
        <StatsCards
          totalProducts={products.length}
          inStockCount={inStockCount}
          outOfStockCount={outOfStockCount}
          lastUpdateTime={new Date()}
        />

        {/* Products Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              Products ({filteredProducts.length})
            </h2>
            {filteredProducts.length === 0 && searchQuery && (
              <Button variant="outline" onClick={() => handleSearch("")}>
                Clear Search
              </Button>
            )}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {products.length === 0 
                  ? "No products added yet. Add your first product to start monitoring!"
                  : "No products match your search criteria."
                }
              </p>
              <div className="flex gap-2 justify-center mt-4">
                <Button onClick={() => setShowAddForm(true)}>
                  Add Product
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Mobile-responsive product grid */}
              <div className={cn(
                "grid gap-4",
                isMobile 
                  ? "grid-cols-1 gap-3" 
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              )}>
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    {...product}
                    onEdit={handleEditProductClick}
                    onDelete={handleDeleteProductClick}
                    onViewHistory={handleViewHistory}
                    onNotificationSettingsChange={handleNotificationSettingsChange}
                  />
                ))}
              </div>
              
            </>
          )}
        </div>

        {/* Add Product Dialog */}
        {showAddForm && (
          <Suspense fallback={null}>
            <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Product</DialogTitle>
                </DialogHeader>
                <AddProductForm 
                  onAddProduct={handleAddProduct}
                />
              </DialogContent>
            </Dialog>
          </Suspense>
        )}

        {/* Stock Alert Modal */}
        {stockAlert && (
          <Suspense fallback={null}>
            <StockAlertModal
              isOpen={!!stockAlert}
              product={stockAlert}
              onClose={() => setStockAlert(null)}
            />
          </Suspense>
        )}
        
        {priceDropAlert && (
          <Suspense fallback={null}>
            <PriceDropAlertModal
              isOpen={!!priceDropAlert}
              product={priceDropAlert}
              onClose={() => setPriceDropAlert(null)}
            />
          </Suspense>
        )}

        {showSettings && (
          <Suspense fallback={null}>
            <Settings
              isOpen={showSettings}
              onClose={() => setShowSettings(false)}
              onDemoStock={handleSimulateStockChange}
              onDemoPrice={handleSimulatePriceDrop}
            />
          </Suspense>
        )}

        {showNotifications && (
          <Suspense fallback={null}>
            <NotificationHistory
              isOpen={showNotifications}
              onClose={() => setShowNotifications(false)}
            />
          </Suspense>
        )}

        {editProduct && (
          <Suspense fallback={null}>
            <EditProductModal
              isOpen={!!editProduct}
              product={editProduct}
              onClose={() => setEditProduct(null)}
              onSave={handleSaveEditProduct}
            />
          </Suspense>
        )}

        {historyProduct && (
          <Suspense fallback={null}>
            <ProductHistoryModal
              isOpen={!!historyProduct}
              product={historyProduct}
              onClose={() => setHistoryProduct(null)}
            />
          </Suspense>
        )}
      </div>
    </div>
  )
}