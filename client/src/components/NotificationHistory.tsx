import { useState, useEffect } from "react"
import { Link } from "wouter"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Bell, TrendingDown, Package, ExternalLink, Calendar, Clock, Eye, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNotifications, Notification } from "@/contexts/NotificationsContext"

interface NotificationHistoryProps {
  isOpen: boolean
  onClose: () => void
}

export default function NotificationHistory({ 
  isOpen, 
  onClose
}: NotificationHistoryProps) {
  // Use shared notifications context
  const { notifications, markAsRead, markAllAsRead } = useNotifications()
  
  // Always show recent view only in modal (last 3 notifications)
  // Full history is now accessible via dedicated page

  const formatTimestamp = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor(diffMs / (1000 * 60))

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`
    } else if (diffHours < 24) {
      return `${diffHours}h ago`
    } else {
      return date.toLocaleDateString()
    }
  }

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

  const NotificationCard = ({ notification }: { notification: Notification }) => {
    const config = platformConfig[notification.platform]
    const isPriceDrop = notification.type === "price_drop"
    
    return (
      <Card className={cn("transition-all duration-200", !notification.read && "border-primary/30 bg-primary/5")}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={cn(
                "p-2 rounded-full",
                isPriceDrop 
                  ? "bg-green-500/10 text-green-600" 
                  : "bg-blue-500/10 text-blue-600"
              )}>
                {isPriceDrop ? (
                  <TrendingDown className="w-4 h-4" />
                ) : (
                  <Package className="w-4 h-4" />
                )}
              </div>
              
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={cn(
                    "text-xs",
                    isPriceDrop 
                      ? "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30"
                      : "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30"
                  )}>
                    {isPriceDrop ? "Price Drop" : "Back In Stock"}
                  </Badge>
                  <Badge variant="secondary" className={cn("text-xs", config.color)}>
                    {config.label}
                  </Badge>
                  {!notification.read && (
                    <div className="w-2 h-2 bg-primary rounded-full" />
                  )}
                </div>
                
                <h3 className="font-medium text-sm line-clamp-2 leading-tight">
                  {notification.productName}
                </h3>
                
                {isPriceDrop && notification.data.currentPrice && notification.data.previousPrice && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      ${notification.data.currentPrice}
                    </span>
                    <span className="text-muted-foreground line-through">
                      ${notification.data.previousPrice}
                    </span>
                    <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-700 dark:text-green-400">
                      -{notification.data.discountPercent}%
                    </Badge>
                  </div>
                )}
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimestamp(notification.timestamp)}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (notification.data.productUrl) {
                    window.open(notification.data.productUrl, '_blank', 'noopener,noreferrer')
                  }
                }}
                className="h-8 w-8 p-0"
              >
                <ExternalLink className="w-3 h-3" />
              </Button>
              
              {!notification.read && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAsRead(notification.id)}
                  className="h-8 w-8 p-0"
                >
                  <Eye className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const recentNotifications = notifications.slice(0, 3)
  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 pr-10">
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {unreadCount} new
              </Badge>
            )}
          </DialogTitle>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="mt-2 w-fit"
            >
              Mark All Read
            </Button>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Recent Notifications */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Recent</h3>
            {recentNotifications.length > 0 ? (
              recentNotifications.map((notification) => (
                <NotificationCard key={notification.id} notification={notification} />
              ))
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Bell className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">No notifications yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    You'll see price drops and stock alerts here
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {notifications.length > 3 && (
            <>
              <Separator />
              <div className="text-center">
                <Link href="/notifications">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    data-testid="button-view-all-notifications"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View All Notifications ({notifications.length - 3} more)
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="flex-shrink-0 flex justify-end pt-4 border-t">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}