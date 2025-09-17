import { useQuery } from "@tanstack/react-query";
import { Loader2, Shield, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import type { UserProfile } from "@shared/schema";

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

export function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const [, setLocation] = useLocation();

  // Check current user and admin status
  const { data: user, isLoading, error } = useQuery<UserProfile>({
    queryKey: ['/api/me'],
    retry: 1,
  });

  // Show loading state while checking authorization
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground animate-pulse" />
          <div className="space-y-2">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Verifying admin access...</p>
          </div>
        </div>
      </div>
    );
  }

  // Handle authentication errors
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader className="text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-2" />
            <CardTitle className="text-destructive">Authentication Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              You must be logged in to access this page.
            </p>
            <Button 
              onClick={() => setLocation('/')}
              className="w-full"
              data-testid="button-return-home"
            >
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check admin authorization
  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-yellow-500">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 mx-auto text-yellow-600 mb-2" />
            <CardTitle className="text-yellow-800 dark:text-yellow-200">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              You don't have administrator privileges to access this page.
            </p>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Current user: <span className="font-medium">{user?.email}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Role: <span className="font-medium">{user?.isAdmin ? 'Administrator' : 'User'}</span>
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button 
                onClick={() => setLocation('/dashboard')}
                className="w-full"
                data-testid="button-go-dashboard"
              >
                Go to Dashboard
              </Button>
              <Button 
                variant="outline"
                onClick={() => setLocation('/')}
                className="w-full"
                data-testid="button-return-home"
              >
                Return Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is authenticated and has admin privileges
  return <>{children}</>;
}