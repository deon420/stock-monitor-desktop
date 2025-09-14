import { Switch, Route } from "wouter";
import { queryClient, setDesktopApiRequest } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { DataProviderProvider } from "@/contexts/DataProviderContext";
import { DesktopAuthProvider, useDesktopAuth } from "@/contexts/DesktopAuthContext";
import { AntiDetectionProvider, useAntiDetection } from "@/contexts/AntiDetectionContext";
import { WelcomeDialog } from "@/components/WelcomeDialog";
import { DesktopLogin } from "@/components/DesktopLogin";
import { ReactQueryValidation } from "@/components/ReactQueryValidation";
import AntiDetectionModal from "@/components/AntiDetectionModal";
import LandingPage from "@/pages/LandingPage";
import Dashboard from "@/components/Dashboard";
import NotificationHistoryPage from "@/pages/NotificationHistoryPage";
import AdminDashboard from "@/pages/AdminDashboard";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import type { AuthResponse } from "@shared/schema";

function AuthenticatedRouter() {
  const { isAuthenticated, isLoading, login, apiRequest } = useDesktopAuth();
  const { detectionAlert, showDetectionModal, hideDetectionAlert } = useAntiDetection();

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
      <AntiDetectionModal
        isOpen={showDetectionModal}
        detection={detectionAlert}
        onClose={hideDetectionAlert}
      />
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/notifications" component={NotificationHistoryPage} />
        <Route path="/admin" component={AdminDashboard} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="stock-monitor-theme">
        <DataProviderProvider>
          <DesktopAuthProvider>
            <AntiDetectionProvider>
              <NotificationsProvider>
                <TooltipProvider>
                  <Toaster />
                  <AuthenticatedRouter />
                </TooltipProvider>
              </NotificationsProvider>
            </AntiDetectionProvider>
          </DesktopAuthProvider>
        </DataProviderProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
