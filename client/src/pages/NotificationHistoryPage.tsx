import { useState } from "react"
import { Link } from "wouter"
import { ArrowLeft, Bell, TrendingDown, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useNotifications, Notification } from "@/contexts/NotificationsContext"

export default function NotificationHistoryPage() {
  // Use shared notifications context
  const { notifications } = useNotifications()
  
  // Filter notifications to show only those from the last 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const last24HoursNotifications = notifications.filter(
    notification => notification.timestamp >= twentyFourHoursAgo
  )

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

  const formatFullTimestamp = (date: Date) => {
    return date.toLocaleString()
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
                    <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                      New
                    </Badge>
                  )}
                </div>
                
                <h3 className="font-medium text-sm leading-tight">{notification.productName}</h3>
                
                {isPriceDrop && notification.data.currentPrice && notification.data.previousPrice ? (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-green-600 font-semibold">
                      ${notification.data.currentPrice}
                    </span>
                    <span className="text-muted-foreground line-through">
                      ${notification.data.previousPrice}
                    </span>
                    <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30 text-xs">
                      Save ${notification.data.savings} ({notification.data.discountPercent}% off)
                    </Badge>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Product is now back in stock
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(notification.timestamp)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatFullTimestamp(notification.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const unreadCount = last24HoursNotifications.filter(n => !n.read).length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon" data-testid="button-back-dashboard">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                <h1 className="text-xl font-semibold">Notification History</h1>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Last 24 Hours
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-4">
          {last24HoursNotifications.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {last24HoursNotifications.length} notification{last24HoursNotifications.length !== 1 ? 's' : ''} in the last 24 hours
                </p>
              </div>
              
              <div className="space-y-3">
                {last24HoursNotifications.map((notification) => (
                  <NotificationCard key={notification.id} notification={notification} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                No notifications in the last 24 hours
              </h3>
              <p className="text-sm text-muted-foreground">
                When you receive price drop or stock alerts, they'll appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}