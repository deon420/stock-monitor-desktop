import { useState, useEffect } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Settings as SettingsIcon, Volume2, Mail, Shield, HelpCircle, Play, Send, Loader2, Download, Minus, AlertTriangle, Info, FolderOpen, Cog, Clock, Bot, Zap, RotateCcw, Timer, Globe, Shuffle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { audioPlayer } from "@/utils/audioPlayer"
import { isDesktopApp } from "@/lib/desktopDataProvider"
import { Settings as SettingsData, UpdateSettings } from "@shared/schema"
import { useSolutionSuggestions } from "@/contexts/SolutionSuggestionsContext"

interface SettingsProps {
  isOpen: boolean
  onClose: () => void
  onDemoStock?: () => void
  onDemoPrice?: () => void
  onDemoAntiBot?: () => void
}

// Available sound options (only soft chime and notification)
const SOUND_OPTIONS = [
  { value: "chime", label: "Soft Chime" },
  { value: "notification", label: "Notification" }
]

export default function Settings({ isOpen, onClose, onDemoStock, onDemoPrice, onDemoAntiBot }: SettingsProps) {
  const [showEmailHelp, setShowEmailHelp] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [emailTestResult, setEmailTestResult] = useState<string | null>(null)
  const [downloadingLogs, setDownloadingLogs] = useState(false)
  const [secretClickCount, setSecretClickCount] = useState(0)
  const [advancedUnlocked, setAdvancedUnlocked] = useState(false)
  const [showUnlockDialog, setShowUnlockDialog] = useState(false)
  const [simulatingStock, setSimulatingStock] = useState(false)
  const [simulatingPrice, setSimulatingPrice] = useState(false)
  const [simulatingAntiBot, setSimulatingAntiBot] = useState(false)
  const [openingFolder, setOpeningFolder] = useState(false)
  const { toast } = useToast()

  // Fetch settings using React Query
  const { data: settings, isLoading } = useQuery<SettingsData>({
    queryKey: ['/api/settings'],
    enabled: isOpen, // Only fetch when modal is open
  })

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (newSettings: UpdateSettings) => apiRequest('POST', '/api/settings', newSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] })
      toast({
        title: "Settings saved",
        description: "Your settings have been updated successfully.",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error saving settings",
        description: error?.message || "Failed to save settings",
        variant: "destructive",
      })
    }
  })

  // Enhanced setting change handler that also notifies desktop tray
  const handleSettingChange = async (key: string, value: any) => {
    if (!settings) return
    
    const updatedSettings = { ...settings, [key]: value }
    
    // Handle desktop tray setting changes
    if (key === 'enableTaskTray' && isDesktopApp()) {
      try {
        // Use the desktop tray API to toggle tray functionality
        const electronAPI = (window as any).electronAPI;
        if (electronAPI?.trayHelper?.toggleSafe) {
          await electronAPI.trayHelper.toggleSafe(value);
          console.log(`[Desktop Settings] Tray ${value ? 'enabled' : 'disabled'} successfully`);
        } else if (electronAPI?.tray?.toggle) {
          // Fallback to direct API call
          const result = await electronAPI.tray.toggle(value);
          console.log(`[Desktop Settings] Tray toggle result:`, result);
        }
      } catch (error) {
        console.warn('[Desktop Settings] Failed to toggle tray:', error);
        // Don't block the settings update if tray toggle fails
        toast({
          title: "Tray Setting Warning", 
          description: "Settings saved but tray functionality may need app restart.",
          variant: "default",
        });
      }
    }
    
    // Always update the backend settings
    updateSettingsMutation.mutate(updatedSettings)
  }

  // Monitor tray setting changes to ensure desktop app stays in sync
  useEffect(() => {
    if (isDesktopApp() && settings?.enableTaskTray !== undefined) {
      const syncTrayState = async () => {
        try {
          const electronAPI = (window as any).electronAPI;
          if (electronAPI?.tray?.refreshSettings) {
            await electronAPI.tray.refreshSettings();
            console.log('[Desktop Settings] Tray settings refreshed');
          }
        } catch (error) {
          console.warn('[Desktop Settings] Failed to refresh tray settings:', error);
        }
      };
      
      // Sync tray state whenever enableTaskTray setting changes
      syncTrayState();
    }
  }, [settings?.enableTaskTray]);

  const playTestSound = async (soundType: string) => {
    if (!settings?.enableAudio) return
    
    // Use the new audio player with current volume settings
    audioPlayer.setVolume(settings.audioVolume)
    await audioPlayer.playSound(soundType)
  }

  const testEmailSettings = async () => {
    if (!settings?.gmailEmail || (!settings?.gmailAppPassword || settings?.gmailAppPassword === "****hidden****")) {
      setEmailTestResult("Please fill in both email and app password")
      return
    }

    setTestingEmail(true)
    setEmailTestResult(null)
    
    try {
      // No need to send credentials - the API will use stored encrypted settings
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Empty body - API uses stored settings
      })
      
      const result = await response.json()
      
      if (response.ok) {
        setEmailTestResult("Test email sent successfully!")
        toast({
          title: "Email test successful",
          description: "Check your inbox for the test email.",
        })
      } else {
        setEmailTestResult(`Error: ${result.error}`)
        toast({
          title: "Email test failed",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      setEmailTestResult("Failed to test email settings")
      toast({
        title: "Email test failed",
        description: "Network error while testing email.",
        variant: "destructive",
      })
    } finally {
      setTestingEmail(false)
    }
  }

  const downloadLogs = async () => {
    setDownloadingLogs(true)
    
    try {
      const response = await fetch('/api/download-logs', {
        method: 'GET'
      })
      
      if (response.ok) {
        // Create blob from response
        const blob = await response.blob()
        
        // Create download link
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'stock-monitor-logs.txt'
        document.body.appendChild(link)
        link.click()
        
        // Cleanup
        window.URL.revokeObjectURL(url)
        document.body.removeChild(link)
        
        toast({
          title: "Logs downloaded",
          description: "Error logs have been saved to your Downloads folder.",
        })
      } else {
        throw new Error('Failed to download logs')
      }
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download error logs. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDownloadingLogs(false)
    }
  }

  const handleSecretClick = () => {
    const newCount = secretClickCount + 1
    setSecretClickCount(newCount)
    
    if (newCount === 3) {
      setShowUnlockDialog(true)
      setSecretClickCount(0) // Reset counter
    }
  }

  const handleUnlockAdvanced = () => {
    setAdvancedUnlocked(true)
    setShowUnlockDialog(false)
    toast({
      title: "Advanced Settings Unlocked",
      description: "You now have access to all advanced monitoring settings. Use with caution!",
    })
  }

  const simulateStockAlert = async () => {
    if (simulatingStock) return
    setSimulatingStock(true)
    
    try {
      const response = await fetch('/api/simulate-stock-alert', { method: 'POST' })
      if (response.ok) {
        toast({
          title: "Stock alert simulated",
          description: "Check your notifications and email!",
        })
      }
    } catch (error) {
      toast({
        title: "Simulation failed",
        description: "Could not simulate stock alert.",
        variant: "destructive",
      })
    } finally {
      setTimeout(() => setSimulatingStock(false), 2000)
    }
  }

  const simulatePriceDropAlert = async () => {
    if (simulatingPrice) return
    setSimulatingPrice(true)
    
    try {
      const response = await fetch('/api/simulate-price-drop', { method: 'POST' })
      if (response.ok) {
        toast({
          title: "Price drop alert simulated",  
          description: "Check your notifications and email!",
        })
      }
    } catch (error) {
      toast({
        title: "Simulation failed",
        description: "Could not simulate price drop alert.",
        variant: "destructive",
      })
    } finally {
      setTimeout(() => setSimulatingPrice(false), 2000)
    }
  }

  const openSoundsFolder = async () => {
    if (openingFolder) return
    setOpeningFolder(true)
    
    try {
      const response = await fetch('/api/open-sounds-folder', { method: 'POST' })
      if (response.ok) {
        toast({
          title: "Sounds folder opened",
          description: "The sounds folder has been opened in your file explorer.",
        })
      } else {
        throw new Error('Failed to open sounds folder')
      }
    } catch (error) {
      toast({
        title: "Could not open folder",
        description: "Failed to open the sounds folder. Please navigate to it manually.",
        variant: "destructive",
      })
    } finally {
      setTimeout(() => setOpeningFolder(false), 1000)
    }
  }

  const handleSimulateStock = () => {
    if (simulatingStock || !onDemoStock) return
    setSimulatingStock(true)
    
    // Call the actual working demo function from Dashboard
    onDemoStock()
    
    // Reset button state
    setTimeout(() => setSimulatingStock(false), 1000)
  }

  const handleSimulatePrice = () => {
    if (simulatingPrice || !onDemoPrice) return
    setSimulatingPrice(true)
    
    // Call the actual working demo function from Dashboard  
    onDemoPrice()
    
    // Reset button state
    setTimeout(() => setSimulatingPrice(false), 1000)
  }
  
  const handleSimulateAntiBot = () => {
    if (simulatingAntiBot || !onDemoAntiBot) return
    setSimulatingAntiBot(true)
    
    // Call the actual working demo function from Dashboard
    onDemoAntiBot()
    
    // Reset button state
    setTimeout(() => setSimulatingAntiBot(false), 1000)
  }

  const EmailHelp = () => (
    <Dialog open={showEmailHelp} onOpenChange={setShowEmailHelp}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            How to Get Your Gmail App Password
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <Alert>
            <HelpCircle className="w-4 h-4" />
            <AlertDescription>
              Google App Passwords are special 16-character passwords that allow apps to access your Gmail account securely.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2 text-sm">Step 1: Enable 2-Factor Authentication</h3>
              <div className="pl-4 space-y-2 text-sm text-muted-foreground">
                <p>• Go to <span className="font-mono bg-muted px-1 rounded">myaccount.google.com</span></p>
                <p>• Click on "Security" in the left sidebar</p>
                <p>• Under "Signing in to Google", click "2-Step Verification"</p>
                <p>• Follow the steps to enable 2FA (required for app passwords)</p>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2 text-sm">Step 2: Generate App Password</h3>
              <div className="pl-4 space-y-2 text-sm text-muted-foreground">
                <p>• Still in Google Account settings, go back to "Security"</p>
                <p>• Under "Signing in to Google", click "App passwords"</p>
                <p>• You may need to sign in again</p>
                <p>• Click "Select app" and choose "Other (custom name)"</p>
                <p>• Type "Stock Monitor" as the app name</p>
                <p>• Click "Generate"</p>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2 text-sm">Step 3: Copy the Password</h3>
              <div className="pl-4 space-y-2 text-sm text-muted-foreground">
                <p>• Google will show a 16-character password like "abcd efgh ijkl mnop"</p>
                <p>• Copy this password exactly (spaces don't matter)</p>
                <p>• Paste it into the "Gmail App Password" field below</p>
                <p>• Keep this password safe - Google won't show it again!</p>
              </div>
            </div>

            <Alert>
              <Shield className="w-4 h-4" />
              <AlertDescription>
                <strong>Security Note:</strong> App passwords are safer than using your regular Gmail password. 
                You can revoke them anytime from your Google Account settings.
              </AlertDescription>
            </Alert>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setShowEmailHelp(false)} data-testid="button-email-help-close">
              Got It!
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" />
              Settings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!settings) {
    return null
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" />
              Settings
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general" data-testid="tab-general">General</TabsTrigger>
              <TabsTrigger value="advanced" data-testid="tab-advanced">Advanced</TabsTrigger>
            </TabsList>

            {/* General Settings */}
            <TabsContent value="general" className="space-y-6">
              {/* Audio Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Volume2 className="w-5 h-5" />
                    Audio Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Enable Audio Alerts</Label>
                      <p className="text-xs text-muted-foreground">
                        Play sounds when price drops or stock changes are detected
                      </p>
                    </div>
                    <Switch
                      checked={settings.enableAudio}
                      onCheckedChange={(checked) => handleSettingChange('enableAudio', checked)}
                      data-testid="switch-audio"
                    />
                  </div>

                  {settings.enableAudio && (
                    <div className="space-y-4">
                      <Separator />
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Notification Sound</Label>
                        <Select 
                          value={settings.audioNotificationSound} 
                          onValueChange={(value) => handleSettingChange('audioNotificationSound', value)}
                        >
                          <SelectTrigger data-testid="select-audio-sound">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SOUND_OPTIONS.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            You can upload custom audio files by placing them in the /sounds folder
                          </p>
                          <Button
                            onClick={openSoundsFolder}
                            disabled={openingFolder}
                            size="sm"
                            variant="outline"
                            className="flex items-center gap-2 text-xs"
                            data-testid="button-open-sounds-folder"
                          >
                            {openingFolder ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <FolderOpen className="w-3 h-3" />
                            )}
                            {openingFolder ? "Opening..." : "Open Folder"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Anti-Detection Solutions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bot className="w-5 h-5" />
                    Anti-Detection Solutions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-sm text-muted-foreground">
                    Configure automatic anti-bot detection solutions. When bot protection is encountered, 
                    enabled solutions will be suggested and can be applied instantly.
                  </p>

                  {/* User Agent Rotation */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <RotateCcw className="w-4 h-4" />
                          User Agent Rotation
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Automatically rotate browser user agents to avoid detection patterns
                        </p>
                      </div>
                      <Switch
                        checked={settings.solutionPreferences?.enableUserAgentRotation ?? true}
                        onCheckedChange={(checked) => handleSettingChange('solutionPreferences', {
                          ...settings.solutionPreferences,
                          enableUserAgentRotation: checked
                        })}
                        data-testid="switch-user-agent-rotation"
                      />
                    </div>

                    {settings.solutionPreferences?.enableUserAgentRotation !== false && (
                      <div className="pl-6 space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">Rotation Frequency</Label>
                            <Select 
                              value={settings.solutionPreferences?.userAgentRotationFrequency || "per_request"} 
                              onValueChange={(value) => handleSettingChange('solutionPreferences', {
                                ...settings.solutionPreferences,
                                userAgentRotationFrequency: value
                              })}
                            >
                              <SelectTrigger className="text-xs" data-testid="select-ua-frequency">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="per_request">Every Request</SelectItem>
                                <SelectItem value="per_session">Per Session</SelectItem>
                                <SelectItem value="daily">Daily</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Browser Types</Label>
                            <Select 
                              value={settings.solutionPreferences?.userAgentTypes || "desktop_mobile"} 
                              onValueChange={(value) => handleSettingChange('solutionPreferences', {
                                ...settings.solutionPreferences,
                                userAgentTypes: value
                              })}
                            >
                              <SelectTrigger className="text-xs" data-testid="select-ua-types">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="desktop_only">Desktop Only</SelectItem>
                                <SelectItem value="mobile_only">Mobile Only</SelectItem>
                                <SelectItem value="desktop_mobile">Desktop & Mobile</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Request Delays */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Timer className="w-4 h-4" />
                          Smart Request Delays
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Add intelligent delays between requests to avoid rate limiting
                        </p>
                      </div>
                      <Switch
                        checked={settings.solutionPreferences?.enableRequestDelays ?? true}
                        onCheckedChange={(checked) => handleSettingChange('solutionPreferences', {
                          ...settings.solutionPreferences,
                          enableRequestDelays: checked
                        })}
                        data-testid="switch-request-delays"
                      />
                    </div>

                    {settings.solutionPreferences?.enableRequestDelays !== false && (
                      <div className="pl-6 space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">Base Delay (seconds)</Label>
                            <Select 
                              value={settings.solutionPreferences?.baseRequestDelay || "2"} 
                              onValueChange={(value) => handleSettingChange('solutionPreferences', {
                                ...settings.solutionPreferences,
                                baseRequestDelay: parseInt(value)
                              })}
                            >
                              <SelectTrigger className="text-xs" data-testid="select-base-delay">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1 second</SelectItem>
                                <SelectItem value="2">2 seconds</SelectItem>
                                <SelectItem value="3">3 seconds</SelectItem>
                                <SelectItem value="5">5 seconds</SelectItem>
                                <SelectItem value="10">10 seconds</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Randomization</Label>
                            <Select 
                              value={settings.solutionPreferences?.requestDelayRandomization || "medium"} 
                              onValueChange={(value) => handleSettingChange('solutionPreferences', {
                                ...settings.solutionPreferences,
                                requestDelayRandomization: value
                              })}
                            >
                              <SelectTrigger className="text-xs" data-testid="select-delay-randomization">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low (±20%)</SelectItem>
                                <SelectItem value="medium">Medium (±50%)</SelectItem>
                                <SelectItem value="high">High (±100%)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Header Randomization */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Shuffle className="w-4 h-4" />
                          Header Randomization
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Randomize HTTP headers to mimic real browser behavior
                        </p>
                      </div>
                      <Switch
                        checked={settings.solutionPreferences?.enableHeaderRandomization ?? true}
                        onCheckedChange={(checked) => handleSettingChange('solutionPreferences', {
                          ...settings.solutionPreferences,
                          enableHeaderRandomization: checked
                        })}
                        data-testid="switch-header-randomization"
                      />
                    </div>

                    {settings.solutionPreferences?.enableHeaderRandomization !== false && (
                      <div className="pl-6 space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">Accept-Language Pool</Label>
                            <Select 
                              value={settings.solutionPreferences?.acceptLanguagePool || "en_variants"} 
                              onValueChange={(value) => handleSettingChange('solutionPreferences', {
                                ...settings.solutionPreferences,
                                acceptLanguagePool: value
                              })}
                            >
                              <SelectTrigger className="text-xs" data-testid="select-accept-language">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="en_only">English Only</SelectItem>
                                <SelectItem value="en_variants">English Variants</SelectItem>
                                <SelectItem value="global">Global Languages</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Custom Headers</Label>
                            <Switch
                              checked={settings.solutionPreferences?.includeCustomHeaders ?? false}
                              onCheckedChange={(checked) => handleSettingChange('solutionPreferences', {
                                ...settings.solutionPreferences,
                                includeCustomHeaders: checked
                              })}
                              data-testid="switch-custom-headers"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Proxy Configuration */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          Proxy Integration
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Use proxy servers to rotate IP addresses and avoid blocks
                        </p>
                      </div>
                      <Switch
                        checked={settings.solutionPreferences?.enableProxyRotation ?? false}
                        onCheckedChange={(checked) => handleSettingChange('solutionPreferences', {
                          ...settings.solutionPreferences,
                          enableProxyRotation: checked
                        })}
                        data-testid="switch-proxy-rotation"
                      />
                    </div>

                    {settings.solutionPreferences?.enableProxyRotation && (
                      <div className="pl-6 space-y-3">
                        <Alert>
                          <Info className="w-4 h-4" />
                          <AlertDescription className="text-xs">
                            Proxy rotation requires configured proxy servers in Advanced Settings.
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {
                                // Auto-switch to advanced tab and unlock if needed
                                if (!advancedUnlocked) {
                                  setAdvancedUnlocked(true)
                                }
                                const tabTrigger = document.querySelector('[data-testid="tab-advanced"]') as HTMLElement
                                if (tabTrigger) tabTrigger.click()
                              }}
                              className="px-2 py-1 h-auto text-primary underline hover:no-underline ml-1"
                              data-testid="button-proxy-settings"
                            >
                              Configure Proxies
                            </Button>
                          </AlertDescription>
                        </Alert>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">Rotation Strategy</Label>
                            <Select 
                              value={settings.solutionPreferences?.proxyRotationStrategy || "round_robin"} 
                              onValueChange={(value) => handleSettingChange('solutionPreferences', {
                                ...settings.solutionPreferences,
                                proxyRotationStrategy: value
                              })}
                            >
                              <SelectTrigger className="text-xs" data-testid="select-proxy-strategy">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="round_robin">Round Robin</SelectItem>
                                <SelectItem value="random">Random</SelectItem>
                                <SelectItem value="health_based">Health Based</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Failure Handling</Label>
                            <Select 
                              value={settings.solutionPreferences?.proxyFailureHandling || "retry_with_next"} 
                              onValueChange={(value) => handleSettingChange('solutionPreferences', {
                                ...settings.solutionPreferences,
                                proxyFailureHandling: value
                              })}
                            >
                              <SelectTrigger className="text-xs" data-testid="select-proxy-failure">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="retry_with_next">Try Next Proxy</SelectItem>
                                <SelectItem value="fallback_direct">Fallback Direct</SelectItem>
                                <SelectItem value="abort_request">Abort Request</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Solution Effectiveness */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Zap className="w-4 h-4" />
                          Solution Effectiveness Tracking
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Learn from applied solutions to improve future recommendations
                        </p>
                      </div>
                      <Switch
                        checked={settings.solutionPreferences?.enableEffectivenessTracking ?? true}
                        onCheckedChange={(checked) => handleSettingChange('solutionPreferences', {
                          ...settings.solutionPreferences,
                          enableEffectivenessTracking: checked
                        })}
                        data-testid="switch-effectiveness-tracking"
                      />
                    </div>

                    {settings.solutionPreferences?.enableEffectivenessTracking !== false && (
                      <div className="pl-6 space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">Success Threshold</Label>
                            <Select 
                              value={settings.solutionPreferences?.effectivenessSuccessThreshold?.toString() || "80"} 
                              onValueChange={(value) => handleSettingChange('solutionPreferences', {
                                ...settings.solutionPreferences,
                                effectivenessSuccessThreshold: parseInt(value)
                              })}
                            >
                              <SelectTrigger className="text-xs" data-testid="select-success-threshold">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="60">60% Success Rate</SelectItem>
                                <SelectItem value="70">70% Success Rate</SelectItem>
                                <SelectItem value="80">80% Success Rate</SelectItem>
                                <SelectItem value="90">90% Success Rate</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Auto-Apply Proven Solutions</Label>
                            <Switch
                              checked={settings.solutionPreferences?.autoApplyProvenSolutions ?? false}
                              onCheckedChange={(checked) => handleSettingChange('solutionPreferences', {
                                ...settings.solutionPreferences,
                                autoApplyProvenSolutions: checked
                              })}
                              data-testid="switch-auto-apply-proven"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <Alert>
                    <Shield className="w-4 h-4" />
                    <AlertDescription className="text-xs">
                      <strong>Note:</strong> These solutions are applied automatically when bot detection occurs. 
                      More aggressive settings may be more effective but could impact scraping speed.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              {/* Demo Testing Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Play className="w-5 h-5" />
                    Demo Testing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Test your notification settings with simulated alerts. These demos will trigger audio 
                    and visual notifications just like real stock changes and price drops.
                  </p>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <Button
                      onClick={handleSimulateStock}
                      disabled={simulatingStock}
                      variant="outline"
                      className="flex items-center justify-center gap-2 h-12"
                      data-testid="button-simulate-stock"
                    >
                      {simulatingStock ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                      {simulatingStock ? "Simulating..." : "Stock Alert"}
                    </Button>
                    
                    <Button
                      onClick={handleSimulatePrice}
                      disabled={simulatingPrice}
                      variant="outline"
                      className="flex items-center justify-center gap-2 h-12"
                      data-testid="button-simulate-price-drop"
                    >
                      {simulatingPrice ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Info className="w-4 h-4" />
                      )}
                      {simulatingPrice ? "Simulating..." : "Price Drop"}
                    </Button>
                    
                    <Button
                      onClick={handleSimulateAntiBot}
                      disabled={simulatingAntiBot}
                      variant="outline"
                      className="flex items-center justify-center gap-2 h-12"
                      data-testid="button-simulate-anti-bot"
                    >
                      {simulatingAntiBot ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Shield className="w-4 h-4" />
                      )}
                      {simulatingAntiBot ? "Simulating..." : "Bot Detection"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Email Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    Email Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Enable Email Alerts</Label>
                      <p className="text-xs text-muted-foreground">
                        Send email notifications for price and stock changes
                      </p>
                    </div>
                    <Switch
                      checked={settings.enableEmail}
                      onCheckedChange={(checked) => handleSettingChange('enableEmail', checked)}
                      data-testid="switch-email"
                    />
                  </div>

                  {settings.enableEmail && (
                    <>
                      <Separator />
                      <Alert>
                        <Info className="w-4 h-4" />
                        <AlertDescription className="flex items-center justify-between">
                          Gmail requires an App Password for third-party applications. 
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setShowEmailHelp(true)}
                            className="px-2 py-1 h-auto text-primary underline hover:no-underline"
                            data-testid="button-email-help"
                          >
                            Click Here to Learn How
                          </Button>
                        </AlertDescription>
                      </Alert>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="gmail-email" className="text-sm font-medium">
                            Gmail Address
                          </Label>
                          <Input
                            id="gmail-email"
                            type="email"
                            placeholder="your.email@gmail.com"
                            value={settings?.gmailEmail ?? ""}
                            onChange={(e) => handleSettingChange('gmailEmail', e.target.value)}
                            data-testid="input-gmail-email"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="gmail-app-password" className="text-sm font-medium">
                            Gmail App Password
                          </Label>
                          <Input
                            id="gmail-app-password"
                            type="password"
                            placeholder="16-character app password"
                            value={settings?.gmailAppPassword ?? ""}
                            onChange={(e) => handleSettingChange('gmailAppPassword', e.target.value)}
                            data-testid="input-gmail-password"
                          />
                          <p className="text-xs text-muted-foreground">
                            This is NOT your regular Gmail password. You need to generate an App Password.
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button 
                            onClick={testEmailSettings}
                            disabled={testingEmail || !settings.gmailEmail || (!settings.gmailAppPassword && settings.gmailAppPassword !== "****hidden****")}
                            className="flex items-center gap-2"
                            data-testid="button-test-email"
                          >
                            {testingEmail ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            {testingEmail ? 'Testing...' : 'Test Email Settings'}
                          </Button>
                        </div>

                        {emailTestResult && (
                          <Alert variant={emailTestResult.includes('successfully') ? 'default' : 'destructive'}>
                            <AlertDescription data-testid="text-email-test-result">
                              {emailTestResult}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Task Tray Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Cog className="w-5 h-5" />
                    Application Behavior
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Run in System Tray</Label>
                      <p className="text-xs text-muted-foreground">
                        Keep monitoring when window is closed (runs in background)
                      </p>
                    </div>
                    <Switch
                      checked={settings.enableTaskTray || false}
                      onCheckedChange={(checked) => handleSettingChange('enableTaskTray', checked)}
                      data-testid="switch-task-tray"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Data Storage</h4>
                    <p className="text-xs text-muted-foreground">
                      All settings and product data are automatically saved instantly as you make changes. 
                      You can safely close the application at any time - your data will be preserved.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Advanced Settings */}
            <TabsContent value="advanced" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield 
                      className="w-5 h-5 cursor-pointer hover:text-primary transition-colors select-none" 
                      onClick={handleSecretClick}
                      onMouseDown={(e) => e.preventDefault()}
                      data-testid="button-secret-unlock"
                    />
                    Advanced Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {!advancedUnlocked ? (
                    <div className="text-center py-4">
                      <h3 className="text-sm font-medium mb-1">Advanced Features Locked</h3>
                      <p className="text-xs text-muted-foreground">
                        Click the shield icon 3 times to unlock.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Monitoring Intervals - moved from General tab */}
                      <div className="space-y-4">
                        <h4 className="font-medium text-sm">Monitoring Intervals</h4>
                        <Alert>
                          <Clock className="w-4 h-4" />
                          <AlertDescription>
                            <strong>Caution:</strong> More frequent checking increases the risk of IP blocking. 
                            ±20% randomization is automatically applied to avoid detection patterns.
                          </AlertDescription>
                        </Alert>

                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="amazon-interval-adv" className="text-sm font-medium">
                                Amazon Check Interval (minutes)
                              </Label>
                              <Badge variant="secondary" className="text-xs">
                                {settings?.amazonCheckInterval || 15}m
                              </Badge>
                            </div>
                            <Select 
                              value={settings?.amazonCheckInterval?.toString() || "15"} 
                              onValueChange={(value) => handleSettingChange('amazonCheckInterval', parseInt(value))}
                            >
                              <SelectTrigger data-testid="select-amazon-interval-advanced">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="5">5 minutes (Aggressive)</SelectItem>
                                <SelectItem value="10">10 minutes (Fast)</SelectItem>
                                <SelectItem value="15">15 minutes (Normal)</SelectItem>
                                <SelectItem value="20">20 minutes (Safe)</SelectItem>
                                <SelectItem value="30">30 minutes (Conservative)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="walmart-interval-adv" className="text-sm font-medium">
                                Walmart Check Interval (minutes)
                              </Label>
                              <Badge variant="secondary" className="text-xs">
                                {settings?.walmartCheckInterval || 1}m
                              </Badge>
                            </div>
                            <Select 
                              value={settings?.walmartCheckInterval?.toString() || "1"} 
                              onValueChange={(value) => handleSettingChange('walmartCheckInterval', parseInt(value))}
                            >
                              <SelectTrigger data-testid="select-walmart-interval-advanced">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1 minute (Aggressive)</SelectItem>
                                <SelectItem value="2">2 minutes (Fast)</SelectItem>
                                <SelectItem value="5">5 minutes (Normal)</SelectItem>
                                <SelectItem value="10">10 minutes (Safe)</SelectItem>
                                <SelectItem value="15">15 minutes (Conservative)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h4 className="font-medium text-sm">Proxy Configuration</h4>
                        <div className="p-4 border rounded-lg space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <Label className="text-sm font-medium">Enable Proxy Support</Label>
                              <p className="text-xs text-muted-foreground">
                                Route requests through proxy servers to avoid IP detection
                              </p>
                            </div>
                            <Switch
                              checked={settings?.enableProxy ?? false}
                              onCheckedChange={(checked) => handleSettingChange('enableProxy', checked)}
                              disabled={true}
                              data-testid="switch-proxy-support"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Proxy Server (HTTP/HTTPS)</Label>
                            <Input 
                              value={settings?.proxyUrl ?? ""}
                              onChange={(e) => handleSettingChange('proxyUrl', e.target.value)}
                              placeholder="http://proxy-server:port"
                              disabled={true}
                              className="text-sm"
                              data-testid="input-proxy-url"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Username (Optional)</Label>
                              <Input 
                                value={settings?.proxyUsername ?? ""}
                                onChange={(e) => handleSettingChange('proxyUsername', e.target.value)}
                                placeholder="username"
                                disabled={true}
                                className="text-sm"
                                data-testid="input-proxy-username"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Password (Optional)</Label>
                              <Input 
                                value={settings?.proxyPassword ?? ""}
                                onChange={(e) => handleSettingChange('proxyPassword', e.target.value)}
                                type="password"
                                placeholder="password"
                                disabled={true}
                                className="text-sm"
                                data-testid="input-proxy-password"
                              />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Proxy support is currently in development and will be available in a future update.
                          </p>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <div className="p-4 border rounded-lg bg-muted/50">
                          <h4 className="font-medium text-sm mb-2">Anti-Detection Status</h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">User Agent Rotation:</span>
                              <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Enabled</Badge>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Request Headers:</span>
                              <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Randomized</Badge>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Proxy Support:</span>
                              <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Available</Badge>
                            </div>
                            <div>
                              <span className="text-muted-foreground">CAPTCHA Handling:</span>
                              <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Auto-Retry</Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Error Logs</h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        Download application logs for troubleshooting. This file contains error information 
                        that you can share with support to help diagnose issues.
                      </p>
                      <Button
                        onClick={downloadLogs}
                        disabled={downloadingLogs}
                        variant="outline"
                        size="sm"
                        data-testid="button-download-logs"
                      >
                        {downloadingLogs ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4 mr-2" />
                        )}
                        {downloadingLogs ? "Downloading..." : "Download Logs"}
                      </Button>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Data Storage</h4>
                      <p className="text-xs text-muted-foreground">
                        Settings and product data are stored locally. All data persists between application restarts 
                        and is automatically backed up with your error logs.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={updateSettingsMutation.isPending}
              data-testid="button-settings-close"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <EmailHelp />

      {/* Secret Unlock Dialog */}
      <Dialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
        <DialogContent className="max-w-md fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-in fade-in-0 zoom-in-95 duration-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Unlock Advanced Settings?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-lg font-medium mb-2">🚨 Danger Zone Ahead! 🚨</h3>
              <p className="text-sm text-muted-foreground mb-4">
                You're about to unlock advanced monitoring settings that could:
              </p>
              <div className="space-y-2 text-sm text-left">
                <div className="flex items-center gap-2">
                  <span>💥</span>
                  <span>Get your IP address blocked by retailers</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🤖</span>
                  <span>Trigger anti-bot detection systems</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🚫</span>
                  <span>Break your monitoring completely</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                But hey... we trust you know what you're doing! 😉
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowUnlockDialog(false)}
                className="flex-1"
                data-testid="button-cancel-unlock"
              >
                🏃 Nope, I'm Good
              </Button>
              <Button
                onClick={handleUnlockAdvanced}
                className="flex-1"
                data-testid="button-confirm-unlock"
              >
                🔥 Let's Do This!
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}