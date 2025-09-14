import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Save, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

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

interface EditProductModalProps {
  isOpen: boolean
  onClose: () => void
  product: Product | null
  onSave: (id: string, updates: Partial<Product>) => void
}

export default function EditProductModal({ isOpen, onClose, product, onSave }: EditProductModalProps) {
  const [editedProduct, setEditedProduct] = useState<Partial<Product>>({})
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (product) {
      setEditedProduct({
        name: product.name,
        url: product.url,
        notifyForStock: product.notifyForStock,
        notifyForPrice: product.notifyForPrice
      })
    }
  }, [product])

  const handleSave = async () => {
    if (!product) return

    setIsSaving(true)
    try {
      // Validate required fields
      if (!editedProduct.name?.trim()) {
        toast({
          title: "Validation Error",
          description: "Product name is required",
          variant: "destructive",
        })
        setIsSaving(false)
        return
      }

      if (!editedProduct.url?.trim()) {
        toast({
          title: "Validation Error", 
          description: "Product URL is required",
          variant: "destructive",
        })
        setIsSaving(false)
        return
      }

      // Call the save handler
      onSave(product.id, editedProduct)
      
      toast({
        title: "Product updated",
        description: "Your product has been updated successfully.",
      })
      
      onClose()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update product. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleFieldChange = (field: keyof Product, value: any) => {
    setEditedProduct(prev => ({ ...prev, [field]: value }))
  }

  const handleOpenUrl = () => {
    if (editedProduct.url) {
      window.open(editedProduct.url, '_blank', 'noopener,noreferrer')
    }
  }

  if (!product) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit Product
            <Badge variant="secondary" className="text-xs">
              {product.platform}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Product Name */}
          <div className="space-y-2">
            <Label htmlFor="product-name">Product Name</Label>
            <Input
              id="product-name"
              value={editedProduct.name || ""}
              onChange={(e) => handleFieldChange("name", e.target.value)}
              placeholder="Enter product name"
              data-testid="input-edit-product-name"
            />
          </div>

          {/* Product URL */}
          <div className="space-y-2">
            <Label htmlFor="product-url">Product URL</Label>
            <div className="flex gap-2">
              <Input
                id="product-url"
                value={editedProduct.url || ""}
                onChange={(e) => handleFieldChange("url", e.target.value)}
                placeholder="Enter product URL"
                className="flex-1"
                data-testid="input-edit-product-url"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenUrl}
                disabled={!editedProduct.url}
                data-testid="button-open-url"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Notification Settings</Label>
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="notify-stock" className="text-sm">Stock Alerts</Label>
                <p className="text-xs text-muted-foreground">
                  Get notified when item comes back in stock
                </p>
              </div>
              <Switch
                id="notify-stock"
                checked={editedProduct.notifyForStock ?? false}
                onCheckedChange={(checked) => handleFieldChange("notifyForStock", checked)}
                data-testid="switch-notify-stock"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="notify-price" className="text-sm">Price Drop Alerts</Label>
                <p className="text-xs text-muted-foreground">
                  Get notified when price decreases
                </p>
              </div>
              <Switch
                id="notify-price"
                checked={editedProduct.notifyForPrice ?? false}
                onCheckedChange={(checked) => handleFieldChange("notifyForPrice", checked)}
                data-testid="switch-notify-price"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1"
              data-testid="button-save-product"
            >
              {isSaving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              data-testid="button-cancel-edit"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}