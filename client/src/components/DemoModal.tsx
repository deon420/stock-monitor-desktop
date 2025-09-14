import { Dialog, DialogContent } from "@/components/ui/dialog"
import Dashboard from "./Dashboard"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DemoModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function DemoModal({ isOpen, onClose }: DemoModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-none w-[80vw] h-[80vh] p-0 border-0 bg-background shadow-2xl rounded-xl overflow-hidden backdrop-blur-sm"
        data-testid="modal-demo"
      >
        {/* Modal Header with Close Button */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-background/95 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-foreground">
            Stock Monitor Demo 👀
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 hover-elevate rounded-full"
            data-testid="button-close-demo"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-hidden bg-background">
          <Dashboard />
        </div>
      </DialogContent>
    </Dialog>
  )
}