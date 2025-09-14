import { 
  SolutionSuggestion, 
  GroupedSuggestions, 
  SolutionPreferences, 
  SolutionConfig, 
  SolutionApplicationResult,
  SolutionEffectiveness,
  DetectionType,
  SolutionDefinition 
} from './solution-types';
import { AntiBotDetectionResult } from '../client/src/contexts/AntiDetectionContext';
import { 
  SOLUTION_DEFINITIONS, 
  DETECTION_SOLUTION_MAPPING, 
  CONFIDENCE_MULTIPLIERS,
  PLATFORM_SOLUTIONS,
  SOLUTION_DEPENDENCIES,
  SOLUTION_CONFLICTS,
  getSolutionById,
  getSolutionsForDetection,
  isSolutionPlatformCompatible,
  filterSolutionsByEnvironment
} from './solution-definitions';
import { Settings } from './schema';

export class SolutionSuggestionEngine {
  private effectivenessData: Map<string, SolutionEffectiveness> = new Map();
  private userConfigs: Map<string, SolutionConfig> = new Map();
  
  constructor() {
    this.initializeDefaultConfigs();
  }

  /**
   * Initialize default configurations for all solutions
   */
  private initializeDefaultConfigs(): void {
    SOLUTION_DEFINITIONS.forEach(solution => {
      this.userConfigs.set(solution.id, {
        enabled: true,
        autoApply: solution.canAutoApply && !solution.requiresUserInteraction,
        parameters: this.getDefaultParameters(solution),
        successCount: 0,
        failureCount: 0,
        effectiveness: solution.estimatedEffectiveness,
      });
    });
  }

  /**
   * Get default parameters for a solution
   */
  private getDefaultParameters(solution: SolutionDefinition): Record<string, any> {
    const defaults: Record<string, any> = {};
    
    switch (solution.id) {
      case 'increase_delays':
        defaults.minDelay = 2000;
        defaults.maxDelay = 8000;
        defaults.multiplier = 1.5;
        break;
      case 'exponential_backoff':
        defaults.baseDelay = 1000;
        defaults.maxDelay = 300000;
        defaults.multiplier = 2;
        defaults.jitter = 0.1;
        break;
      case 'rotate_user_agents':
        defaults.rotationInterval = 10;
        defaults.includeDesktop = true;
        defaults.includeMobile = false;
        defaults.includeFirefox = true;
        defaults.includeChrome = true;
        defaults.includeSafari = false;
        break;
      case 'randomize_headers':
        defaults.rotateAcceptLanguage = true;
        defaults.rotateAcceptEncoding = false;
        defaults.addCustomHeaders = false;
        defaults.randomizeOrder = false;
        break;
      case 'reduce_concurrency':
        defaults.maxConcurrent = 1;
        defaults.queueDelay = 1000;
        break;
      case 'random_timing_jitter':
        defaults.jitterPercent = 20;
        defaults.minJitter = 500;
        defaults.maxJitter = 3000;
        break;
      default:
        // Default empty parameters
        break;
    }
    
    return defaults;
  }

  /**
   * Update user configurations from settings
   */
  updateFromSettings(settings: Settings): void {
    // Update user agent rotation settings
    const userAgentConfig = this.userConfigs.get('rotate_user_agents');
    if (userAgentConfig) {
      userAgentConfig.enabled = settings.enableUserAgentRotation;
      userAgentConfig.parameters = {
        ...userAgentConfig.parameters,
        includeDesktop: settings.enableDesktopUserAgents,
        includeMobile: settings.enableMobileUserAgents,
        includeFirefox: settings.enableFirefoxUserAgents,
        includeChrome: settings.enableChromeUserAgents,
        includeSafari: settings.enableSafariUserAgents,
      };
    }

    // Update delay settings
    const delayConfig = this.userConfigs.get('increase_delays');
    if (delayConfig) {
      delayConfig.enabled = settings.enableDynamicDelays;
      delayConfig.parameters = {
        ...delayConfig.parameters,
        minDelay: settings.minRequestDelay,
        maxDelay: settings.maxRequestDelay,
      };
    }

    // Update exponential backoff
    const backoffConfig = this.userConfigs.get('exponential_backoff');
    if (backoffConfig) {
      backoffConfig.enabled = settings.enableExponentialBackoff;
      backoffConfig.parameters = {
        ...backoffConfig.parameters,
        maxDelay: settings.maxBackoffDelay,
      };
    }

    // Update header randomization
    const headerConfig = this.userConfigs.get('randomize_headers');
    if (headerConfig) {
      headerConfig.enabled = settings.enableHeaderRandomization;
      headerConfig.parameters = {
        ...headerConfig.parameters,
        rotateAcceptLanguage: settings.enableAcceptLanguageVariation,
        rotateAcceptEncoding: settings.enableAcceptEncodingVariation,
        addCustomHeaders: settings.enableCustomHeaders,
      };
    }

    // Update proxy settings
    const proxyConfig = this.userConfigs.get('enable_proxy_rotation');
    if (proxyConfig) {
      proxyConfig.enabled = settings.enableProxyRotation;
      if (settings.proxyRotationUrls) {
        try {
          const urls = JSON.parse(settings.proxyRotationUrls);
          proxyConfig.parameters = {
            ...proxyConfig.parameters,
            proxyUrls: urls,
          };
        } catch (error) {
          console.warn('Failed to parse proxy rotation URLs:', error);
        }
      }
    }

    // Update platform-specific workarounds
    const amazonConfig = this.userConfigs.get('amazon_cookie_management');
    if (amazonConfig) {
      amazonConfig.enabled = settings.enableAmazonWorkarounds && settings.enableCookieManagement;
    }

    const walmartConfig = this.userConfigs.get('walmart_session_persistence');
    if (walmartConfig) {
      walmartConfig.enabled = settings.enableWalmartWorkarounds && settings.enableCookieManagement;
    }

    const jsConfig = this.userConfigs.get('js_challenge_mitigation');
    if (jsConfig) {
      jsConfig.enabled = settings.enableJsChallengeMitigation;
    }

    // Update pattern randomization
    const patternConfig = this.userConfigs.get('randomize_request_patterns');
    if (patternConfig) {
      patternConfig.enabled = settings.enablePatternRandomization;
      patternConfig.parameters = {
        ...patternConfig.parameters,
        randomizeOrder: settings.enableRequestOrderRandomization,
        timingVariation: settings.enableTimingVariation,
      };
    }

    // Update auto-application settings
    SOLUTION_DEFINITIONS.forEach(solution => {
      const config = this.userConfigs.get(solution.id);
      if (config && solution.canAutoApply) {
        config.autoApply = settings.enableAutoSolutionApplication && 
                          settings.autoApplyOnDetection &&
                          !solution.requiresUserInteraction;
      }
    });
  }

  /**
   * Generate solution suggestions for a detection result
   */
  generateSuggestions(
    detection: AntiBotDetectionResult, 
    isDesktop: boolean = false
  ): GroupedSuggestions {
    const relevantSolutions = this.getRelevantSolutions(detection, isDesktop);
    const suggestions = this.createSuggestions(relevantSolutions, detection);
    
    return this.groupSuggestions(suggestions);
  }

  /**
   * Get relevant solutions for a detection
   */
  private getRelevantSolutions(
    detection: AntiBotDetectionResult, 
    isDesktop: boolean
  ): SolutionDefinition[] {
    // Get solutions for detection type
    let solutions = getSolutionsForDetection(detection.detectionType);
    
    // Filter by platform compatibility
    solutions = solutions.filter(solution => 
      isSolutionPlatformCompatible(solution, detection.platform)
    );
    
    // Filter by environment (desktop/web)
    solutions = filterSolutionsByEnvironment(solutions, isDesktop);
    
    // Add platform-specific solutions
    const platformSolutions = PLATFORM_SOLUTIONS[detection.platform] || [];
    const additionalSolutions = platformSolutions
      .map(id => getSolutionById(id))
      .filter(Boolean) as SolutionDefinition[];
    
    // Merge and deduplicate
    const allSolutions = [...solutions, ...additionalSolutions];
    const uniqueSolutions = allSolutions.filter((solution, index, arr) => 
      arr.findIndex(s => s.id === solution.id) === index
    );
    
    return uniqueSolutions;
  }

  /**
   * Create solution suggestions with relevance scores
   */
  private createSuggestions(
    solutions: SolutionDefinition[], 
    detection: AntiBotDetectionResult
  ): SolutionSuggestion[] {
    return solutions.map(solution => {
      const userConfig = this.userConfigs.get(solution.id)!;
      const relevanceScore = this.calculateRelevanceScore(solution, detection);
      const urgency = this.determineUrgency(solution, detection);
      
      return {
        solution,
        relevanceScore,
        urgency,
        userConfig,
        isEnabled: userConfig.enabled,
        canApplyNow: this.canApplyNow(solution, userConfig),
        reasonIfDisabled: this.getDisabledReason(solution, userConfig),
        estimatedImpact: this.getEstimatedImpact(solution, detection),
        applicationSteps: this.getApplicationSteps(solution),
      };
    });
  }

  /**
   * Calculate relevance score for a solution
   */
  private calculateRelevanceScore(
    solution: SolutionDefinition, 
    detection: AntiBotDetectionResult
  ): number {
    let score = solution.estimatedEffectiveness;
    
    // Boost score based on detection confidence
    const confidenceLevel = detection.confidence <= 0.3 ? 'low' : 
                           detection.confidence <= 0.7 ? 'medium' : 'high';
    score *= CONFIDENCE_MULTIPLIERS[confidenceLevel];
    
    // Boost score for solutions that directly address this detection type
    if (solution.detectionTypes.includes(detection.detectionType)) {
      score *= 1.2;
    }
    
    // Consider priority
    const priorityMultiplier = {
      low: 0.8,
      medium: 1.0,
      high: 1.3,
      critical: 1.5,
    }[solution.priority];
    score *= priorityMultiplier;
    
    // Consider effectiveness data if available
    const effectivenessKey = `${solution.id}_${detection.detectionType}_${detection.platform}`;
    const effectiveness = this.effectivenessData.get(effectivenessKey);
    if (effectiveness && effectiveness.totalAttempts > 5) {
      // Use real effectiveness data if we have enough samples
      score = (score * 0.3) + (effectiveness.successRate * 0.7);
    }
    
    // Apply risk penalty for high-risk solutions
    if (solution.riskLevel === 'high') {
      score *= 0.9;
    } else if (solution.riskLevel === 'medium') {
      score *= 0.95;
    }
    
    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * Determine urgency level for a solution
   */
  private determineUrgency(
    solution: SolutionDefinition, 
    detection: AntiBotDetectionResult
  ): 'low' | 'medium' | 'high' | 'immediate' {
    // High confidence detections need immediate action
    if (detection.confidence > 0.8 && solution.priority === 'critical') {
      return 'immediate';
    }
    
    // IP blocks and captchas are high urgency
    if (['ip_block', 'captcha'].includes(detection.detectionType)) {
      return solution.priority === 'critical' ? 'immediate' : 'high';
    }
    
    // Rate limits need quick response
    if (detection.detectionType === 'rate_limit' && solution.priority === 'high') {
      return 'high';
    }
    
    // Map solution priority to urgency
    const urgencyMap = {
      critical: 'high',
      high: 'medium',
      medium: 'medium',
      low: 'low',
    } as const;
    
    return urgencyMap[solution.priority];
  }

  /**
   * Check if solution can be applied now
   */
  private canApplyNow(solution: SolutionDefinition, config: SolutionConfig): boolean {
    if (!config.enabled) return false;
    if (solution.requiresUserInteraction && !config.autoApply) return false;
    
    // Check dependencies
    const dependencies = SOLUTION_DEPENDENCIES[solution.id] || [];
    for (const depId of dependencies) {
      const depConfig = this.userConfigs.get(depId);
      if (!depConfig?.enabled) return false;
    }
    
    // Check conflicts
    const conflicts = SOLUTION_CONFLICTS[solution.id] || [];
    for (const conflictId of conflicts) {
      const conflictConfig = this.userConfigs.get(conflictId);
      if (conflictConfig?.enabled) return false;
    }
    
    return true;
  }

  /**
   * Get reason why solution is disabled
   */
  private getDisabledReason(solution: SolutionDefinition, config: SolutionConfig): string | undefined {
    if (!config.enabled) {
      return 'Solution is disabled in settings';
    }
    
    if (solution.requiresUserInteraction && !config.autoApply) {
      return 'Requires manual confirmation';
    }
    
    // Check dependencies
    const dependencies = SOLUTION_DEPENDENCIES[solution.id] || [];
    for (const depId of dependencies) {
      const depConfig = this.userConfigs.get(depId);
      if (!depConfig?.enabled) {
        const depSolution = getSolutionById(depId);
        return `Requires "${depSolution?.name}" to be enabled`;
      }
    }
    
    // Check conflicts
    const conflicts = SOLUTION_CONFLICTS[solution.id] || [];
    for (const conflictId of conflicts) {
      const conflictConfig = this.userConfigs.get(conflictId);
      if (conflictConfig?.enabled) {
        const conflictSolution = getSolutionById(conflictId);
        return `Conflicts with enabled solution "${conflictSolution?.name}"`;
      }
    }
    
    return undefined;
  }

  /**
   * Get estimated impact description
   */
  private getEstimatedImpact(solution: SolutionDefinition, detection: AntiBotDetectionResult): string {
    const effectiveness = solution.estimatedEffectiveness;
    const confidence = detection.confidence;
    
    if (effectiveness >= 80 && confidence >= 0.7) {
      return 'High likelihood of resolving the detection';
    } else if (effectiveness >= 60 && confidence >= 0.5) {
      return 'Good chance of improving detection avoidance';
    } else if (effectiveness >= 40) {
      return 'May help reduce detection frequency';
    } else {
      return 'Limited impact expected';
    }
  }

  /**
   * Get application steps for a solution
   */
  private getApplicationSteps(solution: SolutionDefinition): string[] {
    const stepMap: Record<string, string[]> = {
      'rotate_user_agents': [
        'Enable user agent rotation in settings',
        'Configure desired browser types',
        'Set rotation frequency',
        'Apply changes to active monitoring'
      ],
      'increase_delays': [
        'Adjust minimum and maximum delay settings',
        'Configure delay multiplier',
        'Apply to all monitoring tasks',
        'Monitor effectiveness'
      ],
      'exponential_backoff': [
        'Enable exponential backoff',
        'Set base delay and maximum delay',
        'Configure backoff multiplier',
        'Test with failed requests'
      ],
      'enable_proxy_rotation': [
        'Configure proxy server list',
        'Test proxy connections',
        'Enable proxy rotation',
        'Restart monitoring with proxy'
      ],
      'vpn_recommendation': [
        'Connect to VPN service',
        'Select different geographic location',
        'Verify IP address change',
        'Resume monitoring activities'
      ],
      'clear_cache_cookies': [
        'Stop all monitoring tasks',
        'Clear browser cache and cookies',
        'Reset session data',
        'Restart monitoring'
      ],
    };
    
    return stepMap[solution.id] || [
      'Review solution configuration',
      'Apply recommended settings',
      'Test solution effectiveness',
      'Monitor results'
    ];
  }

  /**
   * Group suggestions by priority and urgency
   */
  private groupSuggestions(suggestions: SolutionSuggestion[]): GroupedSuggestions {
    const immediate = suggestions.filter(s => s.urgency === 'immediate').sort((a, b) => b.relevanceScore - a.relevanceScore);
    const recommended = suggestions.filter(s => s.urgency === 'high' && s.relevanceScore >= 70).sort((a, b) => b.relevanceScore - a.relevanceScore);
    const optional = suggestions.filter(s => s.urgency === 'medium' || (s.urgency === 'high' && s.relevanceScore < 70)).sort((a, b) => b.relevanceScore - a.relevanceScore);
    const advanced = suggestions.filter(s => s.urgency === 'low' || s.solution.implementationComplexity === 'complex').sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    return { immediate, recommended, optional, advanced };
  }

  /**
   * Apply a solution
   */
  async applySolution(solutionId: string, parameters?: Record<string, any>): Promise<SolutionApplicationResult> {
    const solution = getSolutionById(solutionId);
    const config = this.userConfigs.get(solutionId);
    
    if (!solution || !config) {
      return {
        solutionId,
        success: false,
        message: 'Solution not found',
        appliedAt: Date.now(),
        parameters: parameters || {},
        rollbackAvailable: false,
      };
    }
    
    if (!config.enabled) {
      return {
        solutionId,
        success: false,
        message: 'Solution is disabled',
        appliedAt: Date.now(),
        parameters: parameters || {},
        rollbackAvailable: false,
      };
    }
    
    try {
      // Apply the solution (this would integrate with the actual implementation)
      const appliedParams = { ...config.parameters, ...parameters };
      
      // Simulate application time for complex solutions
      if (solution.implementationComplexity === 'complex') {
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else if (solution.implementationComplexity === 'moderate') {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Update configuration
      config.lastApplied = Date.now();
      config.parameters = appliedParams;
      
      return {
        solutionId,
        success: true,
        message: `${solution.name} applied successfully`,
        appliedAt: Date.now(),
        parameters: appliedParams,
        rollbackAvailable: !solution.requiresRestart,
      };
      
    } catch (error) {
      return {
        solutionId,
        success: false,
        message: `Failed to apply ${solution.name}: ${error}`,
        appliedAt: Date.now(),
        parameters: parameters || {},
        error: String(error),
        rollbackAvailable: false,
      };
    }
  }

  /**
   * Update solution effectiveness
   */
  updateEffectiveness(
    solutionId: string,
    detectionType: DetectionType,
    platform: 'amazon' | 'walmart',
    success: boolean,
    responseTime?: number
  ): void {
    const key = `${solutionId}_${detectionType}_${platform}`;
    let effectiveness = this.effectivenessData.get(key);
    
    if (!effectiveness) {
      effectiveness = {
        solutionId,
        detectionType,
        platform,
        successCount: 0,
        failureCount: 0,
        totalAttempts: 0,
        successRate: 50, // Start with neutral rate
        lastUpdated: Date.now(),
        recentTrend: 'stable',
      };
    }
    
    // Update counts
    effectiveness.totalAttempts++;
    if (success) {
      effectiveness.successCount++;
    } else {
      effectiveness.failureCount++;
    }
    
    // Calculate success rate
    effectiveness.successRate = (effectiveness.successCount / effectiveness.totalAttempts) * 100;
    
    // Update response time if provided
    if (responseTime !== undefined) {
      if (effectiveness.averageResponseTime) {
        effectiveness.averageResponseTime = (effectiveness.averageResponseTime + responseTime) / 2;
      } else {
        effectiveness.averageResponseTime = responseTime;
      }
    }
    
    // Determine trend (simplified)
    const recentSuccessRate = effectiveness.successRate;
    if (recentSuccessRate > 70) {
      effectiveness.recentTrend = 'improving';
    } else if (recentSuccessRate < 30) {
      effectiveness.recentTrend = 'declining';
    } else {
      effectiveness.recentTrend = 'stable';
    }
    
    effectiveness.lastUpdated = Date.now();
    this.effectivenessData.set(key, effectiveness);
    
    // Update user config effectiveness
    const config = this.userConfigs.get(solutionId);
    if (config) {
      config.effectiveness = effectiveness.successRate;
      if (success) {
        config.successCount++;
      } else {
        config.failureCount++;
      }
    }
  }

  /**
   * Get effectiveness data for all solutions
   */
  getEffectivenessData(): SolutionEffectiveness[] {
    return Array.from(this.effectivenessData.values());
  }

  /**
   * Get user configuration for a solution
   */
  getSolutionConfig(solutionId: string): SolutionConfig | undefined {
    return this.userConfigs.get(solutionId);
  }

  /**
   * Update user configuration for a solution
   */
  updateSolutionConfig(solutionId: string, config: Partial<SolutionConfig>): void {
    const existing = this.userConfigs.get(solutionId);
    if (existing) {
      this.userConfigs.set(solutionId, { ...existing, ...config });
    }
  }
}

// Export singleton instance
export const solutionEngine = new SolutionSuggestionEngine();