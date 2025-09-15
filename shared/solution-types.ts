import { z } from "zod";

// Anti-bot detection result interface (imported from scraping-worker.ts)
export interface AntiBotDetectionResult {
  isBlocked: boolean;
  detectionType: 'cloudflare' | 'aws_waf' | 'rate_limit' | 'ip_block' | 'captcha' | 'js_challenge' | 'redirect_loop' | 'platform_specific' | 'none';
  confidence: number; // 0-1 scale
  platform: 'amazon' | 'walmart';
  responseCode: number;
  responseTime: number;
  rawResponse?: string;
  timestamp: number;
  suggestedAction: string;
  details: Record<string, any>;
}

// Solution category types
export type SolutionCategory = 
  | 'user_agent_rotation'
  | 'request_delays'
  | 'header_randomization'
  | 'ip_proxy_rotation'
  | 'request_pattern_modification'
  | 'platform_specific_workarounds';

// Detection types (from existing AntiBotDetectionResult)
export type DetectionType = 
  | 'cloudflare'
  | 'aws_waf'
  | 'rate_limit'
  | 'ip_block'
  | 'captcha'
  | 'js_challenge'
  | 'redirect_loop'
  | 'platform_specific'
  | 'none';

// Solution priority levels
export type SolutionPriority = 'low' | 'medium' | 'high' | 'critical';

// Solution application status
export type SolutionStatus = 'pending' | 'applying' | 'applied' | 'failed' | 'disabled';

// Individual solution definition
export interface SolutionDefinition {
  id: string;
  name: string;
  description: string;
  category: SolutionCategory;
  priority: SolutionPriority;
  detectionTypes: DetectionType[];
  requiresUserInteraction: boolean;
  canAutoApply: boolean;
  estimatedEffectiveness: number; // 0-100 percentage
  implementationComplexity: 'simple' | 'moderate' | 'complex';
  requiresRestart: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  dependencies?: string[]; // IDs of other solutions that must be enabled
  conflicts?: string[]; // IDs of solutions that conflict with this one
  platforms: ('amazon' | 'walmart' | 'both')[];
  desktopOnly?: boolean;
  webOnly?: boolean;
}

// Solution configuration parameters
export interface SolutionConfig {
  enabled: boolean;
  autoApply: boolean;
  parameters: Record<string, any>;
  lastApplied?: number;
  successCount: number;
  failureCount: number;
  effectiveness: number; // Calculated effectiveness percentage
}

// Solution suggestion for a specific detection
export interface SolutionSuggestion {
  solution: SolutionDefinition;
  relevanceScore: number; // 0-100, how relevant this solution is for the detection
  urgency: 'low' | 'medium' | 'high' | 'immediate';
  userConfig: SolutionConfig;
  isEnabled: boolean;
  canApplyNow: boolean;
  reasonIfDisabled?: string;
  estimatedImpact: string;
  applicationSteps: string[];
}

// Grouped solution suggestions
export interface GroupedSuggestions {
  immediate: SolutionSuggestion[];
  recommended: SolutionSuggestion[];
  optional: SolutionSuggestion[];
  advanced: SolutionSuggestion[];
}

// Solution application result
export interface SolutionApplicationResult {
  solutionId: string;
  success: boolean;
  message: string;
  appliedAt: number;
  parameters: Record<string, any>;
  error?: string;
  rollbackAvailable: boolean;
}

// Solution effectiveness tracking
export interface SolutionEffectiveness {
  solutionId: string;
  detectionType: DetectionType;
  platform: 'amazon' | 'walmart';
  successCount: number;
  failureCount: number;
  totalAttempts: number;
  successRate: number;
  lastUpdated: number;
  averageResponseTime?: number;
  recentTrend: 'improving' | 'declining' | 'stable';
}

// User agent pools for rotation
export interface UserAgentPool {
  id: string;
  name: string;
  agents: string[];
  category: 'desktop_chrome' | 'desktop_firefox' | 'desktop_safari' | 'mobile_android' | 'mobile_ios';
  platform: 'windows' | 'macos' | 'linux' | 'android' | 'ios';
  enabled: boolean;
  weight: number; // Selection probability weight
}

// Request timing configuration
export interface TimingConfig {
  minDelay: number;
  maxDelay: number;
  distributionType: 'uniform' | 'normal' | 'exponential';
  jitterPercent: number;
  backoffMultiplier: number;
  maxBackoffDelay: number;
  platformSpecific: {
    amazon: { min: number; max: number };
    walmart: { min: number; max: number };
  };
}

// Header randomization configuration
export interface HeaderConfig {
  acceptLanguages: string[];
  acceptEncodings: string[];
  customHeaders: Record<string, string[]>;
  rotateReferer: boolean;
  includeDnt: boolean;
  includeUpgradeInsecure: boolean;
  randomizeOrder: boolean;
}

// Proxy rotation configuration
export interface ProxyConfig {
  enabled: boolean;
  proxies: Array<{
    url: string;
    username?: string;
    password?: string;
    country?: string;
    provider?: string;
    enabled: boolean;
    successRate?: number;
  }>;
  rotationStrategy: 'round_robin' | 'random' | 'weighted' | 'smart';
  testInterval: number;
  failureThreshold: number;
  automaticDisable: boolean;
}

// Platform-specific workaround configuration
export interface PlatformWorkaroundConfig {
  amazon: {
    enableCookieManagement: boolean;
    useAmazonSpecificHeaders: boolean;
    respectRobotsTxt: boolean;
    enableSessionPersistence: boolean;
    customUserAgents: string[];
  };
  walmart: {
    enableCookieManagement: boolean;
    useWalmartSpecificHeaders: boolean;
    respectRobotsTxt: boolean;
    enableSessionPersistence: boolean;
    customUserAgents: string[];
  };
}

// Complete solution preferences from user settings
export interface SolutionPreferences {
  enableSolutionSuggestions: boolean;
  
  // User Agent Settings
  userAgentRotation: {
    enabled: boolean;
    pools: UserAgentPool[];
    rotationInterval: number;
    randomizeOnFailure: boolean;
  };
  
  // Timing Settings
  requestTiming: TimingConfig;
  
  // Header Settings
  headerRandomization: HeaderConfig;
  
  // Proxy Settings
  proxyRotation: ProxyConfig;
  
  // Pattern Modification
  requestPatterns: {
    enabled: boolean;
    randomizeOrder: boolean;
    addRandomRequests: boolean;
    varyTimingPatterns: boolean;
  };
  
  // Platform Workarounds
  platformWorkarounds: PlatformWorkaroundConfig;
  
  // Auto-Application Settings
  autoApplication: {
    enabled: boolean;
    confirmBeforeApplying: boolean;
    autoApplyOnDetection: boolean;
    maxAutoApplications: number;
  };
  
  // Effectiveness Tracking
  effectivenessTracking: {
    enabled: boolean;
    trackSuccess: boolean;
    autoDisableIneffective: boolean;
    successThreshold: number;
    evaluationPeriod: number;
  };
}

// Validation schemas
export const solutionConfigSchema = z.object({
  enabled: z.boolean(),
  autoApply: z.boolean(),
  parameters: z.record(z.any()),
  successCount: z.number().default(0),
  failureCount: z.number().default(0),
  effectiveness: z.number().min(0).max(100).default(50),
});

export const solutionApplicationSchema = z.object({
  solutionId: z.string(),
  parameters: z.record(z.any()).optional(),
  forceApply: z.boolean().default(false),
});

export const effectivenessUpdateSchema = z.object({
  solutionId: z.string(),
  detectionType: z.enum(['cloudflare', 'aws_waf', 'rate_limit', 'ip_block', 'captcha', 'js_challenge', 'redirect_loop', 'platform_specific', 'none']),
  platform: z.enum(['amazon', 'walmart']),
  success: z.boolean(),
  responseTime: z.number().optional(),
});

// Type exports
export type SolutionConfig_Type = z.infer<typeof solutionConfigSchema>;
export type SolutionApplication_Type = z.infer<typeof solutionApplicationSchema>;
export type EffectivenessUpdate_Type = z.infer<typeof effectivenessUpdateSchema>;