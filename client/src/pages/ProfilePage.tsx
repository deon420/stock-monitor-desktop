import { useDesktopAuth } from "@/contexts/DesktopAuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLocation } from "wouter";
import { 
  Monitor, 
  User, 
  Mail, 
  Crown, 
  CreditCard, 
  Settings, 
  LogOut,
  ArrowLeft,
  Shield
} from "lucide-react";

export default function ProfilePage() {
  const { user, isAuthenticated, logout } = useDesktopAuth();
  const [, setLocation] = useLocation();

  // Redirect if not authenticated
  if (!isAuthenticated || !user) {
    setLocation('/');
    return null;
  }

  const handleLogout = async () => {
    await logout();
    setLocation('/');
  };

  const handleBackToHome = () => {
    setLocation('/');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleBackToHome}
              data-testid="button-back-home"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            <div className="flex items-center space-x-2">
              <Monitor className="h-6 w-6 text-primary" />
              <span className="font-bold text-xl">Stock Monitor</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Profile Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Profile Header */}
          <Card data-testid="card-profile-header">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <User className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">
                      {user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {user.email}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {user.isAdmin && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Admin
                    </Badge>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleLogout}
                    data-testid="button-logout"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Account Information */}
          <Card data-testid="card-account-info">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Account Information
              </CardTitle>
              <CardDescription>
                Manage your account settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">First Name</label>
                  <p className="text-sm mt-1" data-testid="text-first-name">
                    {user.firstName || 'Not set'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                  <p className="text-sm mt-1" data-testid="text-last-name">
                    {user.lastName || 'Not set'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                  <p className="text-sm mt-1" data-testid="text-email">
                    {user.email}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Account Type</label>
                  <p className="text-sm mt-1" data-testid="text-account-type">
                    {user.isAdmin ? 'Administrator' : 'Standard User'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Plan */}
          <Card data-testid="card-subscription-plan">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Subscription Plan
              </CardTitle>
              <CardDescription>
                Your current plan and billing information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Current Plan</h3>
                  <p className="text-sm text-muted-foreground">
                    Beta Tester Plan
                  </p>
                </div>
                <Badge variant="secondary" data-testid="badge-current-plan">
                  Beta Access
                </Badge>
              </div>
              
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Plan Features</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Unlimited product monitoring</li>
                  <li>• Email notifications</li>
                  <li>• Priority support</li>
                  <li>• Advanced settings</li>
                </ul>
              </div>

              <div className="border-t pt-4">
                <Button variant="outline" className="w-full sm:w-auto" data-testid="button-upgrade-plan">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Upgrade Plan (Coming Soon)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card data-testid="card-quick-actions">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common tasks and settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button 
                  variant="outline" 
                  className="h-auto p-4 flex flex-col items-center gap-2"
                  onClick={() => setLocation('/dashboard')}
                  data-testid="button-view-dashboard"
                >
                  <Monitor className="h-6 w-6" />
                  <span>View Dashboard</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="h-auto p-4 flex flex-col items-center gap-2"
                  disabled
                  data-testid="button-billing-settings"
                >
                  <CreditCard className="h-6 w-6" />
                  <span>Billing Settings</span>
                  <span className="text-xs text-muted-foreground">(Coming Soon)</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="h-auto p-4 flex flex-col items-center gap-2"
                  disabled
                  data-testid="button-account-settings"
                >
                  <Settings className="h-6 w-6" />
                  <span>Account Settings</span>
                  <span className="text-xs text-muted-foreground">(Coming Soon)</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}