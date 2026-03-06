import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  decimal,
  date,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const visibilityEnum = pgEnum("visibility", [
  "private",
  "friends",
  "public",
]);

export const accountTypeEnum = pgEnum("account_type", [
  "personal",
  "business",
]);

export const assetCategoryEnum = pgEnum("asset_category", [
  "bank",
  "investment",
  "crypto",
  "real_estate",
  "vehicle",
  "other",
]);

export const connectionStatusEnum = pgEnum("connection_status", [
  "active",
  "error",
  "pending_reauth",
]);

// Users table - supports both email/password and Nostr authentication
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Email/password auth (optional)
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  emailVerified: boolean("email_verified").default(false),
  // Nostr auth (optional)
  nostrPubkey: text("nostr_pubkey").unique(),
  nip05Identifier: text("nip05_identifier"),
  // Profile
  displayName: text("display_name"),
  profileImage: text("profile_image"),
  accountType: accountTypeEnum("account_type").default("personal").notNull(),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Plaid connections
export const plaidConnections = pgTable("plaid_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  itemId: text("item_id").notNull(),
  institutionId: text("institution_id"),
  institutionName: text("institution_name"),
  status: connectionStatusEnum("status").default("active").notNull(),
  lastSynced: timestamp("last_synced"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Financial accounts (from Plaid or manual entry)
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  connectionId: uuid("connection_id").references(() => plaidConnections.id, {
    onDelete: "set null",
  }),
  plaidAccountId: text("plaid_account_id"),
  type: text("type").notNull(), // checking, savings, investment, credit, loan, etc.
  subtype: text("subtype"),
  name: text("name").notNull(),
  officialName: text("official_name"),
  mask: text("mask"), // last 4 digits
  balanceEncrypted: text("balance_encrypted").notNull(),
  availableBalanceEncrypted: text("available_balance_encrypted"),
  limitEncrypted: text("limit_encrypted"), // for credit cards
  currency: text("currency").default("USD").notNull(),
  category: assetCategoryEnum("category").default("bank").notNull(),
  isAsset: boolean("is_asset").default(true).notNull(), // false for liabilities
  isManual: boolean("is_manual").default(false).notNull(),
  isHidden: boolean("is_hidden").default(false).notNull(),
  visibility: visibilityEnum("visibility").default("private").notNull(),
  lastSynced: timestamp("last_synced"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Crypto wallets
export const cryptoWallets = pgTable("crypto_wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  chain: text("chain").notNull(), // bitcoin, ethereum, solana, etc.
  address: text("address").notNull(),
  label: text("label"),
  balanceEncrypted: text("balance_encrypted"),
  balanceUsdEncrypted: text("balance_usd_encrypted"),
  tokensEncrypted: jsonb("tokens_encrypted"), // for EVM chains with multiple tokens
  isHidden: boolean("is_hidden").default(false).notNull(),
  visibility: visibilityEnum("visibility").default("private").notNull(),
  lastSynced: timestamp("last_synced"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Manual assets (real estate, vehicles, collectibles, etc.)
export const manualAssets = pgTable("manual_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  category: assetCategoryEnum("category").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  valueEncrypted: text("value_encrypted").notNull(),
  purchasePriceEncrypted: text("purchase_price_encrypted"),
  purchaseDate: date("purchase_date"),
  isAsset: boolean("is_asset").default(true).notNull(), // false for liabilities
  isHidden: boolean("is_hidden").default(false).notNull(),
  visibility: visibilityEnum("visibility").default("private").notNull(),
  metadata: jsonb("metadata"), // flexible storage for category-specific data
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Portfolio snapshots for historical tracking
export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  date: date("date").notNull(),
  totalAssets: decimal("total_assets", { precision: 18, scale: 2 }).notNull(),
  totalLiabilities: decimal("total_liabilities", {
    precision: 18,
    scale: 2,
  }).notNull(),
  netWorth: decimal("net_worth", { precision: 18, scale: 2 }).notNull(),
  breakdown: jsonb("breakdown"), // detailed breakdown by category
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Item-level value snapshots for performance tracking
export const itemValueSnapshots = pgTable("item_value_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  date: date("date").notNull(),
  itemId: uuid("item_id").notNull(), // ID of the asset/liability
  itemType: text("item_type").notNull(), // 'manual_asset', 'crypto_wallet', 'plaid_account'
  category: text("category").notNull(), // bank, investment, crypto, etc.
  name: text("name").notNull(),
  valueEncrypted: text("value_encrypted").notNull(), // encrypted value at snapshot time
  isAsset: boolean("is_asset").default(true).notNull(),
  metadata: jsonb("metadata"), // ticker, shares, chain, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Privacy settings
export const privacySettings = pgTable("privacy_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  defaultVisibility: visibilityEnum("default_visibility")
    .default("private")
    .notNull(),
  shareExactAmounts: boolean("share_exact_amounts").default(false).notNull(),
  shareBreakdown: boolean("share_breakdown").default(false).notNull(),
  displayFormat: text("display_format").default("hidden").notNull(), // exact, rounded, range, hidden
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Activity log
export const activityLog = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  action: text("action").notNull(), // account_added, account_removed, balance_changed, etc.
  entityType: text("entity_type"), // account, wallet, manual_asset
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Friends/follows
export const follows = pgTable("follows", {
  id: uuid("id").primaryKey().defaultRandom(),
  followerId: uuid("follower_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  followingId: uuid("following_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Sessions for email/password auth
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  token: text("token").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// API keys for business accounts
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  keyHash: text("key_hash").unique().notNull(), // hashed API key
  name: text("name").notNull(),
  lastUsed: timestamp("last_used"),
  isActive: boolean("is_active").default(true).notNull(),
  rateLimit: decimal("rate_limit").default("60"), // requests per minute
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  plaidConnections: many(plaidConnections),
  accounts: many(accounts),
  cryptoWallets: many(cryptoWallets),
  manualAssets: many(manualAssets),
  portfolioSnapshots: many(portfolioSnapshots),
  itemValueSnapshots: many(itemValueSnapshots),
  privacySettings: one(privacySettings),
  activityLog: many(activityLog),
  followers: many(follows, { relationName: "following" }),
  following: many(follows, { relationName: "follower" }),
  apiKeys: many(apiKeys),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const plaidConnectionsRelations = relations(
  plaidConnections,
  ({ one, many }) => ({
    user: one(users, {
      fields: [plaidConnections.userId],
      references: [users.id],
    }),
    accounts: many(accounts),
  })
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
  connection: one(plaidConnections, {
    fields: [accounts.connectionId],
    references: [plaidConnections.id],
  }),
}));

export const cryptoWalletsRelations = relations(cryptoWallets, ({ one }) => ({
  user: one(users, {
    fields: [cryptoWallets.userId],
    references: [users.id],
  }),
}));

export const manualAssetsRelations = relations(manualAssets, ({ one }) => ({
  user: one(users, {
    fields: [manualAssets.userId],
    references: [users.id],
  }),
}));

export const portfolioSnapshotsRelations = relations(
  portfolioSnapshots,
  ({ one }) => ({
    user: one(users, {
      fields: [portfolioSnapshots.userId],
      references: [users.id],
    }),
  })
);

export const itemValueSnapshotsRelations = relations(
  itemValueSnapshots,
  ({ one }) => ({
    user: one(users, {
      fields: [itemValueSnapshots.userId],
      references: [users.id],
    }),
  })
);

export const privacySettingsRelations = relations(
  privacySettings,
  ({ one }) => ({
    user: one(users, {
      fields: [privacySettings.userId],
      references: [users.id],
    }),
  })
);

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  user: one(users, {
    fields: [activityLog.userId],
    references: [users.id],
  }),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
    relationName: "follower",
  }),
  following: one(users, {
    fields: [follows.followingId],
    references: [users.id],
    relationName: "following",
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));
