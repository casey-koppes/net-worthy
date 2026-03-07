// Mock database for local development without a real database
// Uses in-memory storage for serverless compatibility (Vercel)
// Data is seeded fresh for demo users on each login

import bcrypt from "bcryptjs";
import crypto from "crypto";

// Check if running in serverless environment (no filesystem access)
const IS_SERVERLESS = process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME;

interface MockUser {
  id: string;
  email: string | null;
  passwordHash: string | null;
  emailVerified: boolean;
  nostrPubkey: string | null;
  nip05Identifier: string | null;
  displayName: string | null;
  profileImage: string | null;
  accountType: "personal" | "business";
  createdAt: string;
  updatedAt: string;
}

interface MockSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

interface MockPrivacySettings {
  id: string;
  userId: string;
  defaultVisibility: "private" | "friends" | "public";
  shareExactAmounts: boolean;
  shareBreakdown: boolean;
  displayFormat: string;
}

interface MockManualAsset {
  id: string;
  userId: string;
  category: string;
  name: string;
  description: string | null;
  value: number;
  purchasePrice: number | null;
  purchaseDate: string | null;
  isAsset: boolean;
  isHidden: boolean;
  visibility: "private" | "friends" | "public";
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface MockCryptoWallet {
  id: string;
  userId: string;
  chain: string;
  address: string;
  label: string | null;
  balance: number;
  balanceUsd: number;
  isHidden: boolean;
  visibility: "private" | "friends" | "public";
  lastSynced: string;
  createdAt: string;
  updatedAt: string;
}

interface MockPortfolioSnapshot {
  id: string;
  userId: string;
  date: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  breakdown: Record<string, number> | null;
  createdAt: string;
}

interface MockActivityLog {
  id: string;
  userId: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface MockUnitSnapshot {
  id: string;
  userId: string;
  assetId: string;
  assetType: "crypto" | "investment";
  assetName: string;
  assetSymbol: string;
  date: string;
  units: number;
  createdAt: string;
}

interface MockPlaidConnection {
  id: string;
  userId: string;
  itemId: string;
  institutionId: string | null;
  institutionName: string;
  institutionLogo: string | null;
  status: string;
  lastSynced: string;
  createdAt: string;
}

interface MockPlaidAccount {
  id: string;
  userId: string;
  connectionId: string;
  plaidAccountId: string;
  type: string;
  subtype: string | null;
  name: string;
  officialName: string | null;
  mask: string | null;
  balance: number;
  availableBalance: number | null;
  limit: number | null;
  currency: string;
  category: string;
  isAsset: boolean;
  isHidden: boolean;
  visibility: string;
  lastSynced: string;
  createdAt: string;
}

interface DbData {
  users: Record<string, MockUser>;
  sessions: Record<string, MockSession>;
  privacySettings: Record<string, MockPrivacySettings>;
  manualAssets: Record<string, MockManualAsset>;
  cryptoWallets: Record<string, MockCryptoWallet>;
  portfolioSnapshots: Record<string, MockPortfolioSnapshot>;
  activityLog: Record<string, MockActivityLog>;
  unitSnapshots: Record<string, MockUnitSnapshot>;
  plaidConnections: Record<string, MockPlaidConnection>;
  plaidAccounts: Record<string, MockPlaidAccount>;
}

// In-memory data store for serverless environments
let inMemoryData: DbData = {
  users: {},
  sessions: {},
  privacySettings: {},
  manualAssets: {},
  cryptoWallets: {},
  portfolioSnapshots: {},
  activityLog: {},
  unitSnapshots: {},
  plaidConnections: {},
  plaidAccounts: {},
};

// Load data from file (local dev only)
function loadData(): DbData {
  if (IS_SERVERLESS) {
    return inMemoryData;
  }

  try {
    // Dynamic import for fs and path only in non-serverless environments
    const fs = require("fs");
    const path = require("path");
    const DB_FILE = path.join(process.cwd(), ".mock-db.json");

    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (error) {
    console.error("Failed to load mock DB:", error);
  }
  return { users: {}, sessions: {}, privacySettings: {}, manualAssets: {}, cryptoWallets: {}, portfolioSnapshots: {}, activityLog: {}, unitSnapshots: {}, plaidConnections: {}, plaidAccounts: {} };
}

// Save data to file (local dev only) or update in-memory store (serverless)
function saveData(data: DbData): void {
  if (IS_SERVERLESS) {
    inMemoryData = data;
    return;
  }

  try {
    const fs = require("fs");
    const path = require("path");
    const DB_FILE = path.join(process.cwd(), ".mock-db.json");
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Failed to save mock DB:", error);
  }
}

// Get current data
function getData(): DbData {
  if (IS_SERVERLESS) {
    return inMemoryData;
  }
  return loadData();
}

function persist(data: DbData): void {
  saveData(data);
}

// Generate UUID
function generateId(): string {
  return crypto.randomUUID();
}

// Mock DB operations
export const mockDb = {
  users: {
    findByEmail: (email: string): MockUser | null => {
      const data = getData();
      for (const user of Object.values(data.users)) {
        if (user.email?.toLowerCase() === email.toLowerCase()) {
          return user;
        }
      }
      return null;
    },

    findByPubkey: (pubkey: string): MockUser | null => {
      const data = getData();
      for (const user of Object.values(data.users)) {
        if (user.nostrPubkey === pubkey) {
          return user;
        }
      }
      return null;
    },

    findById: (id: string): MockUser | null => {
      const data = getData();
      return data.users[id] || null;
    },

    create: async (input: {
      email?: string;
      password?: string;
      displayName?: string;
      nostrPubkey?: string;
      nip05?: string;
    }): Promise<MockUser> => {
      const data = getData();
      const id = generateId();
      const passwordHash = input.password
        ? await bcrypt.hash(input.password, 12)
        : null;

      const user: MockUser = {
        id,
        email: input.email?.toLowerCase() || null,
        passwordHash,
        emailVerified: false,
        nostrPubkey: input.nostrPubkey || null,
        nip05Identifier: input.nip05 || null,
        displayName: input.displayName || null,
        profileImage: null,
        accountType: "personal",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      data.users[id] = user;

      // Create default privacy settings
      const privacyId = generateId();
      data.privacySettings[id] = {
        id: privacyId,
        userId: id,
        defaultVisibility: "private",
        shareExactAmounts: false,
        shareBreakdown: false,
        displayFormat: "hidden",
      };

      persist(data);
      return user;
    },

    update: (id: string, updates: Partial<MockUser>): MockUser | null => {
      const data = getData();
      const user = data.users[id];
      if (!user) return null;

      const updated = { ...user, ...updates, updatedAt: new Date().toISOString() };
      data.users[id] = updated;
      persist(data);
      return updated;
    },

    verifyPassword: async (
      user: MockUser,
      password: string
    ): Promise<boolean> => {
      if (!user.passwordHash) return false;
      return bcrypt.compare(password, user.passwordHash);
    },
  },

  sessions: {
    create: (userId: string): MockSession => {
      const data = getData();
      const session: MockSession = {
        id: generateId(),
        userId,
        token: crypto.randomBytes(32).toString("hex"),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      };

      data.sessions[session.token] = session;
      persist(data);
      return session;
    },

    findByToken: (token: string): (MockSession & { user: MockUser }) | null => {
      const data = getData();
      const session = data.sessions[token];
      if (!session) return null;

      // Check if expired
      if (new Date(session.expiresAt) < new Date()) {
        delete data.sessions[token];
        persist(data);
        return null;
      }

      const user = data.users[session.userId];
      if (!user) return null;

      return { ...session, user };
    },

    delete: (token: string): void => {
      const data = getData();
      delete data.sessions[token];
      persist(data);
    },
  },

  manualAssets: {
    findByUserId: (userId: string): MockManualAsset[] => {
      const data = getData();
      return Object.values(data.manualAssets).filter(
        (asset) => asset.userId === userId
      );
    },

    findById: (id: string): MockManualAsset | null => {
      const data = getData();
      return data.manualAssets[id] || null;
    },

    create: (input: {
      userId: string;
      category: string;
      name: string;
      description?: string;
      value: number;
      purchasePrice?: number;
      purchaseDate?: Date;
      isAsset?: boolean;
      metadata?: Record<string, unknown> | null;
    }): MockManualAsset => {
      const data = getData();
      const id = generateId();
      const asset: MockManualAsset = {
        id,
        userId: input.userId,
        category: input.category,
        name: input.name,
        description: input.description || null,
        value: input.value,
        purchasePrice: input.purchasePrice || null,
        purchaseDate: input.purchaseDate?.toISOString() || null,
        isAsset: input.isAsset ?? true,
        isHidden: false,
        visibility: "private",
        metadata: input.metadata || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      data.manualAssets[id] = asset;
      persist(data);
      return asset;
    },

    update: (id: string, updates: Partial<MockManualAsset>): MockManualAsset | null => {
      const data = getData();
      const asset = data.manualAssets[id];
      if (!asset) return null;

      const updated = { ...asset, ...updates, updatedAt: new Date().toISOString() };
      data.manualAssets[id] = updated;
      persist(data);
      return updated;
    },

    delete: (id: string): boolean => {
      const data = getData();
      if (!data.manualAssets[id]) return false;
      delete data.manualAssets[id];
      persist(data);
      return true;
    },
  },

  cryptoWallets: {
    findByUserId: (userId: string): MockCryptoWallet[] => {
      const data = getData();
      // Ensure cryptoWallets exists
      if (!data.cryptoWallets) data.cryptoWallets = {};
      return Object.values(data.cryptoWallets).filter(
        (wallet) => wallet.userId === userId
      );
    },

    findById: (id: string): MockCryptoWallet | null => {
      const data = getData();
      if (!data.cryptoWallets) data.cryptoWallets = {};
      return data.cryptoWallets[id] || null;
    },

    create: (input: {
      userId: string;
      chain: string;
      address: string;
      label?: string;
      balance: number;
      balanceUsd: number;
    }): MockCryptoWallet => {
      const data = getData();
      if (!data.cryptoWallets) data.cryptoWallets = {};
      const id = generateId();
      const wallet: MockCryptoWallet = {
        id,
        userId: input.userId,
        chain: input.chain,
        address: input.address,
        label: input.label || null,
        balance: input.balance,
        balanceUsd: input.balanceUsd,
        isHidden: false,
        visibility: "private",
        lastSynced: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      data.cryptoWallets[id] = wallet;
      persist(data);
      return wallet;
    },

    update: (id: string, updates: Partial<MockCryptoWallet>): MockCryptoWallet | null => {
      const data = getData();
      if (!data.cryptoWallets) data.cryptoWallets = {};
      const wallet = data.cryptoWallets[id];
      if (!wallet) return null;

      const updated = { ...wallet, ...updates, updatedAt: new Date().toISOString() };
      data.cryptoWallets[id] = updated;
      persist(data);
      return updated;
    },

    delete: (id: string): boolean => {
      const data = getData();
      if (!data.cryptoWallets) data.cryptoWallets = {};
      if (!data.cryptoWallets[id]) return false;
      delete data.cryptoWallets[id];
      persist(data);
      return true;
    },
  },

  portfolioSnapshots: {
    findByUserId: (userId: string, startDate?: string): MockPortfolioSnapshot[] => {
      const data = getData();
      if (!data.portfolioSnapshots) data.portfolioSnapshots = {};
      let snapshots = Object.values(data.portfolioSnapshots).filter(
        (snapshot) => snapshot.userId === userId
      );
      if (startDate) {
        snapshots = snapshots.filter((s) => s.date >= startDate);
      }
      return snapshots.sort((a, b) => b.date.localeCompare(a.date));
    },

    findByUserIdAndDate: (userId: string, date: string): MockPortfolioSnapshot | null => {
      const data = getData();
      if (!data.portfolioSnapshots) data.portfolioSnapshots = {};
      return Object.values(data.portfolioSnapshots).find(
        (snapshot) => snapshot.userId === userId && snapshot.date === date
      ) || null;
    },

    create: (input: {
      userId: string;
      date: string;
      totalAssets: number;
      totalLiabilities: number;
      netWorth: number;
      breakdown?: Record<string, number>;
    }): MockPortfolioSnapshot => {
      const data = getData();
      if (!data.portfolioSnapshots) data.portfolioSnapshots = {};
      const id = generateId();
      const snapshot: MockPortfolioSnapshot = {
        id,
        userId: input.userId,
        date: input.date,
        totalAssets: input.totalAssets,
        totalLiabilities: input.totalLiabilities,
        netWorth: input.netWorth,
        breakdown: input.breakdown || null,
        createdAt: new Date().toISOString(),
      };

      data.portfolioSnapshots[id] = snapshot;
      persist(data);
      return snapshot;
    },

    update: (id: string, updates: Partial<MockPortfolioSnapshot>): MockPortfolioSnapshot | null => {
      const data = getData();
      if (!data.portfolioSnapshots) data.portfolioSnapshots = {};
      const snapshot = data.portfolioSnapshots[id];
      if (!snapshot) return null;

      const updated = { ...snapshot, ...updates };
      data.portfolioSnapshots[id] = updated;
      persist(data);
      return updated;
    },
  },

  activityLog: {
    findByUserId: (userId: string, limit: number = 50, offset: number = 0): MockActivityLog[] => {
      const data = getData();
      if (!data.activityLog) data.activityLog = {};
      const activities = Object.values(data.activityLog)
        .filter((activity) => activity.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return activities.slice(offset, offset + limit);
    },

    create: (input: {
      userId: string;
      action: string;
      entityType?: string;
      entityId?: string;
      metadata?: Record<string, unknown>;
    }): MockActivityLog => {
      const data = getData();
      if (!data.activityLog) data.activityLog = {};
      const id = generateId();
      const activity: MockActivityLog = {
        id,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType || null,
        entityId: input.entityId || null,
        metadata: input.metadata || null,
        createdAt: new Date().toISOString(),
      };

      data.activityLog[id] = activity;
      persist(data);
      return activity;
    },
  },

  unitSnapshots: {
    findByUserId: (userId: string): MockUnitSnapshot[] => {
      const data = getData();
      if (!data.unitSnapshots) data.unitSnapshots = {};
      return Object.values(data.unitSnapshots)
        .filter((snapshot) => snapshot.userId === userId)
        .sort((a, b) => a.date.localeCompare(b.date));
    },

    findByAssetId: (userId: string, assetId: string): MockUnitSnapshot[] => {
      const data = getData();
      if (!data.unitSnapshots) data.unitSnapshots = {};
      return Object.values(data.unitSnapshots)
        .filter((snapshot) => snapshot.userId === userId && snapshot.assetId === assetId)
        .sort((a, b) => a.date.localeCompare(b.date));
    },

    findByUserIdAndDate: (userId: string, assetId: string, date: string): MockUnitSnapshot | null => {
      const data = getData();
      if (!data.unitSnapshots) data.unitSnapshots = {};
      return Object.values(data.unitSnapshots).find(
        (snapshot) => snapshot.userId === userId && snapshot.assetId === assetId && snapshot.date === date
      ) || null;
    },

    create: (input: {
      userId: string;
      assetId: string;
      assetType: "crypto" | "investment";
      assetName: string;
      assetSymbol: string;
      date: string;
      units: number;
    }): MockUnitSnapshot => {
      const data = getData();
      if (!data.unitSnapshots) data.unitSnapshots = {};
      const id = generateId();
      const snapshot: MockUnitSnapshot = {
        id,
        userId: input.userId,
        assetId: input.assetId,
        assetType: input.assetType,
        assetName: input.assetName,
        assetSymbol: input.assetSymbol,
        date: input.date,
        units: input.units,
        createdAt: new Date().toISOString(),
      };

      data.unitSnapshots[id] = snapshot;
      persist(data);
      return snapshot;
    },

    update: (id: string, updates: Partial<MockUnitSnapshot>): MockUnitSnapshot | null => {
      const data = getData();
      if (!data.unitSnapshots) data.unitSnapshots = {};
      const snapshot = data.unitSnapshots[id];
      if (!snapshot) return null;

      const updated = { ...snapshot, ...updates };
      data.unitSnapshots[id] = updated;
      persist(data);
      return updated;
    },

    getDistinctAssets: (userId: string): { assetId: string; assetType: "crypto" | "investment"; assetName: string; assetSymbol: string }[] => {
      const data = getData();
      if (!data.unitSnapshots) data.unitSnapshots = {};
      const assets = new Map<string, { assetId: string; assetType: "crypto" | "investment"; assetName: string; assetSymbol: string }>();

      Object.values(data.unitSnapshots)
        .filter((snapshot) => snapshot.userId === userId)
        .forEach((snapshot) => {
          if (!assets.has(snapshot.assetId)) {
            assets.set(snapshot.assetId, {
              assetId: snapshot.assetId,
              assetType: snapshot.assetType,
              assetName: snapshot.assetName,
              assetSymbol: snapshot.assetSymbol,
            });
          }
        });

      return Array.from(assets.values());
    },
  },

  plaidConnections: {
    findByUserId: (userId: string): MockPlaidConnection[] => {
      const data = getData();
      if (!data.plaidConnections) data.plaidConnections = {};
      return Object.values(data.plaidConnections).filter(
        (conn) => conn.userId === userId
      );
    },

    create: (input: {
      userId: string;
      itemId: string;
      institutionId: string | null;
      institutionName: string;
      institutionLogo: string | null;
      status: string;
    }): MockPlaidConnection => {
      const data = getData();
      if (!data.plaidConnections) data.plaidConnections = {};
      const id = generateId();
      const connection: MockPlaidConnection = {
        id,
        userId: input.userId,
        itemId: input.itemId,
        institutionId: input.institutionId,
        institutionName: input.institutionName,
        institutionLogo: input.institutionLogo,
        status: input.status,
        lastSynced: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      data.plaidConnections[id] = connection;
      persist(data);
      return connection;
    },
  },

  plaidAccounts: {
    findByUserId: (userId: string): MockPlaidAccount[] => {
      const data = getData();
      if (!data.plaidAccounts) data.plaidAccounts = {};
      return Object.values(data.plaidAccounts).filter(
        (account) => account.userId === userId && !account.isHidden
      );
    },

    create: (input: {
      userId: string;
      connectionId: string;
      plaidAccountId: string;
      type: string;
      subtype: string | null;
      name: string;
      officialName: string | null;
      mask: string | null;
      balance: number;
      availableBalance: number | null;
      limit: number | null;
      currency: string;
      category: string;
      isAsset: boolean;
    }): MockPlaidAccount => {
      const data = getData();
      if (!data.plaidAccounts) data.plaidAccounts = {};
      const id = generateId();
      const account: MockPlaidAccount = {
        id,
        userId: input.userId,
        connectionId: input.connectionId,
        plaidAccountId: input.plaidAccountId,
        type: input.type,
        subtype: input.subtype,
        name: input.name,
        officialName: input.officialName,
        mask: input.mask,
        balance: input.balance,
        availableBalance: input.availableBalance,
        limit: input.limit,
        currency: input.currency,
        category: input.category,
        isAsset: input.isAsset,
        isHidden: false,
        visibility: "private",
        lastSynced: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      data.plaidAccounts[id] = account;
      persist(data);
      return account;
    },

    update: (id: string, updates: Partial<MockPlaidAccount>): MockPlaidAccount | null => {
      const data = getData();
      if (!data.plaidAccounts) data.plaidAccounts = {};
      const account = data.plaidAccounts[id];
      if (!account) return null;

      const updated = { ...account, ...updates };
      data.plaidAccounts[id] = updated;
      persist(data);
      return updated;
    },
  },
};

// Check if we should use mock DB
export function useMockDb(): boolean {
  return !process.env.DATABASE_URL;
}
