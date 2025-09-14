import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, KeyRound, Trash2, CheckCircle, AlertCircle, Info } from "lucide-react";
import { useDesktopAuth } from "@/contexts/DesktopAuthContext";
import { useToast } from "@/hooks/use-toast";

export function SecurityStatus() {
  const [isClearing, setIsClearing] = useState(false);
  const { isKeychainAvailable, clearStoredCredentials, isAuthenticated, user } = useDesktopAuth();
  const { toast } = useToast();

  const handleClearCredentials = async () => {
    setIsClearing(true);
    try {
      await clearStoredCredentials();
      toast({
        title: "Credentials Cleared",
        description: "All stored credentials have been removed from secure storage.",
      });
    } catch (error) {
      console.error('Failed to clear credentials:', error);
      toast({
        title: "Clear Failed",
        description: "Failed to clear stored credentials. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  // Don't render if not desktop app
  if (typeof window === 'undefined' || !('electronAPI' in window)) {
    return null;
  }

  return (
    <div className="space-y-4" data-testid="security-status">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Status
          </CardTitle>
          <CardDescription>
            View and manage your desktop app security settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Keychain Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <KeyRound className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">OS Keychain Integration</p>
                <p className="text-sm text-muted-foreground">
                  Secure credential storage using your operating system
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isKeychainAvailable ? (
                <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Available
                </Badge>
              ) : (
                <Badge variant="outline" className="text-orange-600">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Fallback Mode
                </Badge>
              )}
            </div>
          </div>

          {/* Authentication Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Authentication Status</p>
                <p className="text-sm text-muted-foreground">
                  {isAuthenticated ? `Signed in as ${user?.email}` : "Not signed in"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAuthenticated ? (
                <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge variant="outline">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Inactive
                </Badge>
              )}
            </div>
          </div>

          {/* Security Features */}
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <Info className="h-4 w-4" />
              Active Security Features
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Auto-logout after 30 minutes of inactivity</li>
              <li>• Secure token refresh every 14 minutes</li>
              <li>• {isKeychainAvailable ? "OS keychain" : "Encrypted fallback"} credential storage</li>
              <li>• Activity monitoring for session management</li>
            </ul>
          </div>

          {/* Actions */}
          {isAuthenticated && (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Clear Stored Credentials:</strong> This will remove all stored authentication 
                  tokens and preferences from secure storage. You will need to sign in again.
                </AlertDescription>
              </Alert>
              
              <Button
                variant="destructive"
                onClick={handleClearCredentials}
                disabled={isClearing}
                className="w-full"
                data-testid="button-clear-credentials"
              >
                {isClearing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All Stored Credentials
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}