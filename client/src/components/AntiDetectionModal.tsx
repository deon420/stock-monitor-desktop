import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, X, AlertTriangle, Shield, Clock, Activity, CheckCircle, XCircle, Settings, Zap, Play, ChevronRight, Lightbulb, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { AntiBotDetectionResult } from "@/contexts/AntiDetectionContext"
import { useSolutionSuggestions } from "@/contexts/SolutionSuggestionsContext"
import { SolutionSuggestion, GroupedSuggestions } from "@shared/solution-types"
import { useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"

interface AntiDetectionModalProps {
  isOpen: boolean
  detection: AntiBotDetectionResult | null
  onClose: () => void
}

interface SolutionButtonProps {
  suggestion: SolutionSuggestion
  onApply: (solutionId: string) => Promise<void>
  isApplying: boolean
}

const SolutionButton = ({ suggestion, onApply, isApplying }: SolutionButtonProps) => {
  const { toast } = useToast()
  const { solution, relevanceScore, urgency, isEnabled, canApplyNow, reasonIfDisabled, estimatedImpact } = suggestion
  
  const handleApply = async () => {
    if (!canApplyNow) {
      toast({
        title: "Cannot Apply Solution",
        description: reasonIfDisabled || "Solution cannot be applied at this time",
        variant: "destructive"
      })
      return
    }
    
    try {
      await onApply(solution.id)
    } catch (error) {
      console.error('Failed to apply solution:', error)
    }
  }
  
  const urgencyColor = {
    immediate: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
    high: "bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30",
    medium: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
    low: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30"
  }[urgency]
  
  const priorityIcon = {
    critical: AlertTriangle,
    high: Zap,
    medium: Settings,
    low: Activity
  }[solution.priority]
  
  const PriorityIcon = priorityIcon
  
  return (
    <Card className={cn(
      "transition-all duration-200 hover-elevate",
      !isEnabled && "opacity-60",
      !canApplyNow && "cursor-not-allowed"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <PriorityIcon className="w-4 h-4 text-primary" />
              <h4 className="font-medium text-sm text-foreground">{solution.name}</h4>
              <Badge variant="outline" className={cn("text-xs", urgencyColor)}>
                {urgency}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{solution.description}</p>
            <p className="text-xs text-muted-foreground italic">{estimatedImpact}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="secondary" className="text-xs">
              {relevanceScore}% match
            </Badge>
            {solution.riskLevel !== 'low' && (
              <Badge variant="outline" className={cn(
                "text-xs",
                solution.riskLevel === 'high' ? "border-red-500/30 text-red-600" : "border-orange-500/30 text-orange-600"
              )}>
                {solution.riskLevel} risk
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!isEnabled ? (
              <XCircle className="w-4 h-4 text-muted-foreground" />
            ) : canApplyNow ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <Clock className="w-4 h-4 text-orange-600" />
            )}
            <span className="text-xs text-muted-foreground">
              {!isEnabled ? "Disabled" : canApplyNow ? "Ready" : "Requires action"}
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={!canApplyNow || isApplying || !isEnabled}
            data-testid={`button-apply-solution-${solution.id}`}
            className="text-xs"
          >
            {isApplying ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                Applying...
              </>
            ) : (
              <>
                <Play className="w-3 h-3 mr-1" />
                Apply
              </>
            )}
          </Button>
        </div>
        {reasonIfDisabled && (
          <p className="text-xs text-muted-foreground mt-2 italic">
            {reasonIfDisabled}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

interface SolutionSectionProps {
  title: string
  description: string
  suggestions: SolutionSuggestion[]
  onApplySolution: (solutionId: string) => Promise<void>
  applyingSolutions: Set<string>
  icon: React.ComponentType<any>
}

const SolutionSection = ({ title, description, suggestions, onApplySolution, applyingSolutions, icon: Icon }: SolutionSectionProps) => {
  if (suggestions.length === 0) return null
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="font-medium text-sm">{title}</h3>
        <Badge variant="secondary" className="text-xs">{suggestions.length}</Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>
      <div className="space-y-2">
        {suggestions.map((suggestion) => (
          <SolutionButton
            key={suggestion.solution.id}
            suggestion={suggestion}
            onApply={onApplySolution}
            isApplying={applyingSolutions.has(suggestion.solution.id)}
          />
        ))}
      </div>
    </div>
  )
}

export default function AntiDetectionModal({ isOpen, detection, onClose }: AntiDetectionModalProps) {
  const [activeTab, setActiveTab] = useState("detection")
  const { 
    generateSuggestions, 
    applySolution, 
    suggestions, 
    isGeneratingSuggestions, 
    suggestionsError,
    applyingSolutions 
  } = useSolutionSuggestions()
  const { toast } = useToast()

  // Generate suggestions when detection changes
  useEffect(() => {
    if (detection && isOpen) {
      generateSuggestions(detection)
      setActiveTab("detection") // Reset to detection tab when new detection occurs
    }
  }, [detection, isOpen, generateSuggestions])

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

  // Handle solution application
  const handleApplySolution = async (solutionId: string) => {
    try {
      const result = await applySolution(solutionId)
      
      if (result.success) {
        toast({
          title: "Solution Applied Successfully",
          description: result.message,
        })
      } else {
        toast({
          title: "Solution Application Failed",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Failed to apply solution:', error)
      toast({
        title: "Application Error",
        description: "An unexpected error occurred while applying the solution",
        variant: "destructive",
      })
    }
  }

  // Count available suggestions
  const suggestionCounts = suggestions ? {
    immediate: suggestions.immediate.length,
    recommended: suggestions.recommended.length,
    optional: suggestions.optional.length,
    advanced: suggestions.advanced.length,
    total: suggestions.immediate.length + suggestions.recommended.length + suggestions.optional.length + suggestions.advanced.length
  } : { immediate: 0, recommended: 0, optional: 0, advanced: 0, total: 0 }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      // Only allow closing via the X button, not by clicking outside
      if (!open) return
    }}>
      <DialogContent 
        className="max-w-2xl mx-auto p-0 overflow-hidden max-h-[90vh]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Anti-Bot Detection Alert</DialogTitle>
          <DialogDescription>
            Bot protection has been detected while scraping this platform. View detection details and apply solution suggestions.
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
          
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="detection" className="text-xs">
                  Detection Details
                </TabsTrigger>
                <TabsTrigger value="solutions" className="text-xs relative">
                  Solution Suggestions
                  {suggestionCounts.total > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {suggestionCounts.total}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="detection" className="p-4 space-y-4 mt-0">
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

                {/* Quick Action to View Solutions */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-sm mb-1 text-blue-700 dark:text-blue-400">
                        Automated Solutions Available
                      </h3>
                      <p className="text-xs text-blue-600 dark:text-blue-300">
                        {suggestionCounts.total} solutions ready to help resolve this detection
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setActiveTab("solutions")}
                      data-testid="button-view-solutions"
                    >
                      <Lightbulb className="w-3 h-3 mr-1" />
                      View Solutions
                    </Button>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="solutions" className="p-4 mt-0">
                <ScrollArea className="h-96">
                  {isGeneratingSuggestions ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center space-y-2">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                        <p className="text-sm text-muted-foreground">Analyzing detection and generating solutions...</p>
                      </div>
                    </div>
                  ) : suggestionsError ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center space-y-2">
                        <XCircle className="h-6 w-6 mx-auto text-destructive" />
                        <p className="text-sm text-destructive">Failed to generate solutions</p>
                        <p className="text-xs text-muted-foreground">{suggestionsError}</p>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => generateSuggestions(detection)}
                          data-testid="button-retry-suggestions"
                        >
                          Retry
                        </Button>
                      </div>
                    </div>
                  ) : suggestions ? (
                    <div className="space-y-6">
                      <SolutionSection
                        title="Immediate Actions"
                        description="Critical solutions that should be applied immediately"
                        suggestions={suggestions.immediate}
                        onApplySolution={handleApplySolution}
                        applyingSolutions={applyingSolutions}
                        icon={AlertTriangle}
                      />
                      
                      {suggestions.immediate.length > 0 && suggestions.recommended.length > 0 && (
                        <Separator />
                      )}
                      
                      <SolutionSection
                        title="Recommended Solutions"
                        description="Highly effective solutions for this detection type"
                        suggestions={suggestions.recommended}
                        onApplySolution={handleApplySolution}
                        applyingSolutions={applyingSolutions}
                        icon={Sparkles}
                      />
                      
                      {(suggestions.immediate.length > 0 || suggestions.recommended.length > 0) && suggestions.optional.length > 0 && (
                        <Separator />
                      )}
                      
                      <SolutionSection
                        title="Additional Options"
                        description="Optional solutions that may provide further protection"
                        suggestions={suggestions.optional}
                        onApplySolution={handleApplySolution}
                        applyingSolutions={applyingSolutions}
                        icon={Settings}
                      />
                      
                      {suggestions.advanced.length > 0 && (
                        <>
                          <Separator />
                          <SolutionSection
                            title="Advanced Solutions"
                            description="Complex solutions for persistent detection issues"
                            suggestions={suggestions.advanced}
                            onApplySolution={handleApplySolution}
                            applyingSolutions={applyingSolutions}
                            icon={Zap}
                          />
                        </>
                      )}
                      
                      {suggestionCounts.total === 0 && (
                        <div className="text-center py-8">
                          <Lightbulb className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">No solutions available for this detection type</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">Click "View Solutions" to generate suggestions</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  )
}