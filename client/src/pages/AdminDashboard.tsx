import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Users, 
  Search, 
  Shield, 
  ShieldX, 
  Clock, 
  CreditCard, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Award,
  UserCheck,
  UserX
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'banned' | 'suspended';
  statusReason?: string;
  subscription?: any;
  hasActiveSubscription: boolean;
  billingEmail?: string;
  billingAddress?: any;
  betaAccess?: {
    betaTester: boolean;
    betaExpiresAt?: string;
    status: 'active' | 'expired' | 'none';
    daysUntilExpiry?: number;
  };
}

interface UserSearchResult {
  users: User[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface AdminStats {
  users: {
    total: number;
    active: number;
    banned: number;
    suspended: number;
  };
  subscriptions: number;
  settings: number;
  memoryUsage: string;
  admins: number;
}

interface SubscriptionOverview {
  overview: {
    total: number;
    active: number;
    canceled: number;
    churnRate: string;
  };
  plans: any[];
  recentSubscriptions: any[];
}

interface BetaTester {
  id: string;
  userId: string;
  betaTester: boolean;
  betaExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'expired' | 'inactive';
  daysUntilExpiry?: number;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    profileImageUrl?: string;
    createdAt: string;
  };
}

interface BetaTestersResponse {
  betaTesters: BetaTester[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  stats: {
    total: number;
    active: number;
    expired: number;
  };
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [billingPhone, setBillingPhone] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  
  // Debounced search values
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedBillingEmail, setDebouncedBillingEmail] = useState("");
  const [debouncedBillingPhone, setDebouncedBillingPhone] = useState("");
  const [actionDialog, setActionDialog] = useState<{
    isOpen: boolean;
    type: 'ban' | 'suspend' | 'activate' | null;
    user: User | null;
  }>({ isOpen: false, type: null, user: null });
  const [actionReason, setActionReason] = useState("");
  const [subscriptionActionDialog, setSubscriptionActionDialog] = useState<{
    isOpen: boolean;
    type: 'cancel' | 'resume' | 'changePlan' | null;
    subscription: any | null;
  }>({ isOpen: false, type: null, subscription: null });
  const [newPlanId, setNewPlanId] = useState("");
  
  // Beta access management state
  const [betaAccessDialog, setBetaAccessDialog] = useState<{
    isOpen: boolean;
    type: 'grant' | 'revoke' | null;
    user: User | null;
  }>({ isOpen: false, type: null, user: null });
  const [betaExpirationDate, setBetaExpirationDate] = useState<string>("");
  const [betaStatusFilter, setBetaStatusFilter] = useState("all");
  const [betaTestersPage, setBetaTestersPage] = useState(1);

  // Debounce search inputs
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedBillingEmail(billingEmail);
    }, 300);
    return () => clearTimeout(timer);
  }, [billingEmail]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedBillingPhone(billingPhone);
    }, 300);
    return () => clearTimeout(timer);
  }, [billingPhone]);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, debouncedBillingEmail, debouncedBillingPhone, statusFilter]);
  
  // Reset beta testers page when filter changes
  useEffect(() => {
    setBetaTestersPage(1);
  }, [betaStatusFilter]);

  // Fetch admin stats
  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch users with search and pagination
  const { data: usersData, isLoading: usersLoading } = useQuery<UserSearchResult>({
    queryKey: ['/api/admin/users', {
      page: currentPage,
      limit: 10,
      search: debouncedSearch || undefined,
      billingEmail: debouncedBillingEmail || undefined,
      billingPhone: debouncedBillingPhone || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined
    }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (debouncedBillingEmail) params.set('billingEmail', debouncedBillingEmail);
      if (debouncedBillingPhone) params.set('billingPhone', debouncedBillingPhone);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      
      const response = await fetch(`/api/admin/users?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return response.json();
    },
  });

  // Fetch subscription overview
  const { data: subscriptionData, isLoading: subscriptionLoading } = useQuery<SubscriptionOverview>({
    queryKey: ['/api/admin/subscriptions'],
    refetchInterval: 60000, // Refresh every minute
  });
  
  // Fetch beta testers data
  const { data: betaTestersData, isLoading: betaTestersLoading } = useQuery<BetaTestersResponse>({
    queryKey: ['/api/admin/beta-testers', {
      page: betaTestersPage,
      limit: 20,
      status: betaStatusFilter !== 'all' ? betaStatusFilter : undefined
    }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: betaTestersPage.toString(),
        limit: '20',
      });
      if (betaStatusFilter !== 'all') params.set('status', betaStatusFilter);
      
      const response = await fetch(`/api/admin/beta-testers?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch beta testers');
      }
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // User status update mutation
  const updateUserStatusMutation = useMutation({
    mutationFn: async ({ userId, status, reason }: { userId: string; status: string; reason?: string }) => {
      const response = await apiRequest('PATCH', `/api/admin/users/${userId}/status`, { status, reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/beta-testers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({
        title: "Success",
        description: "User status updated successfully",
      });
      setActionDialog({ isOpen: false, type: null, user: null });
      setActionReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user status",
        variant: "destructive",
      });
    },
  });

  // Subscription management mutations
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async ({ subscriptionId, reason }: { subscriptionId: string; reason?: string }) => {
      const response = await apiRequest('POST', `/api/admin/subscriptions/${subscriptionId}/cancel`, { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({
        title: "Success",
        description: "Subscription canceled successfully",
      });
      setSubscriptionActionDialog({ isOpen: false, type: null, subscription: null });
      setActionReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
    },
  });

  const resumeSubscriptionMutation = useMutation({
    mutationFn: async ({ subscriptionId }: { subscriptionId: string }) => {
      const response = await apiRequest('POST', `/api/admin/subscriptions/${subscriptionId}/resume`, undefined);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({
        title: "Success",
        description: "Subscription resumed successfully",
      });
      setSubscriptionActionDialog({ isOpen: false, type: null, subscription: null });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resume subscription",
        variant: "destructive",
      });
    },
  });

  const changePlanMutation = useMutation({
    mutationFn: async ({ subscriptionId, planId }: { subscriptionId: string; planId: string }) => {
      const response = await apiRequest('PATCH', `/api/admin/subscriptions/${subscriptionId}/plan`, { planId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({
        title: "Success",
        description: "Subscription plan changed successfully",
      });
      setSubscriptionActionDialog({ isOpen: false, type: null, subscription: null });
      setNewPlanId("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change subscription plan",
        variant: "destructive",
      });
    },
  });
  
  // Beta access management mutations
  const grantBetaAccessMutation = useMutation({
    mutationFn: async ({ userId, expiresAt }: { userId: string; expiresAt?: string }) => {
      const response = await apiRequest('POST', `/api/admin/users/${userId}/beta-access`, { expiresAt });
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all user-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/beta-testers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({
        title: "Success",
        description: "Beta access granted successfully",
      });
      setBetaAccessDialog({ isOpen: false, type: null, user: null });
      setBetaExpirationDate("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to grant beta access",
        variant: "destructive",
      });
    },
  });
  
  const revokeBetaAccessMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const response = await apiRequest('DELETE', `/api/admin/users/${userId}/beta-access`, undefined);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all user-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/beta-testers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({
        title: "Success",
        description: "Beta access revoked successfully",
      });
      setBetaAccessDialog({ isOpen: false, type: null, user: null });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to revoke beta access",
        variant: "destructive",
      });
    },
  });

  const handleUserAction = (type: 'ban' | 'suspend' | 'activate', user: User) => {
    setActionDialog({ isOpen: true, type, user });
  };

  const confirmUserAction = () => {
    if (!actionDialog.user || !actionDialog.type) return;

    const statusMap = {
      ban: 'banned',
      suspend: 'suspended',
      activate: 'active',
    };

    updateUserStatusMutation.mutate({
      userId: actionDialog.user.id,
      status: statusMap[actionDialog.type],
      reason: actionReason || undefined,
    });
  };

  const handleSubscriptionAction = (type: 'cancel' | 'resume' | 'changePlan', subscription: any) => {
    setSubscriptionActionDialog({ isOpen: true, type, subscription });
  };

  const confirmSubscriptionAction = () => {
    if (!subscriptionActionDialog.subscription || !subscriptionActionDialog.type) return;

    const subscriptionId = subscriptionActionDialog.subscription.subscription.id;

    switch (subscriptionActionDialog.type) {
      case 'cancel':
        cancelSubscriptionMutation.mutate({
          subscriptionId,
          reason: actionReason || undefined,
        });
        break;
      case 'resume':
        resumeSubscriptionMutation.mutate({ subscriptionId });
        break;
      case 'changePlan':
        if (newPlanId) {
          changePlanMutation.mutate({ subscriptionId, planId: newPlanId });
        }
        break;
    }
  };

  const getSubscriptionActionButtons = (subscription: any) => {
    const status = subscription.subscription.status;
    
    if (status === 'active') {
      return (
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleSubscriptionAction('cancel', subscription)}
            data-testid={`button-cancel-subscription-${subscription.subscription.id}`}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSubscriptionAction('changePlan', subscription)}
            data-testid={`button-change-plan-${subscription.subscription.id}`}
          >
            Change Plan
          </Button>
        </div>
      );
    } else if (status === 'canceled') {
      return (
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => handleSubscriptionAction('resume', subscription)}
            data-testid={`button-resume-subscription-${subscription.subscription.id}`}
          >
            Resume
          </Button>
        </div>
      );
    }
    return null;
  };

  const getBetaStatusBadge = (user: User) => {
    if (!user.betaAccess || !user.betaAccess.betaTester) {
      return (
        <Badge variant="outline" className="text-xs">
          No Beta Access
        </Badge>
      );
    }
    
    const status = user.betaAccess.status;
    const daysUntilExpiry = user.betaAccess.daysUntilExpiry;
    
    if (status === 'active') {
      return (
        <Badge variant="default" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
          <Award className="w-3 h-3 mr-1" />
          Beta Active {daysUntilExpiry ? `(${daysUntilExpiry}d left)` : ''}
        </Badge>
      );
    } else if (status === 'expired') {
      return (
        <Badge variant="destructive" className="text-xs">
          <Clock className="w-3 h-3 mr-1" />
          Beta Expired
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="text-xs">
        Beta Inactive
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" data-testid={`badge-active`}><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'banned':
        return <Badge variant="destructive" data-testid={`badge-banned`}><XCircle className="w-3 h-3 mr-1" />Banned</Badge>;
      case 'suspended':
        return <Badge variant="secondary" data-testid={`badge-suspended`}><AlertTriangle className="w-3 h-3 mr-1" />Suspended</Badge>;
      default:
        return <Badge variant="outline" data-testid={`badge-unknown`}>Unknown</Badge>;
    }
  };

  const getBetaActionButtons = (user: User) => {
    const hasBetaAccess = user.betaAccess?.betaTester && user.betaAccess?.status === 'active';
    
    return (
      <div className="flex gap-2">
        {!hasBetaAccess ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBetaAccessDialog({ isOpen: true, type: 'grant', user })}
            data-testid={`button-grant-beta-${user.id}`}
          >
            <UserCheck className="w-4 h-4" />
            Grant Beta
          </Button>
        ) : (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setBetaAccessDialog({ isOpen: true, type: 'revoke', user })}
            data-testid={`button-revoke-beta-${user.id}`}
          >
            <UserX className="w-4 h-4" />
            Revoke Beta
          </Button>
        )}
      </div>
    );
  };

  const getActionButtons = (user: User) => {
    if (user.status === 'active') {
      return (
        <div className="flex gap-2 flex-wrap">
          {getBetaActionButtons(user)}
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleUserAction('ban', user)}
            data-testid={`button-ban-${user.id}`}
          >
            <ShieldX className="w-3 h-3 mr-1" />
            Ban
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleUserAction('suspend', user)}
            data-testid={`button-suspend-${user.id}`}
          >
            <Clock className="w-3 h-3 mr-1" />
            Suspend
          </Button>
        </div>
      );
    } else {
      return (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => handleUserAction('activate', user)}
            data-testid={`button-activate-${user.id}`}
          >
            <Shield className="w-3 h-3 mr-1" />
            Activate
          </Button>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            <h1 className="text-xl font-semibold" data-testid="heading-admin-dashboard">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="container py-6 space-y-6">
        {/* Admin Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card data-testid="card-total-users">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-users">
                {statsLoading ? "..." : stats?.users.total || 0}
              </div>
              <p className="text-xs text-muted-foreground">Registered accounts</p>
            </CardContent>
          </Card>

          <Card data-testid="card-active-users">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-active-users">
                {statsLoading ? "..." : stats?.users.active || 0}
              </div>
              <p className="text-xs text-muted-foreground">Good standing</p>
            </CardContent>
          </Card>

          <Card data-testid="card-banned-users">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Banned Users</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600" data-testid="text-banned-users">
                {statsLoading ? "..." : stats?.users.banned || 0}
              </div>
              <p className="text-xs text-muted-foreground">Permanently blocked</p>
            </CardContent>
          </Card>

          <Card data-testid="card-subscriptions">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-subscriptions">
                {subscriptionLoading ? "..." : subscriptionData?.overview.active || 0}
              </div>
              <p className="text-xs text-muted-foreground">Active payments</p>
            </CardContent>
          </Card>

          <Card data-testid="card-churn-rate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-churn-rate">
                {subscriptionLoading ? "..." : `${subscriptionData?.overview.churnRate || 0}%`}
              </div>
              <p className="text-xs text-muted-foreground">Cancellation rate</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users" data-testid="tab-users">User Management</TabsTrigger>
            <TabsTrigger value="subscriptions" data-testid="tab-subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="beta-testers" data-testid="tab-beta-testers">Beta Testers</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            {/* Search and Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Search Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Search by email, name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                        data-testid="input-user-search"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-40" data-testid="select-status-filter">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="banned">Banned</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Billing Search Fields */}
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label htmlFor="billing-email-search" className="text-sm font-medium">Billing Email Search</Label>
                      <Input
                        id="billing-email-search"
                        placeholder="Search by billing email..."
                        value={billingEmail}
                        onChange={(e) => setBillingEmail(e.target.value)}
                        data-testid="input-billing-email-search"
                        className="mt-1"
                      />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="billing-phone-search" className="text-sm font-medium">Billing Phone Search</Label>
                      <Input
                        id="billing-phone-search"
                        placeholder="Search by billing phone..."
                        value={billingPhone}
                        onChange={(e) => setBillingPhone(e.target.value)}
                        data-testid="input-billing-phone-search"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Users List */}
            <Card>
              <CardHeader>
                <CardTitle>Users ({usersData?.pagination.total || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="text-center py-8" data-testid="loading-users">Loading users...</div>
                ) : (
                  <div className="space-y-4">
                    {usersData?.users.map((user) => (
                      <div key={user.id} className="border rounded-lg p-4 hover-elevate" data-testid={`user-card-${user.id}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={user.profileImageUrl} />
                              <AvatarFallback data-testid={`avatar-${user.id}`}>
                                {user.firstName?.[0] || user.email[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium" data-testid={`text-user-name-${user.id}`}>
                                {user.firstName && user.lastName ? 
                                  `${user.firstName} ${user.lastName}` : 
                                  user.email
                                }
                              </div>
                              <div className="text-sm text-muted-foreground" data-testid={`text-user-email-${user.id}`}>
                                {user.email}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Joined {new Date(user.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              {getStatusBadge(user.status)}
                              {user.statusReason && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Reason: {user.statusReason}
                                </div>
                              )}
                              {user.hasActiveSubscription && (
                                <Badge variant="outline" className="mt-1">
                                  <CreditCard className="w-3 h-3 mr-1" />
                                  Subscriber
                                </Badge>
                              )}
                              <div className="mt-1">
                                {getBetaStatusBadge(user)}
                              </div>
                            </div>
                            {getActionButtons(user)}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Pagination */}
                    {usersData && usersData.pagination.totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          data-testid="button-prev-page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground" data-testid="text-pagination">
                          Page {currentPage} of {usersData.pagination.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(usersData.pagination.totalPages, p + 1))}
                          disabled={currentPage === usersData.pagination.totalPages}
                          data-testid="button-next-page"
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscriptions" className="space-y-4">
            {/* Subscription Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card data-testid="card-total-subscriptions">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-subscriptions">
                    {subscriptionLoading ? "..." : subscriptionData?.overview.total || 0}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-active-subscriptions">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Active</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600" data-testid="text-active-subscriptions">
                    {subscriptionLoading ? "..." : subscriptionData?.overview.active || 0}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-canceled-subscriptions">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Canceled</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600" data-testid="text-canceled-subscriptions">
                    {subscriptionLoading ? "..." : subscriptionData?.overview.canceled || 0}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-churn-rate-detail">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-churn-rate-detail">
                    {subscriptionLoading ? "..." : `${subscriptionData?.overview.churnRate || 0}%`}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Subscriptions */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Subscriptions</CardTitle>
              </CardHeader>
              <CardContent>
                {subscriptionLoading ? (
                  <div className="text-center py-8" data-testid="loading-subscriptions">Loading subscriptions...</div>
                ) : (
                  <div className="space-y-3">
                    {subscriptionData?.recentSubscriptions.map((sub, index) => (
                      <div key={index} className="border rounded p-3" data-testid={`subscription-${index}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium" data-testid={`text-subscription-user-${index}`}>
                              {sub.user?.firstName && sub.user?.lastName ? 
                                `${sub.user.firstName} ${sub.user.lastName}` : 
                                sub.user?.email || 'Unknown User'
                              }
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {sub.user?.email}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Plan: {sub.subscription.planId} • Created: {new Date(sub.subscription.createdAt).toLocaleDateString()}
                            </div>
                            {getSubscriptionActionButtons(sub)}
                          </div>
                          <div className="text-right">
                            <Badge variant={sub.subscription.status === 'active' ? 'default' : 'secondary'}>
                              {sub.subscription.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="beta-testers" className="space-y-4">
            {/* Beta Testers Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card data-testid="card-total-beta-testers">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Beta Testers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-beta-testers">
                    {betaTestersLoading ? "..." : betaTestersData?.stats.total || 0}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-active-beta-testers">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Active Beta Testers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600" data-testid="text-active-beta-testers">
                    {betaTestersLoading ? "..." : betaTestersData?.stats.active || 0}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-expired-beta-testers">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Expired Beta Testers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600" data-testid="text-expired-beta-testers">
                    {betaTestersLoading ? "..." : betaTestersData?.stats.expired || 0}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Beta Testers List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Beta Testers</CardTitle>
                  <div className="flex items-center gap-2">
                    <Select value={betaStatusFilter} onValueChange={setBetaStatusFilter}>
                      <SelectTrigger className="w-[150px]" data-testid="select-beta-status-filter">
                        <SelectValue placeholder="Filter status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {betaTestersLoading ? (
                  <div className="text-center py-8" data-testid="loading-beta-testers">Loading beta testers...</div>
                ) : betaTestersData?.betaTesters.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="no-beta-testers">
                    No beta testers found
                  </div>
                ) : (
                  <div className="space-y-3">
                    {betaTestersData?.betaTesters.map((betaTester) => (
                      <div key={betaTester.id} className="border rounded p-3" data-testid={`beta-tester-${betaTester.userId}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={betaTester.user.profileImageUrl} />
                              <AvatarFallback>
                                {betaTester.user.firstName?.[0] || betaTester.user.email[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="font-medium" data-testid={`text-beta-tester-name-${betaTester.userId}`}>
                                {betaTester.user.firstName && betaTester.user.lastName ? 
                                  `${betaTester.user.firstName} ${betaTester.user.lastName}` : 
                                  betaTester.user.email
                                }
                              </div>
                              <div className="text-sm text-muted-foreground" data-testid={`text-beta-tester-email-${betaTester.userId}`}>
                                {betaTester.user.email}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Beta granted: {new Date(betaTester.createdAt).toLocaleDateString()}
                                {betaTester.betaExpiresAt && (
                                  <> • Expires: {new Date(betaTester.betaExpiresAt).toLocaleDateString()}</>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <Badge 
                                variant={betaTester.status === 'active' ? 'default' : 'destructive'}
                                className={betaTester.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' : ''}
                                data-testid={`badge-beta-status-${betaTester.userId}`}
                              >
                                <Award className="w-3 h-3 mr-1" />
                                {betaTester.status === 'active' ? 'Active' : betaTester.status === 'expired' ? 'Expired' : 'Inactive'}
                                {betaTester.status === 'active' && betaTester.daysUntilExpiry && (
                                  <> ({betaTester.daysUntilExpiry}d left)</>
                                )}
                              </Badge>
                            </div>
                            <div className="flex gap-2">
                              {betaTester.status === 'active' ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setBetaAccessDialog({ isOpen: true, type: 'revoke', user: { id: betaTester.userId, email: betaTester.user.email } as User })}
                                  data-testid={`button-revoke-beta-access-${betaTester.userId}`}
                                >
                                  <UserX className="w-4 h-4" />
                                  Revoke
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setBetaAccessDialog({ isOpen: true, type: 'grant', user: { id: betaTester.userId, email: betaTester.user.email } as User })}
                                  data-testid={`button-grant-beta-access-${betaTester.userId}`}
                                >
                                  <UserCheck className="w-4 h-4" />
                                  Grant
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Beta Testers Pagination */}
                    {betaTestersData && betaTestersData.pagination.totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBetaTestersPage(p => Math.max(1, p - 1))}
                          disabled={betaTestersPage === 1}
                          data-testid="button-prev-beta-page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground" data-testid="text-beta-pagination">
                          Page {betaTestersPage} of {betaTestersData.pagination.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBetaTestersPage(p => Math.min(betaTestersData.pagination.totalPages, p + 1))}
                          disabled={betaTestersPage === betaTestersData.pagination.totalPages}
                          data-testid="button-next-beta-page"
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionDialog.isOpen} onOpenChange={(open) => setActionDialog({ isOpen: open, type: null, user: null })}>
        <DialogContent data-testid="dialog-user-action">
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === 'ban' && 'Ban User'}
              {actionDialog.type === 'suspend' && 'Suspend User'}
              {actionDialog.type === 'activate' && 'Activate User'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Are you sure you want to {actionDialog.type} user {actionDialog.user?.email}?
            </p>
            {(actionDialog.type === 'ban' || actionDialog.type === 'suspend') && (
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason for this action..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  data-testid="textarea-action-reason"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog({ isOpen: false, type: null, user: null })}
              data-testid="button-cancel-action"
            >
              Cancel
            </Button>
            <Button
              variant={actionDialog.type === 'activate' ? 'default' : 'destructive'}
              onClick={confirmUserAction}
              disabled={updateUserStatusMutation.isPending}
              data-testid="button-confirm-action"
            >
              {updateUserStatusMutation.isPending ? 'Processing...' : `Confirm ${actionDialog.type}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscription Action Confirmation Dialog */}
      <Dialog open={subscriptionActionDialog.isOpen} onOpenChange={(open) => setSubscriptionActionDialog({ isOpen: open, type: null, subscription: null })}>
        <DialogContent data-testid="dialog-subscription-action">
          <DialogHeader>
            <DialogTitle>
              {subscriptionActionDialog.type === 'cancel' && 'Cancel Subscription'}
              {subscriptionActionDialog.type === 'resume' && 'Resume Subscription'}
              {subscriptionActionDialog.type === 'changePlan' && 'Change Subscription Plan'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Are you sure you want to {subscriptionActionDialog.type} subscription for user {subscriptionActionDialog.subscription?.user?.email}?
            </p>
            
            {subscriptionActionDialog.type === 'cancel' && (
              <div className="space-y-2">
                <Label htmlFor="cancel-reason">Reason (optional)</Label>
                <Textarea
                  id="cancel-reason"
                  placeholder="Enter reason for cancellation..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  data-testid="textarea-cancel-reason"
                />
              </div>
            )}
            
            {subscriptionActionDialog.type === 'changePlan' && (
              <div className="space-y-2">
                <Label htmlFor="new-plan">Select New Plan</Label>
                <Select value={newPlanId} onValueChange={setNewPlanId}>
                  <SelectTrigger data-testid="select-new-plan">
                    <SelectValue placeholder="Choose new plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {subscriptionData?.plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - ${plan.monthlyPrice}/month
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSubscriptionActionDialog({ isOpen: false, type: null, subscription: null });
                setActionReason("");
                setNewPlanId("");
              }}
              data-testid="button-cancel-subscription-action"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmSubscriptionAction}
              disabled={
                updateUserStatusMutation.isPending || 
                cancelSubscriptionMutation.isPending ||
                resumeSubscriptionMutation.isPending ||
                changePlanMutation.isPending ||
                (subscriptionActionDialog.type === 'changePlan' && !newPlanId)
              }
              data-testid="button-confirm-subscription-action"
            >
              {(cancelSubscriptionMutation.isPending || resumeSubscriptionMutation.isPending || changePlanMutation.isPending) ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Beta Access Management Dialog */}
      <Dialog open={betaAccessDialog.isOpen} onOpenChange={(open) => setBetaAccessDialog({ isOpen: open, type: null, user: null })}>
        <DialogContent data-testid="dialog-beta-access">
          <DialogHeader>
            <DialogTitle>
              {betaAccessDialog.type === 'grant' && 'Grant Beta Access'}
              {betaAccessDialog.type === 'revoke' && 'Revoke Beta Access'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {betaAccessDialog.type === 'grant' ? (
              <>
                <p>
                  Grant beta access to user <strong>{betaAccessDialog.user?.email}</strong>?
                </p>
                <div className="space-y-2">
                  <Label htmlFor="beta-expiration">Expiration Date</Label>
                  <Input
                    id="beta-expiration"
                    type="date"
                    value={betaExpirationDate}
                    onChange={(e) => setBetaExpirationDate(e.target.value)}
                    min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]} // Tomorrow
                    max={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} // 1 year from now
                    data-testid="input-beta-expiration"
                  />
                  <div className="text-sm text-muted-foreground">
                    Leave empty for 30 days default. Maximum 1 year.
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBetaExpirationDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])}
                    data-testid="button-beta-1-week"
                  >
                    1 Week
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBetaExpirationDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])}
                    data-testid="button-beta-1-month"
                  >
                    1 Month
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBetaExpirationDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])}
                    data-testid="button-beta-3-months"
                  >
                    3 Months
                  </Button>
                </div>
              </>
            ) : (
              <p>
                Are you sure you want to revoke beta access for user <strong>{betaAccessDialog.user?.email}</strong>?
                This action will immediately remove their beta testing privileges.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBetaAccessDialog({ isOpen: false, type: null, user: null })}
              data-testid="button-cancel-beta-action"
            >
              Cancel
            </Button>
            <Button
              variant={betaAccessDialog.type === 'grant' ? 'default' : 'destructive'}
              onClick={() => {
                if (betaAccessDialog.type === 'grant' && betaAccessDialog.user) {
                  const expiresAt = betaExpirationDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                  grantBetaAccessMutation.mutate({ 
                    userId: betaAccessDialog.user.id, 
                    expiresAt 
                  });
                } else if (betaAccessDialog.type === 'revoke' && betaAccessDialog.user) {
                  revokeBetaAccessMutation.mutate({ 
                    userId: betaAccessDialog.user.id 
                  });
                }
              }}
              disabled={grantBetaAccessMutation.isPending || revokeBetaAccessMutation.isPending}
              data-testid="button-confirm-beta-action"
            >
              {(grantBetaAccessMutation.isPending || revokeBetaAccessMutation.isPending) ? 'Processing...' : 
                betaAccessDialog.type === 'grant' ? 'Grant Beta Access' : 'Revoke Beta Access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}