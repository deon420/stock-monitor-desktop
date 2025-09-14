import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ThemeToggle } from "./ThemeToggle"
import { Activity, Search, Filter, Plus, Settings, Play, Square, Bell } from "lucide-react"

interface DashboardHeaderProps {
  onAddProduct?: () => void
  onSearch?: (query: string) => void
  onFilterChange?: (filter: { platform?: string; status?: string }) => void
  isMonitoring?: boolean
  onToggleMonitoring?: () => void
  onShowNotifications?: () => void
  onShowSettings?: () => void
  notificationCount?: number
}

export default function DashboardHeader({
  onAddProduct,
  onSearch,
  onFilterChange,
  isMonitoring = false,
  onToggleMonitoring,
  onShowNotifications,
  onShowSettings,
  notificationCount = 0
}: DashboardHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    onSearch?.(query)
  }

  const handlePlatformChange = (platform: string) => {
    setSelectedPlatform(platform)
    onFilterChange?.({ 
      platform: platform === "all" ? undefined : platform,
      status: selectedStatus === "all" ? undefined : selectedStatus
    })
  }

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status)
    onFilterChange?.({ 
      platform: selectedPlatform === "all" ? undefined : selectedPlatform,
      status: status === "all" ? undefined : status
    })
  }

  const handleAddProduct = () => {
    console.log('Add product clicked')
    onAddProduct?.()
  }

  const handleToggleMonitoring = () => {
    console.log('Toggle monitoring clicked')
    onToggleMonitoring?.()
  }

  return (
    <div className="space-y-4">
      {/* Title and Status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Monitor 😎</h1>
          <p className="text-muted-foreground">
            Track Amazon & Walmart product availability and prices
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Activity className={`w-5 h-5 ${isMonitoring ? 'text-green-500 animate-pulse' : 'text-gray-400'}`} />
            <Badge variant={isMonitoring ? "default" : "secondary"} className="h-8 flex items-center">
              {isMonitoring ? "Monitoring Active" : "Monitoring Stopped"}
            </Badge>
          </div>
          <Button 
            variant={isMonitoring ? "destructive" : "default"}
            size="sm"
            onClick={handleToggleMonitoring}
            data-testid="button-toggle-monitoring"
            className="text-xs h-8"
          >
            {isMonitoring ? "Stop" : "Start"} Monitoring
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-row gap-4 items-center justify-between">
        <div className="flex flex-1 items-center gap-4 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedPlatform} onValueChange={handlePlatformChange}>
              <SelectTrigger className="w-32" data-testid="filter-platform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="amazon">Amazon</SelectItem>
                <SelectItem value="walmart">Walmart</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={selectedStatus} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-32" data-testid="filter-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="in-stock">In Stock</SelectItem>
                <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                <SelectItem value="low-stock">Low Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onShowNotifications}
            className="relative"
            data-testid="button-notifications"
          >
            <Bell className="w-4 h-4" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onShowSettings}
            data-testid="button-settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
          
          <Button onClick={handleAddProduct} data-testid="button-add-product">
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
          
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}