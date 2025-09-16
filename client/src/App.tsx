import { Switch, Route } from "wouter";
import { queryClient, setDesktopApiRequest } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { DataProviderProvider } from "@/contexts/DataProviderContext";
import { DesktopAuthProvider, useDesktopAuth } from "@/contexts/DesktopAuthContext";
import { WelcomeDialog } from "@/components/WelcomeDialog";
import { DesktopLogin } from "@/components/DesktopLogin";
import { ReactQueryValidation } from "@/components/ReactQueryValidation";
import { Loader2 } from "lucide-react";
import { useEffect, Suspense, lazy } from "react";

// Code split large components using React.lazy for better bundle optimization
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const Dashboard = lazy(() => import("@/components/Dashboard"));
const NotificationHistoryPage = lazy(() => import("@/pages/NotificationHistoryPage"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const NotFound = lazy(() => import("@/pages/not-found"));
import type { AuthResponse } from "@shared/schema";

function AuthenticatedRouter() {
  const { isAuthenticated, isLoading, login, apiRequest } = useDesktopAuth();

  // Desktop authentication is now wired in DesktopAuthContext

  // Check if we're in desktop environment
  const isDesktopApp = typeof window !== 'undefined' && 'electronAPI' in window;

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">
            {isDesktopApp ? "Checking authentication..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  // Show login page for desktop app if not authenticated
  if (isDesktopApp && !isAuthenticated) {
    return <DesktopLogin onLoginSuccess={() => {/* Login success is handled by DesktopAuthContext */}} />;
  }

  // Show main application routes  
  return (
    <>
      <ReactQueryValidation />
      <WelcomeDialog />
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }>
        <Switch>
          <Route path="/" component={LandingPage} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/notifications" component={NotificationHistoryPage} />
          <Route path="/admin" component={AdminDashboard} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="stock-monitor-theme">
        <DataProviderProvider>
          <DesktopAuthProvider>
            <NotificationsProvider>
                  <TooltipProvider>
                    <Toaster />
                    <AuthenticatedRouter />
                  </TooltipProvider>
            </NotificationsProvider>
          </DesktopAuthProvider>
        </DataProviderProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
