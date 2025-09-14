import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, index, uniqueIndex, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table - updated to support Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Legacy auth fields (kept for migration compatibility)
  username: text("username").unique(),
  password: text("password"),
  
  // Replit Auth fields
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  
  // Stripe subscription fields
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User status for admin features (whitelist/ban)
export const userStatus = pgTable("user_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status").notNull().default("active"), // active, banned, suspended
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Admin users table
export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role").notNull().default("admin"), // admin, super_admin
  permissions: jsonb("permissions").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Subscription plans table
export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  stripePriceId: varchar("stripe_price_id").notNull(),
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }),
  features: jsonb("features").default(sql`'[]'::jsonb`),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User subscriptions table
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planId: varchar("plan_id").notNull().references(() => subscriptionPlans.id),
  stripeSubscriptionId: varchar("stripe_subscription_id").unique(),
  status: varchar("status").notNull(), // active, canceled, past_due, etc.
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  canceledAt: timestamp("canceled_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Billing info table
export const billingInfo = pgTable("billing_info", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: varchar("stripe_customer_id").unique(),
  defaultPaymentMethodId: varchar("default_payment_method_id"),
  billingEmail: varchar("billing_email"),
  billingAddress: jsonb("billing_address"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // General Settings
  amazonCheckInterval: integer("amazon_check_interval").notNull().default(20),
  walmartCheckInterval: integer("walmart_check_interval").notNull().default(10),
  enableRandomization: boolean("enable_randomization").notNull().default(true),
  
  // Audio Settings
  enableAudio: boolean("enable_audio").notNull().default(true),
  audioNotificationSound: text("audio_notification_sound").notNull().default("notification"),
  audioVolume: integer("audio_volume").notNull().default(80),
  
  // Email Settings
  enableEmail: boolean("enable_email").notNull().default(false),
  gmailEmail: text("gmail_email").notNull().default(""),
  gmailAppPassword: text("gmail_app_password").notNull().default(""),
  
  // Application Behavior Settings  
  enableTaskTray: boolean("enable_task_tray").notNull().default(false),
  
  // Proxy Settings
  enableProxy: boolean("enable_proxy").notNull().default(false),
  proxyUrl: text("proxy_url").notNull().default(""),
  proxyUsername: text("proxy_username").notNull().default(""),
  proxyPassword: text("proxy_password").notNull().default(""),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User access table for beta testing
export const userAccess = pgTable("user_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  betaTester: boolean("beta_tester").notNull().default(false),
  betaExpiresAt: timestamp("beta_expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("user_access_user_id_unique").on(table.userId),
]);

// Refresh tokens table for secure sessions
export const refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash").notNull(), // hashed version of token
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  revokedAt: timestamp("revoked_at"),
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address"),
}, (table) => [
  uniqueIndex("refresh_tokens_token_hash_unique").on(table.tokenHash),
  index("refresh_tokens_user_id_idx").on(table.userId),
  index("refresh_tokens_expires_at_idx").on(table.expiresAt),
]);

// Legacy user schema for backward compatibility
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Replit Auth user schemas
export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export const updateUserStripeSchema = createInsertSchema(users).pick({
  stripeCustomerId: true,
  stripeSubscriptionId: true,
});

// Settings schemas
export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSettingsSchema = createInsertSchema(settings).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

// Admin schemas
export const insertUserStatusSchema = createInsertSchema(userStatus).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Subscription schemas
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBillingInfoSchema = createInsertSchema(billingInfo).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// User access schemas
export const insertUserAccessSchema = createInsertSchema(userAccess).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Refresh tokens schemas
export const insertRefreshTokenSchema = createInsertSchema(refreshTokens).omit({
  id: true,
  createdAt: true,
});

// Type exports
export type User = typeof users.$inferSelect;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUserStripe = z.infer<typeof updateUserStripeSchema>;

export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;

export type UserStatus = typeof userStatus.$inferSelect;
export type InsertUserStatus = z.infer<typeof insertUserStatusSchema>;

export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export type BillingInfo = typeof billingInfo.$inferSelect;
export type InsertBillingInfo = z.infer<typeof insertBillingInfoSchema>;

export type UserAccess = typeof userAccess.$inferSelect;
export type InsertUserAccess = z.infer<typeof insertUserAccessSchema>;

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = z.infer<typeof insertRefreshTokenSchema>;

// Authentication request/response schemas
export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string().optional(), // Optional for header-based auth
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

// Auth response types
export const authResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    profileImageUrl: z.string().nullable(),
    isAdmin: z.boolean(),
  }),
  accessToken: z.string().optional(), // Only for non-cookie clients
  refreshToken: z.string().optional(), // Only for non-cookie clients
  authorized: z.boolean(), // Has subscription or beta access
  authorizationReason: z.string().optional(), // Reason if not authorized
});

export const userProfileSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
  isAdmin: z.boolean(),
  authorized: z.boolean(),
  authorizationReason: z.string().optional(),
  betaAccess: z.object({
    isBetaTester: z.boolean(),
    expiresAt: z.date().nullable(),
  }).optional(),
  subscription: z.object({
    status: z.string(),
    currentPeriodEnd: z.date().nullable(),
  }).optional(),
});

// Test API response interfaces
export interface AuthTestStatusResponse {
  userId: string;
  isAdmin?: boolean;
  authorization: {
    authorized: boolean;
    accessType?: string;
    reason?: string;
  };
  userRecord?: {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  } | null;
  userStatus?: {
    status: string;
    reason?: string;
    createdAt?: Date;
  } | null;
  subscription?: {
    id: string;
    status: string;
    planId: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
  } | null;
  betaAccess?: {
    betaTester: boolean;
    betaExpiresAt?: Date;
    status: string;
  } | null;
  hasValidBetaAccess: boolean;
  timestamp: string;
}

export interface ProtectedFeatureResponse {
  message: string;
  userId: string;
  accessType?: string;
  timestamp: string;
}

export interface AuthTestScenario {
  name: string;
  description: string;
  setup: {
    userStatus: string;
    subscription: { status: string; days: number } | null;
    betaAccess: { enabled: boolean; days: number } | boolean;
  };
}

export interface AuthTestScenariosResponse {
  scenarios: AuthTestScenario[];
}

// Type exports for authentication
export type SignupRequest = z.infer<typeof signupSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
