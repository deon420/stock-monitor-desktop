import { createContext, useContext, useState, ReactNode } from 'react'

// Anti-bot detection result interface
interface AntiBotDetectionResult {
  isBlocked: boolean
  detectionType: 'cloudflare' | 'aws_waf' | 'rate_limit' | 'ip_block' | 'captcha' | 'js_challenge' | 'redirect_loop' | 'platform_specific' | 'none'
  confidence: number // 0-1 scale
  platform: 'amazon' | 'walmart'
  responseCode: number
  responseTime: number
  rawResponse?: string
  timestamp: number
  suggestedAction: string
  details: Record<string, any>
}

interface AntiDetectionContextType {
  detectionAlert: AntiBotDetectionResult | null
  showDetectionModal: boolean
  showDetectionAlert: (detection: AntiBotDetectionResult) => void
  hideDetectionAlert: () => void
}

const AntiDetectionContext = createContext<AntiDetectionContextType | undefined>(undefined)

export const useAntiDetection = () => {
  const context = useContext(AntiDetectionContext)
  if (!context) {
    throw new Error('useAntiDetection must be used within an AntiDetectionProvider')
  }
  return context
}

interface AntiDetectionProviderProps {
  children: ReactNode
}

export const AntiDetectionProvider = ({ children }: AntiDetectionProviderProps) => {
  const [detectionAlert, setDetectionAlert] = useState<AntiBotDetectionResult | null>(null)
  const [showDetectionModal, setShowDetectionModal] = useState(false)

  const showDetectionAlert = (detection: AntiBotDetectionResult) => {
    console.log('[AntiDetection] Showing detection alert:', detection.detectionType, 'on', detection.platform)
    setDetectionAlert(detection)
    setShowDetectionModal(true)
  }

  const hideDetectionAlert = () => {
    console.log('[AntiDetection] Hiding detection alert')
    setShowDetectionModal(false)
    // Keep the detection data for a moment in case we need to reference it
    setTimeout(() => {
      setDetectionAlert(null)
    }, 300) // Small delay to allow modal exit animation
  }

  return (
    <AntiDetectionContext.Provider
      value={{
        detectionAlert,
        showDetectionModal,
        showDetectionAlert,
        hideDetectionAlert
      }}
    >
      {children}
    </AntiDetectionContext.Provider>
  )
}

// Export the interface for use in other components
export type { AntiBotDetectionResult }