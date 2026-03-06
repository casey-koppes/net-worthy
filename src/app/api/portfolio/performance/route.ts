import { NextRequest, NextResponse } from "next/server";
import {
  db,
  manualAssets,
  cryptoWallets,
  accounts,
  itemValueSnapshots,
  portfolioSnapshots,
} from "@/lib/db";
import { eq, and, lte, desc } from "drizzle-orm";
import { mockDb, useMockDb } from "@/lib/db/mock-db";
import { calculatePerformance } from "@/lib/utils/period-utils";
import { decryptNumber } from "@/lib/encryption";

interface AssetMetadata {
  ticker?: string;
  shares?: number;
  pricePerShare?: number;
  investmentType?: string;
}

interface PerformanceItem {
  id: string;
  type: string;
  name: string;
  category: string;
  currentValue: number;
  startValue: number | null;
  changePercent: number | null;
  ticker?: string;
}

interface PerformanceResponse {
  totals: {
    currentAssets: number;
    startAssets: number | null;
    assetsChange: number | null;
    currentLiabilities: number;
    startLiabilities: number | null;
    liabilitiesChange: number | null;
    currentNetWorth: number;
    startNetWorth: number | null;
    netWorthChange: number | null;
  };
  items: PerformanceItem[];
}

/**
 * GET /api/portfolio/performance
 * Calculates performance for all assets over a specified period
 *
 * Query params:
 * - userId: User ID
 * - startDate: Start of period (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const startDate = searchParams.get("startDate");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  if (!startDate) {
    return NextResponse.json(
      { error: "startDate is required" },
      { status: 400 }
    );
  }

  try {
    if (useMockDb()) {
      return calculateMockPerformance(userId, startDate);
    }

    // Use real database
    return calculateRealPerformance(userId, startDate);
  } catch (error) {
    console.error("Performance calculation error:", error);
    return NextResponse.json(
      { error: "Failed to calculate performance" },
      { status: 500 }
    );
  }
}

async function calculateRealPerformance(userId: string, startDate: string) {
  // Fetch all current portfolio items
  const [dbManualAssets, dbCryptoWallets, dbAccounts] = await Promise.all([
    db.query.manualAssets.findMany({
      where: eq(manualAssets.userId, userId),
    }),
    db.query.cryptoWallets.findMany({
      where: eq(cryptoWallets.userId, userId),
    }),
    db.query.accounts.findMany({
      where: eq(accounts.userId, userId),
    }),
  ]);

  // Fetch historical item snapshots closest to startDate
  // We get the most recent snapshot on or before the startDate for each item
  const historicalSnapshots = await db.query.itemValueSnapshots.findMany({
    where: and(
      eq(itemValueSnapshots.userId, userId),
      lte(itemValueSnapshots.date, startDate)
    ),
    orderBy: [desc(itemValueSnapshots.date)],
  });

  // Create a map of itemId -> most recent snapshot value
  const historicalValueMap = new Map<string, number>();
  const seenItems = new Set<string>();

  for (const snapshot of historicalSnapshots) {
    if (!seenItems.has(snapshot.itemId)) {
      const value = decryptNumber(snapshot.valueEncrypted, userId);
      historicalValueMap.set(snapshot.itemId, value);
      seenItems.add(snapshot.itemId);
    }
  }

  // Also get the portfolio snapshot for total comparison
  const historicalPortfolioSnapshot = await db.query.portfolioSnapshots.findFirst({
    where: and(
      eq(portfolioSnapshots.userId, userId),
      lte(portfolioSnapshots.date, startDate)
    ),
    orderBy: [desc(portfolioSnapshots.date)],
  });

  const performanceItems: PerformanceItem[] = [];

  // Process manual assets
  for (const asset of dbManualAssets) {
    const currentValue = decryptNumber(asset.valueEncrypted, userId);
    const startValue = historicalValueMap.get(asset.id) ?? currentValue;

    const item: PerformanceItem = {
      id: asset.id,
      type: asset.isAsset ? "asset" : "liability",
      name: asset.name,
      category: asset.category,
      currentValue,
      startValue,
      changePercent: calculatePerformance(currentValue, startValue),
    };

    // Add ticker if available
    if (asset.metadata && typeof asset.metadata === "object") {
      const metadata = asset.metadata as AssetMetadata;
      if (metadata.ticker) {
        item.ticker = metadata.ticker;
      }
    }

    performanceItems.push(item);
  }

  // Process crypto wallets
  for (const wallet of dbCryptoWallets) {
    const currentValue = wallet.balanceUsdEncrypted
      ? decryptNumber(wallet.balanceUsdEncrypted, userId)
      : 0;
    const startValue = historicalValueMap.get(wallet.id) ?? currentValue;

    performanceItems.push({
      id: wallet.id,
      type: "asset",
      name: `${wallet.chain} - ${wallet.label || wallet.address.slice(0, 8)}`,
      category: "crypto",
      currentValue,
      startValue,
      changePercent: calculatePerformance(currentValue, startValue),
      ticker: wallet.chain.toUpperCase(),
    });
  }

  // Process Plaid accounts
  for (const account of dbAccounts) {
    const currentValue = decryptNumber(account.balanceEncrypted, userId);
    const startValue = historicalValueMap.get(account.id) ?? currentValue;

    performanceItems.push({
      id: account.id,
      type: account.isAsset ? "asset" : "liability",
      name: account.name,
      category: account.category,
      currentValue,
      startValue,
      changePercent: calculatePerformance(currentValue, startValue),
    });
  }

  // Calculate totals
  const assetItems = performanceItems.filter((i) => i.type === "asset");
  const liabilityItems = performanceItems.filter((i) => i.type === "liability");

  const currentAssets = assetItems.reduce((sum, i) => sum + i.currentValue, 0);
  const currentLiabilities = liabilityItems.reduce((sum, i) => sum + i.currentValue, 0);
  const currentNetWorth = currentAssets - currentLiabilities;

  // Use historical portfolio snapshot for totals if available
  let startAssets: number | null = null;
  let startLiabilities: number | null = null;
  let startNetWorth: number | null = null;

  if (historicalPortfolioSnapshot) {
    startAssets = parseFloat(historicalPortfolioSnapshot.totalAssets);
    startLiabilities = parseFloat(historicalPortfolioSnapshot.totalLiabilities);
    startNetWorth = parseFloat(historicalPortfolioSnapshot.netWorth);
  } else {
    // Calculate from item start values
    startAssets = assetItems.reduce((sum, i) => sum + (i.startValue ?? i.currentValue), 0);
    startLiabilities = liabilityItems.reduce((sum, i) => sum + (i.startValue ?? i.currentValue), 0);
    startNetWorth = startAssets - startLiabilities;
  }

  const response: PerformanceResponse = {
    totals: {
      currentAssets,
      startAssets,
      assetsChange: startAssets !== null ? calculatePerformance(currentAssets, startAssets) : null,
      currentLiabilities,
      startLiabilities,
      liabilitiesChange: startLiabilities !== null ? calculatePerformance(currentLiabilities, startLiabilities) : null,
      currentNetWorth,
      startNetWorth,
      netWorthChange: startNetWorth !== null ? calculatePerformance(currentNetWorth, startNetWorth) : null,
    },
    items: performanceItems,
  };

  return NextResponse.json(response);
}

async function calculateMockPerformance(userId: string, startDate: string) {
  // Fetch all current assets
  const mockManualAssets = mockDb.manualAssets.findByUserId(userId);
  const mockCryptoWallets = mockDb.cryptoWallets.findByUserId(userId);
  const mockPlaidAccounts = mockDb.plaidAccounts.findByUserId(userId);

  // Get historical snapshot closest to startDate
  const snapshots = mockDb.portfolioSnapshots.findByUserId(userId, startDate);
  const historicalSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  const performanceItems: PerformanceItem[] = [];

  // Process manual assets
  for (const asset of mockManualAssets) {
    const item: PerformanceItem = {
      id: asset.id,
      type: asset.isAsset ? "asset" : "liability",
      name: asset.name,
      category: asset.category,
      currentValue: asset.value,
      startValue: asset.value, // Default to current (0% change)
      changePercent: 0,
    };

    // Add ticker if available
    if (asset.metadata?.ticker) {
      const metadata = asset.metadata as AssetMetadata;
      item.ticker = metadata.ticker;
    }

    performanceItems.push(item);
  }

  // Process crypto wallets
  for (const wallet of mockCryptoWallets) {
    performanceItems.push({
      id: wallet.id,
      type: "asset",
      name: `${wallet.chain} Wallet`,
      category: "crypto",
      currentValue: wallet.balanceUsd,
      startValue: wallet.balanceUsd,
      changePercent: 0,
      ticker: wallet.chain.toUpperCase(),
    });
  }

  // Process Plaid accounts
  for (const account of mockPlaidAccounts) {
    performanceItems.push({
      id: account.id,
      type: account.isAsset ? "asset" : "liability",
      name: account.name,
      category: account.category,
      currentValue: account.balance,
      startValue: account.balance,
      changePercent: 0,
    });
  }

  // Calculate totals
  const assetItems = performanceItems.filter((i) => i.type === "asset");
  const liabilityItems = performanceItems.filter((i) => i.type === "liability");

  const currentAssets = assetItems.reduce((sum, i) => sum + i.currentValue, 0);
  const currentLiabilities = liabilityItems.reduce((sum, i) => sum + i.currentValue, 0);
  const currentNetWorth = currentAssets - currentLiabilities;

  let startAssets: number | null = null;
  let startLiabilities: number | null = null;
  let startNetWorth: number | null = null;

  if (historicalSnapshot) {
    startAssets = historicalSnapshot.totalAssets;
    startLiabilities = historicalSnapshot.totalLiabilities;
    startNetWorth = historicalSnapshot.netWorth;
  } else {
    startAssets = currentAssets;
    startLiabilities = currentLiabilities;
    startNetWorth = currentNetWorth;
  }

  const response: PerformanceResponse = {
    totals: {
      currentAssets,
      startAssets,
      assetsChange: startAssets !== null ? calculatePerformance(currentAssets, startAssets) : null,
      currentLiabilities,
      startLiabilities,
      liabilitiesChange: startLiabilities !== null ? calculatePerformance(currentLiabilities, startLiabilities) : null,
      currentNetWorth,
      startNetWorth,
      netWorthChange: startNetWorth !== null ? calculatePerformance(currentNetWorth, startNetWorth) : null,
    },
    items: performanceItems,
  };

  return NextResponse.json(response);
}
