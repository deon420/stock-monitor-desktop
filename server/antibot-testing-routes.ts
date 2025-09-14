import type { Express } from "express";
import { requireAuth, requireAdmin } from "./auth";
import { AntiBotIntegrationTester, TEST_CONFIG, type TestResult, type ScenarioResults } from "./antibot-test-framework";
import { Worker } from 'worker_threads';
import path from 'path';
import fs from 'fs/promises';
import { getAntiBotLogger } from './antibot-logger';

// Global test runner instance
let globalTestRunner: AntiBotIntegrationTester | null = null;
let currentTestRun: {
  id: string;
  status: 'running' | 'completed' | 'failed';
  startTime: number;
  results?: ScenarioResults[];
  error?: string;
  progress: {
    currentScenario: string;
    scenarioIndex: number;
    totalScenarios: number;
    currentRequest: number;
    totalRequests: number;
  };
} | null = null;

interface LiveTestResult {
  id: string;
  platform: 'amazon' | 'walmart';
  url: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  responseTime?: number;
  detectionResult?: any;
  httpStatus?: number;
  error?: string;
}

let liveTestResults: Map<string, LiveTestResult> = new Map();

/**
 * Setup anti-bot testing routes
 */
export function setupAntiBotTestingRoutes(app: Express): void {
  // Get test configuration and status
  app.get("/api/antibot/test/config", requireAuth, requireAdmin, (req, res) => {
    res.json({
      success: true,
      config: TEST_CONFIG,
      currentTest: currentTestRun ? {
        id: currentTestRun.id,
        status: currentTestRun.status,
        startTime: currentTestRun.startTime,
        progress: currentTestRun.progress
      } : null
    });
  });

  // Start comprehensive test suite
  app.post("/api/antibot/test/start-suite", requireAuth, requireAdmin, async (req, res) => {
    try {
      if (currentTestRun && currentTestRun.status === 'running') {
        return res.status(409).json({
          success: false,
          error: 'Test suite is already running',
          currentTestId: currentTestRun.id
        });
      }

      const testId = `test-suite-${Date.now()}`;
      
      currentTestRun = {
        id: testId,
        status: 'running',
        startTime: Date.now(),
        progress: {
          currentScenario: 'initializing',
          scenarioIndex: 0,
          totalScenarios: TEST_CONFIG.scenarios.length,
          currentRequest: 0,
          totalRequests: 0
        }
      };

      res.json({
        success: true,
        testId,
        message: 'Test suite started',
        estimatedDuration: '10-15 minutes'
      });

      // Run tests asynchronously
      runTestSuiteAsync(testId);

    } catch (error) {
      console.error('Error starting test suite:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start test suite'
      });
    }
  });

  // Get test suite status and progress
  app.get("/api/antibot/test/status", requireAuth, requireAdmin, (req, res) => {
    if (!currentTestRun) {
      return res.json({
        success: true,
        status: 'idle',
        message: 'No test currently running'
      });
    }

    const duration = Date.now() - currentTestRun.startTime;
    
    res.json({
      success: true,
      testRun: {
        id: currentTestRun.id,
        status: currentTestRun.status,
        startTime: currentTestRun.startTime,
        duration,
        progress: currentTestRun.progress,
        results: currentTestRun.results,
        error: currentTestRun.error
      }
    });
  });

  // Stop current test suite
  app.post("/api/antibot/test/stop", requireAuth, requireAdmin, (req, res) => {
    if (!currentTestRun || currentTestRun.status !== 'running') {
      return res.status(400).json({
        success: false,
        error: 'No test suite currently running'
      });
    }

    currentTestRun.status = 'failed';
    currentTestRun.error = 'Stopped by user';

    res.json({
      success: true,
      message: 'Test suite stopped'
    });
  });

  // Execute single test for immediate feedback
  app.post("/api/antibot/test/single", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { url, platform, scenario = 'manual_test' } = req.body;

      if (!url || !platform) {
        return res.status(400).json({
          success: false,
          error: 'URL and platform are required'
        });
      }

      if (!url.includes(platform === 'amazon' ? 'amazon.com' : 'walmart.com')) {
        return res.status(400).json({
          success: false,
          error: `URL must be from ${platform === 'amazon' ? 'Amazon' : 'Walmart'}`
        });
      }

      const testId = `single-test-${Date.now()}`;
      
      // Create a temporary test runner
      const tempTester = new AntiBotIntegrationTester();
      await tempTester.initializeWorkers();

      try {
        const result = await tempTester.executeSingleTest(url, platform, scenario);
        
        res.json({
          success: true,
          testId,
          result,
          detection: result.detectionResult ? {
            isBlocked: result.detectionResult.isBlocked,
            detectionType: result.detectionResult.detectionType,
            confidence: result.detectionResult.confidence,
            platform: result.detectionResult.platform,
            responseCode: result.detectionResult.responseCode,
            responseTime: result.detectionResult.responseTime,
            suggestedAction: result.detectionResult.suggestedAction,
            details: result.detectionResult.details
          } : null
        });
        
      } finally {
        await tempTester.cleanupWorkers();
      }

    } catch (error) {
      console.error('Error executing single test:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  // Get test results history
  app.get("/api/antibot/test/results", requireAuth, requireAdmin, async (req, res) => {
    try {
      const resultsDir = path.join(process.cwd(), 'tests', 'results');
      
      let files: string[] = [];
      try {
        files = await fs.readdir(resultsDir);
      } catch (error) {
        // Directory doesn't exist yet
        return res.json({
          success: true,
          results: []
        });
      }

      const testFiles = files
        .filter(f => f.endsWith('.json') && f.includes('antibot-test-report'))
        .sort()
        .reverse(); // Most recent first

      const results = await Promise.all(
        testFiles.slice(0, 10).map(async (filename) => { // Last 10 results
          try {
            const filePath = path.join(resultsDir, filename);
            const content = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(content);
            
            return {
              filename,
              timestamp: data.timestamp,
              totalRequests: data.results?.reduce((sum: number, r: any) => sum + r.totalRequests, 0) || 0,
              totalDetections: data.results?.reduce((sum: number, r: any) => sum + r.successfulDetections, 0) || 0,
              scenarios: data.results?.length || 0,
              detectionRate: data.results?.length > 0 ? 
                ((data.results.reduce((sum: number, r: any) => sum + r.successfulDetections, 0) / 
                  data.results.reduce((sum: number, r: any) => sum + r.totalRequests, 0)) * 100).toFixed(1) + '%' : '0%'
            };
          } catch (error) {
            console.error(`Error reading test result file ${filename}:`, error);
            return null;
          }
        })
      );

      res.json({
        success: true,
        results: results.filter(Boolean)
      });

    } catch (error) {
      console.error('Error fetching test results:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch test results'
      });
    }
  });

  // Download specific test result report
  app.get("/api/antibot/test/download/:filename", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { filename } = req.params;
      
      // Security: only allow specific file patterns
      if (!/^antibot-test-report-[\w-]+\.(json|md)$/.test(filename)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid filename'
        });
      }

      const filePath = path.join(process.cwd(), 'tests', 'results', filename);
      
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        
        if (filename.endsWith('.json')) {
          res.setHeader('Content-Type', 'application/json');
        } else {
          res.setHeader('Content-Type', 'text/markdown');
        }
        
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(content);
        
      } catch (error) {
        res.status(404).json({
          success: false,
          error: 'Test result file not found'
        });
      }

    } catch (error) {
      console.error('Error downloading test result:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to download test result'
      });
    }
  });

  // Get live anti-bot detection logs
  app.get("/api/antibot/test/live-logs", requireAuth, requireAdmin, async (req, res) => {
    try {
      const antiBotLogger = getAntiBotLogger();
      const recentLogs = await antiBotLogger.getRecentDetectionEvents(50); // Last 50 events
      
      res.json({
        success: true,
        logs: recentLogs,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error fetching live logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch live detection logs'
      });
    }
  });

  // Test specific URLs with controlled parameters
  app.post("/api/antibot/test/controlled", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { 
        urls = [], 
        requestCount = 1,
        delayBetween = 1000,
        useRandomUserAgents = true,
        useRandomHeaders = true
      } = req.body;

      if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'URLs array is required and must not be empty'
        });
      }

      const testId = `controlled-test-${Date.now()}`;
      const results: LiveTestResult[] = [];

      // Track this test
      liveTestResults.set(testId, {
        id: testId,
        platform: urls[0]?.includes('amazon') ? 'amazon' : 'walmart',
        url: 'multiple',
        status: 'running',
        startTime: Date.now()
      });

      res.json({
        success: true,
        testId,
        message: 'Controlled test started',
        estimatedDuration: `${Math.ceil((urls.length * requestCount * delayBetween) / 1000)} seconds`
      });

      // Execute controlled test asynchronously
      executeControlledTestAsync(testId, {
        urls,
        requestCount,
        delayBetween,
        useRandomUserAgents,
        useRandomHeaders
      });

    } catch (error) {
      console.error('Error starting controlled test:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start controlled test'
      });
    }
  });

  // Get controlled test status
  app.get("/api/antibot/test/controlled/:testId", requireAuth, requireAdmin, (req, res) => {
    const { testId } = req.params;
    const testResult = liveTestResults.get(testId);

    if (!testResult) {
      return res.status(404).json({
        success: false,
        error: 'Test not found'
      });
    }

    res.json({
      success: true,
      test: testResult
    });
  });
}

/**
 * Run test suite asynchronously
 */
async function runTestSuiteAsync(testId: string): Promise<void> {
  try {
    if (!currentTestRun || currentTestRun.id !== testId) {
      return; // Test was cancelled
    }

    globalTestRunner = new AntiBotIntegrationTester();
    
    // Calculate total requests across all scenarios
    const totalRequests = TEST_CONFIG.scenarios.reduce(
      (sum, scenario) => sum + (scenario.requestCount * 2), // *2 for Amazon + Walmart
      0
    );

    currentTestRun.progress.totalRequests = totalRequests;

    const results = await globalTestRunner.runComprehensiveTests();

    if (currentTestRun && currentTestRun.id === testId) {
      currentTestRun.status = 'completed';
      currentTestRun.results = results;
      
      // Save results
      await globalTestRunner.saveTestResults(results, `admin-test-${testId}.md`);
    }

  } catch (error) {
    console.error('Test suite execution error:', error);
    
    if (currentTestRun && currentTestRun.id === testId) {
      currentTestRun.status = 'failed';
      currentTestRun.error = error instanceof Error ? error.message : 'Unknown error';
    }
  } finally {
    if (globalTestRunner) {
      await globalTestRunner.cleanupWorkers();
      globalTestRunner = null;
    }
  }
}

/**
 * Execute controlled test asynchronously
 */
async function executeControlledTestAsync(
  testId: string, 
  params: {
    urls: string[];
    requestCount: number;
    delayBetween: number;
    useRandomUserAgents: boolean;
    useRandomHeaders: boolean;
  }
): Promise<void> {
  const tempTester = new AntiBotIntegrationTester();
  
  try {
    await tempTester.initializeWorkers();
    
    const testResult = liveTestResults.get(testId);
    if (!testResult) return;

    // Execute requests
    for (let i = 0; i < params.requestCount; i++) {
      for (const url of params.urls) {
        const platform = url.includes('amazon.com') ? 'amazon' : 'walmart';
        
        try {
          const result = await tempTester.executeSingleTest(
            url,
            platform,
            `controlled-${testId}`
          );
          
          // Update test result (simplified for controlled tests)
          if (i === params.requestCount - 1 && url === params.urls[params.urls.length - 1]) {
            testResult.status = 'completed';
            testResult.responseTime = result.responseTime;
            testResult.detectionResult = result.detectionResult;
            testResult.httpStatus = result.httpStatus;
            testResult.error = result.error;
          }
          
        } catch (error) {
          testResult.status = 'failed';
          testResult.error = error instanceof Error ? error.message : 'Unknown error';
          break;
        }

        if (params.delayBetween > 0) {
          await new Promise(resolve => setTimeout(resolve, params.delayBetween));
        }
      }
    }

  } catch (error) {
    const testResult = liveTestResults.get(testId);
    if (testResult) {
      testResult.status = 'failed';
      testResult.error = error instanceof Error ? error.message : 'Unknown error';
    }
  } finally {
    await tempTester.cleanupWorkers();
  }
}