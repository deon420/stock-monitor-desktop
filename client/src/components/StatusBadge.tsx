import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: "in-stock" | "out-of-stock" | "low-stock" | "unknown"
}

const statusConfig = {
  "in-stock": {
    label: "In Stock",
    className: "bg-stock-in-stock/20 text-stock-in-stock border-stock-in-stock/30"
  },
  "out-of-stock": {
    label: "Out of Stock", 
    className: "bg-stock-out-of-stock/20 text-stock-out-of-stock border-stock-out-of-stock/30"
  },
  "low-stock": {
    label: "Low Stock",
    className: "bg-stock-low-stock/20 text-stock-low-stock border-stock-low-stock/30"
  },
  "unknown": {
    label: "Checking...",
    className: "bg-muted text-muted-foreground border-border"
  }
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status]
  
  return (
    <Badge 
      variant="outline" 
      className={cn(config.className, "font-medium")}
      data-testid={`status-${status}`}
    >
      {config.label}
    </Badge>
  )
}