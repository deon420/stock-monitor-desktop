import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { cryptoService } from './crypto';
import { logger } from './logger';

/**
 * Unified Authentication Service
 * Handles JWT tokens, refresh token rotation, and secure password operations
 */
export class AuthService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiry = '15m'; // 15 minutes
  private readonly refreshTokenExpiry = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

  constructor() {
    // Use environment variables or generate secure defaults
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || this.generateSecureSecret();
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || this.generateSecureSecret();
    
    if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
      logger.warn('⚠️  JWT secrets not found in environment. Generated temporary secrets.');
      logger.warn('⚠️  For production use, set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET environment variables.');
      logger.warn('⚠️  Temporary secrets will invalidate tokens after server restart.');
    }
  }

  /**
   * Generate a secure random secret
   */
  private generateSecureSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Generate JWT access token (15 minutes expiry)
   */
  generateAccessToken(userId: string, isAdmin: boolean = false): string {
    const payload = {
      userId,
      isAdmin,
      type: 'access'
    };

    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'stock-monitor-auth',
      audience: 'stock-monitor-app'
    });
  }

  /**
   * Verify and decode JWT access token
   */
  verifyAccessToken(token: string): { userId: string; isAdmin: boolean } | null {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: 'stock-monitor-auth',
        audience: 'stock-monitor-app'
      }) as jwt.JwtPayload;

      if (decoded.type !== 'access') {
        return null;
      }

      return {
        userId: decoded.userId,
        isAdmin: decoded.isAdmin || false
      };
    } catch (error) {
      logger.debug('Invalid access token:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Generate opaque refresh token (256-bit random)
   */
  generateRefreshToken(): string {
    return crypto.randomBytes(32).toString('hex'); // 256 bits
  }

  /**
   * Hash refresh token for secure storage
   */
  hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Hash password using cryptoService
   */
  hashPassword(password: string): string {
    return cryptoService.hashPassword(password);
  }

  /**
   * Verify password using cryptoService
   */
  verifyPassword(password: string, hashedPassword: string): boolean {
    return cryptoService.verifyPassword(password, hashedPassword);
  }

  /**
   * Create refresh token and store in database
   */
  async createRefreshTokenRecord(userId: string, userAgent?: string, ipAddress?: string): Promise<string> {
    const refreshToken = this.generateRefreshToken();
    const hashedToken = this.hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + this.refreshTokenExpiry);

    await storage.createRefreshToken(userId, hashedToken, expiresAt, userAgent, ipAddress);
    
    return refreshToken;
  }

  /**
   * Validate refresh token and get user
   */
  async validateRefreshToken(token: string): Promise<{ userId: string; tokenId: string } | null> {
    try {
      const hashedToken = this.hashRefreshToken(token);
      const tokenRecord = await storage.findRefreshTokenByHash(hashedToken);

      if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
        return null;
      }

      return {
        userId: tokenRecord.userId,
        tokenId: tokenRecord.id
      };
    } catch (error) {
      logger.error('Error validating refresh token:', error);
      return null;
    }
  }

  /**
   * Rotate refresh token (revoke old, create new)
   */
  async rotateRefreshToken(oldTokenId: string, userId: string, userAgent?: string, ipAddress?: string): Promise<string> {
    // Revoke old token
    await storage.revokeRefreshToken(oldTokenId);
    
    // Create new token
    return await this.createRefreshTokenRecord(userId, userAgent, ipAddress);
  }

  /**
   * Check if user has valid authorization (subscription or beta access)
   * Priority Order:
   * 1. DENY if user status is 'banned' or 'suspended' (highest priority)
   * 2. ALLOW if user has valid beta access (betaTester=true AND not expired)
   * 3. ALLOW if user status is 'active' AND has valid subscription
   * 4. DENY all other cases
   */
  async checkUserAuthorization(userId: string): Promise<{ authorized: boolean; reason?: string; accessType?: 'subscription' | 'beta' }> {
    try {
      // Get user status first (banned/suspended check)
      const userStatus = await storage.getUserStatus(userId);
      const currentStatus = userStatus?.status || 'active'; // Default to 'active' for backward compatibility
      
      // Priority 1: DENY if user status is 'banned' or 'suspended' (overrides everything)
      if (['banned', 'suspended'].includes(currentStatus)) {
        return { 
          authorized: false, 
          reason: `User account is ${currentStatus}${userStatus?.reason ? ': ' + userStatus.reason : ''}` 
        };
      }

      // Priority 2: ALLOW if user has valid beta access (regardless of subscription)
      const hasValidBetaAccess = await storage.hasValidBetaAccess(userId);
      if (hasValidBetaAccess) {
        logger.info(`User ${userId} authorized via beta access`);
        return { 
          authorized: true,
          accessType: 'beta'
        };
      }

      // Priority 3: ALLOW if user status is 'active' AND has valid subscription
      if (currentStatus === 'active') {
        const subscription = await storage.getUserSubscription(userId);
        if (subscription && subscription.status === 'active') {
          logger.info(`User ${userId} authorized via active subscription`);
          return { 
            authorized: true,
            accessType: 'subscription'
          };
        }
      }

      // Priority 4: DENY all other cases
      let reason = 'Access denied';
      if (currentStatus !== 'active') {
        reason = `User account status is '${currentStatus}'. Active status required for subscription access.`;
      } else {
        reason = 'No active subscription or beta access found';
      }

      logger.warn(`User ${userId} authorization denied: ${reason}`);
      return { 
        authorized: false, 
        reason 
      };
    } catch (error) {
      logger.error('Error checking user authorization:', error);
      return { 
        authorized: false, 
        reason: 'Authorization check failed' 
      };
    }
  }

  /**
   * Get secure cookie settings
   */
  getCookieSettings(isProduction: boolean = process.env.NODE_ENV === 'production') {
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict' as const,
      maxAge: this.refreshTokenExpiry,
      path: '/'
    };
  }

  /**
   * Set authentication cookies
   */
  setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    const cookieSettings = this.getCookieSettings();
    
    res.cookie('accessToken', accessToken, {
      ...cookieSettings,
      maxAge: 15 * 60 * 1000 // 15 minutes for access token
    });
    
    res.cookie('refreshToken', refreshToken, cookieSettings);
  }

  /**
   * Clear authentication cookies
   */
  clearAuthCookies(res: Response): void {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
  }

  /**
   * Extract token from request (cookies or Authorization header)
   */
  extractTokenFromRequest(req: Request, tokenType: 'access' | 'refresh'): string | null {
    // Try cookies first (web clients)
    const cookieToken = req.cookies?.[`${tokenType}Token`];
    if (cookieToken) {
      return cookieToken;
    }

    // Try Authorization header (desktop/mobile clients)
    const authHeader = req.headers.authorization;
    if (authHeader) {
      if (tokenType === 'access' && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
      }
      if (tokenType === 'refresh' && authHeader.startsWith('Refresh ')) {
        return authHeader.substring(8);
      }
    }

    return null;
  }

  /**
   * Rate limiting helper - simple in-memory implementation
   */
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  checkRateLimit(identifier: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): boolean {
    const now = Date.now();
    const record = this.rateLimitMap.get(identifier);

    if (!record || now > record.resetTime) {
      // Reset or create new record
      this.rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (record.count >= maxAttempts) {
      return false;
    }

    record.count++;
    return true;
  }

  /**
   * Clean up expired rate limit entries
   */
  cleanupRateLimit(): void {
    const now = Date.now();
    Array.from(this.rateLimitMap.entries()).forEach(([key, record]) => {
      if (now > record.resetTime) {
        this.rateLimitMap.delete(key);
      }
    });
  }
}

// Export singleton instance
export const authService = new AuthService();

/**
 * Authentication Middleware
 */

/**
 * Require valid JWT access token
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = authService.extractTokenFromRequest(req, 'access');
    
    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const decoded = authService.verifyAccessToken(token);
    if (!decoded) {
      res.status(401).json({ error: 'Invalid or expired access token' });
      return;
    }

    // Check if user still exists
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Attach user info to request
    (req as any).user = { id: decoded.userId, isAdmin: decoded.isAdmin };
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Require admin privileges
 * NOTE: This middleware must be used AFTER requireAuth in the middleware chain
 * Example: app.get('/admin/endpoint', requireAuth, requireAdmin, handler)
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Double-check admin status in database (don't rely solely on JWT claims)
    const isAdmin = await storage.isUserAdmin(user.id);
    if (!isAdmin) {
      res.status(403).json({ error: 'Admin privileges required' });
      return;
    }

    next();
  } catch (error) {
    logger.error('Admin authorization error:', error);
    res.status(500).json({ error: 'Authorization failed' });
  }
}

/**
 * Authorization middleware - check subscription or beta access
 * NOTE: This middleware must be used AFTER requireAuth in the middleware chain
 * Example: app.get('/protected', requireAuth, authorize, handler)
 */
export async function authorize(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const authResult = await authService.checkUserAuthorization(user.id);
    
    if (!authResult.authorized) {
      // Enhanced error response with categorized access denial reasons
      let errorCode = 'ACCESS_DENIED';
      let statusCode = 403;
      
      if (authResult.reason?.includes('banned')) {
        errorCode = 'ACCOUNT_BANNED';
        statusCode = 403;
      } else if (authResult.reason?.includes('suspended')) {
        errorCode = 'ACCOUNT_SUSPENDED';
        statusCode = 403;
      } else if (authResult.reason?.includes('No active subscription')) {
        errorCode = 'SUBSCRIPTION_REQUIRED';
        statusCode = 402; // Payment Required
      } else if (authResult.reason?.includes('authorization check failed')) {
        errorCode = 'AUTHORIZATION_ERROR';
        statusCode = 500;
      }

      res.status(statusCode).json({ 
        error: 'Access denied', 
        reason: authResult.reason || 'Insufficient privileges',
        code: errorCode,
        userId: user.id
      });
      return;
    }

    // Attach access type information for downstream handlers
    (req as any).accessType = authResult.accessType;
    
    logger.debug(`User ${user.id} authorized with ${authResult.accessType} access`);
    next();
  } catch (error) {
    logger.error('Authorization error:', error);
    res.status(500).json({ 
      error: 'Authorization failed',
      code: 'AUTHORIZATION_ERROR'
    });
  }
}

/**
 * Optional authentication middleware - attach user if token is valid but don't require it
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = authService.extractTokenFromRequest(req, 'access');
    
    if (token) {
      const decoded = authService.verifyAccessToken(token);
      if (decoded) {
        const user = await storage.getUser(decoded.userId);
        if (user) {
          (req as any).user = { id: decoded.userId, isAdmin: decoded.isAdmin };
        }
      }
    }

    next();
  } catch (error) {
    // Don't fail for optional auth, just continue without user
    logger.debug('Optional auth failed:', error);
    next();
  }
}