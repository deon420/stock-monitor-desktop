import { parentPort } from 'worker_threads';
import * as cheerio from 'cheerio';
import axios from 'axios';

interface ScrapingTask {
  id: string;
  url: string;
  platform: "amazon" | "walmart";
  maxRetries?: number;
  responseData?: string;
  headers?: Record<string, string>;
}

interface AntiBotDetectionResult {
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

interface ScrapingResult {
  id: string;
  success: boolean;
  productName?: string;
  error?: string;
  antiBot?: AntiBotDetectionResult;
}

// Worker-specific axios instance with connection pooling
const workerAxios = axios.create({
  timeout: 30000,
  maxRedirects: 5,
  // Enable HTTP keep-alive for connection reuse
  httpAgent: new (require('http').Agent)({ keepAlive: true, maxSockets: 5 }),
  httpsAgent: new (require('https').Agent)({ keepAlive: true, maxSockets: 5 })
});

function getRandomUserAgent(): string {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function generateBrowserHeaders(userAgent: string, platform: "amazon" | "walmart"): Record<string, string> {
  const baseHeaders: Record<string, string> = {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'max-age=0',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  };
  
  if (platform === 'amazon') {
    baseHeaders.Referer = 'https://www.amazon.com/';
  } else {
    baseHeaders.Referer = 'https://www.walmart.com/';
  }
  
  return baseHeaders;
}

function detectAntiBot(html: string, url: string, responseCode: number, responseTime: number, headers: Record<string, string>): AntiBotDetectionResult {
  const platform = url.includes('amazon') ? 'amazon' : 'walmart';
  const timestamp = Date.now();
  
  // Start with no detection
  let result: AntiBotDetectionResult = {
    isBlocked: false,
    detectionType: 'none',
    confidence: 0,
    platform,
    responseCode,
    responseTime,
    timestamp,
    suggestedAction: 'continue',
    details: {}
  };

  // 1. Cloudflare Detection
  const cloudflareDetection = detectCloudflareProtection(html, headers);
  if ((cloudflareDetection.confidence || 0) > result.confidence) {
    result = { ...result, ...cloudflareDetection, platform, responseCode, responseTime, timestamp };
  }

  // 2. AWS WAF Detection  
  const wafDetection = detectAWSWAF(html, headers, responseCode);
  if ((wafDetection.confidence || 0) > result.confidence) {
    result = { ...result, ...wafDetection, platform, responseCode, responseTime, timestamp };
  }

  // 3. Rate Limiting Detection
  const rateLimitDetection = detectRateLimiting(html, headers, responseCode, responseTime);
  if ((rateLimitDetection.confidence || 0) > result.confidence) {
    result = { ...result, ...rateLimitDetection, platform, responseCode, responseTime, timestamp };
  }

  // 4. IP Block Detection
  const ipBlockDetection = detectIPBlock(html, headers, responseCode);
  if ((ipBlockDetection.confidence || 0) > result.confidence) {
    result = { ...result, ...ipBlockDetection, platform, responseCode, responseTime, timestamp };
  }

  // 5. JavaScript Challenge Detection
  const jsDetection = detectJavaScriptChallenge(html);
  if ((jsDetection.confidence || 0) > result.confidence) {
    result = { ...result, ...jsDetection, platform, responseCode, responseTime, timestamp };
  }

  // 6. Platform-specific Detection
  const platformDetection = detectPlatformSpecificBlocking(html, platform, headers);
  if ((platformDetection.confidence || 0) > result.confidence) {
    result = { ...result, ...platformDetection, platform, responseCode, responseTime, timestamp };
  }

  // 7. Response Anomaly Detection
  const anomalyDetection = detectResponseAnomalies(html, responseCode, responseTime, url);
  if ((anomalyDetection.confidence || 0) > result.confidence) {
    result = { ...result, ...anomalyDetection, platform, responseCode, responseTime, timestamp };
  }

  // Store raw response for high-confidence detections
  if (result.confidence > 0.7) {
    result.rawResponse = html.substring(0, 5000); // Limit size
  }

  return result;
}

// 1. Cloudflare Protection Detection
function detectCloudflareProtection(html: string, headers: Record<string, string>): Partial<AntiBotDetectionResult> {
  const lowerHtml = html.toLowerCase();
  let confidence = 0;
  const details: Record<string, any> = {};

  // Check for Cloudflare headers
  if (headers['cf-ray'] || headers['server']?.includes('cloudflare')) {
    confidence += 0.2;
    details.cloudflareHeaders = true;
  }

  // Check for Cloudflare challenge pages
  const cloudflarePatterns = [
    'checking your browser before accessing',
    'cloudflare ray id',
    'cf-browser-verification',
    'cf-challenge-form',
    '__cf_chl_jschl_tk__',
    'please wait while we check your browser',
    'ddos protection by cloudflare',
    'cf-wrapper',
    'cf-error-details'
  ];

  cloudflarePatterns.forEach(pattern => {
    if (lowerHtml.includes(pattern)) {
      confidence += 0.15;
      details.patterns = details.patterns || [];
      details.patterns.push(pattern);
    }
  });

  // Check for Cloudflare JavaScript challenges
  if (lowerHtml.includes('jschl-answer') || lowerHtml.includes('__cf_chl_tk')) {
    confidence += 0.3;
    details.jsChallenge = true;
  }

  if (confidence > 0.5) {
    return {
      isBlocked: true,
      detectionType: 'cloudflare',
      confidence: Math.min(confidence, 1.0),
      suggestedAction: 'Wait and retry with different headers, or use proxy rotation',
      details
    };
  }

  return { confidence: 0 };
}

// 2. AWS WAF Detection
function detectAWSWAF(html: string, headers: Record<string, string>, responseCode: number): Partial<AntiBotDetectionResult> {
  const lowerHtml = html.toLowerCase();
  let confidence = 0;
  const details: Record<string, any> = {};

  // Check for AWS WAF specific responses
  if (responseCode === 403) {
    confidence += 0.2;
    details.forbiddenResponse = true;
  }

  // AWS WAF patterns
  const wafPatterns = [
    'aws waf',
    'request blocked',
    'web application firewall',
    'waf rule',
    'access denied by waf',
    'security rule triggered'
  ];

  wafPatterns.forEach(pattern => {
    if (lowerHtml.includes(pattern)) {
      confidence += 0.2;
      details.patterns = details.patterns || [];
      details.patterns.push(pattern);
    }
  });

  // Check for specific AWS error responses
  if (lowerHtml.includes('access denied') && (lowerHtml.includes('amazon') || lowerHtml.includes('aws'))) {
    confidence += 0.3;
    details.awsAccessDenied = true;
  }

  if (confidence > 0.4) {
    return {
      isBlocked: true,
      detectionType: 'aws_waf',
      confidence: Math.min(confidence, 1.0),
      suggestedAction: 'Change IP address, modify request patterns, or wait before retrying',
      details
    };
  }

  return { confidence: 0 };
}

// 3. Rate Limiting Detection
function detectRateLimiting(html: string, headers: Record<string, string>, responseCode: number, responseTime: number): Partial<AntiBotDetectionResult> {
  const lowerHtml = html.toLowerCase();
  let confidence = 0;
  const details: Record<string, any> = {};

  // Check for rate limiting status codes
  if (responseCode === 429) {
    confidence += 0.6;
    details.rateLimitStatusCode = true;
  }

  // Check for rate limiting headers
  if (headers['retry-after'] || headers['x-ratelimit-remaining'] === '0') {
    confidence += 0.4;
    details.rateLimitHeaders = true;
  }

  // Check for rate limiting content
  const rateLimitPatterns = [
    'too many requests',
    'rate limit exceeded',
    'request limit reached',
    'slow down',
    'try again later',
    'temporarily unavailable',
    'service temporarily unavailable'
  ];

  rateLimitPatterns.forEach(pattern => {
    if (lowerHtml.includes(pattern)) {
      confidence += 0.2;
      details.patterns = details.patterns || [];
      details.patterns.push(pattern);
    }
  });

  // Very fast response might indicate immediate blocking
  if (responseTime < 200) {
    confidence += 0.1;
    details.fastResponse = true;
  }

  if (confidence > 0.5) {
    const retryAfter = headers['retry-after'] || '300';
    return {
      isBlocked: true,
      detectionType: 'rate_limit',
      confidence: Math.min(confidence, 1.0),
      suggestedAction: `Wait ${retryAfter} seconds before retrying, or rotate IP/user agent`,
      details
    };
  }

  return { confidence: 0 };
}

// 4. IP Block Detection
function detectIPBlock(html: string, headers: Record<string, string>, responseCode: number): Partial<AntiBotDetectionResult> {
  const lowerHtml = html.toLowerCase();
  let confidence = 0;
  const details: Record<string, any> = {};

  // Check for IP blocking status codes
  if ([403, 401, 451].includes(responseCode)) {
    confidence += 0.2;
    details.blockingStatusCode = responseCode;
  }

  // IP block patterns
  const ipBlockPatterns = [
    'your ip address has been blocked',
    'ip address is blocked',
    'access denied from your location',
    'geographic restriction',
    'not available in your country',
    'blocked in your region',
    'ip banned',
    'unauthorized access'
  ];

  ipBlockPatterns.forEach(pattern => {
    if (lowerHtml.includes(pattern)) {
      confidence += 0.25;
      details.patterns = details.patterns || [];
      details.patterns.push(pattern);
    }
  });

  // Empty response might indicate IP blocking
  if (html.trim().length < 100 && responseCode === 403) {
    confidence += 0.3;
    details.emptyResponse = true;
  }

  if (confidence > 0.4) {
    return {
      isBlocked: true,
      detectionType: 'ip_block',
      confidence: Math.min(confidence, 1.0),
      suggestedAction: 'Use different IP address, VPN, or proxy service',
      details
    };
  }

  return { confidence: 0 };
}

// 5. JavaScript Challenge Detection
function detectJavaScriptChallenge(html: string): Partial<AntiBotDetectionResult> {
  const lowerHtml = html.toLowerCase();
  let confidence = 0;
  const details: Record<string, any> = {};

  // Check for common JS challenge patterns
  const jsPatterns = [
    'enable javascript',
    'javascript is required',
    'please enable javascript',
    'this site requires javascript',
    'browser verification',
    'human verification',
    'prove you are human',
    'loading...'
  ];

  jsPatterns.forEach(pattern => {
    if (lowerHtml.includes(pattern)) {
      confidence += 0.15;
      details.patterns = details.patterns || [];
      details.patterns.push(pattern);
    }
  });

  // Check for specific challenge scripts
  if (html.includes('setTimeout') && html.includes('window.location') && html.length < 2000) {
    confidence += 0.4;
    details.redirectScript = true;
  }

  // Check for minimal HTML with scripts (common in challenges)
  if (html.includes('<script>') && html.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '').trim().length < 500) {
    confidence += 0.3;
    details.minimalHtmlWithScript = true;
  }

  if (confidence > 0.5) {
    return {
      isBlocked: true,
      detectionType: 'js_challenge',
      confidence: Math.min(confidence, 1.0),
      suggestedAction: 'Use headless browser with JavaScript execution or wait for challenge completion',
      details
    };
  }

  return { confidence: 0 };
}

// 6. Platform-specific Detection
function detectPlatformSpecificBlocking(html: string, platform: 'amazon' | 'walmart', headers: Record<string, string>): Partial<AntiBotDetectionResult> {
  const lowerHtml = html.toLowerCase();
  let confidence = 0;
  const details: Record<string, any> = { platform };

  if (platform === 'amazon') {
    // Amazon-specific patterns
    const amazonPatterns = [
      'sorry, we just need to make sure you are not a robot',
      'enter the characters you see below',
      'robot check',
      'automated access',
      'unusual traffic from your computer network',
      'to continue shopping'
    ];

    amazonPatterns.forEach(pattern => {
      if (lowerHtml.includes(pattern)) {
        confidence += 0.2;
        details.patterns = details.patterns || [];
        details.patterns.push(pattern);
      }
    });

    // Check for Amazon CAPTCHA
    if (lowerHtml.includes('captcha') && lowerHtml.includes('amazon')) {
      confidence += 0.4;
      details.amazonCaptcha = true;
    }

  } else if (platform === 'walmart') {
    // Walmart-specific patterns
    const walmartPatterns = [
      'blocked for unusual activity',
      'verify you are human',
      'walmart security',
      'suspicious activity detected',
      'please verify your identity'
    ];

    walmartPatterns.forEach(pattern => {
      if (lowerHtml.includes(pattern)) {
        confidence += 0.2;
        details.patterns = details.patterns || [];
        details.patterns.push(pattern);
      }
    });

    // Walmart often returns different pages for blocked requests
    if (lowerHtml.includes('walmart') && lowerHtml.includes('blocked')) {
      confidence += 0.3;
      details.walmartBlock = true;
    }
  }

  if (confidence > 0.4) {
    return {
      isBlocked: true,
      detectionType: 'platform_specific',
      confidence: Math.min(confidence, 1.0),
      suggestedAction: `Platform-specific blocking detected. Use different browser headers and longer delays for ${platform}`,
      details
    };
  }

  return { confidence: 0 };
}

// 7. Response Anomaly Detection
function detectResponseAnomalies(html: string, responseCode: number, responseTime: number, url: string): Partial<AntiBotDetectionResult> {
  let confidence = 0;
  const details: Record<string, any> = {};

  // Empty or very small responses
  if (html.trim().length < 100) {
    confidence += 0.3;
    details.emptyResponse = true;
    details.responseLength = html.length;
  }

  // Unexpected redirects (checking common redirect patterns)
  if (html.includes('window.location') && html.length < 1000) {
    confidence += 0.2;
    details.unexpectedRedirect = true;
  }

  // Very fast response times might indicate blocking
  if (responseTime < 100) {
    confidence += 0.2;
    details.suspiciouslyFastResponse = responseTime;
  }

  // Generic error pages
  const genericErrorPatterns = [
    'error 1020',
    'error 1010',
    'access denied',
    'forbidden',
    'not authorized',
    'service unavailable'
  ];

  const lowerHtml = html.toLowerCase();
  genericErrorPatterns.forEach(pattern => {
    if (lowerHtml.includes(pattern)) {
      confidence += 0.1;
      details.patterns = details.patterns || [];
      details.patterns.push(pattern);
    }
  });

  // Missing expected content for product pages
  if (!lowerHtml.includes('product') && !lowerHtml.includes('item') && !lowerHtml.includes('price')) {
    confidence += 0.2;
    details.missingProductContent = true;
  }

  if (confidence > 0.4) {
    return {
      isBlocked: true,
      detectionType: 'redirect_loop',
      confidence: Math.min(confidence, 1.0),
      suggestedAction: 'Response appears anomalous, retry with different approach or investigate response',
      details
    };
  }

  return { confidence: 0 };
}

// Legacy function for backward compatibility
function detectChallengePage(html: string, url: string): boolean {
  const detection = detectAntiBot(html, url, 200, 1000, {});
  return detection.isBlocked && detection.confidence > 0.5;
}

function extractProductName(html: string, platform: "amazon" | "walmart"): string {
  const $ = cheerio.load(html);
  let productName = "";

  if (platform === "amazon") {
    // Enhanced Amazon selectors
    productName = 
      $('#productTitle').text().trim() ||
      $('h1[data-automation-id="product-title"]').text().trim() ||
      $('span#productTitle').text().trim() ||
      $('.product-title').text().trim() ||
      $('h1.a-size-large.a-spacing-none.a-color-base').text().trim() ||
      $('h1.a-size-large').text().trim() ||
      $('.a-size-large.product-title-word-break').text().trim() ||
      $('[data-asin] h1').text().trim() ||
      $('.a-spacing-none .a-size-large').text().trim();
  } 
  else if (platform === "walmart") {
    // Enhanced Walmart selectors
    productName = 
      $('[data-automation-id="product-title"]').text().trim() ||
      $('h1[data-testid="product-title"]').text().trim() ||
      $('#main-title').text().trim() ||
      $('.prod-ProductTitle').text().trim() ||
      $('.f2').text().trim() ||
      $('h1[data-cy="product-title"]').text().trim() ||
      $('h1.normal.dark-gray.mb1.mr1.f2.f1-l').text().trim() ||
      $('h1').first().text().trim();
  }

  // Clean up the product name
  if (productName) {
    productName = productName
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .replace(/\n/g, ' ')   // Replace newlines with spaces
      .replace(/\t/g, ' ')   // Replace tabs with spaces
      .trim();
  }

  return productName;
}

async function scrapeWithRetry(task: ScrapingTask): Promise<ScrapingResult> {
  const { id, url, platform, maxRetries = 3, responseData, headers } = task;
  
  // If responseData is provided, skip HTTP request and just parse
  if (responseData) {
    try {
      const startTime = Date.now();
      const antiBot = detectAntiBot(responseData, url, 200, Date.now() - startTime, {});
      
      if (antiBot.isBlocked) {
        return {
          id,
          success: false,
          error: `Product blocked by ${antiBot.detectionType} protection (confidence: ${(antiBot.confidence * 100).toFixed(1)}%)`,
          antiBot
        };
      }
      
      const productName = extractProductName(responseData, platform);
      
      if (productName) {
        return {
          id,
          success: true,
          productName
        };
      } else {
        return {
          id,
          success: false,
          error: "No product name found in provided data"
        };
      }
    } catch (error) {
      return {
        id,
        success: false,
        error: `Parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Otherwise, perform full scraping with retries
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Progressive delay between requests - more human-like
      if (attempt > 1) {
        const baseDelay = platform === 'walmart' ? 3000 : 2000;
        const randomDelay = Math.random() * 3000 + baseDelay;
        await new Promise(resolve => setTimeout(resolve, randomDelay));
      }
      
      // Generate realistic browser headers
      const userAgent = getRandomUserAgent();
      const requestHeaders = headers || generateBrowserHeaders(userAgent, platform);
      
      // Add some randomness to make requests less detectable
      if (Math.random() > 0.7) {
        requestHeaders['X-Requested-With'] = 'XMLHttpRequest';
      }

      const axiosConfig = {
        headers: requestHeaders,
        timeout: 30000,
        maxRedirects: 5,
        validateStatus: (status: number) => status < 500,
        decompress: false
      };
      
      const requestStart = Date.now();
      const response = await workerAxios.get(url, axiosConfig);
      const requestTime = Date.now() - requestStart;

      // Use comprehensive anti-bot detection
      const antiBot = detectAntiBot(response.data, url, response.status, requestTime, response.headers as Record<string, string> || {});
      
      if (antiBot.isBlocked) {
        if (attempt < maxRetries) {
          // Use detection-specific retry strategies
          let retryDelay = 2000; // Default base delay
          
          switch (antiBot.detectionType) {
            case 'rate_limit':
              // Longer delays for rate limiting
              retryDelay = Math.pow(2, attempt) * 5000;
              break;
            case 'cloudflare':
            case 'js_challenge':
              // Extended delays for challenge-based protection
              retryDelay = Math.pow(2, attempt) * 3000;
              break;
            case 'ip_block':
              // Very long delay or skip retries for IP blocks
              retryDelay = Math.pow(2, attempt) * 10000;
              break;
            default:
              retryDelay = Math.pow(2, attempt) * 2000;
          }
          
          // Add jitter to delay
          const jitter = Math.random() * retryDelay * 0.5;
          const finalDelay = retryDelay + jitter;
          
          await new Promise(resolve => setTimeout(resolve, finalDelay));
          continue;
        } else {
          return {
            id,
            success: false,
            error: `Product blocked by ${antiBot.detectionType} protection (confidence: ${(antiBot.confidence * 100).toFixed(1)}%). ${antiBot.suggestedAction}`,
            antiBot
          };
        }
      }

      const productName = extractProductName(response.data, platform);

      if (productName) {
        return {
          id,
          success: true,
          productName,
          antiBot // Include detection data even for successful requests
        };
      } else {
        if (attempt < maxRetries) {
          continue;
        } else {
          return {
            id,
            success: false,
            error: "No product name found after all retries",
            antiBot // Include detection data for failed scraping
          };
        }
      }
      
    } catch (error) {
      if (attempt === maxRetries) {
        return {
          id,
          success: false,
          error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
      // Continue to next retry
    }
  }

  return {
    id,
    success: false,
    error: "All scraping attempts failed"
  };
}

// Handle messages from main thread
if (parentPort) {
  parentPort.on('message', async (task: ScrapingTask) => {
    try {
      const result = await scrapeWithRetry(task);
      parentPort!.postMessage(result);
    } catch (error) {
      parentPort!.postMessage({
        id: task.id,
        success: false,
        error: `Worker error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });
} else {
  console.error('Worker: parentPort is null, cannot receive messages');
}