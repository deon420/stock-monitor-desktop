import { ArrowUp, ArrowDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface PriceDisplayProps {
  currentPrice?: number
  previousPrice?: number
  currency?: string
  size?: "sm" | "default" | "lg"
}

export default function PriceDisplay({ 
  currentPrice, 
  previousPrice, 
  currency = "$",
  size = "default" 
}: PriceDisplayProps) {
  if (!currentPrice) {
    return (
      <div className={cn("text-muted-foreground font-mono", {
        "text-sm": size === "sm",
        "text-base": size === "default", 
        "text-lg": size === "lg"
      })}>
        Price unavailable
      </div>
    )
  }

  const priceChange = previousPrice ? currentPrice - previousPrice : 0
  const percentChange = previousPrice ? ((priceChange / previousPrice) * 100) : 0
  
  const priceChangeIcon = priceChange > 0 ? ArrowUp : priceChange < 0 ? ArrowDown : Minus
  const Icon = priceChangeIcon
  
  return (
    <div className="flex items-center gap-2">
      <span className={cn("font-mono font-semibold", {
        "text-sm": size === "sm",
        "text-base": size === "default",
        "text-lg": size === "lg"
      })}>
        {currency}{currentPrice.toFixed(2)}
      </span>
      {previousPrice && priceChange !== 0 && (
        <div className={cn("flex items-center gap-1 text-xs", {
          "text-stock-price-drop": priceChange < 0,
          "text-stock-price-rise": priceChange > 0
        })}>
          <Icon className="w-3 h-3" />
          <span className="font-medium">
            {Math.abs(percentChange).toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  )
}