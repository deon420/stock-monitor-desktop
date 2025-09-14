import type { Express } from "express";
import { storage } from "./storage";
import { authService, requireAuth, authorize, requireAdmin } from "./auth";
import { logger } from "./logger";

/**
 * Test routes for comprehensive authorization testing
 * This file provides endpoints to test different authorization scenarios
 */
export function setupAuthTestRoutes(app: Express): void {
  
  /**
   * Test endpoint: Check current user authorization status
   */
  app.get("/api/test/auth-status", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Get comprehensive authorization information
      const authResult = await authService.checkUserAuthorization(user.id);
      const userRecord = await storage.getUser(user.id);
      const userStatus = await storage.getUserStatus(user.id);
      const subscription = await storage.getUserSubscription(user.id);
      const betaAccess = await storage.getUserAccess(user.id);
      const hasValidBeta = await storage.hasValidBetaAccess(user.id);
      
      res.json({
        userId: user.id,
        isAdmin: user.isAdmin,
        authorization: authResult,
        userRecord: {
          id: userRecord?.id,
          email: userRecord?.email,
          firstName: userRecord?.firstName,
          lastName: userRecord?.lastName,
        },
        userStatus: userStatus ? {
          status: userStatus.status,
          reason: userStatus.reason,
          createdAt: userStatus.createdAt,
        } : null,
        subscription: subscription ? {
          id: subscription.id,
          status: subscription.status,
          planId: subscription.planId,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
        } : null,
        betaAccess: betaAccess ? {
          betaTester: betaAccess.betaTester,
          betaExpiresAt: betaAccess.betaExpiresAt,
          status: hasValidBeta ? 'active' : 'expired',
        } : null,
        hasValidBetaAccess: hasValidBeta,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in auth status test:', error);
      res.status(500).json({ error: 'Failed to get authorization status' });
    }
  });

  /**
   * Test endpoint: Protected feature requiring authorization
   */
  app.get("/api/test/protected-feature", requireAuth, authorize, async (req, res) => {
    const user = (req as any).user;
    const accessType = (req as any).accessType;
    
    res.json({
      message: "Access granted to protected feature",
      userId: user.id,
      accessType: accessType,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Test endpoint: Set user status (admin only) - for testing different scenarios
   */
  app.post("/api/test/set-user-status", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { userId, status, reason } = req.body;
      
      if (!userId || !status) {
        return res.status(400).json({ error: 'userId and status are required' });
      }

      if (!['active', 'banned', 'suspended'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be active, banned, or suspended' });
      }

      // Create or update user status
      const existingStatus = await storage.getUserStatus(userId);
      if (existingStatus) {
        await storage.updateUserStatus(userId, status, reason);
      } else {
        await storage.createUserStatus({ userId, status, reason });
      }
      
      res.json({ 
        message: `User ${userId} status set to ${status}`,
        userId,
        status,
        reason: reason || null,
      });
    } catch (error) {
      logger.error('Error setting user status:', error);
      res.status(500).json({ error: 'Failed to set user status' });
    }
  });

  /**
   * Test endpoint: Set beta access (admin only) - for testing beta scenarios
   */
  app.post("/api/test/set-beta-access", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { userId, betaTester, daysFromNow } = req.body;
      
      if (!userId || betaTester === undefined) {
        return res.status(400).json({ error: 'userId and betaTester are required' });
      }

      let betaExpiresAt: Date | undefined;
      if (betaTester && daysFromNow) {
        betaExpiresAt = new Date();
        betaExpiresAt.setDate(betaExpiresAt.getDate() + daysFromNow);
      }

      await storage.setBetaAccess(userId, betaTester, betaExpiresAt);
      
      res.json({ 
        message: `Beta access for user ${userId} set to ${betaTester}`,
        userId,
        betaTester,
        betaExpiresAt: betaExpiresAt?.toISOString() || null,
      });
    } catch (error) {
      logger.error('Error setting beta access:', error);
      res.status(500).json({ error: 'Failed to set beta access' });
    }
  });

  /**
   * Test endpoint: Create test subscription (admin only) - for testing subscription scenarios  
   */
  app.post("/api/test/create-subscription", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { userId, status = 'active', daysFromNow = 30 } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const currentPeriodStart = new Date();
      const currentPeriodEnd = new Date();
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + daysFromNow);

      const subscription = await storage.createSubscription({
        userId,
        planId: 'test-plan',
        status,
        currentPeriodStart,
        currentPeriodEnd,
      });
      
      res.json({ 
        message: `Test subscription created for user ${userId}`,
        subscription: {
          id: subscription.id,
          userId: subscription.userId,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
        }
      });
    } catch (error) {
      logger.error('Error creating test subscription:', error);
      res.status(500).json({ error: 'Failed to create test subscription' });
    }
  });

  /**
   * Test endpoint: Get all authorization test scenarios
   */
  app.get("/api/test/auth-scenarios", requireAuth, requireAdmin, async (req, res) => {
    res.json({
      scenarios: [
        {
          name: "Active user with subscription",
          description: "User with active status and valid subscription - should be allowed",
          setup: {
            userStatus: "active",
            subscription: { status: "active", days: 30 },
            betaAccess: false
          }
        },
        {
          name: "Active user with beta access",
          description: "User with active status and valid beta access - should be allowed",
          setup: {
            userStatus: "active", 
            subscription: null,
            betaAccess: { enabled: true, days: 7 }
          }
        },
        {
          name: "Active user without access",
          description: "User with active status but no subscription or beta - should be denied",
          setup: {
            userStatus: "active",
            subscription: null,
            betaAccess: false
          }
        },
        {
          name: "Banned user with subscription",
          description: "Banned user even with valid subscription - should be denied",
          setup: {
            userStatus: "banned",
            subscription: { status: "active", days: 30 },
            betaAccess: false
          }
        },
        {
          name: "Suspended user with beta access",
          description: "Suspended user even with valid beta access - should be denied",
          setup: {
            userStatus: "suspended",
            subscription: null,
            betaAccess: { enabled: true, days: 7 }
          }
        },
        {
          name: "Beta user with expired access",
          description: "User with expired beta access - should be denied",
          setup: {
            userStatus: "active",
            subscription: null,
            betaAccess: { enabled: true, days: -1 }
          }
        }
      ]
    });
  });
}