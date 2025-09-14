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

interface ScrapingResult {
  id: string;
  success: boolean;
  productName?: string;
  error?: string;
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

function detectChallengePage(html: string, url: string): boolean {
  const challengeIndicators = [
    'Robot Check', 'Robot or human?', 'Something went wrong',
    'To discuss automated access', 'automated queries', 'unusual traffic',
    'blocked', 'captcha', 'Please confirm that you are a human',
    'Security check', 'Access Denied'
  ];
  
  const lowerHtml = html.toLowerCase();
  return challengeIndicators.some(indicator => 
    lowerHtml.includes(indicator.toLowerCase())
  );
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
      if (detectChallengePage(responseData, url)) {
        return {
          id,
          success: false,
          error: "Product blocked by anti-bot protection"
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
      
      const response = await workerAxios.get(url, axiosConfig);

      // Check if we got a challenge page
      if (detectChallengePage(response.data, url)) {
        if (attempt < maxRetries) {
          // Enhanced exponential backoff with jitter for challenges
          const baseDelay = Math.pow(2, attempt) * 2000;
          const jitter = Math.random() * 2000;
          const challengeDelay = baseDelay + jitter;
          await new Promise(resolve => setTimeout(resolve, challengeDelay));
          continue;
        } else {
          return {
            id,
            success: false,
            error: "Product blocked by anti-bot protection"
          };
        }
      }

      const productName = extractProductName(response.data, platform);

      if (productName) {
        return {
          id,
          success: true,
          productName
        };
      } else {
        if (attempt < maxRetries) {
          continue;
        } else {
          return {
            id,
            success: false,
            error: "No product name found after all retries"
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