import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Settings, Bell, DollarSign, Package } from "lucide-react"
import { cn } from "@/lib/utils"

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

interface NotificationSettingsModalProps {
  isOpen: boolean
  product: Product | null
  onClose: () => void
  onSave: (productId: string, settings: { notifyForStock: boolean; notifyForPrice: boolean }) => void
}

export default function NotificationSettingsModal({ 
  isOpen, 
  product, 
  onClose, 
  onSave 
}: NotificationSettingsModalProps) {
  const [notifyForStock, setNotifyForStock] = useState(false)
  const [notifyForPrice, setNotifyForPrice] = useState(false)

  // Synchronize state when product changes or modal opens
  useEffect(() => {
    if (product) {
      setNotifyForStock(product.notifyForStock)
      setNotifyForPrice(product.notifyForPrice)
    }
  }, [product?.id, product?.notifyForStock, product?.notifyForPrice, isOpen])

  if (!product) return null

  const handleSave = () => {
    onSave(product.id, { notifyForStock, notifyForPrice })
    onClose()
  }

  const handleCancel = () => {
    // Reset to original values
    setNotifyForStock(product.notifyForStock)
    setNotifyForPrice(product.notifyForPrice)
    onClose()
  }

  // Platform-specific styling
  const platformConfig = {
    amazon: { 
      color: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
      label: "Amazon",
      accent: "border-orange-500"
    },
    walmart: { 
      color: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
      label: "Walmart",
      accent: "border-blue-500"
    }
  }

  const config = platformConfig[product.platform]

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleCancel(); }}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-muted-foreground" />
            <DialogTitle>Notification Settings</DialogTitle>
          </div>
          <DialogDescription>
            Customize when you want to be notified about this product
          </DialogDescription>
        </DialogHeader>

        <Card className={cn("border", config.accent)}>
          <CardHeader className="pb-3">
            <div className="space-y-2">
              <h3 className="font-medium line-clamp-2 text-sm" data-testid="text-product-name">
                {product.name}
              </h3>
              <Badge variant="secondary" className={cn("text-xs w-fit", config.color)} data-testid="badge-platform">
                {config.label}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Stock Notifications */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="stock-notifications" className="text-sm font-medium">
                  Stock Notifications
                </Label>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Get notified when this product comes back in stock or stock levels change
                  </p>
                </div>
                <Switch
                  id="stock-notifications"
                  checked={notifyForStock}
                  onCheckedChange={setNotifyForStock}
                  data-testid="switch-notify-stock"
                />
              </div>
            </div>

            {/* Price Notifications */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="price-notifications" className="text-sm font-medium">
                  Price Notifications
                </Label>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Get notified when this product's price drops or changes
                  </p>
                </div>
                <Switch
                  id="price-notifications"
                  checked={notifyForPrice}
                  onCheckedChange={setNotifyForPrice}
                  data-testid="switch-notify-price"
                />
              </div>
            </div>

            {/* Notification Status */}
            <div className="pt-2 border-t">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {notifyForStock || notifyForPrice 
                    ? "Notifications active for this product"
                    : "No notifications enabled for this product"
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            data-testid="button-cancel-settings"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            data-testid="button-save-settings"
          >
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}