import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { X, AlertTriangle, Shield, Clock, Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import { AntiBotDetectionResult } from "@/contexts/AntiDetectionContext"

interface AntiDetectionModalProps {
  isOpen: boolean
  detection: AntiBotDetectionResult | null
  onClose: () => void
}

export default function AntiDetectionModal({ isOpen, detection, onClose }: AntiDetectionModalProps) {
  if (!detection) return null

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

  const config = platformConfig[detection.platform]

  // Detection type styling and human-readable labels
  const detectionTypeConfig = {
    cloudflare: { 
      label: "Cloudflare Protection", 
      icon: Shield,
      color: "bg-red-500/20 text-red-700 dark:text-red-400"
    },
    aws_waf: { 
      label: "AWS WAF", 
      icon: Shield,
      color: "bg-red-500/20 text-red-700 dark:text-red-400"
    },
    rate_limit: { 
      label: "Rate Limiting", 
      icon: Clock,
      color: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
    },
    ip_block: { 
      label: "IP Blocked", 
      icon: AlertTriangle,
      color: "bg-red-500/20 text-red-700 dark:text-red-400"
    },
    captcha: { 
      label: "CAPTCHA Challenge", 
      icon: AlertTriangle,
      color: "bg-orange-500/20 text-orange-700 dark:text-orange-400"
    },
    js_challenge: { 
      label: "JavaScript Challenge", 
      icon: Activity,
      color: "bg-orange-500/20 text-orange-700 dark:text-orange-400"
    },
    redirect_loop: { 
      label: "Redirect Loop", 
      icon: Activity,
      color: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
    },
    platform_specific: { 
      label: "Platform Protection", 
      icon: Shield,
      color: "bg-red-500/20 text-red-700 dark:text-red-400"
    },
    none: { 
      label: "No Detection", 
      icon: Activity,
      color: "bg-gray-500/20 text-gray-700 dark:text-gray-400"
    }
  }

  const typeConfig = detectionTypeConfig[detection.detectionType]
  const TypeIcon = typeConfig.icon

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  // Generate solution suggestions based on detection type
  const getSolutionSuggestions = (type: AntiBotDetectionResult['detectionType']) => {
    const suggestions: { [key: string]: string[] } = {
      cloudflare: [
        "Wait 5-10 minutes before retrying",
        "Clear browser cookies and cache",
        "Try using a different network connection",
        "Consider using a VPN from a different location"
      ],
      aws_waf: [
        "Reduce request frequency",
        "Wait before retrying",
        "Check if IP is temporarily blocked",
        "Contact support if issue persists"
      ],
      rate_limit: [
        "Slow down request frequency",
        "Wait for rate limit to reset",
        "Implement exponential backoff",
        "Monitor request patterns"
      ],
      ip_block: [
        "Use a different network connection",
        "Try a VPN service",
        "Contact your ISP",
        "Wait 24-48 hours before retrying"
      ],
      captcha: [
        "Complete the CAPTCHA challenge",
        "Clear browser data",
        "Try from a different browser",
        "Wait before making new requests"
      ],
      js_challenge: [
        "Enable JavaScript in browser",
        "Clear browser cache",
        "Wait before retrying",
        "Update browser to latest version"
      ],
      redirect_loop: [
        "Clear cookies and cache",
        "Disable browser extensions",
        "Try incognito/private mode",
        "Check network connectivity"
      ],
      platform_specific: [
        "Review platform terms of service",
        "Reduce request frequency",
        "Use official APIs when available",
        "Consider alternative approaches"
      ],
      none: ["No action needed - false positive detection"]
    }
    
    return suggestions[type] || ["Try again later", "Contact support if issue persists"]
  }

  const solutions = getSolutionSuggestions(detection.detectionType)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      // Only allow closing via the X button, not by clicking outside
      if (!open) return
    }}>
      <DialogContent 
        className="max-w-lg mx-auto p-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Anti-Bot Detection Alert</DialogTitle>
          <DialogDescription>
            Bot protection has been detected while scraping this platform
          </DialogDescription>
        </DialogHeader>
        
        <Card className="border-2 border-red-500">
          <CardHeader className="text-center pb-4 relative">
            {/* X Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8"
              onClick={onClose}
              data-testid="button-close-modal"
            >
              <X className="h-4 w-4" />
            </Button>

            <div className="flex items-center justify-center gap-2">
              <TypeIcon className="w-5 h-5 text-red-500" />
              <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30">
                Bot Detection Alert
              </Badge>
            </div>
            
            <div className="mt-4">
              <h2 className="text-lg font-semibold mb-2">
                {typeConfig.label} Detected
              </h2>
              <div className="flex gap-2 justify-center items-center">
                <Badge variant="secondary" className={cn("text-sm", config.color)}>
                  {config.label}
                </Badge>
                <Badge className={cn("text-sm", typeConfig.color)}>
                  {Math.round(detection.confidence * 100)}% Confidence
                </Badge>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Detection Details */}
            <div className="bg-muted/30 rounded-md p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Response Code:</span>
                <span className="font-mono">{detection.responseCode}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Response Time:</span>
                <span className="font-mono">{detection.responseTime}ms</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Detected At:</span>
                <span className="font-mono text-xs">{formatTimestamp(detection.timestamp)}</span>
              </div>
            </div>

            {/* Suggested Action */}
            {detection.suggestedAction && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-md p-3">
                <h3 className="font-medium text-sm mb-2 text-orange-700 dark:text-orange-400">
                  Immediate Action:
                </h3>
                <p className="text-sm text-orange-600 dark:text-orange-300">
                  {detection.suggestedAction}
                </p>
              </div>
            )}

            {/* Solution Suggestions */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm mb-2">Suggested Solutions:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                {solutions.map((solution, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>{solution}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  )
}