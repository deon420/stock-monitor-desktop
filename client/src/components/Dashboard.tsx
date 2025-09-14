import { useState, useEffect } from "react"
import DashboardHeader from "./DashboardHeader"
import StatsCards from "./StatsCards"
import ProductCard from "./ProductCard"
import AddProductForm from "./AddProductForm"
import EditProductModal from "./EditProductModal"
import ProductHistoryModal from "./ProductHistoryModal"
import StockAlertModal from "./StockAlertModal"
import PriceDropAlertModal from "./PriceDropAlertModal"
import Settings from "./Settings"
import NotificationHistory from "./NotificationHistory"
import { AccessControl, AccessStatusBadge, ProtectedFeature } from "./AccessControl"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { audioPlayer } from "@/utils/audioPlayer"
import { Play } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNotifications } from "@/contexts/NotificationsContext"
import { ApiError, apiRequest } from "@/lib/queryClient"
import { isDesktopApp, DesktopDataProvider } from "@/lib/desktopDataProvider"

// todo: remove mock functionality
interface Product {
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
}
const mockProducts: Product[] = [
  {
    id: "1",
    name: "Wireless Bluetooth Headphones with Active Noise Cancellation",
    url: "https://amazon.com/product/123",
    platform: "amazon" as const,
    currentPrice: 89.99,
    previousPrice: 119.99,
    status: "in-stock" as const,
    lastChecked: new Date(),
    notifyForStock: false,
    notifyForPrice: true
  },
  {
    id: "2", 
    name: "Smart Home Security Camera 1080P WiFi",
    url: "https://walmart.com/product/456",
    platform: "walmart" as const,
    currentPrice: 45.99,
    previousPrice: 45.99,
    status: "low-stock" as const,
    lastChecked: new Date(Date.now() - 2 * 60 * 60 * 1000),
    notifyForStock: true,
    notifyForPrice: false
  },
  {
    id: "3",
    name: "Portable Power Bank 20000mAh Fast Charging",
    url: "https://amazon.com/product/789", 
    platform: "amazon" as const,
    status: "out-of-stock" as const,
    lastChecked: new Date(Date.now() - 24 * 60 * 60 * 1000),
    notifyForStock: false,
    notifyForPrice: true
  },
  {
    id: "4",
    name: "Fitness Tracker with Heart Rate Monitor",
    url: "https://walmart.com/product/101",
    platform: "walmart" as const,
    currentPrice: 79.99,
    previousPrice: 99.99,
    status: "in-stock" as const,
    lastChecked: new Date(Date.now() - 30 * 60 * 1000),
    notifyForStock: true,
    notifyForPrice: false
  },
  {
    id: "5",
    name: "Gaming Mechanical Keyboard RGB Backlit",
    url: "https://amazon.com/product/202",
    platform: "amazon" as const,
    currentPrice: 129.99,
    status: "in-stock" as const,
    lastChecked: new Date(Date.now() - 15 * 60 * 1000),
    notifyForStock: false,
    notifyForPrice: true
  },
  {
    id: "6",
    name: "Wireless Phone Charger Stand 15W",
    url: "https://walmart.com/product/303",
    platform: "walmart" as const,
    status: "out-of-stock" as const,
    lastChecked: new Date(Date.now() - 3 * 60 * 60 * 1000),
    notifyForStock: true,
    notifyForPrice: false
  },
  {
    id: "7",
    name: "Smart Watch Series 8 GPS + Cellular",
    url: "https://amazon.com/product/404",
    platform: "amazon" as const,
    currentPrice: 249.99,
    previousPrice: 399.99,
    status: "in-stock" as const,
    lastChecked: new Date(Date.now() - 10 * 60 * 1000),
    notifyForStock: false,
    notifyForPrice: true
  },
  {
    id: "8",
    name: "4K Webcam with Auto Focus",
    url: "https://walmart.com/product/505",
    platform: "walmart" as const,
    currentPrice: 89.99,
    previousPrice: 129.99,
    status: "low-stock" as const,
    lastChecked: new Date(Date.now() - 45 * 60 * 1000),
    notifyForStock: true,
    notifyForPrice: true
  },
  {
    id: "9",
    name: "Wireless Earbuds Pro with ANC",
    url: "https://amazon.com/product/606",
    platform: "amazon" as const,
    currentPrice: 179.99,
    status: "in-stock" as const,
    lastChecked: new Date(Date.now() - 5 * 60 * 1000),
    notifyForStock: false,
    notifyForPrice: true
  }
]

export default function Dashboard() {
  const queryClient = useQueryClient()
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [isMonitoring, setIsMonitoring] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [stockAlert, setStockAlert] = useState<Product | null>(null)
  const [priceDropAlert, setPriceDropAlert] = useState<Product | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  // State for Edit and History modals
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null)
  
  // Settings state
  const [settings, setSettings] = useState({
    amazonCheckInterval: 20, // minutes
    walmartCheckInterval: 10, // minutes
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
  
  // Determine if we're running in desktop mode
  const isDesktop = isDesktopApp()
  const [desktopProvider, setDesktopProvider] = useState<DesktopDataProvider | null>(null)
  
  // Initialize desktop provider if available
  useEffect(() => {
    if (isDesktop) {
      try {
        const provider = new DesktopDataProvider()
        setDesktopProvider(provider)
        console.log('[Dashboard] Desktop data provider initialized')
      } catch (error) {
        console.error('[Dashboard] Failed to initialize desktop provider:', error)
      }
    }
  }, [isDesktop])
  
  // Fetch products from the appropriate data source
  const { data: products = mockProducts, isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: ['/api/products'],
    queryFn: async () => {
      if (isDesktop && desktopProvider) {
        console.log('[Dashboard] Fetching products from desktop database')
        return await desktopProvider.getProducts()
      } else {
        console.log('[Dashboard] Fetching products from HTTP API')
        const response = await apiRequest('GET', '/api/products')
        return await response.json()
      }
    },
    enabled: !isDesktop || !!desktopProvider, // Wait for desktop provider to be ready
    staleTime: 30 * 1000, // Cache for 30 seconds
  })

  // Use shared notifications context
  const { notifications, addNotification, markAsRead, markAllAsRead } = useNotifications()
  
  const unreadNotificationCount = notifications.filter(n => !n.read).length

  // Update filtered products when products change
  useEffect(() => {
    filterProducts(searchQuery, {})
  }, [products, searchQuery])

  // Add product mutation
  const addProductMutation = useMutation({
    mutationFn: async (newProduct: { name: string; url: string; platform: "amazon" | "walmart"; asin?: string }) => {
      const productData = {
        name: newProduct.name,
        url: newProduct.url,
        platform: newProduct.platform,
        asin: newProduct.asin || null,
        notifyOnPriceDrop: newProduct.platform === "amazon",
        notifyOnStockChange: newProduct.platform === "walmart",
      }
      
      if (isDesktop && desktopProvider) {
        return await desktopProvider.addProduct(productData)
      } else {
        const response = await apiRequest('POST', '/api/products', productData)
        return await response.json()
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] })
      setShowAddForm(false)
    },
    onError: (error) => {
      console.error('[Dashboard] Failed to add product:', error)
    }
  })

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (isDesktop && desktopProvider) {
        return await desktopProvider.deleteProduct(productId)
      } else {
        const response = await apiRequest('DELETE', `/api/products/${productId}`)
        return await response.json()
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] })
    },
    onError: (error) => {
      console.error('[Dashboard] Failed to delete product:', error)
    }
  })

  // Load settings for audio notifications
  const { data: audioSettings } = useQuery({
    queryKey: ['/api/settings'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

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

  const handleAddProduct = (newProduct: { name: string; url: string; platform: "amazon" | "walmart"; asin?: string }) => {
    addProductMutation.mutate(newProduct)
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

  const handleEditProduct = (id: string) => {
    console.log('Edit product:', id)
    const product = products.find((p: Product) => p.id === id)
    if (product) {
      setEditProduct(product)
    }
  }

  const handleDeleteProduct = (id: string) => {
    console.log('Delete product:', id)
    // Prevent double-deletion by checking if product still exists
    if (!products.find((p: Product) => p.id === id)) return
    
    deleteProductMutation.mutate(id)
  }

  const handleViewHistory = (id: string) => {
    console.log('View history for product:', id)
    const product = products.find((p: Product) => p.id === id)
    if (product) {
      setHistoryProduct(product)
    }
  }

  const handleNotificationSettingsChange = (productId: string, settings: { notifyForStock: boolean; notifyForPrice: boolean }) => {
    console.log('Updating notification settings for product:', productId, settings)
    // This would require an update product mutation - for now just log
    console.log('Notification settings update not yet implemented')
  }

  const handleSettingsChange = (newSettings: any) => {
    console.log('Settings updated:', newSettings)
    setSettings(newSettings)
  }

  const handleMarkNotificationAsRead = (notificationId: string) => {
    markAsRead(notificationId)
  }

  const handleMarkAllNotificationsAsRead = () => {
    markAllAsRead()
  }

  const handleSaveEditProduct = (id: string, updates: Partial<Product>) => {
    console.log('Saving product updates:', id, updates)
    // This would require an update product mutation - for now just close the modal
    console.log('Product edit functionality not yet fully implemented')
    setEditProduct(null)
  }

  // Calculate stats
  const inStockCount = products.filter((p: Product) => p.status === "in-stock").length
  const outOfStockCount = products.filter((p: Product) => p.status === "out-of-stock").length

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
              <div className="grid grid-cols-4 gap-4">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    {...product}
                    onEdit={handleEditProduct}
                    onDelete={handleDeleteProduct}
                    onViewHistory={handleViewHistory}
                    onNotificationSettingsChange={handleNotificationSettingsChange}
                  />
                ))}
              </div>
              
            </>
          )}
        </div>

        {/* Add Product Dialog */}
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

        {/* Stock Alert Modal */}
        <StockAlertModal
          isOpen={!!stockAlert}
          product={stockAlert}
          onClose={() => setStockAlert(null)}
        />
        
        <PriceDropAlertModal
          isOpen={!!priceDropAlert}
          product={priceDropAlert}
          onClose={() => setPriceDropAlert(null)}
        />

        <Settings
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onDemoStock={handleSimulateStockChange}
          onDemoPrice={handleSimulatePriceDrop}
        />

        <NotificationHistory
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
        />

        <EditProductModal
          isOpen={!!editProduct}
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onSave={handleSaveEditProduct}
        />

        <ProductHistoryModal
          isOpen={!!historyProduct}
          product={historyProduct}
          onClose={() => setHistoryProduct(null)}
        />
      </div>
    </div>
  )
}