import type { Express } from "express";
import { createServer, type Server } from "http";
import axios from "axios";
import * as cheerio from "cheerio";
import nodemailer from "nodemailer";
import { storage } from "./storage";
import { 
  updateSettingsSchema, 
  users, 
  userStatus, 
  subscriptions, 
  adminUsers, 
  billingInfo,
  userAccess,
  signupSchema,
  loginSchema,
  refreshTokenRequestSchema,
  changePasswordSchema,
  type SignupRequest,
  type LoginRequest,
  type AuthResponse,
  type UserProfile
} from "@shared/schema";
import { authService, requireAuth, requireAdmin, authorize, optionalAuth } from "./auth";
import { logger, logError, logInfo, logWarn, getCombinedLogs } from "./logger";
import { db } from "./db";
import { or, ilike, inArray, count, eq, desc, and, gt, lt, isNull } from "drizzle-orm";
// import { getWorkerPool, destroyWorkerPool } from "./worker-pool";
import { httpPool } from "./http-pool";
import { performanceMonitor } from "./performance-monitor";
import { setupAuthTestRoutes } from "./test-auth";

// Product monitoring scheduler
interface MonitoredProduct {
  id: string;
  name: string;
  url: string; 
  platform: "amazon" | "walmart";
  asin?: string;
  interval: number; // in milliseconds
  timer?: NodeJS.Timeout;
}

interface ProductSchedulingState extends MonitoredProduct {
  backoffDelay: number; // Current backoff delay in ms
  consecutiveErrors: number; // Count of consecutive errors
}

class ProductScheduler {
  private products = new Map<string, ProductSchedulingState>();
  private concurrencyLimit = 6; // Increased limit for worker thread pool
  private runningJobs = 0;
  private jobQueue: Array<{ productId: string; retryCount: number }> = []; // Queue for jobs when at concurrency limit
  private cleanupInterval: NodeJS.Timeout;
  // private workerPool = getWorkerPool();

  constructor() {
    // Initialize periodic cleanup to prevent memory leaks
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 5 * 60 * 1000); // Cleanup every 5 minutes
  }

  // Cleanup old/stale product entries to prevent memory leaks
  private performCleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [productId, product] of Array.from(this.products)) {
      // Remove products that haven't been scheduled in the last hour
      const lastScheduled = product.timer ? now : now - (60 * 60 * 1000);
      if (now - lastScheduled > 60 * 60 * 1000) {
        this.stopMonitoring(productId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[Scheduler] Cleaned up ${cleanedCount} stale monitoring entries`);
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  // Add a product to monitoring schedule
  startMonitoring(product: Omit<MonitoredProduct, 'interval' | 'timer'>): void {
    // Set base interval based on platform
    const baseInterval = product.platform === 'amazon' 
      ? 15 * 60 * 1000  // 15 minutes for Amazon
      : 1 * 60 * 1000;   // 1 minute for Walmart
    
    console.log(`Starting monitoring for ${product.platform} product: ${product.name} (base interval: ${baseInterval/1000}s)`);
    
    // Stop existing monitoring if any
    this.stopMonitoring(product.id);
    
    // Create monitored product with scheduling state
    const monitoredProduct: ProductSchedulingState = {
      ...product,
      interval: baseInterval,
      backoffDelay: baseInterval, // Start with base interval
      consecutiveErrors: 0,
      timer: undefined
    };
    
    // Store the product
    this.products.set(product.id, monitoredProduct);
    
    // Start monitoring with recursive setTimeout
    this.scheduleNextRun(product.id, 1000); // Initial delay of 1 second
  }

  // Remove a product from monitoring
  stopMonitoring(productId: string): void {
    const product = this.products.get(productId);
    if (product) {
      console.log(`Stopping monitoring for product: ${product.name}`);
      if (product.timer) {
        clearTimeout(product.timer);
      }
      this.products.delete(productId);
      
      // Remove from queue if present
      this.jobQueue = this.jobQueue.filter(job => job.productId !== productId);
    }
  }

  // Schedule next run with proper backoff and jitter
  private scheduleNextRun(productId: string, delay?: number): void {
    const product = this.products.get(productId);
    if (!product) return;

    const actualDelay = delay || this.calculateDelay(product);
    
    product.timer = setTimeout(() => {
      this.executeScrapingJob(productId);
    }, actualDelay);
  }

  // Calculate delay with jitter and backoff
  private calculateDelay(product: ProductSchedulingState): number {
    let delay = product.backoffDelay;
    
    // Add jitter (±10%)
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    const finalDelay = Math.max(1000, delay + jitter); // Minimum 1 second
    
    return finalDelay;
  }

  // Execute scraping job with improved concurrency and backoff
  private async executeScrapingJob(productId: string): Promise<void> {
    // If at concurrency limit, queue the job (with deduplication)
    if (this.runningJobs >= this.concurrencyLimit) {
      const alreadyQueued = this.jobQueue.some(job => job.productId === productId);
      if (!alreadyQueued) {
        console.log(`[Scheduler] Queuing job for ${productId} - concurrency limit reached`);
        this.jobQueue.push({ productId, retryCount: 0 });
      }
      
      // Schedule queue processing
      setTimeout(() => this.processQueue(), 5000 + Math.random() * 5000); // 5-10 second delay
      return;
    }

    const product = this.products.get(productId);
    if (!product) {
      console.log(`Product ${productId} not found in monitoring list`);
      return;
    }

    this.runningJobs++;
    let success = false;
    
    try {
      console.log(`[Scheduler] Scraping ${product.platform} product: ${product.name}`);
      
      // CRITICAL: Use worker pool for CPU-intensive scraping with SSRF protection
      // This offloads parsing to worker threads and validates hostnames
      const scrapedName = await this.scrapeProductWithWorker(product.url, product.platform);
      
      // Check if scraping was successful
      if (!scrapedName.includes("Could Not Be Retrieved") && !scrapedName.includes("blocked") && !scrapedName.includes("Invalid URL")) {
        success = true;
        
        // Log results (in real app, this would update database, send notifications, etc.)
        if (scrapedName !== product.name) {
          console.log(`[Scheduler] Product name changed: "${product.name}" -> "${scrapedName}"`);
        }
        
        console.log(`[Scheduler] Completed monitoring check for: ${product.name}`);
      } else {
        console.log(`[Scheduler] Scraping failed for ${product.name}: ${scrapedName}`);
      }
      
    } catch (error) {
      console.error(`[Scheduler] Error scraping product ${productId}:`, error);
    } finally {
      this.runningJobs--;
      
      // Update scheduling state and schedule next run
      this.updateProductScheduling(productId, success);
      
      // Process queue if there are waiting jobs
      if (this.jobQueue.length > 0) {
        setTimeout(() => this.processQueue(), 1000 + Math.random() * 2000);
      }
    }
  }

  // Update product scheduling state based on success/failure
  private updateProductScheduling(productId: string, success: boolean): void {
    const product = this.products.get(productId);
    if (!product) return;

    if (success) {
      // Reset backoff on success
      product.backoffDelay = product.interval;
      product.consecutiveErrors = 0;
      console.log(`[Scheduler] Reset backoff for ${product.name}, next check in ${Math.round(product.backoffDelay/1000)}s`);
    } else {
      // Increase backoff on failure - correct calculation: baseInterval * 2^min(consecutiveErrors, 4)
      product.consecutiveErrors++;
      const exponentialBackoff = Math.pow(2, Math.min(product.consecutiveErrors, 4));
      product.backoffDelay = Math.min(
        product.interval * exponentialBackoff, // baseInterval * 2^n, not compounding the already inflated delay
        5 * 60 * 1000 // Max 5 minutes
      );
      console.log(`[Scheduler] Increased backoff for ${product.name} (error #${product.consecutiveErrors}, multiplier: ${exponentialBackoff}), next check in ${Math.round(product.backoffDelay/1000)}s`);
    }

    // Schedule next run
    this.scheduleNextRun(productId);
  }

  // Process queued jobs
  private processQueue(): void {
    while (this.jobQueue.length > 0 && this.runningJobs < this.concurrencyLimit) {
      const job = this.jobQueue.shift();
      if (job && this.products.has(job.productId)) {
        console.log(`[Scheduler] Processing queued job for ${job.productId}`);
        this.executeScrapingJob(job.productId);
      }
    }
  }

  // Get monitoring status
  getMonitoringStatus(): Array<{id: string, name: string, platform: string, interval: number}> {
    return Array.from(this.products.values()).map(p => ({
      id: p.id,
      name: p.name, 
      platform: p.platform,
      interval: Math.round(p.interval / 1000) // Convert to seconds
    }));
  }

  // Optimized scraping with SSRF protection (temporarily using main thread)
  private async scrapeProductWithWorker(url: string, platform: "amazon" | "walmart"): Promise<string> {
    // Validate URL to prevent SSRF attacks
    try {
      const urlObj = new URL(url);
      const allowedHosts = ['amazon.com', 'www.amazon.com', 'walmart.com', 'www.walmart.com'];
      
      if (!allowedHosts.includes(urlObj.hostname)) {
        throw new Error(`Invalid hostname: ${urlObj.hostname}`);
      }
    } catch (error) {
      console.error('Invalid URL:', url, error);
      return "Invalid URL provided";
    }

    try {
      // Temporarily use optimized main thread scraping until worker threads are stable
      return await scrapeProductName(url, platform);
    } catch (error) {
      console.error('Optimized scraping failed:', error);
      return "Product Name Could Not Be Retrieved";
    }
  }

  // Stop all monitoring (cleanup)
  stopAll(): void {
    console.log('Stopping all product monitoring...');
    const productIds = Array.from(this.products.keys());
    for (const productId of productIds) {
      this.stopMonitoring(productId);
    }
    
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Global scheduler instance
const productScheduler = new ProductScheduler();

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup comprehensive authorization testing routes (if in development)
  if (process.env.NODE_ENV !== 'production') {
    setupAuthTestRoutes(app);
    logger.info('Authorization test routes enabled for development/testing');
  }

  // ======================
  // AUTHENTICATION ROUTES
  // ======================

  // POST /api/auth/signup - User registration
  app.post("/api/auth/signup", async (req, res) => {
    try {
      // Rate limiting for signup attempts
      const clientId = req.ip || 'unknown';
      if (!authService.checkRateLimit(`signup:${clientId}`, 3, 15 * 60 * 1000)) {
        return res.status(429).json({ error: 'Too many signup attempts. Please try again later.' });
      }

      // Validate request body
      const validationResult = signupSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: validationResult.error.format() 
        });
      }

      const { email, password, firstName, lastName } = validationResult.data;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: 'User already exists with this email' });
      }

      // Hash password and create user
      const hashedPassword = authService.hashPassword(password);
      const user = await storage.createUserWithPassword(email, hashedPassword, firstName, lastName);

      // Check if user is admin
      const isAdmin = await storage.isUserAdmin(user.id);

      // Generate tokens
      const accessToken = authService.generateAccessToken(user.id, isAdmin);
      const refreshToken = await authService.createRefreshTokenRecord(
        user.id, 
        req.headers['user-agent'], 
        req.ip
      );

      // Check authorization
      const authResult = await authService.checkUserAuthorization(user.id);

      const authResponse: AuthResponse = {
        user: {
          id: user.id,
          email: user.email!,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          isAdmin,
        },
        authorized: authResult.authorized,
        authorizationReason: authResult.reason,
      };

      // Check if client wants tokens in response (desktop/mobile)
      const wantsTokens = req.headers['x-auth-mode'] === 'tokens';
      if (wantsTokens) {
        authResponse.accessToken = accessToken;
        authResponse.refreshToken = refreshToken;
      } else {
        // Set cookies for web clients
        authService.setAuthCookies(res, accessToken, refreshToken);
      }

      res.status(201).json(authResponse);
      logger.info(`User registered: ${email}`);

    } catch (error) {
      logger.error('Signup error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/auth/login - User authentication
  app.post("/api/auth/login", async (req, res) => {
    try {
      // Rate limiting for login attempts
      const clientId = req.ip || 'unknown';
      if (!authService.checkRateLimit(`login:${clientId}`, 5, 15 * 60 * 1000)) {
        return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
      }

      // Validate request body
      const validationResult = loginSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: validationResult.error.format() 
        });
      }

      const { email, password, rememberMe } = validationResult.data;

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Verify password
      if (!authService.verifyPassword(password, user.password)) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Check if user is admin
      const isAdmin = await storage.isUserAdmin(user.id);

      // Generate tokens
      const accessToken = authService.generateAccessToken(user.id, isAdmin);
      const refreshToken = await authService.createRefreshTokenRecord(
        user.id, 
        req.headers['user-agent'], 
        req.ip
      );

      // Check authorization
      const authResult = await authService.checkUserAuthorization(user.id);

      const authResponse: AuthResponse = {
        user: {
          id: user.id,
          email: user.email!,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          isAdmin,
        },
        authorized: authResult.authorized,
        authorizationReason: authResult.reason,
      };

      // Check if client wants tokens in response (desktop/mobile)
      const wantsTokens = req.headers['x-auth-mode'] === 'tokens';
      if (wantsTokens) {
        authResponse.accessToken = accessToken;
        authResponse.refreshToken = refreshToken;
      } else {
        // Set cookies for web clients
        authService.setAuthCookies(res, accessToken, refreshToken);
      }

      res.json(authResponse);
      logger.info(`User logged in: ${email}`);

    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/auth/refresh - Refresh access token
  app.post("/api/auth/refresh", async (req, res) => {
    try {
      // Get refresh token from cookies or headers
      const refreshToken = authService.extractTokenFromRequest(req, 'refresh');
      
      if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh token required' });
      }

      // Validate refresh token
      const tokenData = await authService.validateRefreshToken(refreshToken);
      if (!tokenData) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }

      // Check if user still exists
      const user = await storage.getUser(tokenData.userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Check if user is admin
      const isAdmin = await storage.isUserAdmin(user.id);

      // Rotate refresh token and generate new access token
      const newAccessToken = authService.generateAccessToken(user.id, isAdmin);
      const newRefreshToken = await authService.rotateRefreshToken(
        tokenData.tokenId,
        user.id,
        req.headers['user-agent'],
        req.ip
      );

      // Check authorization
      const authResult = await authService.checkUserAuthorization(user.id);

      const authResponse: AuthResponse = {
        user: {
          id: user.id,
          email: user.email!,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          isAdmin,
        },
        authorized: authResult.authorized,
        authorizationReason: authResult.reason,
      };

      // Check if client wants tokens in response (desktop/mobile)
      const wantsTokens = req.headers['x-auth-mode'] === 'tokens';
      if (wantsTokens) {
        authResponse.accessToken = newAccessToken;
        authResponse.refreshToken = newRefreshToken;
      } else {
        // Set cookies for web clients
        authService.setAuthCookies(res, newAccessToken, newRefreshToken);
      }

      res.json(authResponse);

    } catch (error) {
      logger.error('Refresh error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/auth/logout - Logout user
  app.post("/api/auth/logout", async (req, res) => {
    try {
      // Get refresh token from cookies or headers
      const refreshToken = authService.extractTokenFromRequest(req, 'refresh');
      
      if (refreshToken) {
        // Validate and revoke refresh token
        const tokenData = await authService.validateRefreshToken(refreshToken);
        if (tokenData) {
          await storage.revokeRefreshToken(tokenData.tokenId);
        }
      }

      // Clear authentication cookies
      authService.clearAuthCookies(res);

      res.json({ message: 'Logged out successfully' });

    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/me - Get current user information
  app.get("/api/me", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const fullUser = await storage.getUser(user.id);
      
      if (!fullUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check authorization
      const authResult = await authService.checkUserAuthorization(user.id);

      // Get beta access info
      const betaAccess = await storage.getUserAccess(user.id);
      
      // Get subscription info
      const subscription = await storage.getUserSubscription(user.id);

      const userProfile: UserProfile = {
        id: fullUser.id,
        email: fullUser.email!,
        firstName: fullUser.firstName,
        lastName: fullUser.lastName,
        profileImageUrl: fullUser.profileImageUrl,
        isAdmin: user.isAdmin,
        authorized: authResult.authorized,
        authorizationReason: authResult.reason,
        betaAccess: betaAccess ? {
          isBetaTester: betaAccess.betaTester,
          expiresAt: betaAccess.betaExpiresAt,
        } : undefined,
        subscription: subscription ? {
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
        } : undefined,
      };

      res.json(userProfile);

    } catch (error) {
      logger.error('Get user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/auth/change-password - Change user password
  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      // Validate request body
      const validationResult = changePasswordSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: validationResult.error.format() 
        });
      }

      const { currentPassword, newPassword } = validationResult.data;
      const user = (req as any).user;

      // Get current user with password
      const fullUser = await storage.getUser(user.id);
      if (!fullUser || !fullUser.password) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify current password
      if (!authService.verifyPassword(currentPassword, fullUser.password)) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Hash new password and update
      const hashedNewPassword = authService.hashPassword(newPassword);
      await storage.setPassword(user.id, hashedNewPassword);

      // Revoke all refresh tokens to force re-login on other devices
      await storage.revokeAllRefreshTokens(user.id);

      res.json({ message: 'Password changed successfully' });
      logger.info(`Password changed for user: ${fullUser.email}`);

    } catch (error) {
      logger.error('Change password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ======================
  // PRODUCT API ROUTES
  // ======================

  // API route to scrape product names from URLs
  app.post("/api/scrape-product", async (req, res) => {
    try {
      const { url, platform } = req.body;
      
      if (!url || !platform) {
        return res.status(400).json({ error: "URL and platform are required" });
      }
      
      // Use optimized HTTP connection pool for scraping
      const productName = await scrapeProductName(url, platform);
      res.json({ name: productName });
      
    } catch (error) {
      console.error("Error scraping product:", error);
      res.status(500).json({ error: "Failed to scrape product name" });
    }
  });

  // API route to search products by ASIN or product name
  app.post("/api/search-product", async (req, res) => {
    try {
      const { query, platform, type } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }
      
      // Validate platform parameter
      const validPlatforms = ['amazon', 'walmart', 'both'];
      if (platform && !validPlatforms.includes(platform)) {
        return res.status(400).json({ error: "Platform must be amazon, walmart, or both" });
      }
      
      // Default to searching both platforms for name searches
      const searchPlatform = platform || 'both';
      
      let searchResult;
      
      if (type === 'asin') {
        // ASIN searches are Amazon-only, but return unified format
        searchResult = await searchByASINWithWorker(query);
      } else {
        // Product name searches support multi-platform
        searchResult = await searchByProductName(query, searchPlatform);
      }
      
      res.json(searchResult);
      
    } catch (error) {
      console.error("Error searching product:", error);
      res.status(500).json({ error: "Failed to search product" });
    }
  });

  // API route to start monitoring a product
  app.post("/api/start-monitoring", async (req, res) => {
    try {
      const { id, name, url, platform, asin } = req.body;
      
      if (!id || !name || !url || !platform) {
        return res.status(400).json({ error: "ID, name, URL, and platform are required" });
      }
      
      if (!['amazon', 'walmart'].includes(platform)) {
        return res.status(400).json({ error: "Platform must be amazon or walmart" });
      }
      
      // Start monitoring the product
      productScheduler.startMonitoring({
        id: id,
        name: name,
        url: url,
        platform: platform,
        asin: asin
      });
      
      const intervalMinutes = platform === 'amazon' ? 15 : 1;
      
      res.json({ 
        message: `Started monitoring ${platform} product: ${name}`,
        interval: `Every ${intervalMinutes} minute(s)`
      });
      
    } catch (error) {
      console.error("Error starting product monitoring:", error);
      res.status(500).json({ error: "Failed to start product monitoring" });
    }
  });

  // API route to stop monitoring a product
  app.post("/api/stop-monitoring", async (req, res) => {
    try {
      const { id } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: "Product ID is required" });
      }
      
      productScheduler.stopMonitoring(id);
      
      res.json({ 
        message: `Stopped monitoring product with ID: ${id}`
      });
      
    } catch (error) {
      console.error("Error stopping product monitoring:", error);
      res.status(500).json({ error: "Failed to stop product monitoring" });
    }
  });

  // API route to get monitoring status
  app.get("/api/monitoring-status", async (req, res) => {
    try {
      const status = productScheduler.getMonitoringStatus();
      
      res.json({ 
        monitoredProducts: status.length,
        products: status
      });
      
    } catch (error) {
      console.error("Error getting monitoring status:", error);
      res.status(500).json({ error: "Failed to get monitoring status" });
    }
  });

  // Performance monitoring API endpoints
  app.get("/api/performance/current", async (req, res) => {
    try {
      const metrics = await performanceMonitor.getCurrentMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error getting current performance metrics:", error);
      res.status(500).json({ error: "Failed to get performance metrics" });
    }
  });

  app.get("/api/performance/summary", async (req, res) => {
    try {
      const summary = await performanceMonitor.getResourceSummary();
      const averages = performanceMonitor.getAverageMetrics();
      res.json({ summary, averages });
    } catch (error) {
      console.error("Error getting performance summary:", error);
      res.status(500).json({ error: "Failed to get performance summary" });
    }
  });

  app.get("/api/performance/history", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const history = performanceMonitor.getMetricsHistory(limit);
      res.json({ history, count: history.length });
    } catch (error) {
      console.error("Error getting performance history:", error);
      res.status(500).json({ error: "Failed to get performance history" });
    }
  });

  // Initialize performance monitoring
  performanceMonitor.startMonitoring(30000); // Monitor every 30 seconds to reduce resource usage
  console.log('[Server] Performance monitoring started');

  // Cleanup on server shutdown
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, cleaning up all resources...');
    performanceMonitor.stopMonitoring();
    productScheduler.stopAll();
    if (storage.destroy) {
      storage.destroy();
    }
    // destroyWorkerPool().then(() => {
      httpPool.destroy();
      performanceMonitor.destroy();
      process.exit(0);
    // });
  });

  process.on('SIGINT', () => {
    console.log('Received SIGINT, cleaning up all resources...');
    performanceMonitor.stopMonitoring();
    productScheduler.stopAll(); 
    if (storage.destroy) {
      storage.destroy();
    }
    // destroyWorkerPool().then(() => {
      httpPool.destroy();
      performanceMonitor.destroy();
      process.exit(0);
    // });
  });

  // Test email endpoint - uses stored encrypted credentials
  app.post("/api/test-email", async (req, res) => {
    try {
      // Get user's stored email settings instead of accepting plain text password
      const userId = "default-user";
      const settings = await storage.getSettings(userId);
      
      if (!settings || !settings.gmailEmail || !settings.gmailAppPassword) {
        return res.status(400).json({ error: "Email settings not configured. Please set your Gmail email and app password in settings first." });
      }

      // Create transporter with stored (decrypted) credentials
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: settings.gmailEmail,
          pass: settings.gmailAppPassword // This is already decrypted by storage layer
        }
      });

      // Verify the connection
      await transporter.verify();

      // Send test email
      await transporter.sendMail({
        from: settings.gmailEmail,
        to: settings.gmailEmail,
        subject: 'Stock Monitor - Test Email',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4CAF50;">Email Configuration Successful!</h2>
            <p>Your Stock Monitor email notifications are now configured and working properly.</p>
            <p>You'll receive alerts for:</p>
            <ul>
              <li>Price drops on Amazon products</li>
              <li>Stock availability changes on Walmart products</li>
            </ul>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
            <small style="color: #666;">
              This is a test email from Stock Monitor. You can safely ignore this message.
            </small>
          </div>
        `
      });

      res.json({ success: true, message: "Test email sent successfully!" });
    } catch (error) {
      // Security: Don't log the full error which might contain credentials
      console.error("Test email failed:", error instanceof Error ? error.message : 'Unknown error');
      let errorMessage = "Failed to send test email";
      
      if (error instanceof Error) {
        if (error.message.includes("Invalid login")) {
          errorMessage = "Invalid email or app password. Please check your Gmail app password.";
        } else if (error.message.includes("authentication")) {
          errorMessage = "Authentication failed. Please verify your Gmail app password.";
        } else {
          errorMessage = error.message;
        }
      }
      
      res.status(500).json({ error: errorMessage });
    }
  });

  // Get user settings
  app.get("/api/settings", async (req, res) => {
    try {
      // For now, use a default user ID - in a real app this would come from session
      const userId = "default-user";
      
      let settings = await storage.getSettings(userId);
      
      if (!settings) {
        // Create default settings if none exist
        const defaultSettings = {
          userId,
          amazonCheckInterval: 20,
          walmartCheckInterval: 10,
          enableRandomization: true,
          enableAudio: true,
          audioNotificationSound: "notification",
          audioVolume: 80,
          enableEmail: false,
          gmailEmail: "",
          gmailAppPassword: "",
          enableTaskTray: false,
          enableProxy: false,
          proxyUrl: "",
          proxyUsername: "",
          proxyPassword: ""
        };
        
        settings = await storage.createSettings(defaultSettings);
      }
      
      // Security: Never expose passwords in API responses - mask them
      const secureSettings = {
        ...settings,
        gmailAppPassword: settings.gmailAppPassword ? "****hidden****" : "",
        proxyPassword: settings.proxyPassword ? "****hidden****" : ""
      };
      
      res.json(secureSettings);
    } catch (error) {
      logError("Error getting settings:", error);
      res.status(500).json({ error: "Failed to get settings" });
    }
  });

  // Update user settings
  app.post("/api/settings", async (req, res) => {
    try {
      // For now, use a default user ID - in a real app this would come from session
      const userId = "default-user";
      
      // Validate request body with Zod schema
      const validatedSettings = updateSettingsSchema.parse(req.body);
      
      const updatedSettings = await storage.updateSettings(userId, validatedSettings);
      
      // Security: Never expose passwords in API responses - mask them
      const secureSettings = {
        ...updatedSettings,
        gmailAppPassword: updatedSettings.gmailAppPassword ? "****hidden****" : "",
        proxyPassword: updatedSettings.proxyPassword ? "****hidden****" : ""
      };
      
      res.json(secureSettings);
    } catch (error) {
      // Security: Sanitize error logging to avoid exposing sensitive data
      logError("Error updating settings:", error instanceof Error ? error.message : 'Unknown error');
      if (error instanceof Error && error.name === 'ZodError') {
        res.status(400).json({ error: "Invalid settings data" });
      } else {
        res.status(500).json({ error: "Failed to update settings" });
      }
    }
  });

  // Download error logs for Windows users
  app.get("/api/download-logs", async (req, res) => {
    try {
      const combinedLogs = getCombinedLogs();
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename="stock-monitor-logs.txt"');
      res.setHeader('Cache-Control', 'no-cache');
      
      // Send the logs as a downloadable file
      res.send(combinedLogs);
      
      logInfo("User downloaded error logs");
    } catch (error) {
      logError("Error generating logs for download:", error);
      res.status(500).json({ error: "Failed to generate logs" });
    }
  });

  // Open sounds folder in file explorer
  app.post("/api/open-sounds-folder", async (req, res) => {
    try {
      const path = require('path');
      const fs = require('fs');
      
      // Create sounds directory if it doesn't exist
      const soundsPath = path.join(process.cwd(), 'sounds');
      if (!fs.existsSync(soundsPath)) {
        fs.mkdirSync(soundsPath, { recursive: true });
        logInfo("Created sounds directory");
      }
      
      // Check if we're in a cloud/sandboxed environment (like Replit)
      const isCloudEnvironment = process.env.REPLIT_DEV_DOMAIN || process.env.CODESPACES || process.env.GITPOD_WORKSPACE_ID;
      
      if (isCloudEnvironment) {
        // In cloud environments, just return success with helpful message
        logInfo("Sounds folder accessed (cloud environment)");
        res.json({ 
          success: true, 
          message: "Sounds folder created successfully. In cloud environments, you can access files through the file explorer in your IDE.",
          path: soundsPath
        });
        return;
      }
      
      // For local environments, try to open folder
      const { exec } = require('child_process');
      const platform = process.platform;
      let command = '';
      
      if (platform === 'win32') {
        command = `explorer "${soundsPath}"`;
      } else if (platform === 'darwin') {
        command = `open "${soundsPath}"`;
      } else {
        // Linux and other Unix-like systems
        command = `xdg-open "${soundsPath}"`;
      }
      
      exec(command, (error: any) => {
        if (error) {
          logWarn("Could not open sounds folder with system command:", error.message);
          // Fallback response instead of error
          res.json({ 
            success: true, 
            message: "Sounds folder created successfully. Please navigate to the project directory and look for the 'sounds' folder.",
            path: soundsPath
          });
        } else {
          logInfo("Opened sounds folder in file explorer");
          res.json({ success: true, message: "Sounds folder opened in file explorer" });
        }
      });
      
    } catch (error: unknown) {
      logError("Error with sounds folder operation:", error);
      res.status(500).json({ error: "Failed to access sounds folder" });
    }
  });

  // Demo simulation endpoints
  app.post("/api/simulate-stock-demo", async (req, res) => {
    try {
      // This would trigger a demo stock alert in the real application
      logInfo("Demo stock alert triggered");
      res.json({ 
        success: true, 
        message: "Stock alert demo triggered - this will show the full notification modal with graphics and sound when you have products being monitored."
      });
    } catch (error) {
      logError("Error triggering stock demo:", error);
      res.status(500).json({ error: "Failed to trigger stock demo" });
    }
  });

  app.post("/api/simulate-price-demo", async (req, res) => {
    try {
      // This would trigger a demo price drop alert in the real application
      logInfo("Demo price drop triggered");
      res.json({ 
        success: true, 
        message: "Price drop demo triggered - this will show the full notification modal with graphics and sound when you have products being monitored."
      });
    } catch (error) {
      logError("Error triggering price demo:", error);
      res.status(500).json({ error: "Failed to trigger price demo" });
    }
  });


  // Admin API endpoints
  app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { 
        search = '', 
        billingEmail = '',
        billingPhone = '',
        status = 'all', 
        page = 1, 
        limit = 20 
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);

      // Get users with search and filtering
      let usersQuery;
      let totalCount;

      // Build search conditions
      const searchConditions = [];
      
      if (search) {
        const searchPattern = `%${search}%`;
        searchConditions.push(
          or(
            ilike(users.email, searchPattern),
            ilike(users.firstName, searchPattern),
            ilike(users.lastName, searchPattern)
          )
        );
      }

      if (billingEmail) {
        const billingEmailPattern = `%${billingEmail}%`;
        searchConditions.push(ilike(billingInfo.billingEmail, billingEmailPattern));
      }

      if (billingPhone) {
        const billingPhonePattern = `%${billingPhone}%`;
        // Search in billing address JSON for phone field
        searchConditions.push(
          ilike(billingInfo.billingAddress, billingPhonePattern)
        );
      }

      if (searchConditions.length > 0) {
        // Search with joins to billing info
        usersQuery = await db
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
            stripeCustomerId: users.stripeCustomerId,
            stripeSubscriptionId: users.stripeSubscriptionId,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
            billingEmail: billingInfo.billingEmail,
            billingAddress: billingInfo.billingAddress
          })
          .from(users)
          .leftJoin(billingInfo, eq(users.id, billingInfo.userId))
          .where(or(...searchConditions))
          .limit(Number(limit))
          .offset(offset);

        // Get total count for pagination
        const [countResult] = await db
          .select({ count: count() })
          .from(users)
          .leftJoin(billingInfo, eq(users.id, billingInfo.userId))
          .where(or(...searchConditions));
        totalCount = countResult?.count || 0;
      } else {
        // Get all users with billing info
        usersQuery = await db
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
            stripeCustomerId: users.stripeCustomerId,
            stripeSubscriptionId: users.stripeSubscriptionId,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
            billingEmail: billingInfo.billingEmail,
            billingAddress: billingInfo.billingAddress
          })
          .from(users)
          .leftJoin(billingInfo, eq(users.id, billingInfo.userId))
          .limit(Number(limit))
          .offset(offset);

        // Get total count
        const [countResult] = await db.select({ count: count() }).from(users);
        totalCount = countResult?.count || 0;
      }

      // Get user statuses for each user
      const userIds = usersQuery.map(u => u.id);
      const statuses = await db
        .select()
        .from(userStatus)
        .where(inArray(userStatus.userId, userIds));

      const statusMap = new Map(statuses.map(s => [s.userId, s]));

      // Get subscription info for each user
      const subscriptionInfo = await db
        .select()
        .from(subscriptions)
        .where(inArray(subscriptions.userId, userIds));

      const subscriptionMap = new Map(subscriptionInfo.map(s => [s.userId, s]));

      // Combine data
      const enrichedUsers = usersQuery.map(user => ({
        ...user,
        status: statusMap.get(user.id)?.status || 'active',
        statusReason: statusMap.get(user.id)?.reason,
        subscription: subscriptionMap.get(user.id),
        hasActiveSubscription: !!subscriptionMap.get(user.id) && 
          subscriptionMap.get(user.id)?.status === 'active'
      }));

      // Filter by status if specified
      let filteredUsers = enrichedUsers;
      if (status !== 'all') {
        filteredUsers = enrichedUsers.filter(user => user.status === status);
      }

      res.json({
        users: filteredUsers,
        pagination: {
          total: totalCount,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(totalCount / Number(limit))
        }
      });

    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/users/:id/status", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id: userId } = req.params;
      const { status, reason } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      if (!['active', 'banned', 'suspended'].includes(status)) {
        return res.status(400).json({ error: "Invalid status. Must be active, banned, or suspended" });
      }

      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Update user status
      const updatedStatus = await storage.updateUserStatus(userId, status, reason);

      // Log admin action
      logInfo(`Admin action: User ${userId} status changed to ${status}`, {
        adminId: (req as any).session?.user?.id,
        targetUserId: userId,
        newStatus: status,
        reason: reason
      });

      res.json({
        success: true,
        userStatus: updatedStatus
      });

    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ error: "Failed to update user status" });
    }
  });

  app.get("/api/admin/subscriptions", requireAuth, requireAdmin, async (req, res) => {
    try {
      // Get subscription overview
      const [totalSubscriptions] = await db
        .select({ count: count() })
        .from(subscriptions);

      const [activeSubscriptions] = await db
        .select({ count: count() })
        .from(subscriptions)
        .where(eq(subscriptions.status, 'active'));

      const [canceledSubscriptions] = await db
        .select({ count: count() })
        .from(subscriptions)
        .where(eq(subscriptions.status, 'canceled'));

      // Get subscription plans
      const plans = await storage.getSubscriptionPlans();

      // Get recent subscriptions with user info
      const recentSubscriptions = await db
        .select({
          subscription: subscriptions,
          user: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName
          }
        })
        .from(subscriptions)
        .leftJoin(users, eq(subscriptions.userId, users.id))
        .orderBy(desc(subscriptions.createdAt))
        .limit(10);

      res.json({
        overview: {
          total: totalSubscriptions?.count || 0,
          active: activeSubscriptions?.count || 0,
          canceled: canceledSubscriptions?.count || 0,
          churnRate: totalSubscriptions?.count ? 
            ((canceledSubscriptions?.count || 0) / totalSubscriptions.count * 100).toFixed(1) : '0'
        },
        plans,
        recentSubscriptions
      });

    } catch (error) {
      console.error("Error fetching subscription data:", error);
      res.status(500).json({ error: "Failed to fetch subscription data" });
    }
  });

  // Cancel subscription endpoint
  app.post("/api/admin/subscriptions/:id/cancel", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id: subscriptionId } = req.params;
      const { reason } = req.body;

      if (!subscriptionId) {
        return res.status(400).json({ error: "Subscription ID is required" });
      }

      // Get subscription to verify it exists
      const subscription = await storage.getUserSubscription(subscriptionId);
      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      // Update subscription status to canceled
      const updatedSubscription = await storage.updateSubscription(subscriptionId, {
        status: 'canceled',
        canceledAt: new Date(),
      });

      // Log admin action
      logInfo(`Admin action: Subscription ${subscriptionId} canceled`, {
        adminId: (req as any).session?.user?.id,
        subscriptionId,
        userId: subscription.userId,
        reason: reason
      });

      res.json({
        success: true,
        subscription: updatedSubscription
      });

    } catch (error) {
      console.error("Error canceling subscription:", error);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  // Resume subscription endpoint
  app.post("/api/admin/subscriptions/:id/resume", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id: subscriptionId } = req.params;

      if (!subscriptionId) {
        return res.status(400).json({ error: "Subscription ID is required" });
      }

      // Get subscription to verify it exists
      const subscription = await storage.getUserSubscription(subscriptionId);
      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      if (subscription.status !== 'canceled') {
        return res.status(400).json({ error: "Only canceled subscriptions can be resumed" });
      }

      // Update subscription status to active
      const updatedSubscription = await storage.updateSubscription(subscriptionId, {
        status: 'active',
        canceledAt: null,
      });

      // Log admin action
      logInfo(`Admin action: Subscription ${subscriptionId} resumed`, {
        adminId: (req as any).session?.user?.id,
        subscriptionId,
        userId: subscription.userId
      });

      res.json({
        success: true,
        subscription: updatedSubscription
      });

    } catch (error) {
      console.error("Error resuming subscription:", error);
      res.status(500).json({ error: "Failed to resume subscription" });
    }
  });

  // Change subscription plan endpoint
  app.patch("/api/admin/subscriptions/:id/plan", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id: subscriptionId } = req.params;
      const { planId } = req.body;

      if (!subscriptionId) {
        return res.status(400).json({ error: "Subscription ID is required" });
      }

      if (!planId) {
        return res.status(400).json({ error: "Plan ID is required" });
      }

      // Get subscription to verify it exists
      const subscription = await storage.getUserSubscription(subscriptionId);
      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      // Verify the new plan exists
      const plans = await storage.getSubscriptionPlans();
      const newPlan = plans.find(p => p.id === planId);
      if (!newPlan) {
        return res.status(400).json({ error: "Invalid plan ID" });
      }

      // Update subscription plan
      const updatedSubscription = await storage.updateSubscription(subscriptionId, {
        planId,
      });

      // Log admin action
      logInfo(`Admin action: Subscription ${subscriptionId} plan changed`, {
        adminId: (req as any).session?.user?.id,
        subscriptionId,
        userId: subscription.userId,
        oldPlanId: subscription.planId,
        newPlanId: planId
      });

      res.json({
        success: true,
        subscription: updatedSubscription
      });

    } catch (error) {
      console.error("Error changing subscription plan:", error);
      res.status(500).json({ error: "Failed to change subscription plan" });
    }
  });

  app.get("/api/admin/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getStats();
      
      // Get additional admin-specific stats
      const [totalUsers] = await db.select({ count: count() }).from(users);
      const [bannedUsers] = await db
        .select({ count: count() })
        .from(userStatus)
        .where(eq(userStatus.status, 'banned'));
      
      const [suspendedUsers] = await db
        .select({ count: count() })
        .from(userStatus)
        .where(eq(userStatus.status, 'suspended'));

      const [adminUserCount] = await db.select({ count: count() }).from(adminUsers);

      res.json({
        ...stats,
        users: {
          total: totalUsers?.count || 0,
          banned: bannedUsers?.count || 0,
          suspended: suspendedUsers?.count || 0,
          active: (totalUsers?.count || 0) - (bannedUsers?.count || 0) - (suspendedUsers?.count || 0)
        },
        admins: adminUserCount?.count || 0
      });

    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  // Beta Access Management Routes
  app.post("/api/admin/users/:userId/beta-access", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { expiresAt } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Validate expiration date
      const expirationDate = expiresAt ? new Date(expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days
      const now = new Date();
      const maxExpiration = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Max 1 year

      if (expirationDate <= now) {
        return res.status(400).json({ error: "Expiration date must be in the future" });
      }

      if (expirationDate > maxExpiration) {
        return res.status(400).json({ error: "Expiration date cannot be more than 1 year from now" });
      }

      // Grant beta access
      const userAccess = await storage.setBetaAccess(userId, true, expirationDate);

      // Log admin action
      logInfo(`Admin action: Beta access granted to user ${userId}`, {
        adminId: (req as any).session?.user?.id,
        userId,
        userEmail: user.email,
        expiresAt: expirationDate.toISOString()
      });

      res.json({
        success: true,
        userAccess,
        message: `Beta access granted until ${expirationDate.toLocaleDateString()}`
      });

    } catch (error) {
      console.error("Error granting beta access:", error);
      res.status(500).json({ error: "Failed to grant beta access" });
    }
  });

  app.delete("/api/admin/users/:userId/beta-access", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Revoke beta access
      const userAccess = await storage.setBetaAccess(userId, false, null);

      // Log admin action
      logInfo(`Admin action: Beta access revoked from user ${userId}`, {
        adminId: (req as any).session?.user?.id,
        userId,
        userEmail: user.email
      });

      res.json({
        success: true,
        userAccess,
        message: "Beta access revoked successfully"
      });

    } catch (error) {
      console.error("Error revoking beta access:", error);
      res.status(500).json({ error: "Failed to revoke beta access" });
    }
  });

  app.get("/api/admin/beta-testers", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 20,
        status = 'all' // all, active, expired
      } = req.query;

      const pageNumber = parseInt(page as string);
      const limitNumber = parseInt(limit as string);
      const offset = (pageNumber - 1) * limitNumber;

      // Build where conditions based on status filter
      const now = new Date();
      let whereConditions;

      if (status === 'active') {
        whereConditions = and(
          eq(userAccess.betaTester, true),
          or(
            isNull(userAccess.betaExpiresAt),
            gt(userAccess.betaExpiresAt, now)
          )
        );
      } else if (status === 'expired') {
        whereConditions = and(
          eq(userAccess.betaTester, true),
          lt(userAccess.betaExpiresAt, now)
        );
      } else {
        // all beta testers (including expired)
        whereConditions = eq(userAccess.betaTester, true);
      }

      // Get beta testers with user information
      const betaTesters = await db
        .select({
          id: userAccess.id,
          userId: userAccess.userId,
          betaTester: userAccess.betaTester,
          betaExpiresAt: userAccess.betaExpiresAt,
          createdAt: userAccess.createdAt,
          updatedAt: userAccess.updatedAt,
          user: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
            createdAt: users.createdAt
          }
        })
        .from(userAccess)
        .innerJoin(users, eq(userAccess.userId, users.id))
        .where(whereConditions)
        .orderBy(desc(userAccess.updatedAt))
        .limit(limitNumber)
        .offset(offset);

      // Get total count for pagination
      const [totalCount] = await db
        .select({ count: count() })
        .from(userAccess)
        .innerJoin(users, eq(userAccess.userId, users.id))
        .where(whereConditions);

      // Get summary stats
      const [totalBetaTesters] = await db
        .select({ count: count() })
        .from(userAccess)
        .where(eq(userAccess.betaTester, true));

      const [activeBetaTesters] = await db
        .select({ count: count() })
        .from(userAccess)
        .where(and(
          eq(userAccess.betaTester, true),
          or(
            isNull(userAccess.betaExpiresAt),
            gt(userAccess.betaExpiresAt, now)
          )
        ));

      const [expiredBetaTesters] = await db
        .select({ count: count() })
        .from(userAccess)
        .where(and(
          eq(userAccess.betaTester, true),
          lt(userAccess.betaExpiresAt, now)
        ));

      // Add status calculation to each beta tester
      const betaTestersWithStatus = betaTesters.map(bt => {
        const isActive = bt.betaTester && (!bt.betaExpiresAt || bt.betaExpiresAt > now);
        const isExpired = bt.betaTester && bt.betaExpiresAt && bt.betaExpiresAt <= now;
        
        let daysUntilExpiry = null;
        if (bt.betaExpiresAt && bt.betaExpiresAt > now) {
          daysUntilExpiry = Math.ceil((bt.betaExpiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        }

        return {
          ...bt,
          status: isActive ? 'active' : (isExpired ? 'expired' : 'inactive'),
          daysUntilExpiry
        };
      });

      res.json({
        betaTesters: betaTestersWithStatus,
        pagination: {
          total: totalCount?.count || 0,
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil((totalCount?.count || 0) / limitNumber)
        },
        stats: {
          total: totalBetaTesters?.count || 0,
          active: activeBetaTesters?.count || 0,
          expired: expiredBetaTesters?.count || 0
        }
      });

    } catch (error) {
      console.error("Error fetching beta testers:", error);
      res.status(500).json({ error: "Failed to fetch beta testers" });
    }
  });

  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, cleaning up product scheduler...');
    productScheduler.stopAll();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('Received SIGINT, cleaning up product scheduler...');
    productScheduler.stopAll();
    process.exit(0);
  });

  const httpServer = createServer(app);

  return httpServer;
}

// Enhanced rotating user agents with more variety to avoid detection
const USER_AGENTS = [
  // Chrome on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  // Chrome on Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  // Firefox
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
  // Safari
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  // Edge
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0'
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Enhanced browser fingerprint simulation
function generateBrowserHeaders(userAgent: string, platform: 'amazon' | 'walmart'): Record<string, string> {
  const isChrome = userAgent.includes('Chrome');
  const isFirefox = userAgent.includes('Firefox');
  const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
  const isWindows = userAgent.includes('Windows');
  const isMac = userAgent.includes('Macintosh');
  
  const headers: Record<string, string> = {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'DNT': '1'
  };
  
  // Chrome-specific headers
  if (isChrome) {
    headers['sec-ch-ua'] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
    headers['sec-ch-ua-mobile'] = '?0';
    headers['sec-ch-ua-platform'] = isWindows ? '"Windows"' : '"macOS"';
    headers['Sec-Fetch-Dest'] = 'document';
    headers['Sec-Fetch-Mode'] = 'navigate';
    headers['Sec-Fetch-Site'] = 'none';
    headers['Sec-Fetch-User'] = '?1';
  }
  
  // Platform-specific referer
  if (platform === 'amazon') {
    headers['Referer'] = 'https://www.google.com/';
  } else if (platform === 'walmart') {
    headers['Referer'] = 'https://www.google.com/';
  }
  
  return headers;
}

function detectChallengePage(html: string, url: string): boolean {
  const challengeIndicators = [
    'Robot Check',
    'Robot or human?',
    'Something went wrong',
    'To discuss automated access',
    'automated queries',
    'unusual traffic',
    'blocked',
    'captcha',
    'Please confirm that you are a human',
    'Security check',
    'Access Denied'
  ];
  
  const lowerHtml = html.toLowerCase();
  const isChallenge = challengeIndicators.some(indicator => 
    lowerHtml.includes(indicator.toLowerCase())
  );
  
  if (isChallenge) {
    console.log(`Challenge page detected for URL: ${url}`);
    console.log(`Challenge indicators found: ${challengeIndicators.filter(indicator => 
      lowerHtml.includes(indicator.toLowerCase())
    ).join(', ')}`);
  }
  
  return isChallenge;
}

async function scrapeWithRetry(url: string, platform: "amazon" | "walmart", maxRetries = 3): Promise<string> {
  // Use optimized HTTP connection pool instead of creating new instances
  const axiosInstance = httpPool.getAxiosInstance();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Scraping attempt ${attempt}/${maxRetries} for ${platform}: ${url}`);
      
      // Progressive delay between requests - more human-like
      if (attempt > 1) {
        const baseDelay = platform === 'walmart' ? 3000 : 2000; // Walmart needs longer delays
        const randomDelay = Math.random() * 3000 + baseDelay; // 2-5s for Amazon, 3-6s for Walmart
        console.log(`Waiting ${Math.round(randomDelay)}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, randomDelay));
      }
      
      // Generate realistic browser headers
      const userAgent = getRandomUserAgent();
      const headers = generateBrowserHeaders(userAgent, platform);
      
      // Add some randomness to make requests less detectable
      if (Math.random() > 0.7) {
        headers['X-Requested-With'] = 'XMLHttpRequest';
      }

      // Simulate more realistic browsing behavior
      const axiosConfig = {
        headers,
        timeout: 30000,
        maxRedirects: 5,
        validateStatus: (status: number) => status < 500, // Accept 4xx errors but retry on 5xx
        // Disable automatic decompression to handle manually
        decompress: false
      };
      
      const response = await axiosInstance.get(url, axiosConfig);

      // Debug: Log response status and first 500 chars of content
      console.log(`Response status: ${response.status}, Content length: ${response.data.length}`);
      console.log(`First 500 chars: ${response.data.substring(0, 500)}`);

      // Check if we got a challenge page
      if (detectChallengePage(response.data, url)) {
        if (attempt < maxRetries) {
          console.log(`Challenge detected, retrying attempt ${attempt + 1} with exponential backoff...`);
          // Enhanced exponential backoff with jitter for challenges
          const baseDelay = Math.pow(2, attempt) * 2000; // 4s, 8s, 16s base delays
          const jitter = Math.random() * 2000; // Add up to 2s random jitter
          const challengeDelay = baseDelay + jitter;
          console.log(`Challenge backoff delay: ${Math.round(challengeDelay)}ms`);
          await new Promise(resolve => setTimeout(resolve, challengeDelay));
          continue;
        } else {
          console.log("All retry attempts exhausted, challenge page persists");
          console.log("Recommendation: Try using a different approach or external scraping service");
          return "Product blocked by anti-bot protection";
        }
      }

      const $ = cheerio.load(response.data);
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

        console.log(`Successfully scraped ${platform} product: "${productName}"`);
        return productName;
      }

      // If no product name found, try one more time if we have retries left
      if (attempt < maxRetries) {
        console.log(`No product name found, retrying attempt ${attempt + 1}...`);
        continue;
      }

      return "Product Name Could Not Be Retrieved";

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Scraping attempt ${attempt} failed for ${platform} product ${url}:`, errorMessage);
      
      // Handle specific error types
      if ((error as any).code === 'ENOTFOUND' || (error as any).code === 'ECONNREFUSED') {
        console.log('Network connectivity issue detected');
        return "Network error: Could not connect to product page";
      }
      
      if ((error as any).response?.status === 403) {
        console.log('Access forbidden - likely blocked by anti-bot');
        if (attempt < maxRetries) {
          const blockDelay = Math.random() * 5000 + 5000; // 5-10 second delay for 403s
          console.log(`403 error, waiting ${Math.round(blockDelay)}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, blockDelay));
          continue;
        }
        return "Access blocked by anti-bot protection";
      }
      
      if (attempt === maxRetries) {
        return "Product Name Could Not Be Retrieved";
      }
      
      // Short delay before retrying on other errors
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return "Product Name Could Not Be Retrieved";
}

// Optimized non-blocking scraping using worker pool
async function scrapeProductName(url: string, platform: "amazon" | "walmart"): Promise<string> {
  // Validate URL to prevent SSRF attacks
  try {
    const urlObj = new URL(url);
    const allowedHosts = ['amazon.com', 'www.amazon.com', 'walmart.com', 'www.walmart.com'];
    
    if (!allowedHosts.includes(urlObj.hostname)) {
      throw new Error(`Invalid hostname: ${urlObj.hostname}`);
    }
  } catch (error) {
    console.error('Invalid URL:', url, error);
    return "Invalid URL provided";
  }

  // Use optimized HTTP connection pool for scraping
  try {
    return await scrapeWithRetry(url, platform, 3);
  } catch (error) {
    console.error('Optimized scraping failed:', error);
    return "Product Name Could Not Be Retrieved";
  }
}

// Worker-based ASIN search
async function searchByASINWithWorker(asin: string): Promise<{results: Array<{platform: string, name: string, url: string, asin?: string, price?: string, status: string}>}> {
  try {
    // Validate ASIN format (should be 10 characters, alphanumeric)
    if (!/^[A-Z0-9]{10}$/.test(asin.toUpperCase())) {
      throw new Error("Invalid ASIN format");
    }

    const amazonUrl = `https://www.amazon.com/dp/${asin.toUpperCase()}`;
    console.log(`Searching Amazon by ASIN: ${asin} -> ${amazonUrl}`);
    
    // Use optimized scraping with connection pooling
    const productName = await scrapeProductName(amazonUrl, 'amazon');
    
    const status = productName.includes("blocked") || productName.includes("Could Not Be Retrieved") ? "blocked" : "ok";
    
    return {
      results: [{
        platform: "amazon",
        name: productName,
        url: amazonUrl,
        asin: asin.toUpperCase(),
        price: "N/A",
        status: status
      }]
    };
  } catch (error) {
    console.error(`Error searching by ASIN ${asin}:`, error);
    return {
      results: [{
        platform: "amazon", 
        name: "Product Name Could Not Be Retrieved",
        url: `https://www.amazon.com/dp/${asin.toUpperCase()}`,
        asin: asin.toUpperCase(),
        price: "N/A",
        status: "error"
      }]
    };
  }
}

async function searchByASIN(asin: string): Promise<{results: Array<{platform: string, name: string, url: string, asin?: string, price?: string, status: string}>}> {
  try {
    // Validate ASIN format (should be 10 characters, alphanumeric)
    if (!/^[A-Z0-9]{10}$/.test(asin.toUpperCase())) {
      throw new Error("Invalid ASIN format");
    }

    const amazonUrl = `https://www.amazon.com/dp/${asin.toUpperCase()}`;
    console.log(`Searching Amazon by ASIN: ${asin} -> ${amazonUrl}`);
    
    const productName = await scrapeWithRetry(amazonUrl, 'amazon', 3);
    
    const status = productName.includes("blocked") || productName.includes("Could Not Be Retrieved") ? "blocked" : "ok";
    
    return {
      results: [{
        platform: "amazon",
        name: productName,
        url: amazonUrl,
        asin: asin.toUpperCase(),
        price: "N/A",
        status: status
      }]
    };
  } catch (error) {
    console.error(`Error searching by ASIN ${asin}:`, error);
    return {
      results: [{
        platform: "amazon", 
        name: "Product Name Could Not Be Retrieved",
        url: `https://www.amazon.com/dp/${asin.toUpperCase()}`,
        asin: asin.toUpperCase(),
        price: "N/A",
        status: "error"
      }]
    };
  }
}

async function searchByProductName(query: string, platform: "amazon" | "walmart" | "both"): Promise<{results: Array<{platform: string, name: string, url: string, price?: string, status: string}>}> {
  try {
    console.log(`Searching ${platform} platform(s) for product name: "${query}"`);
    
    if (platform === "both") {
      // Search both platforms in parallel
      console.log(`Running parallel search on Amazon and Walmart for: "${query}"`);
      
      const [amazonResults, walmartResults] = await Promise.all([
        searchSinglePlatform(query, "amazon"),
        searchSinglePlatform(query, "walmart")
      ]);
      
      // Combine results from both platforms
      const combinedResults = [...amazonResults, ...walmartResults];
      console.log(`Combined ${combinedResults.length} results from both platforms`);
      
      return { results: combinedResults };
    } else {
      // Search single platform
      const results = await searchSinglePlatform(query, platform);
      return { results: results };
    }
    
  } catch (error) {
    console.error(`Error searching for "${query}" on ${platform}:`, error);
    return { 
      results: [{
        platform: platform === "both" ? "multi" : platform,
        name: "Search results could not be retrieved", 
        url: "",
        price: "N/A",
        status: "error"
      }]
    };
  }
}

async function searchSinglePlatform(query: string, platform: "amazon" | "walmart"): Promise<Array<{platform: string, name: string, url: string, price?: string, status: string}>> {
  try {
    let searchUrl = "";
    if (platform === "amazon") {
      searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
    } else if (platform === "walmart") {
      searchUrl = `https://www.walmart.com/search?q=${encodeURIComponent(query)}`;
    }

    const searchResults = await scrapeSearchResults(searchUrl, platform);
    
    // Add platform field and status to each result
    return searchResults.map(result => ({
      platform: platform,
      name: result.name,
      url: result.url,
      price: result.price,
      status: result.name.includes("blocked") || result.name.includes("could not be retrieved") ? "blocked" : "ok"
    }));
    
  } catch (error) {
    console.error(`Error searching ${platform} for "${query}":`, error);
    return [{
      platform: platform,
      name: "Search results could not be retrieved",
      url: "",
      price: "N/A", 
      status: "error"
    }];
  }
}

async function scrapeSearchResults(searchUrl: string, platform: "amazon" | "walmart"): Promise<Array<{name: string, url: string, price?: string}>> {
  try {
    const headers: Record<string, string> = {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=0',
      'DNT': '1'
    };

    if (platform === 'amazon') {
      headers['Referer'] = 'https://www.amazon.com/';
    } else {
      headers['Referer'] = 'https://www.walmart.com/';
    }

    // Use optimized HTTP connection pool
    const response = await httpPool.getAxiosInstance().get(searchUrl, {
      headers,
      timeout: 15000,
      maxRedirects: 5
    });

    if (detectChallengePage(response.data, searchUrl)) {
      console.log("Challenge page detected for search results");
      return [{ name: "Search blocked by anti-bot protection", url: "", price: "N/A" }];
    }

    const $ = cheerio.load(response.data);
    const results: Array<{name: string, url: string, price?: string}> = [];

    if (platform === "amazon") {
      // Amazon search result selectors
      $('[data-component-type="s-search-result"]').each((index, element) => {
        if (index >= 5) return; // Limit to top 5 results
        
        const $element = $(element);
        const nameElement = $element.find('h2 a span, .a-size-mini span, .a-size-base-plus');
        const linkElement = $element.find('h2 a');
        const priceElement = $element.find('.a-price .a-offscreen, .a-price-whole');
        
        const name = nameElement.first().text().trim();
        const relativeUrl = linkElement.attr('href');
        const price = priceElement.first().text().trim();
        
        if (name && relativeUrl) {
          const fullUrl = relativeUrl.startsWith('http') ? relativeUrl : `https://www.amazon.com${relativeUrl}`;
          results.push({
            name: name.substring(0, 100), // Limit name length
            url: fullUrl,
            price: price || "N/A"
          });
        }
      });
    } else if (platform === "walmart") {
      // Walmart search result selectors
      $('[data-testid="item"], [data-automation-id="product-title"]').each((index, element) => {
        if (index >= 5) return; // Limit to top 5 results
        
        const $element = $(element);
        const nameElement = $element.find('[data-automation-id="product-title"], a[href*="/ip/"]');
        const priceElement = $element.find('[itemprop="price"], .price-current');
        
        const name = nameElement.first().text().trim();
        const relativeUrl = nameElement.first().attr('href');
        const price = priceElement.first().text().trim();
        
        if (name && relativeUrl) {
          const fullUrl = relativeUrl.startsWith('http') ? relativeUrl : `https://www.walmart.com${relativeUrl}`;
          results.push({
            name: name.substring(0, 100), // Limit name length
            url: fullUrl,
            price: price || "N/A"
          });
        }
      });
    }

    console.log(`Found ${results.length} search results for ${platform}`);
    return results.slice(0, 5); // Return top 5 results

  } catch (error) {
    console.error(`Error scraping search results from ${searchUrl}:`, error);
    return [{ name: "Search results could not be retrieved", url: "", price: "N/A" }];
  }
}
