import { useQuery } from "@tanstack/react-query";
import { useDesktopAuth } from "@/contexts/DesktopAuthContext";
import { useEffect } from "react";

/**
 * Validation component to test React Query integration with desktop transport
 * This component will be used to verify that all queries route through electronAPI
 */
export function ReactQueryValidation() {
  const { isAuthenticated } = useDesktopAuth();

  // Test query to validate React Query integration
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['/api/me'],
    enabled: isAuthenticated,
    staleTime: 0, // Always fetch for validation
    retry: false,
  });

  // Log validation results
  useEffect(() => {
    if (isAuthenticated) {
      console.log('[ReactQueryValidation] Testing React Query desktop transport integration...');
      
      // Test the query
      refetch().then((result) => {
        if (result.data) {
          console.log('[ReactQueryValidation] ✅ React Query desktop transport working correctly');
          console.log('[ReactQueryValidation] Query result:', result.data);
        }
      }).catch((err) => {
        console.error('[ReactQueryValidation] ❌ React Query desktop transport failed:', err);
      });
    }
  }, [isAuthenticated, refetch]);

  // Don't render anything visible - this is just for validation
  return null;
}

export default ReactQueryValidation;