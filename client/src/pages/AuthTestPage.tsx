import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  ShieldCheck, 
  ShieldX, 
  User, 
  CreditCard, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle
} from "lucide-react";
import { AccessControl, AccessStatusBadge } from "@/components/AccessControl";
import { apiRequest, queryClient, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AuthTestStatusResponse, ProtectedFeatureResponse, AuthTestScenariosResponse } from "@shared/schema";

export default function AuthTestPage() {
  const { toast } = useToast();
  const [selectedScenario, setSelectedScenario] = useState<string>("");

  // Query user auth status
  const { data: authStatus, isLoading: authLoading, error: authError, refetch: refetchAuth } = useQuery<AuthTestStatusResponse>({
    queryKey: ['/api/test/auth-status'],
    refetchInterval: false,
    retry: false,
  });

  // Query available test scenarios
  const { data: scenarios } = useQuery<AuthTestScenariosResponse>({
    queryKey: ['/api/test/auth-scenarios'],
    refetchInterval: false,
  });

  // Test protected feature access
  const { data: protectedResult, error: protectedError, refetch: testProtectedFeature } = useQuery<ProtectedFeatureResponse>({
    queryKey: ['/api/test/protected-feature'],
    enabled: false, // Only run when manually triggered
    retry: false,
  });

  // Mutations for setting user status
  const setUserStatusMutation = useMutation({
    mutationFn: async ({ status, reason }: { status: string; reason?: string }) => {
      if (!authStatus?.userId) throw new Error('No user ID available');
      
      const response = await apiRequest('POST', '/api/test/set-user-status', {
        userId: authStatus.userId,
        status,
        reason,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "User status updated", description: "Authorization status has been changed." });
      refetchAuth();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Mutation for setting beta access
  const setBetaAccessMutation = useMutation({
    mutationFn: async ({ betaTester, daysFromNow }: { betaTester: boolean; daysFromNow?: number }) => {
      if (!authStatus?.userId) throw new Error('No user ID available');
      
      const response = await apiRequest('POST', '/api/test/set-beta-access', {
        userId: authStatus.userId,
        betaTester,
        daysFromNow,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Beta access updated", description: "Beta access has been changed." });
      refetchAuth();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Mutation for creating test subscription
  const createSubscriptionMutation = useMutation({
    mutationFn: async ({ status, daysFromNow }: { status: string; daysFromNow: number }) => {
      if (!authStatus?.userId) throw new Error('No user ID available');
      
      const response = await apiRequest('POST', '/api/test/create-subscription', {
        userId: authStatus.userId,
        status,
        daysFromNow,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Subscription created", description: "Test subscription has been created." });
      refetchAuth();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const renderAuthorizationStatus = () => {
    if (authLoading) return <div>Loading authorization status...</div>;
    if (authError) return <Alert><AlertDescription>Failed to load auth status: {(authError as Error).message}</AlertDescription></Alert>;
    if (!authStatus) return <div>No authorization data available</div>;

    const { authorization } = authStatus;
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {authorization.authorized ? (
              <ShieldCheck className="h-5 w-5 text-green-500" />
            ) : (
              <ShieldX className="h-5 w-5 text-red-500" />
            )}
            Authorization Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Badge variant={authorization.authorized ? "default" : "destructive"}>
                {authorization.authorized ? "AUTHORIZED" : "DENIED"}
              </Badge>
              {authorization.accessType && (authorization.accessType === 'subscription' || authorization.accessType === 'beta') && (
                <AccessStatusBadge accessType={authorization.accessType} className="ml-2" />
              )}
            </div>
            <div className="text-right">
              <Badge variant="outline">
                User ID: {authStatus.userId.slice(0, 8)}...
              </Badge>
            </div>
          </div>

          {authorization.reason && (
            <Alert variant={authorization.authorized ? "default" : "destructive"}>
              <AlertDescription>{authorization.reason}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <strong>User Status:</strong>
              <Badge variant="outline" className="ml-2">
                {authStatus.userStatus?.status || 'active'}
              </Badge>
            </div>
            <div>
              <strong>Subscription:</strong>
              <Badge variant={authStatus.subscription?.status === 'active' ? "default" : "secondary"} className="ml-2">
                {authStatus.subscription?.status || 'none'}
              </Badge>
            </div>
            <div>
              <strong>Beta Access:</strong>
              <Badge variant={authStatus.hasValidBetaAccess ? "default" : "secondary"} className="ml-2">
                {authStatus.hasValidBetaAccess ? 'active' : 'none'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderQuickActions = () => (
    <Card>
      <CardHeader>
        <CardTitle>Quick Test Actions</CardTitle>
        <CardDescription>Test different authorization scenarios</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUserStatusMutation.mutate({ status: 'active' })}
            data-testid="button-set-active"
          >
            Set Active
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setUserStatusMutation.mutate({ status: 'banned', reason: 'Test ban' })}
            data-testid="button-set-banned"
          >
            Set Banned
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setUserStatusMutation.mutate({ status: 'suspended', reason: 'Test suspension' })}
            data-testid="button-set-suspended"
          >
            Set Suspended
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => testProtectedFeature()}
            data-testid="button-test-access"
          >
            Test Access
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBetaAccessMutation.mutate({ betaTester: true, daysFromNow: 7 })}
            data-testid="button-grant-beta"
          >
            Grant Beta (7 days)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => createSubscriptionMutation.mutate({ status: 'active', daysFromNow: 30 })}
            data-testid="button-create-subscription"
          >
            Create Subscription
          </Button>
        </div>

        {protectedResult && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Protected feature access: SUCCESS - {protectedResult.message}
            </AlertDescription>
          </Alert>
        )}

        {protectedError && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Protected feature access: DENIED - {(protectedError as ApiError).reason || (protectedError as Error).message}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Authorization Testing</h1>
          <p className="text-muted-foreground">
            Test comprehensive access control scenarios
          </p>
        </div>
        <Button onClick={() => refetchAuth()} variant="outline" data-testid="button-refresh">
          Refresh Status
        </Button>
      </div>

      <Tabs defaultValue="status" className="space-y-4">
        <TabsList>
          <TabsTrigger value="status">Current Status</TabsTrigger>
          <TabsTrigger value="actions">Quick Actions</TabsTrigger>
          <TabsTrigger value="scenarios">Test Scenarios</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-4">
          {renderAuthorizationStatus()}
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          {renderQuickActions()}
        </TabsContent>

        <TabsContent value="scenarios" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Scenarios</CardTitle>
              <CardDescription>Predefined scenarios for comprehensive testing</CardDescription>
            </CardHeader>
            <CardContent>
              {scenarios?.scenarios?.map((scenario, index: number) => (
                <div key={index} className="p-4 border rounded-md mb-4">
                  <h4 className="font-semibold">{scenario.name}</h4>
                  <p className="text-sm text-muted-foreground mb-2">{scenario.description}</p>
                  <div className="text-xs text-muted-foreground">
                    Setup: {JSON.stringify(scenario.setup, null, 2)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}