import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Edit, Trash2, Clock, TrendingDown, Settings } from "lucide-react"
import StatusBadge from "./StatusBadge"
import PriceDisplay from "./PriceDisplay"
import NotificationSettingsModal from "./NotificationSettingsModal"
import { cn } from "@/lib/utils"
import { formatTimeAgo } from "@/utils/timeUtils"
import { useIsMobile } from "@/hooks/use-mobile"

interface ProductCardProps {
  id: string
  name: string
  url: string
  platform: "amazon" | "walmart"
  currentPrice?: number
  previousPrice?: number
  status: "in-stock" | "out-of-stock" | "low-stock" | "unknown"
  lastChecked?: Date
  priceHistory?: Array<{ price: number; date: Date }>
  notifyForStock: boolean
  notifyForPrice: boolean
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  onViewHistory?: (id: string) => void
  onNotificationSettingsChange?: (id: string, settings: { notifyForStock: boolean; notifyForPrice: boolean }) => void
}

export default function ProductCard({
  id,
  name,
  url,
  platform,
  currentPrice,
  previousPrice,
  status,
  lastChecked,
  notifyForStock,
  notifyForPrice,
  onEdit,
  onDelete,
  onViewHistory,
  onNotificationSettingsChange
}: ProductCardProps) {
  const [imageError, setImageError] = useState(false)
  const [showNotificationSettings, setShowNotificationSettings] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isViewingHistory, setIsViewingHistory] = useState(false)
  const isMobile = useIsMobile()
  
  const handleEdit = () => {
    if (isEditing) return // Prevent double clicks
    setIsEditing(true)
    console.log(`Edit product ${id}`)
    onEdit?.(id)
    // Reset after a short delay
    setTimeout(() => setIsEditing(false), 1000)
  }
  
  const handleDelete = () => {
    if (isDeleting) return // Prevent double clicks
    setIsDeleting(true)
    console.log(`Delete product ${id}`)
    onDelete?.(id)
    // Reset after a short delay
    setTimeout(() => setIsDeleting(false), 1000)
  }
  
  const handleViewHistory = () => {
    if (isViewingHistory) return // Prevent double clicks
    setIsViewingHistory(true)
    console.log(`View history for ${id}`)
    onViewHistory?.(id)
    // Reset after a short delay
    setTimeout(() => setIsViewingHistory(false), 1000)
  }
  
  const handleOpenUrl = () => {
    console.log(`Opening URL: ${url}`)
    window.open(url, '_blank')
  }
  
  const handleNotificationSettings = () => {
    console.log(`Opening notification settings for ${id}`)
    setShowNotificationSettings(true)
  }
  
  const handleNotificationSettingsChange = (productId: string, settings: { notifyForStock: boolean; notifyForPrice: boolean }) => {
    console.log(`Updating notification settings for ${productId}:`, settings)
    onNotificationSettingsChange?.(productId, settings)
  }
  
  // Create product object for the modal
  const productForModal = {
    id,
    name,
    url,
    platform,
    currentPrice,
    previousPrice,
    status,
    lastChecked: lastChecked || new Date(),
    notifyForStock,
    notifyForPrice
  }

  // Platform-specific styling
  const platformConfig = {
    amazon: { 
      color: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
      label: "Amazon"
    },
    walmart: { 
      color: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
      label: "Walmart"
    }
  }

  return (
    <Card className="hover-elevate transition-all duration-200" data-testid={`product-card-${id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-2">
              {name}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className={cn("text-xs", platformConfig[platform].color)}>
                {platformConfig[platform].label}
              </Badge>
              <StatusBadge status={status} />
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-4">
        <div className="space-y-2">
          <PriceDisplay 
            currentPrice={currentPrice}
            previousPrice={previousPrice}
            size="default"
          />
          
          {lastChecked && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
              <Clock className="w-3 h-3 flex-shrink-0" />
              <span>Last checked: {formatTimeAgo(lastChecked)}</span>
            </div>
          )}
        </div>

        {/* Mobile-responsive button layout */}
        <div className={cn(
          "pt-2",
          isMobile 
            ? "grid grid-cols-3 gap-2" 
            : "flex justify-center items-center gap-1"
        )}>
          <Button 
            variant="ghost" 
            size={isMobile ? "sm" : "icon"}
            onClick={handleNotificationSettings}
            data-testid={`button-settings-${id}`}
            className={cn(
              "flex items-center justify-center",
              isMobile ? "h-10 w-full" : ""
            )}
          >
            <Settings className="w-4 h-4" />
            {isMobile && <span className="ml-1 text-xs">Settings</span>}
          </Button>
          <Button 
            variant="ghost" 
            size={isMobile ? "sm" : "icon"}
            onClick={handleEdit}
            disabled={isEditing}
            data-testid={`button-edit-${id}`}
            className={cn(
              "flex items-center justify-center",
              isMobile ? "h-10 w-full" : ""
            )}
          >
            <Edit className="w-4 h-4" />
            {isMobile && <span className="ml-1 text-xs">Edit</span>}
          </Button>
          <Button 
            variant="ghost" 
            size={isMobile ? "sm" : "icon"}
            onClick={handleDelete}
            disabled={isDeleting}
            data-testid={`button-delete-${id}`}
            className={cn(
              "flex items-center justify-center",
              isMobile ? "h-10 w-full" : ""
            )}
          >
            <Trash2 className="w-4 h-4" />
            {isMobile && <span className="ml-1 text-xs">Delete</span>}
          </Button>
          <Button 
            variant="ghost" 
            size={isMobile ? "sm" : "icon"}
            onClick={handleViewHistory}
            disabled={isViewingHistory}
            data-testid={`button-history-${id}`}
            className={cn(
              "flex items-center justify-center",
              isMobile ? "h-10 w-full col-span-1" : ""
            )}
          >
            <TrendingDown className="w-4 h-4" />
            {isMobile && <span className="ml-1 text-xs">History</span>}
          </Button>
          <Button 
            variant="ghost" 
            size={isMobile ? "sm" : "icon"}
            onClick={handleOpenUrl}
            data-testid={`button-open-${id}`}
            className={cn(
              "flex items-center justify-center",
              isMobile ? "h-10 w-full col-span-2" : ""
            )}
          >
            <ExternalLink className="w-4 h-4" />
            {isMobile && <span className="ml-1 text-xs">Open Product</span>}
          </Button>
        </div>
      </CardContent>
      
      <NotificationSettingsModal
        isOpen={showNotificationSettings}
        product={productForModal}
        onClose={() => setShowNotificationSettings(false)}
        onSave={handleNotificationSettingsChange}
      />
    </Card>
  )
}