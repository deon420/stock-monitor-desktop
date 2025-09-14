import { 
  type User, 
  type UpsertUser, 
  type InsertUser, 
  type UpdateUserStripe,
  type Settings, 
  type InsertSettings, 
  type UpdateSettings,
  type UserStatus,
  type InsertUserStatus,
  type AdminUser,
  type InsertAdminUser,
  type SubscriptionPlan,
  type InsertSubscriptionPlan,
  type Subscription,
  type InsertSubscription,
  type BillingInfo,
  type InsertBillingInfo,
  type UserAccess,
  type InsertUserAccess,
  type RefreshToken,
  type InsertRefreshToken,
  users,
  settings,
  userStatus,
  adminUsers,
  subscriptionPlans,
  subscriptions,
  billingInfo,
  userAccess,
  refreshTokens
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, lt, gt, isNull, isNotNull } from "drizzle-orm";
import { encryptSensitiveData, decryptSensitiveData } from "./crypto";

// Storage interface supporting all new operations
export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createUserWithPassword(email: string, hashedPassword: string, firstName?: string, lastName?: string): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserStripeInfo(userId: string, stripeInfo: UpdateUserStripe): Promise<User>;
  setPassword(userId: string, hashedPassword: string): Promise<void>;
  
  // Settings operations
  getSettings(userId: string): Promise<Settings | undefined>;
  createSettings(settings: InsertSettings): Promise<Settings>;
  updateSettings(userId: string, settings: UpdateSettings): Promise<Settings>;
  
  // User status operations (admin features)
  getUserStatus(userId: string): Promise<UserStatus | undefined>;
  createUserStatus(userStatus: InsertUserStatus): Promise<UserStatus>;
  updateUserStatus(userId: string, status: string, reason?: string): Promise<UserStatus>;
  
  // Admin operations
  getAdminUser(userId: string): Promise<AdminUser | undefined>;
  createAdminUser(adminUser: InsertAdminUser): Promise<AdminUser>;
  isUserAdmin(userId: string): Promise<boolean>;
  
  // Subscription operations
  getSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  getUserSubscription(userId: string): Promise<Subscription | undefined>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(subscriptionId: string, updates: Partial<InsertSubscription>): Promise<Subscription>;
  
  // Billing operations
  getBillingInfo(userId: string): Promise<BillingInfo | undefined>;
  createBillingInfo(billingInfo: InsertBillingInfo): Promise<BillingInfo>;
  updateBillingInfo(userId: string, billingInfo: Partial<InsertBillingInfo>): Promise<BillingInfo>;
  
  // Beta Access Control
  getUserAccess(userId: string): Promise<UserAccess | undefined>;
  setBetaAccess(userId: string, betaTester: boolean, betaExpiresAt?: Date): Promise<UserAccess>;
  hasValidBetaAccess(userId: string): Promise<boolean>;
  
  // Refresh Token Management
  createRefreshToken(userId: string, tokenHash: string, expiresAt: Date, userAgent?: string, ipAddress?: string): Promise<RefreshToken>;
  findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | undefined>;
  revokeRefreshToken(tokenId: string): Promise<void>;
  revokeAllRefreshTokens(userId: string): Promise<void>;
  cleanupExpiredTokens(): Promise<number>;
  
  // Performance monitoring
  getStats(): Promise<{ users: number; settings: number; subscriptions: number; memoryUsage: string }>;
  
  // Optional cleanup method
  destroy?(): void;
}

export class DatabaseStorage implements IStorage {
  
  /**
   * Encrypt sensitive field if it has a value
   */
  private encryptField(value: string): string {
    if (!value || value.trim() === '') {
      return '';
    }
    try {
      return encryptSensitiveData(value);
    } catch (error) {
      console.error('Encryption failed for sensitive field:', error);
      return value; // Fallback to plain text if encryption fails
    }
  }

  /**
   * Decrypt sensitive field if it has a value
   */
  private decryptField(value: string): string {
    if (!value || value.trim() === '') {
      return '';
    }
    try {
      return decryptSensitiveData(value);
    } catch (error) {
      console.warn('Decryption failed, assuming plain text value (migration mode)');
      return value;
    }
  }

  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!username) return undefined;
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!email) return undefined;
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUserWithPassword(email: string, hashedPassword: string, firstName?: string, lastName?: string): Promise<User> {
    const userData = {
      email,
      password: hashedPassword,
      firstName,
      lastName,
    };
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async setPassword(userId: string, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserStripeInfo(userId: string, stripeInfo: UpdateUserStripe): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...stripeInfo,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Settings operations
  async getSettings(userId: string): Promise<Settings | undefined> {
    const [settingsResult] = await db.select().from(settings).where(eq(settings.userId, userId));
    
    if (settingsResult) {
      // Decrypt sensitive fields before returning
      return {
        ...settingsResult,
        gmailAppPassword: this.decryptField(settingsResult.gmailAppPassword),
        proxyPassword: this.decryptField(settingsResult.proxyPassword)
      };
    }
    
    return undefined;
  }

  async createSettings(insertSettings: InsertSettings): Promise<Settings> {
    // Encrypt sensitive fields before storing
    const encryptedSettings = {
      ...insertSettings,
      gmailAppPassword: this.encryptField(insertSettings.gmailAppPassword ?? ''),
      proxyPassword: this.encryptField(insertSettings.proxyPassword ?? '')
    };
    
    const [settingsResult] = await db.insert(settings).values(encryptedSettings).returning();
    
    // Return with decrypted fields
    return {
      ...settingsResult,
      gmailAppPassword: insertSettings.gmailAppPassword ?? '',
      proxyPassword: insertSettings.proxyPassword ?? ''
    };
  }

  async updateSettings(userId: string, updateSettings: UpdateSettings): Promise<Settings> {
    // Prepare update data with encrypted sensitive fields
    const updateData = {
      ...updateSettings,
      updatedAt: new Date(),
    };
    
    if (updateSettings.gmailAppPassword !== undefined) {
      updateData.gmailAppPassword = this.encryptField(updateSettings.gmailAppPassword);
    }
    
    if (updateSettings.proxyPassword !== undefined) {
      updateData.proxyPassword = this.encryptField(updateSettings.proxyPassword);
    }
    
    const [settingsResult] = await db
      .update(settings)
      .set(updateData)
      .where(eq(settings.userId, userId))
      .returning();
    
    if (!settingsResult) {
      // Create new settings if none exist
      const newSettings: InsertSettings = { userId, ...updateSettings };
      return await this.createSettings(newSettings);
    }
    
    // Return with decrypted fields
    return {
      ...settingsResult,
      gmailAppPassword: updateSettings.gmailAppPassword !== undefined ? 
        updateSettings.gmailAppPassword : this.decryptField(settingsResult.gmailAppPassword),
      proxyPassword: updateSettings.proxyPassword !== undefined ? 
        updateSettings.proxyPassword : this.decryptField(settingsResult.proxyPassword)
    };
  }

  // User status operations (admin features)
  async getUserStatus(userId: string): Promise<UserStatus | undefined> {
    const [status] = await db.select().from(userStatus).where(eq(userStatus.userId, userId));
    return status;
  }

  async createUserStatus(insertUserStatus: InsertUserStatus): Promise<UserStatus> {
    const [status] = await db.insert(userStatus).values(insertUserStatus).returning();
    return status;
  }

  async updateUserStatus(userId: string, status: string, reason?: string): Promise<UserStatus> {
    const updateData = {
      status,
      reason,
      updatedAt: new Date(),
    };
    
    const [existingStatus] = await db.select().from(userStatus).where(eq(userStatus.userId, userId));
    
    if (existingStatus) {
      const [updatedStatus] = await db
        .update(userStatus)
        .set(updateData)
        .where(eq(userStatus.userId, userId))
        .returning();
      return updatedStatus;
    } else {
      return await this.createUserStatus({ userId, status, reason });
    }
  }

  // Admin operations
  async getAdminUser(userId: string): Promise<AdminUser | undefined> {
    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.userId, userId));
    return admin;
  }

  async createAdminUser(insertAdminUser: InsertAdminUser): Promise<AdminUser> {
    const [admin] = await db.insert(adminUsers).values(insertAdminUser).returning();
    return admin;
  }

  async isUserAdmin(userId: string): Promise<boolean> {
    const admin = await this.getAdminUser(userId);
    return !!admin;
  }

  // Subscription operations
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true));
  }

  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const [newPlan] = await db.insert(subscriptionPlans).values(plan).returning();
    return newPlan;
  }

  async getUserSubscription(userId: string): Promise<Subscription | undefined> {
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    return subscription;
  }

  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const [newSubscription] = await db.insert(subscriptions).values(subscription).returning();
    return newSubscription;
  }

  async updateSubscription(subscriptionId: string, updates: Partial<InsertSubscription>): Promise<Subscription> {
    const [updatedSubscription] = await db
      .update(subscriptions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(subscriptions.id, subscriptionId))
      .returning();
    return updatedSubscription;
  }

  // Billing operations
  async getBillingInfo(userId: string): Promise<BillingInfo | undefined> {
    const [billing] = await db.select().from(billingInfo).where(eq(billingInfo.userId, userId));
    return billing;
  }

  async createBillingInfo(insertBillingInfo: InsertBillingInfo): Promise<BillingInfo> {
    const [billing] = await db.insert(billingInfo).values(insertBillingInfo).returning();
    return billing;
  }

  async updateBillingInfo(userId: string, updateBillingInfo: Partial<InsertBillingInfo>): Promise<BillingInfo> {
    const [updatedBilling] = await db
      .update(billingInfo)
      .set({ ...updateBillingInfo, updatedAt: new Date() })
      .where(eq(billingInfo.userId, userId))
      .returning();
    return updatedBilling;
  }

  // Performance monitoring
  async getStats(): Promise<{ users: number; settings: number; subscriptions: number; memoryUsage: string }> {
    const [userCount] = await db.select({ count: db.$count(users) }).from(users);
    const [settingsCount] = await db.select({ count: db.$count(settings) }).from(settings);
    const [subscriptionCount] = await db.select({ count: db.$count(subscriptions) }).from(subscriptions);
    
    const memUsage = process.memoryUsage();
    
    return {
      users: userCount?.count ?? 0,
      settings: settingsCount?.count ?? 0,
      subscriptions: subscriptionCount?.count ?? 0,
      memoryUsage: `${Math.round(memUsage.rss / 1024 / 1024)}MB RSS, ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB Heap`
    };
  }

  // Beta Access Control
  async getUserAccess(userId: string): Promise<UserAccess | undefined> {
    const [access] = await db.select().from(userAccess).where(eq(userAccess.userId, userId));
    return access;
  }

  async setBetaAccess(userId: string, betaTester: boolean, betaExpiresAt?: Date): Promise<UserAccess> {
    const updateData = {
      betaTester,
      betaExpiresAt,
      updatedAt: new Date(),
    };
    
    const [existingAccess] = await db.select().from(userAccess).where(eq(userAccess.userId, userId));
    
    if (existingAccess) {
      const [updatedAccess] = await db
        .update(userAccess)
        .set(updateData)
        .where(eq(userAccess.userId, userId))
        .returning();
      return updatedAccess;
    } else {
      const [newAccess] = await db
        .insert(userAccess)
        .values({ userId, ...updateData })
        .returning();
      return newAccess;
    }
  }

  async hasValidBetaAccess(userId: string): Promise<boolean> {
    const access = await this.getUserAccess(userId);
    if (!access || !access.betaTester) {
      return false;
    }
    
    // If no expiration date is set, access is valid
    if (!access.betaExpiresAt) {
      return true;
    }
    
    // Check if access has not expired
    return access.betaExpiresAt > new Date();
  }

  // Refresh Token Management
  async createRefreshToken(userId: string, tokenHash: string, expiresAt: Date, userAgent?: string, ipAddress?: string): Promise<RefreshToken> {
    const tokenData = {
      userId,
      tokenHash,
      expiresAt,
      userAgent,
      ipAddress,
    };
    const [token] = await db.insert(refreshTokens).values(tokenData).returning();
    return token;
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | undefined> {
    const [token] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          // Only return non-revoked tokens
          isNull(refreshTokens.revokedAt),
          // Only return non-expired tokens
          gt(refreshTokens.expiresAt, new Date())
        )
      );
    return token;
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, tokenId));
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.userId, userId),
          // Only revoke non-revoked tokens
          isNull(refreshTokens.revokedAt)
        )
      );
  }

  async cleanupExpiredTokens(): Promise<number> {
    const now = new Date();
    const olderThan30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const result = await db
      .delete(refreshTokens)
      .where(
        or(
          // Delete tokens that are expired
          lt(refreshTokens.expiresAt, now),
          // Or revoked tokens older than 30 days
          and(
            isNotNull(refreshTokens.revokedAt),
            lt(refreshTokens.revokedAt, olderThan30Days)
          )
        )
      );
    
    return result.rowCount ?? 0;
  }

  // Optional cleanup method implementation
  destroy(): void {
    // No specific cleanup needed for database storage
    // This method exists to satisfy the optional interface requirement
    console.log('[DatabaseStorage] Cleanup completed');
  }
}

export const storage = new DatabaseStorage();