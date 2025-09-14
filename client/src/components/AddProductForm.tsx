import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Plus, Link as LinkIcon, Hash } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

interface AddProductFormProps {
  onAddProduct?: (product: {
    name: string
    url: string
    platform: "amazon" | "walmart"
    asin?: string
  }) => void
  isLoading?: boolean
}

export default function AddProductForm({ onAddProduct, isLoading }: AddProductFormProps) {
  const [url, setUrl] = useState("")
  const [asin, setAsin] = useState("")
  const [productName, setProductName] = useState("")
  const [detectedPlatform, setDetectedPlatform] = useState<"amazon" | "walmart" | null>(null)
  const isMobile = useIsMobile()

  const detectPlatform = (inputUrl: string): "amazon" | "walmart" | null => {
    if (inputUrl.includes('amazon.com')) return "amazon"
    if (inputUrl.includes('walmart.com')) return "walmart"
    return null
  }

  const extractASINFromUrl = (url: string): string => {
    // Extract ASIN from Amazon URL patterns
    const asinMatch = url.match(/\/([A-Z0-9]{10})(?:[/?]|$)/) || url.match(/\/dp\/([A-Z0-9]{10})/) || url.match(/\/product\/([A-Z0-9]{10})/)
    return asinMatch ? asinMatch[1] : ""
  }



  const handleUrlChange = (value: string) => {
    setUrl(value)
    const platform = detectPlatform(value)
    setDetectedPlatform(platform)
    
    if (platform === "amazon") {
      const extractedASIN = extractASINFromUrl(value)
      setAsin(extractedASIN)
    } else {
      setAsin("")
    }
  }

  const handleAsinChange = (value: string) => {
    const cleanAsin = value.toUpperCase().trim()
    setAsin(cleanAsin)
    
    // If ASIN is provided, generate Amazon URL and set platform
    if (cleanAsin.length === 10) {
      const amazonUrl = `https://www.amazon.com/dp/${cleanAsin}`
      setUrl(amazonUrl)
      setDetectedPlatform("amazon")
    } else {
      // Clear URL and platform if ASIN is incomplete
      if (url.includes('amazon.com/dp/')) {
        setUrl("")
        setDetectedPlatform(null)
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!productName.trim() || !url.trim() || !detectedPlatform) return

    console.log('Adding product:', { 
      name: productName.trim(), 
      url: url.trim(), 
      platform: detectedPlatform,
      asin: asin.trim() || undefined 
    })
    
    onAddProduct?.({
      name: productName.trim(),
      url: url.trim(),
      platform: detectedPlatform,
      asin: asin.trim() || undefined
    })

    // Reset form
    setUrl("")
    setAsin("")
    setProductName("")
    setDetectedPlatform(null)
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

  const isValid = productName.trim() && url.trim() && detectedPlatform

  return (
    <Card data-testid="add-product-form">
      <CardHeader className={cn(isMobile ? "p-4 pb-3" : "")}>
        <CardTitle className={cn(
          "flex items-center gap-2",
          isMobile ? "text-base" : "text-lg"
        )}>
          <Plus className="w-5 h-5" />
          Add Product to Monitor
        </CardTitle>
        <p className={cn(
          "text-muted-foreground",
          isMobile ? "text-xs" : "text-sm"
        )}>
          Add products by entering the product name and URL (Amazon/Walmart) or ASIN (Amazon)
        </p>
      </CardHeader>
      <CardContent className={cn(isMobile ? "p-4 pt-0" : "")}>
        <form onSubmit={handleSubmit} className={cn(isMobile ? "space-y-4" : "space-y-6")}>
          {/* Product Name Input */}
          <div className="space-y-2">
            <Label htmlFor="product-name" className="font-medium">Product Name</Label>
            <Input
              id="product-name"
              placeholder={isMobile ? "Product name..." : "Enter the product name you want to monitor"}
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              data-testid="input-product-name"
              className={cn(isMobile ? "h-11" : "")}
              required
            />
            <p className="text-xs text-muted-foreground">
              Give your product a name for easy identification
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border"></div>
            <span className="text-xs text-muted-foreground">PRODUCT IDENTIFICATION</span>
            <div className="flex-1 h-px bg-border"></div>
          </div>
          {/* ASIN Input Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4" />
              <Label htmlFor="asin-input" className="font-medium">Amazon ASIN Lookup</Label>
            </div>
            <div className="space-y-2">
              <Input
                id="asin-input"
                placeholder={isMobile ? "ASIN (e.g., B07ABC123XYZ)" : "Enter 10-character ASIN (e.g., B07ABC123XYZ)"}
                value={asin}
                onChange={(e) => handleAsinChange(e.target.value)}
                data-testid="input-asin"
                className={cn(isMobile ? "h-11" : "")}
                maxLength={10}
              />
              <p className="text-xs text-muted-foreground">
                Auto-fills Amazon URL from ASIN
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border"></div>
            <span className="text-xs text-muted-foreground">OR</span>
            <div className="flex-1 h-px bg-border"></div>
          </div>

          {/* URL Input Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4" />
              <Label htmlFor="url-input" className="font-medium">Product URL</Label>
            </div>
            <div className="space-y-2">
              <Input
                id="url-input"
                placeholder={isMobile ? "Product URL (Amazon/Walmart)" : "Paste Amazon or Walmart product URL here"}
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                data-testid="input-product-url"
                className={cn(isMobile ? "h-11" : "")}
              />
              <p className="text-xs text-muted-foreground">
                Supports Amazon and Walmart product URLs
              </p>
            </div>
            
            {detectedPlatform && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Platform detected:</span>
                <Badge variant="secondary" className={cn("text-xs", platformConfig[detectedPlatform].color)}>
                  {platformConfig[detectedPlatform].label}
                </Badge>
                {detectedPlatform === "amazon" && asin && (
                  <span className="text-xs text-muted-foreground">ASIN: {asin}</span>
                )}
              </div>
            )}
            
            {url && !detectedPlatform && (
              <p className="text-sm text-destructive">
                Please enter a valid Amazon or Walmart product URL
              </p>
            )}
          </div>


          <Button 
            type="submit" 
            className={cn(
              "w-full",
              isMobile ? "h-12 text-base" : ""
            )}
            disabled={!isValid || isLoading}
            data-testid="button-add-product"
          >
            {isLoading ? "Adding Product..." : "Add Product"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}