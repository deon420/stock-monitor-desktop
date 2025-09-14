import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Package, TrendingDown, Clock, DollarSign } from "lucide-react"
import StatusIndicator from "./StatusIndicator"

interface StatsCardsProps {
  totalProducts: number
  inStockCount: number
  outOfStockCount: number
  lastUpdateTime?: Date
}

export default function StatsCards({
  totalProducts,
  inStockCount,
  outOfStockCount,
  lastUpdateTime
}: StatsCardsProps) {
  const stats = [
    {
      title: "Total Products",
      value: totalProducts.toString(),
      icon: Package,
      description: "Being monitored"
    },
    {
      title: "In Stock",
      value: inStockCount.toString(),
      icon: Package,
      description: "Available now",
      badge: inStockCount > 0 ? { label: "Available", variant: "default" as const } : undefined
    },
    {
      title: "Out of Stock",
      value: outOfStockCount.toString(),
      icon: Package,
      description: "Currently unavailable",
      badge: outOfStockCount > 0 ? { label: "Alert", variant: "destructive" as const } : undefined
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon
        return (
          <Card key={index} data-testid={`stat-card-${index}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
                {stat.badge && (
                  <Badge variant={stat.badge.variant}>
                    {stat.badge.label}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
      
      {/* Status Indicator - Click to cycle through options */}
      <Card className="col-span-3 hover-elevate" data-testid="status-indicator-card">
        <CardContent className="p-0">
          <StatusIndicator />
        </CardContent>
      </Card>
    </div>
  )
}