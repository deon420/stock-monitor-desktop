import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { signupSchema } from "@shared/schema";
import type { SignupRequest, AuthResponse } from "@shared/schema";
import { Loader2, UserPlus, Mail, Lock, User, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

// Extended schema with confirm password validation
const webSignupSchema = signupSchema.extend({
  confirmPassword: z.string().min(8, 'Confirm password must be at least 8 characters'),
  rememberMe: z.boolean().optional().default(false),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type WebSignupRequest = z.infer<typeof webSignupSchema>;

interface WebSignupFormProps {
  onSignupSuccess?: (authResponse: AuthResponse) => void;
  onSwitchToLogin?: () => void;
}

export function WebSignupForm({ onSignupSuccess, onSwitchToLogin }: WebSignupFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const form = useForm<WebSignupRequest>({
    resolver: zodResolver(webSignupSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      rememberMe: true,
    },
  });

  const onSubmit = async (data: WebSignupRequest) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      console.log("[WebSignup] Attempting signup for:", data.email);
      
      // Prepare signup request (exclude confirmPassword)
      const signupData: SignupRequest = {
        email: data.email,
        password: data.password,
        firstName: data.firstName || undefined,
        lastName: data.lastName || undefined,
      };

      // Make signup request (web clients use cookie-based auth by default)
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(signupData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Signup failed");
      }

      const authResponse = result as AuthResponse;

      // If signup successful, immediately attempt login with remember me preference
      console.log("[WebSignup] Signup successful, logging in user...");
      
      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          rememberMe: data.rememberMe,
        }),
      });

      const loginResult = await loginResponse.json();

      if (!loginResponse.ok) {
        // Signup succeeded but login failed - this is unusual but not critical
        console.warn("[WebSignup] Signup succeeded but auto-login failed:", loginResult.error);
        setSuccess(true);
        toast({
          title: "Account Created Successfully",
          description: "Please log in with your new account credentials.",
        });
        return;
      }

      const loginAuthResponse = loginResult as AuthResponse;

      console.log("[WebSignup] Auto-login successful for user:", loginAuthResponse.user.email);
      
      toast({
        title: "Welcome to Stock Monitor!",
        description: `Account created successfully. Welcome, ${loginAuthResponse.user.firstName || loginAuthResponse.user.email}!`,
      });

      // Call success callback with login response (includes cookie auth)
      if (onSignupSuccess) {
        onSignupSuccess(loginAuthResponse);
      }

    } catch (error) {
      console.error("[WebSignup] Signup failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Signup failed. Please try again.";
      setError(errorMessage);
      
      toast({
        title: "Signup Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="w-full max-w-md shadow-lg" data-testid="card-signup-success">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-green-600 dark:text-green-400">
            Account Created!
          </CardTitle>
          <CardDescription>
            Your account has been created successfully. You can now log in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={onSwitchToLogin}
            className="w-full"
            data-testid="button-go-to-login"
          >
            Go to Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-lg" data-testid="card-web-signup">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <UserPlus className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
        <CardDescription className="text-muted-foreground">
          Join Stock Monitor and start saving money today
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert className="mb-4" variant="destructive" data-testid="alert-signup-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="John"
                        disabled={isLoading}
                        data-testid="input-first-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Doe"
                        disabled={isLoading}
                        data-testid="input-last-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email *
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="your.email@example.com"
                      disabled={isLoading}
                      data-testid="input-signup-email"
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
                    Password *
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="Create a secure password"
                      disabled={isLoading}
                      data-testid="input-signup-password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Confirm Password *
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="Confirm your password"
                      disabled={isLoading}
                      data-testid="input-confirm-password"
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
                      data-testid="checkbox-signup-remember-me"
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
              data-testid="button-signup"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Account
                </>
              )}
            </Button>
          </form>
        </Form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <button
              type="button"
              className="text-primary hover:underline font-medium"
              onClick={onSwitchToLogin}
              disabled={isLoading}
              data-testid="button-switch-to-login"
            >
              Sign in
            </button>
          </p>
        </div>

        <div className="mt-4 text-center">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>By creating an account, you agree to our Terms of Service</p>
            <p>• Free to start • No spam emails • Cancel anytime</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}