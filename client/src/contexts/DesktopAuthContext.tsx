import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { setDesktopApiRequest } from "@/lib/queryClient";
import type { AuthResponse, UserProfile } from "@shared/schema";
import type { ElectronAPI } from "@/types/electron";

// Type guard for desktop environment - defined at module level
const isElectronApp = (): boolean => {
  return typeof window !== 'undefined' && 'electronAPI' in window;
};

// Type definitions for desktop electron API
interface ElectronAuthData {
  accessToken: string;
  refreshToken?: string | null;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    isAdmin: boolean;
  };
  rememberMe?: boolean;
  timestamp?: number;
}

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isAdmin: boolean;
}

interface DesktopAuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isKeychainAvailable: boolean;
  login: (authResponse: AuthResponse, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  checkAuthStatus: () => Promise<void>;
  apiRequest: (url: string, options?: RequestInit) => Promise<Response>;
  clearStoredCredentials: () => Promise<void>;
}

const DesktopAuthContext = createContext<DesktopAuthContextType | undefined>(undefined);

export function useDesktopAuth() {
  const context = useContext(DesktopAuthContext);
  if (context === undefined) {
    throw new Error('useDesktopAuth must be used within a DesktopAuthProvider');
  }
  return context;
}

interface DesktopAuthProviderProps {
  children: React.ReactNode;
}

export function DesktopAuthProvider({ children }: DesktopAuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isKeychainAvailable, setIsKeychainAvailable] = useState(false);

  // Single-flight token refresh protection
  const [refreshInProgress, setRefreshInProgress] = useState(false);
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null);

  // Check if we're in desktop environment
  const isDesktopApp = isElectronApp();

  // Check keychain availability on mount
  useEffect(() => {
    const checkKeychainStatus = async () => {
      if (!isDesktopApp) {
        setIsKeychainAvailable(false);
        return;
      }

      try {
        const electronAPI = window.electronAPI as ElectronAPI | undefined;
        if (electronAPI?.keychainHelper?.isAvailable) {
          const available = await electronAPI.keychainHelper.isAvailable();
          setIsKeychainAvailable(available);
          console.log(`[DesktopAuth] Keychain ${available ? 'available' : 'unavailable'} on this system`);
        } else {
          setIsKeychainAvailable(false);
        }
      } catch (error) {
        console.warn('[DesktopAuth] Failed to check keychain availability:', error);
        setIsKeychainAvailable(false);
      }
    };

    checkKeychainStatus();
  }, [isDesktopApp]);

  const login = useCallback(async (authResponse: AuthResponse, rememberMe: boolean = false) => {
    console.log("[DesktopAuth] Login successful, persisting tokens securely");
    
    if (!isDesktopApp) {
      console.warn('[DesktopAuth] Not in desktop environment, skipping keychain storage');
      setUser(authResponse.user);
      setIsLoading(false);
      return;
    }

    try {
      const electronAPI = window.electronAPI as ElectronAPI | undefined;
      if (electronAPI?.keychainHelper?.storeAuthSafe) {
        // Use secure keychain storage
        const result = await electronAPI.keychainHelper.storeAuthSafe(
          authResponse.user.email,
          authResponse,
          rememberMe
        );
        
        if (result.success) {
          console.log(`[DesktopAuth] Auth data stored securely ${result.fallback ? '(fallback used)' : '(keychain)'}`);
        } else {
          console.warn('[DesktopAuth] Failed to store auth data securely');
        }
      } else {
        console.error('[DesktopAuth] Keychain helper not available and no secure fallback possible');
        // NO INSECURE FALLBACKS - tokens stay in memory only
        throw new Error('Secure storage unavailable - cannot persist authentication data');
      }
    } catch (error) {
      console.error('[DesktopAuth] Error storing auth data:', error);
      // Continue with login even if storage fails
    }
    
    // Set user state
    setUser(authResponse.user);
    setIsLoading(false);
  }, [isDesktopApp]);

  const logout = useCallback(async () => {
    console.log("[DesktopAuth] Logging out user");
    
    if (!isDesktopApp) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    const currentUserId = user?.email;
    
    try {
      // Get refresh token from keychain for logout API call
      const electronAPI = (window as any).electronAPI;
      let refreshToken = null;
      
      if (currentUserId && electronAPI?.keychainHelper?.getAuthSafe) {
        const authData = await electronAPI.keychainHelper.getAuthSafe(currentUserId);
        refreshToken = authData?.refreshToken;
      }
      
      // Call logout endpoint to invalidate refresh token
      if (refreshToken) {
        if (electronAPI?.apiRequest) {
          await electronAPI.apiRequest("/api/auth/logout", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Refresh ${refreshToken}`,
            },
          });
        } else {
          await fetch("/api/auth/logout", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Refresh ${refreshToken}`,
            },
          });
        }
      }
    } catch (error) {
      console.warn("[DesktopAuth] Logout API call failed:", error);
    }

    // Clear keychain auth data
    if (currentUserId) {
      try {
        const electronAPI = window.electronAPI as ElectronAPI | undefined;
        if (electronAPI?.keychainHelper?.clearAuthSafe) {
          await electronAPI.keychainHelper.clearAuthSafe(currentUserId);
          console.log('[DesktopAuth] Keychain auth data cleared');
        }
      } catch (error) {
        console.warn('[DesktopAuth] Failed to clear keychain data:', error);
      }
    }
    
    setUser(null);
    setIsLoading(false);
  }, [isDesktopApp, user]);

  const refreshToken = useCallback(async (retryCount = 0): Promise<boolean> => {
    if (!isDesktopApp) return false;

    const currentUserId = user?.email;
    if (!currentUserId) {
      console.log("[DesktopAuth] No user ID available for token refresh");
      return false;
    }

    // Single-flight protection: return existing refresh promise if one is already in progress
    if (refreshPromiseRef.current) {
      console.log("[DesktopAuth] Refresh already in progress, waiting for existing promise");
      try {
        return await refreshPromiseRef.current;
      } catch (error) {
        console.error("[DesktopAuth] Existing refresh promise failed:", error);
        return false;
      }
    }

    // Create new refresh promise with single-flight protection
    const refreshPromise = (async (): Promise<boolean> => {
      setRefreshInProgress(true);
      console.log(`[DesktopAuth] Starting token refresh attempt ${retryCount + 1}`);

      let storedRefreshToken: string | null = null;
      
      try {
        // Get refresh token from keychain
        const electronAPI = window.electronAPI as ElectronAPI | undefined;
        if (electronAPI?.keychainHelper?.getAuthSafe) {
          const authData = await electronAPI.keychainHelper.getAuthSafe(currentUserId);
          storedRefreshToken = authData?.refreshToken ?? null;
        }
        
        if (!storedRefreshToken) {
          console.log("[DesktopAuth] No refresh token available in keychain");
          return false;
        }

        console.log("[DesktopAuth] Attempting token refresh with keychain token");
        
        let response: Response | any;
        
        if (electronAPI?.apiRequest) {
          response = await electronAPI.apiRequest("/api/auth/refresh", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Refresh ${storedRefreshToken}`,
              "X-Auth-Mode": "tokens", // Request tokens for desktop
            },
          });
        } else {
          response = await fetch("/api/auth/refresh", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Refresh ${storedRefreshToken}`,
              "X-Auth-Mode": "tokens", // Request tokens for desktop
            },
          });
        }

        // Handle different response scenarios
        if (response.status === 401 || response.status === 403) {
          console.warn("[DesktopAuth] Refresh token expired or invalid");
          await logout(); // Clear invalid tokens
          return false;
        }

        if (!response.ok) {
          // Implement exponential backoff for server errors
          if (response.status >= 500 && retryCount < 3) {
            const backoffDelay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
            console.warn(`[DesktopAuth] Server error (${response.status}), retrying in ${backoffDelay}ms`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            return await refreshToken(retryCount + 1);
          }
          
          console.error(`[DesktopAuth] Token refresh failed with status: ${response.status}`);
          await logout(); // Clear invalid tokens after max retries
          return false;
        }

        const authResponse = await response.json() as AuthResponse;
        
        // Update stored tokens in keychain with new tokens
        if (electronAPI?.keychainHelper?.storeAuthSafe) {
          await electronAPI.keychainHelper.storeAuthSafe(
            currentUserId,
            authResponse,
            true // Keep remember me setting
          );
          console.log("[DesktopAuth] New tokens stored securely in keychain");
        }

        // Update user data if user info changed
        setUser(authResponse.user);
        
        console.log("[DesktopAuth] Token refresh successful");
        return true;

      } catch (error) {
        if (retryCount < 3) {
          const backoffDelay = Math.pow(2, retryCount) * 1000;
          console.warn(`[DesktopAuth] Network error during refresh, retrying in ${backoffDelay}ms:`, error);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          return await refreshToken(retryCount + 1);
        }
        
        console.error("[DesktopAuth] Token refresh error after max retries:", error);
        await logout(); // Clear invalid tokens after max retries
        return false;
      }
    })();

    // Store the promise for single-flight protection
    refreshPromiseRef.current = refreshPromise;

    try {
      const result = await refreshPromise;
      return result;
    } finally {
      // Clean up promise and state
      refreshPromiseRef.current = null;
      setRefreshInProgress(false);
    }
  }, [isDesktopApp, user?.email, logout]);

  const checkAuthStatus = useCallback(async () => {
    if (!isDesktopApp) {
      // For web users, check cookie-based authentication
      console.log("[DesktopAuth] Checking web authentication status via cookies");
      try {
        const response = await fetch("/api/me", {
          method: "GET",
          credentials: "include", // Include cookies for web authentication
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const userProfile = await response.json() as UserProfile;
          setUser({
            id: userProfile.id,
            email: userProfile.email,
            firstName: userProfile.firstName,
            lastName: userProfile.lastName,
            profileImageUrl: userProfile.profileImageUrl,
            isAdmin: userProfile.isAdmin,
          });
          console.log("[DesktopAuth] Web authentication detected, user logged in");
        } else {
          console.log("[DesktopAuth] No valid web authentication found");
          setUser(null);
        }
      } catch (error) {
        console.warn("[DesktopAuth] Error checking web authentication:", error);
        setUser(null);
      }
      setIsLoading(false);
      return;
    }

    console.log("[DesktopAuth] Checking authentication status from keychain");
    
    try {
      const electronAPI = (window as any).electronAPI;
      
      // First, check if there are any stored credentials in keychain
      if (!electronAPI?.keychain?.preferences?.getEmail) {
        console.log('[DesktopAuth] Keychain API not available');
        setIsLoading(false);
        return;
      }
      
      // Try to get the last logged in email
      const emailResult = await electronAPI.keychain.preferences.getEmail();
      const lastEmail = emailResult.success ? emailResult.data : null;
      
      if (!lastEmail) {
        console.log('[DesktopAuth] No stored login email found');
        setIsLoading(false);
        return;
      }
      
      // Try to get auth data for this email
      const authData = await electronAPI.keychainHelper.getAuthSafe(lastEmail);
      if (!authData) {
        console.log('[DesktopAuth] No stored auth data found');
        setIsLoading(false);
        return;
      }
      
      // If we have an access token, try to validate it
      if (authData.accessToken) {
        try {
          let response: Response;
          
          if (electronAPI?.apiRequest) {
            response = await electronAPI.apiRequest("/api/me", {
              headers: {
                "Authorization": `Bearer ${authData.accessToken}`,
              },
            });
          } else {
            response = await fetch("/api/me", {
              headers: {
                "Authorization": `Bearer ${authData.accessToken}`,
              },
            });
          }

          if (response.ok) {
            const userProfile = await response.json() as UserProfile;
            setUser({
              id: userProfile.id,
              email: userProfile.email,
              firstName: userProfile.firstName,
              lastName: userProfile.lastName,
              profileImageUrl: userProfile.profileImageUrl,
              isAdmin: userProfile.isAdmin,
            });
            console.log("[DesktopAuth] Valid session restored from keychain");
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.warn("[DesktopAuth] Access token validation failed:", error);
        }
      }
      
      // If access token is invalid, try refresh token
      if (authData.refreshToken && authData.rememberMe) {
        console.log('[DesktopAuth] Attempting refresh with stored token');
        setUser({ ...authData.user }); // Temporarily set user for refresh
        const refreshSuccess = await refreshToken();
        if (refreshSuccess) {
          console.log("[DesktopAuth] Session restored via keychain refresh token");
        } else {
          console.log("[DesktopAuth] Refresh token invalid, clearing stored data");
          await electronAPI.keychainHelper.clearAuthSafe(lastEmail);
          setUser(null);
        }
      } else {
        console.log("[DesktopAuth] No remember me preference, using current session only");
        if (authData.user && authData.accessToken) {
          setUser({ ...authData.user });
          console.log("[DesktopAuth] Session-only login restored");
        }
      }
    } catch (error) {
      console.error('[DesktopAuth] Error checking auth status:', error);
    }
    
    setIsLoading(false);
  }, [isDesktopApp, refreshToken]);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Add clear credentials function
  const clearStoredCredentials = useCallback(async () => {
    console.log('[DesktopAuth] Clearing all stored credentials');
    
    if (!isDesktopApp) {
      return;
    }
    
    try {
      const electronAPI = (window as any).electronAPI;
      
      // Clear stored login email
      if (electronAPI?.keychain?.preferences?.clearEmail) {
        await electronAPI.keychain.preferences.clearEmail();
      }
      
      // Clear auth data for current user
      if (user?.email && electronAPI?.keychainHelper?.clearAuthSafe) {
        await electronAPI.keychainHelper.clearAuthSafe(user.email);
      }
      
      // Clear any legacy insecure storage data if it exists
      try {
        sessionStorage.removeItem('fallback_access_token');
        sessionStorage.removeItem('fallback_user_data');
        localStorage.removeItem('desktopLogin_email');
        localStorage.removeItem('desktopLogin_rememberEmail');
        console.log('[DesktopAuth] Cleared legacy insecure storage');
      } catch (error) {
        console.warn('[DesktopAuth] Failed to clear legacy storage:', error);
      }
      
      console.log('[DesktopAuth] All credentials cleared successfully');
    } catch (error) {
      console.error('[DesktopAuth] Error clearing credentials:', error);
    }
  }, [isDesktopApp, user?.email]);
  
  // Auto-refresh token periodically (every 10 minutes)
  useEffect(() => {
    if (!isDesktopApp || !user) return;

    const interval = setInterval(async () => {
      if (user) {
        console.log("[DesktopAuth] Auto-refreshing token");
        refreshToken();
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(interval);
  }, [isDesktopApp, user, refreshToken]);

  // Provide API request function with automatic token handling from keychain
  const apiRequest = useCallback(async (url: string, options: RequestInit = {}) => {
    if (!isDesktopApp) {
      // For web users, ensure credentials are included for cookie-based auth
      return fetch(url, {
        ...options,
        credentials: "include", // Always include cookies for web authentication
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
    }

    // Use electronAPI for desktop requests
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.apiRequest) {
      let accessToken: string | null = null;
      
      // Get access token from keychain
      if (user?.email && electronAPI?.keychainHelper?.getAuthSafe) {
        const authData = await electronAPI.keychainHelper.getAuthSafe(user.email);
        accessToken = authData?.accessToken;
      }
      
      const headers = {
        "Content-Type": "application/json",
        ...options.headers,
      };

      if (accessToken) {
        (headers as any)["Authorization"] = `Bearer ${accessToken}`;
      }

      let response = await electronAPI.apiRequest(url, {
        ...options,
        headers,
      });

      // If token expired, try to refresh and retry
      if (response.status === 401 && user) {
        const refreshSuccess = await refreshToken();
        if (refreshSuccess) {
          // Get the new access token from keychain after refresh
          if (electronAPI?.keychainHelper?.getAuthSafe) {
            const newAuthData = await electronAPI.keychainHelper.getAuthSafe(user.email);
            const newAccessToken = newAuthData?.accessToken;
            if (newAccessToken) {
              (headers as any)["Authorization"] = `Bearer ${newAccessToken}`;
              response = await electronAPI.apiRequest(url, {
                ...options,
                headers,
              });
            }
          }
        }
      }

      return response;
    }

    // Fallback to fetch if electronAPI is not available
    let accessToken: string | null = null;
    
    // Get access token from secure storage only
    if (user?.email && electronAPI?.keychainHelper?.getAuthSafe) {
      const authData = await electronAPI.keychainHelper.getAuthSafe(user.email);
      accessToken = authData?.accessToken;
    }
    // NO INSECURE FALLBACKS - if keychain fails, request will fail properly
    
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (accessToken) {
      (headers as any)["Authorization"] = `Bearer ${accessToken}`;
    }

    let response = await fetch(url, {
      ...options,
      headers,
    });

    // If token expired, try to refresh and retry
    if (response.status === 401 && user) {
      const refreshSuccess = await refreshToken();
      if (refreshSuccess) {
        // Get the new access token after refresh
        if (electronAPI?.keychainHelper?.getAuthSafe) {
          const newAuthData = await electronAPI.keychainHelper.getAuthSafe(user.email);
          const newAccessToken = newAuthData?.accessToken;
          if (newAccessToken) {
            (headers as any)["Authorization"] = `Bearer ${newAccessToken}`;
            response = await fetch(url, {
              ...options,
              headers,
            });
          }
        }
      }
    }

    return response;
  }, [isDesktopApp, user, refreshToken]);

  // Wire apiRequest into global queryClient for desktop apps
  useEffect(() => {
    if (isDesktopApp) {
      console.log("[DesktopAuth] Wiring desktop API transport into queryClient");
      setDesktopApiRequest(apiRequest);
    } else {
      // Ensure web clients use normal fetch
      setDesktopApiRequest(null);
    }
    
    // Cleanup on unmount
    return () => {
      if (isDesktopApp) {
        console.log("[DesktopAuth] Cleaning up desktop API transport from queryClient");
        setDesktopApiRequest(null);
      }
    };
  }, [isDesktopApp, apiRequest]);

  // Activity tracking for auto-logout
  useEffect(() => {
    if (!isDesktopApp || !user) {
      return;
    }

    let inactivityTimer: NodeJS.Timeout;
    let warningTimer: NodeJS.Timeout;
    
    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    const WARNING_TIMEOUT = INACTIVITY_TIMEOUT - (5 * 60 * 1000); // Show warning 5 minutes before

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      clearTimeout(warningTimer);

      // Warning timer
      warningTimer = setTimeout(() => {
        console.log('[DesktopAuthContext] Inactivity warning - auto logout in 5 minutes');
        // Show toast notification for warning
        if (typeof window !== 'undefined') {
          const electronAPI = window.electronAPI as ElectronAPI | undefined;
          if (electronAPI?.showNotification) {
            electronAPI.showNotification({
              title: 'Auto-logout Warning',
              body: 'You will be automatically logged out in 5 minutes due to inactivity.',
              type: 'warning'
            });
          }
        }
      }, WARNING_TIMEOUT);

      // Auto logout timer
      inactivityTimer = setTimeout(async () => {
        console.log('[DesktopAuthContext] Auto-logout due to inactivity');
        try {
          await logout();
        } catch (error) {
          console.error('[DesktopAuthContext] Auto-logout failed:', error);
        }
      }, INACTIVITY_TIMEOUT);
    };

    // Track user activity
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const handleActivity = () => {
      resetInactivityTimer();
    };

    // Add event listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Start initial timer
    resetInactivityTimer();

    return () => {
      clearTimeout(inactivityTimer);
      clearTimeout(warningTimer);
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [isDesktopApp, user, logout]);

  // Explicitly define isAuthenticated to fix ReferenceError
  const contextValue: DesktopAuthContextType = {
    user,
    isAuthenticated: !!user, // Explicitly derive from user state
    isLoading,
    isKeychainAvailable,
    login,
    logout,
    refreshToken,
    checkAuthStatus,
    apiRequest,
    clearStoredCredentials,
  };

  return (
    <DesktopAuthContext.Provider value={contextValue}>
      {children}
    </DesktopAuthContext.Provider>
  );
}