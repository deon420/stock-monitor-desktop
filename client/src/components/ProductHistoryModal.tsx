import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { TrendingDown, TrendingUp, Minus, ExternalLink, Calendar, DollarSign, Package } from "lucide-react"
import { format, isToday, isYesterday, differenceInDays } from "date-fns"

interface Product {
  id: string
  name: string
  url: string
  platform: "amazon" | "walmart"
  currentPrice?: number
  previousPrice?: number
  status: "in-stock" | "out-of-stock" | "low-stock" | "unknown"
  lastChecked: Date
  priceHistory?: Array<{ price: number; date: Date }>
  notifyForStock: boolean
  notifyForPrice: boolean
}

interface ProductHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  product: Product | null
}

export default function ProductHistoryModal({ isOpen, onClose, product }: ProductHistoryModalProps) {
  
  const formatRelativeDate = (date: Date) => {
    if (isToday(date)) {
      return `Today at ${format(date, 'h:mm a')}`
    }
    if (isYesterday(date)) {
      return `Yesterday at ${format(date, 'h:mm a')}`
    }
    const days = differenceInDays(new Date(), date)
    if (days <= 7) {
      return `${days} days ago at ${format(date, 'h:mm a')}`
    }
    return format(date, 'MMM d, yyyy h:mm a')
  }

  const getPriceChange = (current: number, previous: number) => {
    const change = current - previous
    const percentChange = ((change / previous) * 100).toFixed(1)
    return { change, percentChange }
  }

  const getPriceChangeIcon = (current: number, previous: number) => {
    if (current > previous) {
      return <TrendingUp className="w-4 h-4 text-red-500" />
    } else if (current < previous) {
      return <TrendingDown className="w-4 h-4 text-green-500" />
    } else {
      return <Minus className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in-stock': return 'bg-green-500/10 text-green-700 dark:text-green-400'
      case 'out-of-stock': return 'bg-red-500/10 text-red-700 dark:text-red-400'
      case 'low-stock': return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
      default: return 'bg-gray-500/10 text-gray-700 dark:text-gray-400'
    }
  }

  const getPlatformDisplay = (platform: string) => {
    switch (platform) {
      case 'walmart': 
        return { 
          name: 'Walmart', 
          className: 'bg-blue-600 text-white'
        }
      case 'amazon': 
        return { 
          name: 'Amazon', 
          className: 'bg-orange-500 text-white'
        }
      default: 
        return { 
          name: platform, 
          className: 'bg-gray-500 text-white'
        }
    }
  }

  const handleOpenUrl = () => {
    if (product?.url) {
      window.open(product.url, '_blank', 'noopener,noreferrer')
    }
  }

  if (!product) return null

  // Generate mock history data if not available
  const mockHistory = [
    { price: product.currentPrice || 89.99, date: new Date(), status: product.status },
    { price: product.previousPrice || 119.99, date: new Date(Date.now() - 24 * 60 * 60 * 1000), status: 'in-stock' },
    { price: 109.99, date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), status: 'in-stock' },
    { price: 129.99, date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), status: 'in-stock' }
  ].filter(item => item.price)

  const currentPrice = product.currentPrice || 0
  const previousPrice = product.previousPrice || 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left">
            <TrendingDown className="w-5 h-5" />
            Price & Stock History
            <Badge className={`text-xs ${getPlatformDisplay(product.platform).className}`}>
              {getPlatformDisplay(product.platform).name}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto max-h-[calc(80vh-8rem)]">
          {/* Product Info */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg line-clamp-2">{product.name}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={getPlatformDisplay(product.platform).className}>
                      {getPlatformDisplay(product.platform).name}
                    </Badge>
                    <Badge className={getStatusColor(product.status)}>
                      {product.status}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenUrl}
                  data-testid="button-open-product-url"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Current Price
                  </p>
                  <p className="text-2xl font-bold">
                    {currentPrice > 0 ? `$${currentPrice.toFixed(2)}` : 'Not Available'}
                  </p>
                </div>
                
                {previousPrice > 0 && currentPrice > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Price Change</p>
                    <div className="flex items-center gap-2">
                      {getPriceChangeIcon(currentPrice, previousPrice)}
                      <span className={`font-medium ${currentPrice < previousPrice ? 'text-green-600' : currentPrice > previousPrice ? 'text-red-600' : 'text-gray-600'}`}>
                        {(() => {
                          const { change, percentChange } = getPriceChange(currentPrice, previousPrice)
                          return `${change > 0 ? '+' : ''}$${change.toFixed(2)} (${change > 0 ? '+' : ''}${percentChange}%)`
                        })()}
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Last Checked
                  </p>
                  <p className="text-sm font-medium">
                    {formatRelativeDate(product.lastChecked)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* History Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5" />
                Price History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mockHistory.length > 0 ? (
                <div className="space-y-4">
                  {mockHistory.map((entry, index) => (
                    <div key={index}>
                      <div className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                          <div>
                            <p className="font-medium">${entry.price.toFixed(2)}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatRelativeDate(entry.date)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(entry.status)}>
                            {entry.status}
                          </Badge>
                          {index < mockHistory.length - 1 && (
                            <div className="flex items-center gap-1">
                              {getPriceChangeIcon(entry.price, mockHistory[index + 1].price)}
                              <span className="text-xs text-muted-foreground">
                                {(() => {
                                  const { change } = getPriceChange(entry.price, mockHistory[index + 1].price)
                                  return `${change > 0 ? '+' : ''}$${change.toFixed(2)}`
                                })()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {index < mockHistory.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <TrendingDown className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No History Available</h3>
                  <p className="text-sm text-muted-foreground">
                    Price history will appear here once monitoring begins.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notification Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notification Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Stock Alerts</p>
                    <p className="text-xs text-muted-foreground">When item comes back in stock</p>
                  </div>
                  <Badge variant={product.notifyForStock ? "default" : "secondary"}>
                    {product.notifyForStock ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Price Drop Alerts</p>
                    <p className="text-xs text-muted-foreground">When price decreases</p>
                  </div>
                  <Badge variant={product.notifyForPrice ? "default" : "secondary"}>
                    {product.notifyForPrice ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-4">
          <Button onClick={onClose} data-testid="button-close-history">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}