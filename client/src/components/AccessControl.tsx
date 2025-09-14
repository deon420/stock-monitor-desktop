import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  ShieldX, 
  AlertTriangle, 
  XCircle, 
  CreditCard, 
  Calendar,
  UserCheck,
  UserX
} from "lucide-react";
import { ApiError } from "@/lib/queryClient";

interface AccessControlProps {
  error?: ApiError | Error | null;
  children?: React.ReactNode;
}

export function AccessControl({ error, children }: AccessControlProps) {
  if (!error) {
    return <>{children}</>;
  }

  // Check if this is an API error with access control information
  const apiError = error as ApiError;
  const errorCode = apiError.code;
  const reason = apiError.reason;

  const renderAccessDeniedMessage = () => {
    switch (errorCode) {
      case 'ACCOUNT_BANNED':
        return (
          <Card className="border-destructive bg-destructive/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-destructive">Account Banned</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CardDescription>
                Your account has been permanently banned from using this service.
                {reason && <span className="block mt-2 text-sm">{reason}</span>}
              </CardDescription>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" size="sm" data-testid="button-contact-support">
                  Contact Support
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'ACCOUNT_SUSPENDED':
        return (
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <UserX className="h-5 w-5 text-yellow-600" />
                <CardTitle className="text-yellow-800 dark:text-yellow-200">Account Suspended</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CardDescription className="text-yellow-700 dark:text-yellow-300">
                Your account has been temporarily suspended.
                {reason && <span className="block mt-2 text-sm">{reason}</span>}
              </CardDescription>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" size="sm" data-testid="button-contact-support">
                  Contact Support
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'SUBSCRIPTION_REQUIRED':
        return (
          <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-blue-800 dark:text-blue-200">Subscription Required</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CardDescription className="text-blue-700 dark:text-blue-300">
                You need an active subscription or beta access to use stock monitoring features.
              </CardDescription>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="default" size="sm" data-testid="button-subscribe">
                  Subscribe Now
                </Button>
                <Button variant="outline" size="sm" data-testid="button-request-beta">
                  Request Beta Access
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'ACCESS_DENIED':
      default:
        return (
          <Card className="border-muted-foreground bg-muted/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ShieldX className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-muted-foreground">Access Denied</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CardDescription>
                {reason || 'You do not have permission to access this feature.'}
              </CardDescription>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" size="sm" data-testid="button-contact-support">
                  Contact Support
                </Button>
              </div>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <div className="w-full max-w-md">
        {renderAccessDeniedMessage()}
      </div>
    </div>
  );
}

interface AccessStatusBadgeProps {
  accessType?: 'subscription' | 'beta';
  className?: string;
}

export function AccessStatusBadge({ accessType, className }: AccessStatusBadgeProps) {
  if (!accessType) return null;

  if (accessType === 'beta') {
    return (
      <Badge variant="secondary" className={className} data-testid="badge-beta-access">
        <Calendar className="h-3 w-3 mr-1" />
        Beta Access
      </Badge>
    );
  }

  if (accessType === 'subscription') {
    return (
      <Badge variant="default" className={className} data-testid="badge-subscription">
        <UserCheck className="h-3 w-3 mr-1" />
        Subscribed
      </Badge>
    );
  }

  return null;
}

interface ProtectedFeatureProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  error?: ApiError | Error | null;
}

export function ProtectedFeature({ children, fallback, error }: ProtectedFeatureProps) {
  if (error) {
    return fallback || <AccessControl error={error} />;
  }

  return <>{children}</>;
}