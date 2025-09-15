import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WebSignupForm } from "./WebSignupForm";
import { WebLoginForm } from "./WebLoginForm";
import type { AuthResponse } from "@shared/schema";
import { Monitor, UserPlus, LogIn, Zap, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

type AuthMode = 'choice' | 'signup' | 'login';

interface AuthChoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMode?: AuthMode;
}

export default function AuthChoiceModal({ open, onOpenChange, defaultMode = 'choice' }: AuthChoiceModalProps) {
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [, setLocation] = useLocation();

  const handleAuthSuccess = (authResponse: AuthResponse) => {
    console.log("[AuthChoice] Authentication successful:", authResponse.user.email);
    
    // Close modal
    onOpenChange(false);
    
    // Reset mode for next time
    setMode('choice');
    
    // Redirect to dashboard
    setLocation('/dashboard');
  };

  const handleReplitAuth = () => {
    // Close modal and redirect to Replit Auth
    onOpenChange(false);
    window.location.href = "/api/login";
  };

  const renderContent = () => {
    switch (mode) {
      case 'signup':
        return (
          <WebSignupForm
            onSignupSuccess={handleAuthSuccess}
            onSwitchToLogin={() => setMode('login')}
          />
        );
      
      case 'login':
        return (
          <WebLoginForm
            onLoginSuccess={handleAuthSuccess}
            onSwitchToSignup={() => setMode('signup')}
            onSwitchToReplitAuth={handleReplitAuth}
          />
        );
      
      case 'choice':
      default:
        return (
          <div className="w-full max-w-md mx-auto space-y-6">
            {/* Header */}
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Monitor className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold">Join Stock Monitor</h2>
                <p className="text-muted-foreground mt-2">
                  Choose your preferred way to get started
                </p>
              </div>
            </div>

            {/* Auth Options */}
            <div className="space-y-4">
              {/* Replit Auth Option */}
              <Card className="hover-elevate cursor-pointer transition-all" data-testid="card-replit-auth-option">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Zap className="h-5 w-5 text-primary" />
                      Continue with Replit
                    </CardTitle>
                    <Badge variant="secondary">Recommended</Badge>
                  </div>
                  <CardDescription>
                    Quick and secure sign-in with your Replit account
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button 
                    className="w-full" 
                    onClick={handleReplitAuth}
                    data-testid="button-choose-replit-auth"
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    Sign in with Replit
                  </Button>
                  <div className="mt-3 text-xs text-muted-foreground">
                    • No password required • Instant access • Secure OAuth
                  </div>
                </CardContent>
              </Card>

              {/* Email/Password Options */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Signup Option */}
                <Card className="hover-elevate cursor-pointer transition-all" data-testid="card-signup-option">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <UserPlus className="h-5 w-5 text-chart-1" />
                      Create Account
                    </CardTitle>
                    <CardDescription className="text-sm">
                      New to Stock Monitor? Sign up with email
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => setMode('signup')}
                      data-testid="button-choose-signup"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Sign Up
                    </Button>
                  </CardContent>
                </Card>

                {/* Login Option */}
                <Card className="hover-elevate cursor-pointer transition-all" data-testid="card-login-option">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <LogIn className="h-5 w-5 text-chart-2" />
                      Sign In
                    </CardTitle>
                    <CardDescription className="text-sm">
                      Already have an account? Sign in here
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => setMode('login')}
                      data-testid="button-choose-login"
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      Sign In
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Benefits */}
            <div className="text-center space-y-2">
              <div className="text-xs text-muted-foreground">
                All sign-up methods include:
              </div>
              <div className="flex flex-wrap justify-center gap-2 text-xs">
                <Badge variant="outline" className="text-xs">Free to Start</Badge>
                <Badge variant="outline" className="text-xs">No Spam</Badge>
                <Badge variant="outline" className="text-xs">Cancel Anytime</Badge>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-auth-choice">
        {mode !== 'choice' && (
          <div className="absolute left-4 top-4 z-10">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode('choice')}
              className="p-2"
              data-testid="button-back-to-choice"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        <DialogHeader className={mode !== 'choice' ? 'sr-only' : ''}>
          <DialogTitle>Get Started with Stock Monitor</DialogTitle>
          <DialogDescription>
            Choose how you'd like to sign in or create your account
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}