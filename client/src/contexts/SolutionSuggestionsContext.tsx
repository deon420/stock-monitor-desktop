import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { AntiBotDetectionResult } from './AntiDetectionContext';
import { isDesktopApp } from '@/lib/desktopDataProvider';
import { 
  SolutionSuggestion, 
  GroupedSuggestions, 
  SolutionApplicationResult,
  SolutionConfig,
  SolutionEffectiveness 
} from '@shared/solution-types';

// Context state interface
interface SolutionSuggestionsContextType {
  // Current suggestions state
  suggestions: GroupedSuggestions | null;
  isGeneratingSuggestions: boolean;
  suggestionsError: string | null;
  
  // Solution application state
  applyingSolutions: Set<string>;
  appliedSolutions: Map<string, SolutionApplicationResult>;
  
  // User configuration
  solutionConfigs: Map<string, SolutionConfig>;
  isLoadingConfigs: boolean;
  
  // Effectiveness tracking
  effectivenessData: SolutionEffectiveness[];
  
  // Actions
  generateSuggestions: (detection: AntiBotDetectionResult) => Promise<void>;
  applySolution: (solutionId: string, parameters?: Record<string, any>) => Promise<SolutionApplicationResult>;
  updateSolutionConfig: (solutionId: string, config: Partial<SolutionConfig>) => Promise<void>;
  clearSuggestions: () => void;
  refreshConfigs: () => void;
  
  // State getters
  isSolutionApplying: (solutionId: string) => boolean;
  getSolutionResult: (solutionId: string) => SolutionApplicationResult | undefined;
  getSolutionConfig: (solutionId: string) => SolutionConfig | undefined;
}

const SolutionSuggestionsContext = createContext<SolutionSuggestionsContextType | undefined>(undefined);

export const useSolutionSuggestions = () => {
  const context = useContext(SolutionSuggestionsContext);
  if (!context) {
    throw new Error('useSolutionSuggestions must be used within a SolutionSuggestionsProvider');
  }
  return context;
};

interface SolutionSuggestionsProviderProps {
  children: ReactNode;
}

export const SolutionSuggestionsProvider = ({ children }: SolutionSuggestionsProviderProps) => {
  // Local state
  const [suggestions, setSuggestions] = useState<GroupedSuggestions | null>(null);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [applyingSolutions, setApplyingSolutions] = useState<Set<string>>(new Set());
  const [appliedSolutions, setAppliedSolutions] = useState<Map<string, SolutionApplicationResult>>(new Map());
  const [solutionConfigs, setSolutionConfigs] = useState<Map<string, SolutionConfig>>(new Map());
  
  const { toast } = useToast();

  // Fetch solution configurations
  const { data: configsData, isLoading: isLoadingConfigs, refetch: refetchConfigs } = useQuery({
    queryKey: ['/api/solutions/configs'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch effectiveness data
  const { data: effectivenessData = [] } = useQuery<SolutionEffectiveness[]>({
    queryKey: ['/api/solutions/effectiveness'],
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Update local configs when data changes
  useEffect(() => {
    if (configsData) {
      const configMap = new Map<string, SolutionConfig>();
      Object.entries(configsData).forEach(([solutionId, config]) => {
        configMap.set(solutionId, config as SolutionConfig);
      });
      setSolutionConfigs(configMap);
    }
  }, [configsData]);

  // Solution application mutation
  const applySolutionMutation = useMutation({
    mutationFn: async ({ solutionId, parameters }: { solutionId: string; parameters?: Record<string, any> }) => {
      const response = await apiRequest('POST', '/api/solutions/apply', { solutionId, parameters });
      return response as SolutionApplicationResult;
    },
    onMutate: ({ solutionId }) => {
      setApplyingSolutions(prev => new Set(prev).add(solutionId));
    },
    onSuccess: (result) => {
      setAppliedSolutions(prev => new Map(prev).set(result.solutionId, result));
      
      if (result.success) {
        toast({
          title: "Solution Applied Successfully",
          description: result.message,
        });
        
        // Refresh configurations if solution was applied
        refetchConfigs();
        
        // Invalidate effectiveness data to refresh
        queryClient.invalidateQueries({ queryKey: ['/api/solutions/effectiveness'] });
      } else {
        toast({
          title: "Solution Application Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: any, { solutionId }) => {
      console.error('Failed to apply solution:', error);
      toast({
        title: "Solution Application Error",
        description: error?.message || "An unexpected error occurred",
        variant: "destructive",
      });
      
      const failureResult: SolutionApplicationResult = {
        solutionId,
        success: false,
        message: error?.message || "Application failed",
        appliedAt: Date.now(),
        parameters: {},
        error: String(error),
        rollbackAvailable: false,
      };
      setAppliedSolutions(prev => new Map(prev).set(solutionId, failureResult));
    },
    onSettled: ({ solutionId }) => {
      setApplyingSolutions(prev => {
        const newSet = new Set(prev);
        newSet.delete(solutionId);
        return newSet;
      });
    },
  });

  // Configuration update mutation
  const updateConfigMutation = useMutation({
    mutationFn: async ({ solutionId, config }: { solutionId: string; config: Partial<SolutionConfig> }) => {
      return await apiRequest('PATCH', `/api/solutions/configs/${solutionId}`, config);
    },
    onSuccess: (_, { solutionId, config }) => {
      // Update local state immediately
      setSolutionConfigs(prev => {
        const newConfigs = new Map(prev);
        const existingConfig = newConfigs.get(solutionId);
        if (existingConfig) {
          newConfigs.set(solutionId, { ...existingConfig, ...config });
        }
        return newConfigs;
      });
      
      // Refresh from server
      refetchConfigs();
      
      toast({
        title: "Configuration Updated",
        description: "Solution preferences have been saved",
      });
    },
    onError: (error: any) => {
      console.error('Failed to update solution configuration:', error);
      toast({
        title: "Configuration Update Failed",
        description: error?.message || "Failed to save solution preferences",
        variant: "destructive",
      });
    },
  });

  // Generate suggestions for a detection
  const generateSuggestions = useCallback(async (detection: AntiBotDetectionResult) => {
    setIsGeneratingSuggestions(true);
    setSuggestionsError(null);
    
    try {
      console.log('[SolutionSuggestions] Generating suggestions for detection:', detection.detectionType);
      
      const response = await apiRequest('POST', '/api/solutions/generate', {
        detection,
        isDesktop: isDesktopApp(),
      });
      
      setSuggestions(response as GroupedSuggestions);
      console.log('[SolutionSuggestions] Generated suggestions:', response);
    } catch (error: any) {
      console.error('[SolutionSuggestions] Failed to generate suggestions:', error);
      setSuggestionsError(error?.message || 'Failed to generate solution suggestions');
      toast({
        title: "Suggestion Generation Failed",
        description: "Unable to generate solution suggestions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingSuggestions(false);
    }
  }, [toast]);

  // Apply a solution
  const applySolution = useCallback(async (solutionId: string, parameters?: Record<string, any>) => {
    console.log('[SolutionSuggestions] Applying solution:', solutionId, parameters);
    
    const result = await applySolutionMutation.mutateAsync({ solutionId, parameters });
    return result;
  }, [applySolutionMutation]);

  // Update solution configuration
  const updateSolutionConfig = useCallback(async (solutionId: string, config: Partial<SolutionConfig>) => {
    console.log('[SolutionSuggestions] Updating config for solution:', solutionId, config);
    
    await updateConfigMutation.mutateAsync({ solutionId, config });
  }, [updateConfigMutation]);

  // Clear suggestions
  const clearSuggestions = useCallback(() => {
    setSuggestions(null);
    setSuggestionsError(null);
  }, []);

  // Refresh configurations
  const refreshConfigs = useCallback(() => {
    refetchConfigs();
  }, [refetchConfigs]);

  // State getters
  const isSolutionApplying = useCallback((solutionId: string) => {
    return applyingSolutions.has(solutionId);
  }, [applyingSolutions]);

  const getSolutionResult = useCallback((solutionId: string) => {
    return appliedSolutions.get(solutionId);
  }, [appliedSolutions]);

  const getSolutionConfig = useCallback((solutionId: string) => {
    return solutionConfigs.get(solutionId);
  }, [solutionConfigs]);

  // Context value
  const contextValue: SolutionSuggestionsContextType = {
    // State
    suggestions,
    isGeneratingSuggestions,
    suggestionsError,
    applyingSolutions,
    appliedSolutions,
    solutionConfigs,
    isLoadingConfigs,
    effectivenessData,
    
    // Actions
    generateSuggestions,
    applySolution,
    updateSolutionConfig,
    clearSuggestions,
    refreshConfigs,
    
    // Getters
    isSolutionApplying,
    getSolutionResult,
    getSolutionConfig,
  };

  return (
    <SolutionSuggestionsContext.Provider value={contextValue}>
      {children}
    </SolutionSuggestionsContext.Provider>
  );
};

// Helper hook for checking if solutions feature is enabled
export const useSolutionsEnabled = () => {
  const { solutionConfigs } = useSolutionSuggestions();
  
  // Check if any solutions are enabled
  const hasEnabledSolutions = Array.from(solutionConfigs.values()).some(config => config.enabled);
  
  return hasEnabledSolutions;
};

// Helper hook for getting solution counts by category
export const useSolutionStats = () => {
  const { solutionConfigs, effectivenessData, appliedSolutions } = useSolutionSuggestions();
  
  const totalSolutions = solutionConfigs.size;
  const enabledSolutions = Array.from(solutionConfigs.values()).filter(config => config.enabled).length;
  const recentlyApplied = Array.from(appliedSolutions.values()).filter(
    result => result.appliedAt > Date.now() - 24 * 60 * 60 * 1000 // Last 24 hours
  ).length;
  const successfulApplications = Array.from(appliedSolutions.values()).filter(result => result.success).length;
  
  return {
    totalSolutions,
    enabledSolutions,
    recentlyApplied,
    successfulApplications,
    effectivenessData: effectivenessData.length,
  };
};