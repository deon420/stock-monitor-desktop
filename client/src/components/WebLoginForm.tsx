import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { loginSchema } from "@shared/schema";
import type { LoginRequest, AuthResponse } from "@shared/schema";
import { Loader2, LogIn, Mail, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WebLoginFormProps {
  onLoginSuccess?: (authResponse: AuthResponse) => void;
  onSwitchToSignup?: () => void;
}

export function WebLoginForm({ onLoginSuccess, onSwitchToSignup }: WebLoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: true,
    },
  });

  const onSubmit = async (data: LoginRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("[WebLogin] Attempting login for:", data.email);
      
      // Make login request (web clients use cookie-based auth by default)
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // No X-Auth-Mode header = defaults to cookie-based auth for web
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Login failed");
      }

      const authResponse = result as AuthResponse;

      console.log("[WebLogin] Login successful for user:", authResponse.user.email);
      
      toast({
        title: "Login Successful",
        description: `Welcome back, ${authResponse.user.firstName || authResponse.user.email}!`,
      });

      // Call success callback (cookies are automatically set by server)
      if (onLoginSuccess) {
        onLoginSuccess(authResponse);
      }

    } catch (error) {
      console.error("[WebLogin] Login failed:", error);
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

  return (
    <Card className="w-full max-w-md shadow-lg" data-testid="card-web-login">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <LogIn className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
        <CardDescription className="text-muted-foreground">
          Sign in to your Stock Monitor account
        </CardDescription>
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
                    <Mail className="h-4 w-4" />
                    Email
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="your.email@example.com"
                      disabled={isLoading}
                      data-testid="input-login-email"
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
                      placeholder="Your password"
                      disabled={isLoading}
                      data-testid="input-login-password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      data-testid="checkbox-login-remember-me"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm font-normal">
                      Remember me
                    </FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Keep me signed in for 30 days
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
              data-testid="button-web-login"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </>
              )}
            </Button>
          </form>
        </Form>


        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <button
              type="button"
              className="text-primary hover:underline font-medium"
              onClick={onSwitchToSignup}
              disabled={isLoading}
              data-testid="button-switch-to-signup"
            >
              Sign up
            </button>
          </p>
        </div>

        <div className="mt-4 text-center">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Secure cookie-based authentication</p>
            <p>• Your data is encrypted and protected</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}