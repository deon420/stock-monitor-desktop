import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useDesktopAuth } from "@/contexts/DesktopAuthContext";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  FullUserProfile, 
  SubscriptionPlan, 
  updateProfileSchema, 
  updateBillingSchema, 
  UpdateProfileRequest,
  UpdateBillingRequest,
  CancelSubscriptionRequest 
} from "@shared/schema";

import { 
  Monitor, 
  User, 
  Mail, 
  Crown, 
  CreditCard, 
  Settings,
  Settings2,
  LogOut,
  ArrowLeft,
  Shield,
  Edit2,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Save,
  X,
  Loader2
} from "lucide-react";

// Local form schemas with validation adjustments for optional fields
const profileFormSchema = updateProfileSchema.extend({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const billingFormSchema = updateBillingSchema.pick({ billingEmail: true });

type ProfileFormData = z.infer<typeof profileFormSchema>;
type BillingFormData = z.infer<typeof billingFormSchema>;

export default function ProfilePage() {
  const { user, isAuthenticated, logout } = useDesktopAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingBilling, setEditingBilling] = useState(false);

  // Queries with proper TypeScript generics - MOVED BEFORE EARLY RETURN
  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery<FullUserProfile>({
    queryKey: ['/api/profile'],
    enabled: isAuthenticated && !!user, // Only run if authenticated
  });

  const { data: plans, isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ['/api/subscription/plans'],
    enabled: isAuthenticated && !!user, // Only run if authenticated
  });

  // Forms with proper hydration - MOVED BEFORE EARLY RETURN  
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
    },
  });

  const billingForm = useForm<BillingFormData>({
    resolver: zodResolver(billingFormSchema),
    defaultValues: {
      billingEmail: '',
    },
  });

  // Mutations using apiRequest - MOVED BEFORE EARLY RETURN TO FIX HOOK ERROR
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData): Promise<FullUserProfile> => {
      const response = await apiRequest('PATCH', '/api/profile', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      toast({ title: "Profile updated successfully" });
      setEditingProfile(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update profile", 
        description: error.message || "Please try again",
        variant: "destructive"
      });
    },
  });

  const updateBillingMutation = useMutation({
    mutationFn: async (data: BillingFormData): Promise<FullUserProfile> => {
      const response = await apiRequest('PATCH', '/api/billing', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      toast({ title: "Billing information updated successfully" });
      setEditingBilling(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update billing information", 
        description: error.message || "Please try again",
        variant: "destructive"
      });
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async (immediate: boolean = false): Promise<FullUserProfile> => {
      const response = await apiRequest('POST', '/api/subscription/cancel', { 
        immediate, 
        reason: 'User requested cancellation' 
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      toast({ title: "Subscription cancelled successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to cancel subscription", 
        description: error.message || "Please try again",
        variant: "destructive"
      });
    },
  });

  // Form hydration effect - reset forms when profile data loads
  useEffect(() => {
    if (profile) {
      profileForm.reset({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
      });
      
      billingForm.reset({
        billingEmail: profile.billingEmail || profile.email || '',
      });
    }
  }, [profile, profileForm, billingForm]);

  // Redirect if not authenticated (moved to useEffect to avoid render side effects)
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setLocation('/');
    }
  }, [isAuthenticated, user, setLocation]);

  // Early return AFTER all hooks are called
  if (!isAuthenticated || !user) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    setLocation('/');
  };

  const handleBackToHome = () => {
    setLocation('/');
  };

  const handleUpgradeClick = () => {
    toast({ 
      title: "Upgrade Coming Soon", 
      description: "Subscription upgrades will be available in a future update." 
    });
  };

  const handleManageBilling = () => {
    toast({ 
      title: "Billing Portal Coming Soon", 
      description: "Full billing management will be available in a future update." 
    });
  };

  const getTierBadgeVariant = (tier: string) => {
    switch (tier) {
      case 'beta': return 'secondary';
      case 'pro': return 'default';
      case 'free': 
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'canceled': 
      case 'cancel_at_period_end': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  if (profileError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md" data-testid="card-profile-error">
          <CardHeader>
            <CardTitle className="text-destructive" data-testid="text-error-title">Error Loading Profile</CardTitle>
            <CardDescription data-testid="text-error-description">
              Please try refreshing the page or contact support if the issue persists.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setLocation('/')} 
              variant="outline" 
              className="w-full"
              data-testid="button-back-to-home-error"
            >
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                    {profileLoading ? (
                      <>
                        <Skeleton className="h-8 w-48 mb-2" />
                        <Skeleton className="h-4 w-32" />
                      </>
                    ) : (
                      <>
                        <CardTitle className="text-2xl" data-testid="text-user-name">
                          {profile?.firstName ? `${profile.firstName} ${profile.lastName || ''}`.trim() : profile?.email}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <span data-testid="text-user-email">{profile?.email}</span>
                        </CardDescription>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {profile?.isAdmin && (
                    <Badge variant="secondary" className="flex items-center gap-1" data-testid="badge-admin">
                      <Shield className="h-3 w-3" />
                      Admin
                    </Badge>
                  )}
                  {profile?.email === 'admin@47supply.com' && (
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={() => setLocation('/admin')}
                      data-testid="button-admin-dashboard"
                    >
                      <Settings2 className="h-4 w-4 mr-2" />
                      Admin Dashboard
                    </Button>
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

          {/* Account Information Card */}
          <Card data-testid="card-account-info">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Account Information
                  </CardTitle>
                  <CardDescription>
                    Manage your personal information
                  </CardDescription>
                </div>
                {!editingProfile && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingProfile(true)}
                    data-testid="button-edit-profile"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {profileLoading ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Skeleton className="h-4 w-20 mb-2" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                    <div>
                      <Skeleton className="h-4 w-20 mb-2" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </div>
                </div>
              ) : editingProfile ? (
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit((data) => updateProfileMutation.mutate(data))} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={profileForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-first-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={profileForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-last-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button 
                        type="submit" 
                        size="sm"
                        disabled={updateProfileMutation.isPending}
                        data-testid="button-save-profile"
                      >
                        {updateProfileMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Changes
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setEditingProfile(false)}
                        data-testid="button-cancel-profile-edit"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">First Name</Label>
                    <p className="text-sm mt-1" data-testid="text-first-name">
                      {profile?.firstName || 'Not set'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Last Name</Label>
                    <p className="text-sm mt-1" data-testid="text-last-name">
                      {profile?.lastName || 'Not set'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Email Address</Label>
                    <p className="text-sm mt-1" data-testid="text-email-address">
                      {profile?.email}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Account Type</Label>
                    <p className="text-sm mt-1" data-testid="text-account-type">
                      {profile?.isAdmin ? 'Administrator' : 'Standard User'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subscription Plan Card */}
          <Card data-testid="card-subscription-plan">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Subscription Plan
              </CardTitle>
              <CardDescription>
                Your current plan and subscription status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profileLoading ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Skeleton className="h-6 w-32 mb-2" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium flex items-center gap-2">
                        Current Plan
                        {profile?.subscription && getStatusIcon(profile.subscription.status)}
                      </h3>
                      <p className="text-sm text-muted-foreground" data-testid="text-subscription-plan">
                        {profile?.subscription?.planName || 'Beta Tester Plan'}
                      </p>
                    </div>
                    <Badge 
                      variant={getTierBadgeVariant(profile?.subscription?.tier || 'beta')}
                      data-testid="badge-plan-tier"
                    >
                      {(profile?.subscription?.tier || 'beta').toUpperCase()}
                    </Badge>
                  </div>

                  {profile?.subscription && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Status:</span>
                        <span data-testid="text-subscription-status" className="capitalize">
                          {profile.subscription.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {profile.subscription.currentPeriodEnd && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {profile.subscription.status === 'cancel_at_period_end' ? 'Ends:' : 'Renews:'}
                          </span>
                          <span data-testid="text-subscription-period-end">
                            {new Date(profile.subscription.currentPeriodEnd).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">Plan Features</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Unlimited product monitoring</li>
                      <li>• Email notifications</li>
                      <li>• Priority support</li>
                      <li>• Advanced settings</li>
                      {profile?.subscription?.tier === 'pro' && (
                        <li>• Premium analytics dashboard</li>
                      )}
                    </ul>
                  </div>

                  <div className="border-t pt-4 flex flex-col sm:flex-row gap-2">
                    {(!profile?.subscription || profile.subscription.tier !== 'pro') && (
                      <Button 
                        className="flex-1" 
                        onClick={handleUpgradeClick}
                        data-testid="button-upgrade-plan"
                      >
                        <Crown className="h-4 w-4 mr-2" />
                        Upgrade Plan
                      </Button>
                    )}
                    
                    {profile?.subscription && profile.subscription.status === 'active' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="flex-1"
                            data-testid="button-cancel-subscription"
                          >
                            Cancel Subscription
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent data-testid="dialog-cancel-subscription">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to cancel your subscription? You'll continue to have access until the end of your current billing period.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-testid="button-cancel-subscription-dialog-cancel">
                              Keep Subscription
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => cancelSubscriptionMutation.mutate(false)}
                              disabled={cancelSubscriptionMutation.isPending}
                              data-testid="button-cancel-subscription-confirm"
                            >
                              {cancelSubscriptionMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : null}
                              Cancel Subscription
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    <Button 
                      variant="outline" 
                      onClick={handleManageBilling}
                      data-testid="button-manage-billing"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Manage Billing
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Billing Information Card */}
          <Card data-testid="card-billing-info">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Billing Information
                  </CardTitle>
                  <CardDescription>
                    Manage your billing preferences
                  </CardDescription>
                </div>
                {!editingBilling && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingBilling(true)}
                    data-testid="button-edit-billing"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {profileLoading ? (
                <div className="space-y-4">
                  <div>
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </div>
              ) : editingBilling ? (
                <Form {...billingForm}>
                  <form onSubmit={billingForm.handleSubmit((data) => updateBillingMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={billingForm.control}
                      name="billingEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Billing Email</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="email" 
                              data-testid="input-billing-email" 
                            />
                          </FormControl>
                          <FormDescription>
                            Receipts and billing notifications will be sent to this email address.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-center space-x-2">
                      <Button 
                        type="submit" 
                        size="sm"
                        disabled={updateBillingMutation.isPending}
                        data-testid="button-save-billing"
                      >
                        {updateBillingMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Changes
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setEditingBilling(false)}
                        data-testid="button-cancel-billing-edit"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Billing Email</Label>
                    <p className="text-sm mt-1" data-testid="text-billing-email">
                      {profile?.billingEmail || profile?.email || 'Not set'}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>Payment method and detailed billing history will be available through the billing portal once Stripe integration is complete.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}