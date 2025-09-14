import { useState } from "react"
import { Circle, Eye, Shield, Monitor, Cpu, Satellite, Power, RotateCcw, Target } from "lucide-react"

interface StatusOption {
  id: string
  icon: React.ComponentType<{ className?: string }>
  text: string
  description: string
  pulseType: 'scale' | 'glow' | 'spin'
}

const statusOptions: StatusOption[] = [
  {
    id: 'online-undetected',
    icon: Circle,
    text: 'ONLINE | MONITORING IS UNDETECTED',
    description: 'Simple dot with reverse spin',
    pulseType: 'spin'
  },
  {
    id: 'secure-monitoring',
    icon: Shield,
    text: 'SECURE | MONITORING IS UNDETECTED', 
    description: 'Shield with reverse spin',
    pulseType: 'spin'
  },
  {
    id: 'online-undetected-2',
    icon: Eye,
    text: 'ONLINE | SYSTEM IS UNDETECTED',
    description: 'Eye with reverse spin',
    pulseType: 'spin'
  },
  {
    id: 'system-operational',
    icon: Monitor,
    text: 'SYSTEM | MONITORING IS UNDETECTED',
    description: 'Monitor with glow pulse',
    pulseType: 'glow'
  },
  {
    id: 'processing-undetected',
    icon: Cpu,
    text: 'PROCESSING | SYSTEM IS UNDETECTED',
    description: 'CPU chip with scale pulse',
    pulseType: 'scale'
  },
  {
    id: 'signal-acquired',
    icon: Satellite,
    text: 'SIGNAL ACQUIRED | UNDETECTED',
    description: 'Satellite with glow pulse',
    pulseType: 'glow'
  },
  {
    id: 'powered-on',
    icon: Power,
    text: 'POWERED ON | MONITORING ACTIVE',
    description: 'Power button with scale pulse',
    pulseType: 'scale'
  },
  {
    id: 'continuous-monitoring',
    icon: RotateCcw,
    text: 'CONTINUOUS | MONITORING ACTIVE',
    description: 'Rotating arrows with spin',
    pulseType: 'spin'
  },
  {
    id: 'target-locked',
    icon: Target,
    text: 'TARGET LOCKED | UNDETECTED',
    description: 'Target crosshairs with scale pulse',
    pulseType: 'scale'
  }
]

export default function StatusIndicator() {
  const [currentIndex, setCurrentIndex] = useState(0)

  const handleClick = () => {
    setCurrentIndex((prev) => (prev + 1) % statusOptions.length)
  }

  const currentOption = statusOptions[currentIndex]
  const Icon = currentOption.icon

  const getPulseClasses = (type: string) => {
    switch (type) {
      case 'scale':
        return 'animate-pulse'
      case 'glow':
        return 'animate-pulse drop-shadow-md'
      case 'spin':
        return 'animate-spin-reverse'
      default:
        return 'animate-pulse'
    }
  }

  return (
    <div 
      className="flex items-center justify-center gap-3 py-4 cursor-pointer select-none transition-all hover:bg-muted/50 rounded-lg px-6"
      onClick={handleClick}
      data-testid="status-indicator"
      title={`Click to cycle options (${currentIndex + 1}/${statusOptions.length}): ${currentOption.description}`}
    >
      <Icon 
        className={`w-5 h-5 text-green-500 ${getPulseClasses(currentOption.pulseType)}`}
      />
      <span className="font-mono text-sm font-medium text-muted-foreground tracking-wide">
        {currentOption.text}
      </span>
    </div>
  )
}