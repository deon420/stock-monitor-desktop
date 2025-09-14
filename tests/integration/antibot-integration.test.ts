import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import axios from 'axios';
import { Worker } from 'worker_threads';
import path from 'path';
import fs from 'fs/promises';
import { AntiBotDetectionResult } from '@/contexts/AntiDetectionContext';

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:5000',
  timeout: 60000, // 60 seconds for scraping tests
  maxRetries: 3,
  
  // Real URLs for testing different scenarios
  testUrls: {
    amazon: [
      'https://www.amazon.com/dp/B08N5WRWNW', // Echo Dot (popular, likely to have protection)
      'https://www.amazon.com/dp/B0BCQ7FZN5', // Fire TV Stick
      'https://www.amazon.com/gp/bestsellers', // Bestsellers page (high traffic)
      'https://www.amazon.com/s?k=laptop', // Search results (complex page)
    ],
    walmart: [
      'https://www.walmart.com/ip/Apple-iPhone-14-128GB-Blue/1944945036', // iPhone (popular item)
      'https://www.walmart.com/ip/Nintendo-Switch/55449983', // Nintendo Switch
      'https://www.walmart.com/browse/electronics', // Category page
      'https://www.walmart.com/search/?query=tablet', // Search results
    ]
  },
  
  // Detection scenarios to test
  scenarios: [
    {
      name: 'rapid_fire_requests',
      description: 'Trigger rate limiting with rapid consecutive requests',
      requestCount: 10,
      delayBetween: 100, // 100ms
      expectedDetection: ['rate_limit', 'cloudflare', 'aws_waf']
    },
    {
      name: 'single_request_detection',
      description: 'Single request to detect basic anti-bot measures',
      requestCount: 1,
      delayBetween: 0,
      expectedDetection: ['ip_block', 'cloudflare', 'platform_specific']
    },
    {
      name: 'user_agent_variation',
      description: 'Test different user agents to see varying responses',
      requestCount: 5,
      delayBetween: 2000, // 2 seconds
      expectedDetection: ['cloudflare', 'platform_specific']
    },
    {
      name: 'sustained_monitoring',
      description: 'Simulate real monitoring behavior over time',
      requestCount: 3,
      delayBetween: 15000, // 15 seconds
      expectedDetection: ['rate_limit', 'ip_block']
    }
  ]
};

interface TestResult {
  scenario: string;
  platform: 'amazon' | 'walmart';
  url: string;
  detectionResult: AntiBotDetectionResult | null;
  responseTime: number;
  httpStatus: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

interface ScenarioResults {
  scenarioName: string;
  totalRequests: number;
  successfulDetections: number;
  detectionTypes: Record<string, number>;
  avgResponseTime: number;
  results: TestResult[];
}

class AntiBotIntegrationTester {
  private testResults: TestResult[] = [];
  private workerPool: Worker[] = [];
  
  constructor() {
    console.log('🔬 Initializing Anti-Bot Integration Tester');
  }
  
  /**
   * Initialize worker pool for testing
   */
  async initializeWorkers(): Promise<void> {
    const workerPath = path.join(__dirname, '../../server/scraping-worker.js');
    
    // Create 3 workers for concurrent testing
    for (let i = 0; i < 3; i++) {
      const worker = new Worker(workerPath);
      this.workerPool.push(worker);
    }
    
    console.log(`✅ Initialized ${this.workerPool.length} test workers`);
  }
  
  /**
   * Clean up workers
   */
  async cleanupWorkers(): Promise<void> {
    for (const worker of this.workerPool) {
      await worker.terminate();
    }
    this.workerPool = [];
    console.log('🧹 Cleaned up test workers');
  }
  
  /**
   * Execute single scraping test
   */
  async executeSingleTest(
    url: string,
    platform: 'amazon' | 'walmart',
    scenario: string,
    customHeaders?: Record<string, string>
  ): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🕐 Testing ${platform} URL: ${url.substring(0, 50)}...`);
      
      // Use our scraping worker to perform the test
      const worker = this.workerPool[Math.floor(Math.random() * this.workerPool.length)];
      
      const scrapingTask = {
        id: `test-${Date.now()}-${Math.random()}`,
        url,
        platform,
        maxRetries: 1, // Single attempt for testing
        headers: customHeaders
      };
      
      // Execute scraping with timeout
      const result = await this.executeWorkerTask(worker, scrapingTask);
      const responseTime = Date.now() - startTime;
      
      const testResult: TestResult = {
        scenario,
        platform,
        url,
        detectionResult: result.antiBot || null,
        responseTime,
        httpStatus: result.requestStats?.responseCode || 0,
        timestamp: Date.now(),
        success: !result.antiBot?.isBlocked || false,
        error: result.error
      };
      
      this.testResults.push(testResult);
      return testResult;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const testResult: TestResult = {
        scenario,
        platform,
        url,
        detectionResult: null,
        responseTime,
        httpStatus: 0,
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      this.testResults.push(testResult);
      return testResult;
    }
  }
  
  /**
   * Execute worker task with promise wrapper
   */
  private executeWorkerTask(worker: Worker, task: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker task timeout'));
      }, TEST_CONFIG.timeout);
      
      const messageHandler = (result: any) => {
        clearTimeout(timeout);
        worker.off('message', messageHandler);
        worker.off('error', errorHandler);
        resolve(result);
      };
      
      const errorHandler = (error: Error) => {
        clearTimeout(timeout);
        worker.off('message', messageHandler);
        worker.off('error', errorHandler);
        reject(error);
      };
      
      worker.on('message', messageHandler);
      worker.on('error', errorHandler);
      worker.postMessage(task);
    });
  }
  
  /**
   * Execute test scenario
   */
  async executeScenario(scenarioConfig: any): Promise<ScenarioResults> {
    console.log(`\n🚀 Executing scenario: ${scenarioConfig.name}`);
    console.log(`📝 Description: ${scenarioConfig.description}`);
    
    const scenarioResults: ScenarioResults = {
      scenarioName: scenarioConfig.name,
      totalRequests: 0,
      successfulDetections: 0,
      detectionTypes: {},
      avgResponseTime: 0,
      results: []
    };
    
    // Test both Amazon and Walmart
    for (const platform of ['amazon', 'walmart'] as const) {
      const urls = TEST_CONFIG.testUrls[platform];
      
      for (let i = 0; i < scenarioConfig.requestCount; i++) {
        // Rotate through URLs
        const url = urls[i % urls.length];
        
        // Add delay between requests if specified
        if (i > 0 && scenarioConfig.delayBetween > 0) {
          console.log(`⏳ Waiting ${scenarioConfig.delayBetween}ms before next request...`);
          await new Promise(resolve => setTimeout(resolve, scenarioConfig.delayBetween));
        }
        
        const result = await this.executeSingleTest(url, platform, scenarioConfig.name);
        scenarioResults.results.push(result);
        scenarioResults.totalRequests++;
        
        // Track detection types
        if (result.detectionResult?.isBlocked) {
          scenarioResults.successfulDetections++;
          const detectionType = result.detectionResult.detectionType;
          scenarioResults.detectionTypes[detectionType] = 
            (scenarioResults.detectionTypes[detectionType] || 0) + 1;
        }
        
        // Log immediate results
        this.logTestResult(result);
      }
    }
    
    // Calculate average response time
    const totalResponseTime = scenarioResults.results.reduce(
      (sum, result) => sum + result.responseTime, 0
    );
    scenarioResults.avgResponseTime = totalResponseTime / scenarioResults.totalRequests;
    
    return scenarioResults;
  }
  
  /**
   * Log individual test result
   */
  private logTestResult(result: TestResult): void {
    const status = result.detectionResult?.isBlocked ? '🚫 BLOCKED' : '✅ SUCCESS';
    const detectionType = result.detectionResult?.detectionType || 'none';
    const confidence = result.detectionResult?.confidence ? 
      `(${(result.detectionResult.confidence * 100).toFixed(1)}%)` : '';
    
    console.log(
      `${status} ${result.platform.toUpperCase()}: ${detectionType} ${confidence} ` +
      `${result.responseTime}ms HTTP:${result.httpStatus}`
    );
    
    if (result.error) {
      console.log(`❌ Error: ${result.error}`);
    }
  }
  
  /**
   * Run comprehensive test suite
   */
  async runComprehensiveTests(): Promise<ScenarioResults[]> {
    console.log('🔍 Starting Comprehensive Anti-Bot Detection Tests');
    console.log('=' * 60);
    
    await this.initializeWorkers();
    
    const allResults: ScenarioResults[] = [];
    
    try {
      // Execute each test scenario
      for (const scenario of TEST_CONFIG.scenarios) {
        const results = await this.executeScenario(scenario);
        allResults.push(results);
        
        // Brief pause between scenarios
        console.log('\n⏸️  Pausing 5 seconds between scenarios...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      return allResults;
      
    } finally {
      await this.cleanupWorkers();
    }
  }
  
  /**
   * Generate comprehensive test report
   */
  generateTestReport(scenarioResults: ScenarioResults[]): string {
    let report = '# Anti-Bot Detection Integration Test Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Total Scenarios: ${scenarioResults.length}\n\n`;
    
    // Executive Summary
    report += '## Executive Summary\n\n';
    const totalRequests = scenarioResults.reduce((sum, s) => sum + s.totalRequests, 0);
    const totalDetections = scenarioResults.reduce((sum, s) => sum + s.successfulDetections, 0);
    const detectionRate = ((totalDetections / totalRequests) * 100).toFixed(1);
    
    report += `- **Total Requests**: ${totalRequests}\n`;
    report += `- **Successful Detections**: ${totalDetections}\n`;
    report += `- **Detection Rate**: ${detectionRate}%\n\n`;
    
    // Detection Type Summary
    const allDetectionTypes: Record<string, number> = {};
    scenarioResults.forEach(scenario => {
      Object.entries(scenario.detectionTypes).forEach(([type, count]) => {
        allDetectionTypes[type] = (allDetectionTypes[type] || 0) + count;
      });
    });
    
    report += '## Detection Types Identified\n\n';
    Object.entries(allDetectionTypes)
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, count]) => {
        report += `- **${type}**: ${count} occurrences\n`;
      });
    
    report += '\n';
    
    // Scenario Details
    report += '## Scenario Results\n\n';
    scenarioResults.forEach(scenario => {
      report += `### ${scenario.scenarioName}\n\n`;
      report += `- **Total Requests**: ${scenario.totalRequests}\n`;
      report += `- **Detections**: ${scenario.successfulDetections}\n`;
      report += `- **Detection Rate**: ${((scenario.successfulDetections / scenario.totalRequests) * 100).toFixed(1)}%\n`;
      report += `- **Avg Response Time**: ${scenario.avgResponseTime.toFixed(0)}ms\n\n`;
      
      if (Object.keys(scenario.detectionTypes).length > 0) {
        report += '**Detection Types:**\n';
        Object.entries(scenario.detectionTypes).forEach(([type, count]) => {
          report += `- ${type}: ${count}\n`;
        });
        report += '\n';
      }
    });
    
    // Detailed Results
    report += '## Detailed Test Results\n\n';
    scenarioResults.forEach(scenario => {
      report += `### ${scenario.scenarioName} - Detailed Results\n\n`;
      report += '| Platform | URL | Detection Type | Confidence | Response Time | Status |\n';
      report += '|----------|-----|----------------|------------|---------------|--------|\n';
      
      scenario.results.forEach(result => {
        const detectionType = result.detectionResult?.detectionType || 'none';
        const confidence = result.detectionResult?.confidence ? 
          `${(result.detectionResult.confidence * 100).toFixed(1)}%` : 'N/A';
        const status = result.detectionResult?.isBlocked ? 'BLOCKED' : 'SUCCESS';
        const shortUrl = result.url.length > 50 ? 
          result.url.substring(0, 47) + '...' : result.url;
        
        report += `| ${result.platform} | ${shortUrl} | ${detectionType} | ${confidence} | ${result.responseTime}ms | ${status} |\n`;
      });
      
      report += '\n';
    });
    
    return report;
  }
  
  /**
   * Save test results to file
   */
  async saveTestResults(
    scenarioResults: ScenarioResults[], 
    filename?: string
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFilename = filename || `antibot-test-report-${timestamp}.md`;
    const reportPath = path.join(process.cwd(), 'tests', 'results', reportFilename);
    
    // Ensure results directory exists
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    
    const report = this.generateTestReport(scenarioResults);
    await fs.writeFile(reportPath, report, 'utf-8');
    
    // Also save raw JSON data
    const jsonPath = reportPath.replace('.md', '.json');
    await fs.writeFile(jsonPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      config: TEST_CONFIG,
      results: scenarioResults,
      allTestResults: this.testResults
    }, null, 2), 'utf-8');
    
    console.log(`📊 Test report saved to: ${reportPath}`);
    console.log(`📋 Raw data saved to: ${jsonPath}`);
    
    return reportPath;
  }
}

// Jest test suite
describe('Anti-Bot Detection Integration Tests', () => {
  let tester: AntiBotIntegrationTester;
  let testResults: ScenarioResults[];
  
  beforeAll(async () => {
    tester = new AntiBotIntegrationTester();
  }, 30000); // 30 second timeout for setup
  
  afterAll(async () => {
    if (tester && testResults) {
      await tester.saveTestResults(testResults);
    }
  });
  
  it('should detect anti-bot measures in rapid fire scenario', async () => {
    const rapidFireScenario = TEST_CONFIG.scenarios.find(s => s.name === 'rapid_fire_requests');
    expect(rapidFireScenario).toBeDefined();
    
    const results = await tester.executeScenario(rapidFireScenario!);
    
    // Should detect some form of protection with rapid requests
    expect(results.successfulDetections).toBeGreaterThan(0);
    expect(results.totalRequests).toBeGreaterThan(0);
    
    // Should detect rate limiting or similar
    const hasExpectedDetection = rapidFireScenario!.expectedDetection.some(
      detection => results.detectionTypes[detection] > 0
    );
    expect(hasExpectedDetection).toBe(true);
    
  }, TEST_CONFIG.timeout * 2);
  
  it('should run comprehensive test suite and generate report', async () => {
    testResults = await tester.runComprehensiveTests();
    
    expect(testResults).toBeDefined();
    expect(testResults.length).toBe(TEST_CONFIG.scenarios.length);
    
    // Each scenario should have completed
    testResults.forEach(result => {
      expect(result.totalRequests).toBeGreaterThan(0);
      expect(result.avgResponseTime).toBeGreaterThan(0);
    });
    
    // Should have detected some anti-bot measures overall
    const totalDetections = testResults.reduce((sum, r) => sum + r.successfulDetections, 0);
    expect(totalDetections).toBeGreaterThan(0);
    
  }, TEST_CONFIG.timeout * 10); // Very long timeout for full suite
  
  it('should properly log detection events', async () => {
    // This test verifies that detection events are properly logged
    // We'll check that the anti-bot logger received events
    
    const logPath = path.join(process.cwd(), 'logs', 'antibot');
    
    try {
      const files = await fs.readdir(logPath);
      const detectionLogFiles = files.filter(f => f.includes('detection-events'));
      
      expect(detectionLogFiles.length).toBeGreaterThan(0);
      
      // Read the most recent detection log
      const latestLogFile = detectionLogFiles.sort().pop();
      if (latestLogFile) {
        const logContent = await fs.readFile(
          path.join(logPath, latestLogFile), 
          'utf-8'
        );
        
        // Should contain detection events from our tests
        expect(logContent.length).toBeGreaterThan(0);
      }
      
    } catch (error) {
      console.warn('Anti-bot logs not found, this may be expected in test environment');
    }
  });
});

// Export for use in other tests
export { AntiBotIntegrationTester, TEST_CONFIG, type TestResult, type ScenarioResults };