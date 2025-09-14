import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Desktop authentication API request function type
type DesktopApiRequest = (url: string, options?: RequestInit) => Promise<Response>;

// Enhanced error interface for better error handling
export interface ApiError extends Error {
  status: number;
  code?: string;
  reason?: string;
  userId?: string;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorData: any;
    try {
      const text = await res.text();
      errorData = text ? JSON.parse(text) : { error: res.statusText };
    } catch {
      errorData = { error: res.statusText };
    }

    const error = new Error(errorData.error || `HTTP ${res.status}`) as ApiError;
    error.status = res.status;
    error.code = errorData.code;
    error.reason = errorData.reason;
    error.userId = errorData.userId;
    
    throw error;
  }
}

// Global reference to desktop API request function
let desktopApiRequest: DesktopApiRequest | null = null;

// Function to set the desktop API request function from DesktopAuthContext
export function setDesktopApiRequest(apiRequestFn: DesktopApiRequest | null) {
  desktopApiRequest = apiRequestFn;
}

// Check if we're in desktop environment
function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && 'electronAPI' in window;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Use desktop authentication if available
  if (isDesktopApp() && desktopApiRequest) {
    const options: RequestInit = {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
    };
    
    const res = await desktopApiRequest(url, options);
    await throwIfResNotOk(res);
    return res;
  }

  // Fallback to regular fetch for web clients
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    
    let res: Response;
    
    // Use desktop authentication if available
    if (isDesktopApp() && desktopApiRequest) {
      res = await desktopApiRequest(url, { method: 'GET' });
    } else {
      // Fallback to regular fetch for web clients
      res = await fetch(url, {
        credentials: "include",
      });
    }

    // Handle different authorization error scenarios
    if (res.status === 401 && unauthorizedBehavior === "returnNull") {
      return null;
    }
    
    if (res.status === 402 || res.status === 403) {
      // Let 402 (Payment Required) and 403 (Forbidden) errors be handled by components
      // These include SUBSCRIPTION_REQUIRED, ACCOUNT_BANNED, ACCOUNT_SUSPENDED
      await throwIfResNotOk(res);
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
