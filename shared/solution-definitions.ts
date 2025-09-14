import { SolutionDefinition, DetectionType, SolutionCategory } from './solution-types';

// Comprehensive solution definitions
export const SOLUTION_DEFINITIONS: SolutionDefinition[] = [
  // User Agent Rotation Solutions
  {
    id: 'rotate_user_agents',
    name: 'Rotate User Agents',
    description: 'Automatically rotate between different browser user agents to avoid detection patterns',
    category: 'user_agent_rotation',
    priority: 'high',
    detectionTypes: ['cloudflare', 'aws_waf', 'platform_specific', 'rate_limit'],
    requiresUserInteraction: false,
    canAutoApply: true,
    estimatedEffectiveness: 75,
    implementationComplexity: 'simple',
    requiresRestart: false,
    riskLevel: 'low',
    platforms: ['both'],
  },
  {
    id: 'enable_mobile_agents',
    name: 'Enable Mobile User Agents',
    description: 'Include mobile browser user agents in rotation to mimic diverse traffic',
    category: 'user_agent_rotation',
    priority: 'medium',
    detectionTypes: ['platform_specific', 'cloudflare'],
    requiresUserInteraction: false,
    canAutoApply: true,
    estimatedEffectiveness: 60,
    implementationComplexity: 'simple',
    requiresRestart: false,
    riskLevel: 'low',
    platforms: ['both'],
  },
  {
    id: 'firefox_user_agents',
    name: 'Use Firefox User Agents',
    description: 'Switch to Firefox-based user agents which may have different detection signatures',
    category: 'user_agent_rotation',
    priority: 'medium',
    detectionTypes: ['cloudflare', 'platform_specific'],
    requiresUserInteraction: false,
    canAutoApply: true,
    estimatedEffectiveness: 65,
    implementationComplexity: 'simple',
    requiresRestart: false,
    riskLevel: 'low',
    platforms: ['both'],
  },

  // Request Delay Solutions
  {
    id: 'increase_delays',
    name: 'Increase Request Delays',
    description: 'Add longer delays between requests to reduce server load and avoid rate limiting',
    category: 'request_delays',
    priority: 'high',
    detectionTypes: ['rate_limit', 'cloudflare', 'aws_waf'],
    requiresUserInteraction: false,
    canAutoApply: true,
    estimatedEffectiveness: 85,
    implementationComplexity: 'simple',
    requiresRestart: false,
    riskLevel: 'low',
    platforms: ['both'],
  },
  {
    id: 'exponential_backoff',
    name: 'Enable Exponential Backoff',
    description: 'Implement exponential backoff delays that increase after each failure',
    category: 'request_delays',
    priority: 'high',
    detectionTypes: ['rate_limit', 'ip_block', 'aws_waf'],
    requiresUserInteraction: false,
    canAutoApply: true,
    estimatedEffectiveness: 80,
    implementationComplexity: 'moderate',
    requiresRestart: false,
    riskLevel: 'low',
    platforms: ['both'],
  },
  {
    id: 'random_timing_jitter',
    name: 'Add Random Timing Jitter',
    description: 'Add random variation to request timing to avoid predictable patterns',
    category: 'request_delays',
    priority: 'medium',
    detectionTypes: ['platform_specific', 'cloudflare', 'rate_limit'],
    requiresUserInteraction: false,
    canAutoApply: true,
    estimatedEffectiveness: 70,
    implementationComplexity: 'simple',
    requiresRestart: false,
    riskLevel: 'low',
    platforms: ['both'],
  },

  // Header Randomization Solutions
  {
    id: 'randomize_headers',
    name: 'Randomize Request Headers',
    description: 'Vary browser headers like Accept-Language and Accept-Encoding to appear more natural',
    category: 'header_randomization',
    priority: 'medium',
    detectionTypes: ['cloudflare', 'platform_specific', 'aws_waf'],
    requiresUserInteraction: false,
    canAutoApply: true,
    estimatedEffectiveness: 65,
    implementationComplexity: 'moderate',
    requiresRestart: false,
    riskLevel: 'low',
    platforms: ['both'],
  },
  {
    id: 'accept_language_variation',
    name: 'Vary Accept-Language Headers',
    description: 'Rotate between different language preferences to simulate diverse users',
    category: 'header_randomization',
    priority: 'low',
    detectionTypes: ['platform_specific', 'cloudflare'],
    requiresUserInteraction: false,
    canAutoApply: true,
    estimatedEffectiveness: 45,
    implementationComplexity: 'simple',
    requiresRestart: false,
    riskLevel: 'low',
    platforms: ['both'],
  },
  {
    id: 'custom_browser_headers',
    name: 'Add Custom Browser Headers',
    description: 'Include additional headers that real browsers send to improve authenticity',
    category: 'header_randomization',
    priority: 'medium',
    detectionTypes: ['js_challenge', 'cloudflare', 'platform_specific'],
    requiresUserInteraction: false,
    canAutoApply: true,
    estimatedEffectiveness: 70,
    implementationComplexity: 'moderate',
    requiresRestart: false,
    riskLevel: 'medium',
    platforms: ['both'],
  },

  // IP/Proxy Rotation Solutions
  {
    id: 'enable_proxy_rotation',
    name: 'Enable Proxy Rotation',
    description: 'Rotate between multiple proxy servers to change apparent IP address',
    category: 'ip_proxy_rotation',
    priority: 'critical',
    detectionTypes: ['ip_block', 'rate_limit', 'cloudflare'],
    requiresUserInteraction: true,
    canAutoApply: false,
    estimatedEffectiveness: 90,
    implementationComplexity: 'complex',
    requiresRestart: true,
    riskLevel: 'high',
    platforms: ['both'],
    desktopOnly: true,
  },
  {
    id: 'vpn_recommendation',
    name: 'VPN Connection Recommended',
    description: 'Use a VPN service to change your IP address and geographic location',
    category: 'ip_proxy_rotation',
    priority: 'critical',
    detectionTypes: ['ip_block', 'cloudflare', 'platform_specific'],
    requiresUserInteraction: true,
    canAutoApply: false,
    estimatedEffectiveness: 95,
    implementationComplexity: 'complex',
    requiresRestart: true,
    riskLevel: 'medium',
    platforms: ['both'],
  },

  // Request Pattern Modification Solutions
  {
    id: 'randomize_request_patterns',
    name: 'Randomize Request Patterns',
    description: 'Vary the order and timing of requests to avoid predictable automation patterns',
    category: 'request_pattern_modification',
    priority: 'medium',
    detectionTypes: ['platform_specific', 'aws_waf', 'cloudflare'],
    requiresUserInteraction: false,
    canAutoApply: true,
    estimatedEffectiveness: 60,
    implementationComplexity: 'moderate',
    requiresRestart: false,
    riskLevel: 'low',
    platforms: ['both'],
  },
  {
    id: 'simulate_human_behavior',
    name: 'Simulate Human Browsing Behavior',
    description: 'Add realistic browsing patterns like page dwell time and navigation sequences',
    category: 'request_pattern_modification',
    priority: 'medium',
    detectionTypes: ['js_challenge', 'platform_specific', 'cloudflare'],
    requiresUserInteraction: false,
    canAutoApply: true,
    estimatedEffectiveness: 75,
    implementationComplexity: 'complex',
    requiresRestart: false,
    riskLevel: 'medium',
    platforms: ['both'],
  },

  // Platform-Specific Workaround Solutions
  {
    id: 'amazon_cookie_management',
    name: 'Amazon Cookie Management',
    description: 'Implement Amazon-specific cookie handling and session management',
    category: 'platform_specific_workarounds',
    priority: 'high',
    detectionTypes: ['platform_specific', 'js_challenge', 'redirect_loop'],
    requiresUserInteraction: false,
    canAutoApply: true,
    estimatedEffectiveness: 80,
    implementationComplexity: 'moderate',
    requiresRestart: false,
    riskLevel: 'medium',
    platforms: ['amazon'],
  },
  {
    id: 'walmart_session_persistence',
    name: 'Walmart Session Persistence',
    description: 'Maintain consistent session data for Walmart-specific anti-bot measures',
    category: 'platform_specific_workarounds',
    priority: 'high',
    detectionTypes: ['platform_specific', 'js_challenge', 'redirect_loop'],
    requiresUserInteraction: false,
    canAutoApply: true,
    estimatedEffectiveness: 75,
    implementationComplexity: 'moderate',
    requiresRestart: false,
    riskLevel: 'medium',
    platforms: ['walmart'],
  },
  {
    id: 'js_challenge_mitigation',
    name: 'JavaScript Challenge Mitigation',
    description: 'Implement browser simulation to handle JavaScript-based challenges',
    category: 'platform_specific_workarounds',
    priority: 'high',
    detectionTypes: ['js_challenge', 'cloudflare', 'platform_specific'],
    requiresUserInteraction: false,
    canAutoApply: false,
    estimatedEffectiveness: 85,
    implementationComplexity: 'complex',
    requiresRestart: true,
    riskLevel: 'high',
    platforms: ['both'],
  },
  {
    id: 'captcha_notification',
    name: 'CAPTCHA Detection & Notification',
    description: 'Enhanced detection and immediate notification when CAPTCHA challenges appear',
    category: 'platform_specific_workarounds',
    priority: 'critical',
    detectionTypes: ['captcha'],
    requiresUserInteraction: true,
    canAutoApply: true,
    estimatedEffectiveness: 100,
    implementationComplexity: 'simple',
    requiresRestart: false,
    riskLevel: 'low',
    platforms: ['both'],
  },
  {
    id: 'reduce_concurrency',
    name: 'Reduce Request Concurrency',
    description: 'Limit simultaneous requests to reduce server load and detection risk',
    category: 'request_pattern_modification',
    priority: 'medium',
    detectionTypes: ['rate_limit', 'aws_waf', 'platform_specific'],
    requiresUserInteraction: false,
    canAutoApply: true,
    estimatedEffectiveness: 70,
    implementationComplexity: 'simple',
    requiresRestart: false,
    riskLevel: 'low',
    platforms: ['both'],
  },
  {
    id: 'clear_cache_cookies',
    name: 'Clear Cache and Cookies',
    description: 'Reset browser state by clearing cache and cookies to start fresh',
    category: 'platform_specific_workarounds',
    priority: 'medium',
    detectionTypes: ['redirect_loop', 'js_challenge', 'cloudflare'],
    requiresUserInteraction: true,
    canAutoApply: false,
    estimatedEffectiveness: 60,
    implementationComplexity: 'simple',
    requiresRestart: true,
    riskLevel: 'low',
    platforms: ['both'],
  },
];

// Detection type to solution mapping with priority scores
export const DETECTION_SOLUTION_MAPPING: Record<DetectionType, string[]> = {
  cloudflare: [
    'increase_delays',
    'rotate_user_agents', 
    'exponential_backoff',
    'randomize_headers',
    'firefox_user_agents',
    'random_timing_jitter',
    'clear_cache_cookies',
    'vpn_recommendation'
  ],
  aws_waf: [
    'increase_delays',
    'exponential_backoff',
    'rotate_user_agents',
    'randomize_headers',
    'reduce_concurrency',
    'randomize_request_patterns'
  ],
  rate_limit: [
    'increase_delays',
    'exponential_backoff',
    'reduce_concurrency',
    'rotate_user_agents',
    'enable_proxy_rotation',
    'random_timing_jitter'
  ],
  ip_block: [
    'vpn_recommendation',
    'enable_proxy_rotation',
    'exponential_backoff',
    'increase_delays'
  ],
  captcha: [
    'captcha_notification',
    'increase_delays',
    'clear_cache_cookies',
    'vpn_recommendation'
  ],
  js_challenge: [
    'js_challenge_mitigation',
    'custom_browser_headers',
    'simulate_human_behavior',
    'clear_cache_cookies',
    'amazon_cookie_management',
    'walmart_session_persistence'
  ],
  redirect_loop: [
    'clear_cache_cookies',
    'amazon_cookie_management',
    'walmart_session_persistence',
    'increase_delays'
  ],
  platform_specific: [
    'amazon_cookie_management',
    'walmart_session_persistence',
    'rotate_user_agents',
    'randomize_request_patterns',
    'simulate_human_behavior',
    'enable_mobile_agents',
    'randomize_headers'
  ],
  none: [
    'random_timing_jitter',
    'rotate_user_agents'
  ]
};

// Solution effectiveness multipliers based on detection confidence
export const CONFIDENCE_MULTIPLIERS: Record<string, number> = {
  low: 0.7,      // 0-0.3 confidence
  medium: 1.0,   // 0.3-0.7 confidence
  high: 1.3,     // 0.7-1.0 confidence
};

// Platform-specific solution filters
export const PLATFORM_SOLUTIONS: Record<'amazon' | 'walmart', string[]> = {
  amazon: [
    'amazon_cookie_management',
    'rotate_user_agents',
    'increase_delays',
    'exponential_backoff',
    'randomize_headers',
    'js_challenge_mitigation',
    'simulate_human_behavior'
  ],
  walmart: [
    'walmart_session_persistence',
    'rotate_user_agents',
    'increase_delays',
    'exponential_backoff', 
    'randomize_headers',
    'js_challenge_mitigation',
    'simulate_human_behavior'
  ]
};

// Solution dependencies and conflicts
export const SOLUTION_DEPENDENCIES: Record<string, string[]> = {
  'enable_proxy_rotation': ['rotate_user_agents'],
  'js_challenge_mitigation': ['custom_browser_headers', 'simulate_human_behavior'],
  'amazon_cookie_management': ['custom_browser_headers'],
  'walmart_session_persistence': ['custom_browser_headers'],
};

export const SOLUTION_CONFLICTS: Record<string, string[]> = {
  'enable_mobile_agents': ['js_challenge_mitigation'], // Mobile agents may not handle JS challenges well
  'vpn_recommendation': ['enable_proxy_rotation'], // Don't use both VPN and proxy
};

// Helper function to get solution by ID
export function getSolutionById(id: string): SolutionDefinition | undefined {
  return SOLUTION_DEFINITIONS.find(solution => solution.id === id);
}

// Helper function to get solutions by category
export function getSolutionsByCategory(category: SolutionCategory): SolutionDefinition[] {
  return SOLUTION_DEFINITIONS.filter(solution => solution.category === category);
}

// Helper function to get solutions for detection type
export function getSolutionsForDetection(detectionType: DetectionType): SolutionDefinition[] {
  const solutionIds = DETECTION_SOLUTION_MAPPING[detectionType] || [];
  return solutionIds.map(id => getSolutionById(id)).filter(Boolean) as SolutionDefinition[];
}

// Helper function to check if solution is platform compatible
export function isSolutionPlatformCompatible(solution: SolutionDefinition, platform: 'amazon' | 'walmart'): boolean {
  return solution.platforms.includes('both') || solution.platforms.includes(platform);
}

// Helper function to filter desktop/web only solutions
export function filterSolutionsByEnvironment(solutions: SolutionDefinition[], isDesktop: boolean): SolutionDefinition[] {
  return solutions.filter(solution => {
    if (isDesktop && solution.webOnly) return false;
    if (!isDesktop && solution.desktopOnly) return false;
    return true;
  });
}