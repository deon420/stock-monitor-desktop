import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Shield, Server, Settings, Zap } from "lucide-react";
import { isDesktopApp } from "@/utils/env";

export function WelcomeDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Only show welcome dialog in desktop app, not on website
    if (isDesktopApp()) {
      setIsOpen(true);
    }
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" data-testid="dialog-welcome">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-primary" />
            Hey there! 👋 Welcome to Stock Monitor
          </DialogTitle>
          <DialogDescription>
            Welcome to your personal stock monitoring app with enterprise-level security!
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-base">🚧</span>
              <div>
                <strong>Work in Progress:</strong> This app is constantly evolving! 
                Your feedback is super valuable - let me know what works, what doesn't, 
                and what you'd love to see added! 🎯
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-2">
              <span className="text-base">🏠</span>
              <div>
                <strong>Your Data Stays Local:</strong> Everything is stored right on your machine. 
                I have zero access to your data, settings, or monitored products. 
                Complete privacy guaranteed! 🔒
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                <span className="font-medium">Enterprise Security 🛡️</span>
                <Badge variant="secondary" className="text-xs">AES-256-GCM</Badge>
              </div>
              <div className="text-white ml-6">
                Your sensitive data is protected with military-grade encryption:
              </div>
              <ul className="text-white ml-6 space-y-1">
                <li className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Gmail app passwords (for notifications)
                </li>
                <li className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Proxy server credentials  
                </li>
                <li className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  All authentication tokens
                </li>
              </ul>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Not Perfect, But Getting Better! 🎨</span>
              </div>
              <div className="text-xs text-muted-foreground">
                This app isn't flawless (what is?), but it's built to be resilient! 
                If you're getting blocked from frequent requests, try experimenting with proxies. 🌐
              </div>
              <div className="text-xs text-muted-foreground">
                <strong>How proxies help:</strong> They rotate your IP address and make requests 
                appear to come from different locations, helping you avoid rate limits and blocks 
                when monitoring multiple products frequently. 🔄
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Settings className="h-3 w-3 text-blue-500" />
                <span className="text-xs font-medium">
                  Proxy support available in Advanced Settings! ⚙️
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button 
            onClick={() => {
              setIsOpen(false);
              setLocation('/dashboard');
            }} 
            className="w-full"
            data-testid="button-welcome-got-it"
          >
            Got it! Let's monitor some products! 🚀
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}