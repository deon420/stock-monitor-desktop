import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ExternalLink, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface Product {
  id: string
  name: string
  url: string
  platform: "amazon" | "walmart"
  currentPrice?: number
  previousPrice?: number
}

interface PriceDropAlertModalProps {
  isOpen: boolean
  product: Product | null
  onClose: () => void
}

export default function PriceDropAlertModal({ isOpen, product, onClose }: PriceDropAlertModalProps) {
  if (!product) return null

  const handleVisitProduct = () => {
    window.open(product.url, '_blank', 'noopener,noreferrer')
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
  
  // Calculate savings
  const hasCurrent = typeof product.currentPrice === 'number'
  const hasPrevious = typeof product.previousPrice === 'number'
  const savings = hasCurrent && hasPrevious 
    ? product.previousPrice! - product.currentPrice! 
    : 0
  
  const discountPercent = hasPrevious && savings > 0
    ? Math.round((savings / product.previousPrice!) * 100)
    : 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-md mx-auto p-0 overflow-hidden"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Price Drop Alert</DialogTitle>
          <DialogDescription>
            This product has dropped in price
          </DialogDescription>
        </DialogHeader>
        <Card className={cn("border-2", config.accent)}>
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center gap-2">
              <TrendingDown className="w-5 h-5 text-green-500" />
              <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">
                Price Drop!
              </Badge>
            </div>
            <div className="mt-4">
              <h2 className="text-lg font-semibold line-clamp-2 mb-2">
                {product.name}
              </h2>
              <Badge variant="secondary" className={cn("text-sm", config.color)}>
                {config.label}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="text-center space-y-4">
            <div className="space-y-2">
              {hasCurrent && (
                <div className="text-2xl font-bold font-mono text-green-600 dark:text-green-400" data-testid="text-current-price">
                  ${product.currentPrice!.toFixed(2)}
                </div>
              )}
              
              {hasPrevious && savings > 0 && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground line-through" data-testid="text-previous-price">
                    Was ${product.previousPrice!.toFixed(2)}
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <Badge variant="outline" className="text-green-600 border-green-600" data-testid="badge-savings">
                      Save ${savings.toFixed(2)} (<span data-testid="text-discount-percent">{discountPercent}% off</span>)
                    </Badge>
                  </div>
                </div>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground">
              Great news! This product just dropped in price. Click below to view it on {config.label}.
            </p>
            
            <div className="flex gap-2">
              <Button 
                className="flex-1"
                onClick={handleVisitProduct}
                data-testid="button-visit-product-price-drop"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View on {config.label}
              </Button>
              <Button 
                variant="outline" 
                onClick={onClose}
                data-testid="button-dismiss-price-alert"
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  )
}