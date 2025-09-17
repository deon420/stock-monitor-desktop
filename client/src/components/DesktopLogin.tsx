import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { loginSchema } from "@shared/schema";
import type { LoginRequest, AuthResponse } from "@shared/schema";
import { Loader2, Shield, Lock, User, KeyRound, AlertCircle, Monitor, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDesktopAuth } from "@/contexts/DesktopAuthContext";

interface DesktopLoginProps {
  onLoginSuccess?: () => void;
}

export function DesktopLogin({ onLoginSuccess }: DesktopLoginProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberEmail, setRememberEmail] = useState(true);
  const [electronAPIStatus, setElectronAPIStatus] = useState<{
    available: boolean;
    checking: boolean;
    error?: string;
  }>({ available: false, checking: true });
  const [keychainStatus, setKeychainStatus] = useState<{
    available: boolean;
    checking: boolean;
    error?: string;
  }>({ available: false, checking: true });
  const { toast } = useToast();
  const { login, isKeychainAvailable } = useDesktopAuth();

  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: true,
    },
  });

  // Check electronAPI and keychain status on mount
  useEffect(() => {
    const checkElectronAPIAndKeychain = async () => {
      // First, check if we're in a browser environment
      if (typeof window === 'undefined') {
        setElectronAPIStatus({ available: false, checking: false, error: 'Server environment' });
        setKeychainStatus({ available: false, checking: false, error: 'Server environment' });
        return;
      }

      // Check for electronAPI availability with a small delay to handle timing issues
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('[DesktopLogin] Checking for electronAPI...');
      console.log('[DesktopLogin] window.electronAPI:', (window as any).electronAPI);
      
      const electronAPI = (window as any).electronAPI;
      const isElectronAvailable = !!electronAPI;
      
      console.log('[DesktopLogin] electronAPI available:', isElectronAvailable);
      
      setElectronAPIStatus({ 
        available: isElectronAvailable, 
        checking: false,
        error: isElectronAvailable ? undefined : 'Running in web mode'
      });

      if (!isElectronAvailable) {
        setKeychainStatus({ available: false, checking: false, error: 'Web mode - no keychain' });
        return;
      }

      // ElectronAPI is available, now check keychain
      try {
        setKeychainStatus({ available: false, checking: true });
        
        if (electronAPI?.keychainHelper?.isAvailable) {
          const available = await electronAPI.keychainHelper.isAvailable();
          setKeychainStatus({ available, checking: false });
          
          if (available) {
            // Try to load stored email from keychain
            const emailResult = await electronAPI.keychain.preferences.getEmail();
            if (emailResult.success && emailResult.data) {
              form.setValue("email", emailResult.data);
              setRememberEmail(true);
              console.log('[DesktopLogin] Loaded stored email from keychain');
            }
          }
        } else {
          setKeychainStatus({ 
            available: false, 
            checking: false, 
            error: 'Keychain API not available' 
          });
        }
      } catch (error) {
        console.warn('[DesktopLogin] Failed to check keychain:', error);
        setKeychainStatus({ 
          available: false, 
          checking: false, 
          error: 'Keychain check failed' 
        });
        
        // No insecure fallbacks - if keychain unavailable, don't persist email
        console.warn('[DesktopLogin] Keychain unavailable - email will not be persisted');
      }
    };

    checkElectronAPIAndKeychain();
  }, [form]);

  const onSubmit = async (data: LoginRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("[DesktopLogin] Attempting secure login for:", data.email);
      
      let response: Response;
      
      if (electronAPIStatus.available && (window as any).electronAPI?.apiRequest) {
        // Use desktop API for authenticated requests (bypasses CORS)
        console.log("[DesktopLogin] Using desktop API for login");
        response = await (window as any).electronAPI.apiRequest("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Auth-Mode": "tokens", // Request tokens for desktop
          },
          body: JSON.stringify(data),
        });
      } else {
        // Fallback to regular fetch for web clients
        console.log("[DesktopLogin] Using regular fetch for web login");
        response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // No X-Auth-Mode header for web - use default cookie-based auth
          },
          body: JSON.stringify(data),
        });
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Login failed");
      }

      const authResponse = result as AuthResponse;

      // Use secure keychain-based login from context
      await login(authResponse, data.rememberMe);

      // Store email preference in keychain if remember email is enabled and we're in desktop mode
      if (rememberEmail && electronAPIStatus.available) {
        try {
          const electronAPI = (window as any).electronAPI;
          if (electronAPI?.keychain?.preferences?.storeEmail) {
            await electronAPI.keychain.preferences.storeEmail(data.email);
            console.log('[DesktopLogin] Email stored securely in keychain');
          }
        } catch (emailStoreError) {
          console.warn('[DesktopLogin] Failed to store email in keychain - email will not be persisted:', emailStoreError);
          // NO INSECURE FALLBACKS - if keychain fails, don't store email
        }
      } else if (!rememberEmail && electronAPIStatus.available) {
        try {
          const electronAPI = (window as any).electronAPI;
          if (electronAPI?.keychain?.preferences?.clearEmail) {
            await electronAPI.keychain.preferences.clearEmail();
            console.log('[DesktopLogin] Email preference cleared from keychain');
          }
        } catch (clearError) {
          console.warn('[DesktopLogin] Failed to clear email from keychain:', clearError);
        }
        // Clear any legacy localStorage data if it exists
        try {
          localStorage.removeItem("desktopLogin_email");
          localStorage.removeItem("desktopLogin_rememberEmail");
        } catch (error) {
          console.warn('[DesktopLogin] Failed to clear legacy localStorage:', error);
        }
      }

      console.log("[DesktopLogin] Secure login successful for user:", authResponse.user.email);
      
      toast({
        title: "Login Successful",
        description: `Welcome back, ${authResponse.user.firstName || authResponse.user.email}!`,
      });

      // Call success callback
      if (onLoginSuccess) {
        onLoginSuccess();
      }

    } catch (error) {
      console.error("[DesktopLogin] Login failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Login failed. Please try again.";
      setError(errorMessage);
      
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Always render the login form, but show appropriate status messages
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md shadow-lg" data-testid="card-desktop-login">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Stock Monitor</CardTitle>
          <CardDescription className="text-muted-foreground">
            {electronAPIStatus.checking ? (
              "Initializing secure login..."
            ) : electronAPIStatus.available ? (
              "Sign in to your secure desktop app"
            ) : (
              "Sign in to Stock Monitor (Web Mode)"
            )}
          </CardDescription>
          
          {/* App Mode and Security Status */}
          <div className="flex flex-col items-center justify-center mt-2 space-y-2">
            {/* App Mode Status */}
            {electronAPIStatus.checking ? (
              <Badge variant="outline" className="text-xs">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Detecting Mode...
              </Badge>
            ) : electronAPIStatus.available ? (
              <Badge variant="default" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                <Monitor className="h-3 w-3 mr-1" />
                Desktop App Mode
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                <Globe className="h-3 w-3 mr-1" />
                Web Mode
              </Badge>
            )}
            
            {/* Keychain Status (only show if in desktop mode) */}
            {electronAPIStatus.available && (
              <div>
                {keychainStatus.checking ? (
                  <Badge variant="outline" className="text-xs">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Checking Security...
                  </Badge>
                ) : keychainStatus.available ? (
                  <Badge variant="default" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                    <KeyRound className="h-3 w-3 mr-1" />
                    OS Keychain Available
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-orange-600">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Keychain Unavailable
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4" variant="destructive" data-testid="alert-login-error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Email
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="your.email@example.com"
                        disabled={isLoading}
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Password
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Your secure password"
                        disabled={isLoading}
                        data-testid="input-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="rememberMe"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isLoading}
                          data-testid="checkbox-remember-me"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-normal">
                          Remember me
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Keep me signed in across app restarts
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {/* Only show remember email option if we're in desktop mode */}
                {electronAPIStatus.available && (
                  <div className="flex flex-row items-center space-x-2">
                    <Checkbox
                      id="rememberEmail"
                      checked={rememberEmail}
                      onCheckedChange={(checked) => setRememberEmail(checked === true)}
                      disabled={isLoading || !keychainStatus.available}
                      data-testid="checkbox-remember-email"
                    />
                    <Label
                      htmlFor="rememberEmail"
                      className={`text-sm font-normal cursor-pointer ${!keychainStatus.available ? 'text-muted-foreground' : ''}`}
                    >
                      Remember my email address
                      {!keychainStatus.available && " (requires keychain)"}
                    </Label>
                  </div>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Sign In Securely
                  </>
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center">
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="flex items-center justify-center gap-1">
                <Shield className="h-3 w-3" />
                Your data is encrypted and secure
              </p>
              {electronAPIStatus.available ? (
                <p>Desktop app version • Enterprise security</p>
              ) : (
                <p>Web version • Standard security</p>
              )}
              {!electronAPIStatus.available && (
                <p className="text-orange-600 dark:text-orange-400">
                  Some features may be limited in web mode
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}