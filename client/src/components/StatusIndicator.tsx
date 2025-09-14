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
    description: 'Simple dot with glow pulse',
    pulseType: 'glow'
  },
  {
    id: 'secure-monitoring',
    icon: Shield,
    text: 'SECURE | MONITORING IS UNDETECTED', 
    description: 'Shield with glow pulse',
    pulseType: 'glow'
  },
  {
    id: 'online-system-undetected',
    icon: Eye,
    text: 'ONLINE | SYSTEM IS UNDETECTED',
    description: 'Eye with scale pulse',
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