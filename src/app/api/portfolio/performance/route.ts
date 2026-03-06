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
import {
  fetchCurrentPrice,
  fetchHistoricalPrice,
  cryptoTickerMap,
} from "@/lib/utils/yahoo-finance";

interface AssetMetadata {
  ticker?: string;
  shares?: number;
  pricePerShare?: number;
  investmentType?: string;
}

/**
 * Extract ticker and shares from description (e.g., "TWLO - 340 shares")
 */
function parseDescription(description: string | null): { ticker: string | null; shares: number } {
  if (!description) return { ticker: null, shares: 0 };

  const match = description.match(/^([A-Z]+)\s*-\s*(\d+(?:\.\d+)?)\s*shares?/i);
  if (match) {
    return { ticker: match[1].toUpperCase(), shares: parseFloat(match[2]) };
  }
  return { ticker: null, shares: 0 };
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

  // Collect all tickers that need price lookups
  const tickersToFetch: Map<string, { shares: number; assetId: string }[]> = new Map();
  const assetTickerMap = new Map<string, { ticker: string; shares: number }>();

  for (const asset of dbManualAssets) {
    let ticker: string | null = null;
    let shares = 0;

    // First check metadata
    if (asset.metadata && typeof asset.metadata === "object") {
      const metadata = asset.metadata as AssetMetadata;
      if (metadata.ticker) {
        ticker = metadata.ticker.toUpperCase();
        shares = metadata.shares ?? 0;
      }
    }

    // Fall back to parsing description (e.g., "TWLO - 340 shares")
    if (!ticker && asset.description) {
      const parsed = parseDescription(asset.description);
      ticker = parsed.ticker;
      shares = parsed.shares;
    }

    if (ticker && shares > 0) {
      assetTickerMap.set(asset.id, { ticker, shares });

      if (!tickersToFetch.has(ticker)) {
        tickersToFetch.set(ticker, []);
      }
      tickersToFetch.get(ticker)!.push({ shares, assetId: asset.id });
    }
  }

  // Fetch historical and current prices for all tickers in parallel
  const pricePromises: Promise<{
    ticker: string;
    currentPrice: number | null;
    historicalPrice: number | null;
  }>[] = [];

  for (const ticker of tickersToFetch.keys()) {
    pricePromises.push(
      Promise.all([
        fetchCurrentPrice(ticker),
        fetchHistoricalPrice(ticker, startDate),
      ]).then(([currentPrice, historicalPrice]) => ({
        ticker,
        currentPrice,
        historicalPrice,
      }))
    );
  }

  const priceResults = await Promise.all(pricePromises);
  const priceMap = new Map<string, { currentPrice: number | null; historicalPrice: number | null }>();

  for (const result of priceResults) {
    priceMap.set(result.ticker, {
      currentPrice: result.currentPrice,
      historicalPrice: result.historicalPrice,
    });
  }

  const performanceItems: PerformanceItem[] = [];

  // Process manual assets
  for (const asset of dbManualAssets) {
    const storedValue = decryptNumber(asset.valueEncrypted, userId);
    let currentValue = storedValue;
    let startValue = storedValue;
    let changePercent: number | null = 0;
    let ticker: string | undefined;

    // Check if this asset has ticker info (from metadata or description)
    const tickerInfo = assetTickerMap.get(asset.id);

    if (tickerInfo) {
      ticker = tickerInfo.ticker;
      const shares = tickerInfo.shares;
      const prices = priceMap.get(ticker);

      if (prices && shares > 0) {
        // Use live prices if available
        if (prices.currentPrice !== null) {
          currentValue = shares * prices.currentPrice;
        }

        if (prices.historicalPrice !== null) {
          startValue = shares * prices.historicalPrice;
          changePercent = calculatePerformance(currentValue, startValue);
        } else {
          // No historical price available, can't calculate performance
          startValue = currentValue;
          changePercent = null;
        }
      }
    }

    const item: PerformanceItem = {
      id: asset.id,
      type: asset.isAsset ? "asset" : "liability",
      name: asset.name,
      category: asset.category,
      currentValue,
      startValue,
      changePercent,
      ticker,
    };

    performanceItems.push(item);
  }

  // Collect unique crypto tickers to fetch
  const cryptoTickersToFetch = new Set<string>();
  for (const wallet of dbCryptoWallets) {
    const ticker = cryptoTickerMap[wallet.chain.toLowerCase()];
    if (ticker) {
      cryptoTickersToFetch.add(ticker);
    }
  }

  // Fetch crypto prices in parallel
  const cryptoPricePromises: Promise<{
    ticker: string;
    currentPrice: number | null;
    historicalPrice: number | null;
  }>[] = [];

  for (const ticker of cryptoTickersToFetch) {
    cryptoPricePromises.push(
      Promise.all([
        fetchCurrentPrice(ticker),
        fetchHistoricalPrice(ticker, startDate),
      ]).then(([currentPrice, historicalPrice]) => ({
        ticker,
        currentPrice,
        historicalPrice,
      }))
    );
  }

  const cryptoPriceResults = await Promise.all(cryptoPricePromises);
  const cryptoPriceMap = new Map<string, { currentPrice: number | null; historicalPrice: number | null }>();

  for (const result of cryptoPriceResults) {
    cryptoPriceMap.set(result.ticker, {
      currentPrice: result.currentPrice,
      historicalPrice: result.historicalPrice,
    });
  }

  // Process crypto wallets with historical prices
  for (const wallet of dbCryptoWallets) {
    const storedValue = wallet.balanceUsdEncrypted
      ? decryptNumber(wallet.balanceUsdEncrypted, userId)
      : 0;

    let currentValue = storedValue;
    let startValue = storedValue;
    let changePercent: number | null = 0;

    const ticker = cryptoTickerMap[wallet.chain.toLowerCase()];
    if (ticker) {
      const prices = cryptoPriceMap.get(ticker);

      if (prices && storedValue > 0) {
        // Calculate the coin balance from stored USD value and current price
        // This is an approximation since we store USD value, not coin count
        if (prices.currentPrice && prices.historicalPrice) {
          // Use price ratio to calculate historical value
          const priceRatio = prices.historicalPrice / prices.currentPrice;
          startValue = storedValue * priceRatio;
          changePercent = calculatePerformance(currentValue, startValue);
        }
      }
    }

    performanceItems.push({
      id: wallet.id,
      type: "asset",
      name: `${wallet.chain} - ${wallet.label || wallet.address.slice(0, 8)}`,
      category: "crypto",
      currentValue,
      startValue,
      changePercent,
      ticker: wallet.chain.toUpperCase(),
    });
  }

  // Process Plaid accounts (bank accounts don't have market-based performance)
  for (const account of dbAccounts) {
    const currentValue = decryptNumber(account.balanceEncrypted, userId);

    performanceItems.push({
      id: account.id,
      type: account.isAsset ? "asset" : "liability",
      name: account.name,
      category: account.category,
      currentValue,
      startValue: currentValue,
      changePercent: 0, // Bank accounts don't have market performance
    });
  }

  // Calculate totals from actual item values (which now include live stock prices)
  const assetItems = performanceItems.filter((i) => i.type === "asset");
  const liabilityItems = performanceItems.filter((i) => i.type === "liability");

  const currentAssets = assetItems.reduce((sum, i) => sum + i.currentValue, 0);
  const currentLiabilities = liabilityItems.reduce((sum, i) => sum + i.currentValue, 0);
  const currentNetWorth = currentAssets - currentLiabilities;

  // Calculate start values from item start values (which now include historical stock prices)
  const startAssets = assetItems.reduce((sum, i) => sum + (i.startValue ?? i.currentValue), 0);
  const startLiabilities = liabilityItems.reduce((sum, i) => sum + (i.startValue ?? i.currentValue), 0);
  const startNetWorth = startAssets - startLiabilities;

  const response: PerformanceResponse = {
    totals: {
      currentAssets,
      startAssets,
      assetsChange: calculatePerformance(currentAssets, startAssets),
      currentLiabilities,
      startLiabilities,
      liabilitiesChange: calculatePerformance(currentLiabilities, startLiabilities),
      currentNetWorth,
      startNetWorth,
      netWorthChange: calculatePerformance(currentNetWorth, startNetWorth),
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

  const performanceItems: PerformanceItem[] = [];

  // Collect all tickers that need price lookups
  // Check both metadata and description for ticker/shares info
  const tickersToFetch: Map<string, { shares: number; assetId: string }[]> = new Map();
  const assetTickerMap = new Map<string, { ticker: string; shares: number }>();

  for (const asset of mockManualAssets) {
    let ticker: string | null = null;
    let shares = 0;

    // First check metadata
    if (asset.metadata?.ticker) {
      const metadata = asset.metadata as AssetMetadata;
      ticker = metadata.ticker!.toUpperCase();
      shares = metadata.shares ?? 0;
    }

    // Fall back to parsing description (e.g., "TWLO - 340 shares")
    if (!ticker && asset.description) {
      const parsed = parseDescription(asset.description);
      ticker = parsed.ticker;
      shares = parsed.shares;
    }

    if (ticker && shares > 0) {
      assetTickerMap.set(asset.id, { ticker, shares });

      if (!tickersToFetch.has(ticker)) {
        tickersToFetch.set(ticker, []);
      }
      tickersToFetch.get(ticker)!.push({ shares, assetId: asset.id });
    }
  }

  // Fetch historical and current prices for all tickers in parallel
  const pricePromises: Promise<{
    ticker: string;
    currentPrice: number | null;
    historicalPrice: number | null;
  }>[] = [];

  for (const ticker of tickersToFetch.keys()) {
    pricePromises.push(
      Promise.all([
        fetchCurrentPrice(ticker),
        fetchHistoricalPrice(ticker, startDate),
      ]).then(([currentPrice, historicalPrice]) => ({
        ticker,
        currentPrice,
        historicalPrice,
      }))
    );
  }

  const priceResults = await Promise.all(pricePromises);
  const priceMap = new Map<string, { currentPrice: number | null; historicalPrice: number | null }>();

  for (const result of priceResults) {
    priceMap.set(result.ticker, {
      currentPrice: result.currentPrice,
      historicalPrice: result.historicalPrice,
    });
  }

  // Process manual assets
  for (const asset of mockManualAssets) {
    let currentValue = asset.value;
    let startValue = asset.value;
    let changePercent: number | null = 0;
    let ticker: string | undefined;

    // Check if this asset has ticker info (from metadata or description)
    const tickerInfo = assetTickerMap.get(asset.id);

    if (tickerInfo) {
      ticker = tickerInfo.ticker;
      const shares = tickerInfo.shares;
      const prices = priceMap.get(ticker);

      if (prices && shares > 0) {
        // Use live prices if available
        if (prices.currentPrice !== null) {
          currentValue = shares * prices.currentPrice;
        }

        if (prices.historicalPrice !== null) {
          startValue = shares * prices.historicalPrice;
          changePercent = calculatePerformance(currentValue, startValue);
        } else {
          // No historical price available, can't calculate performance
          startValue = currentValue;
          changePercent = null;
        }
      }
    }

    const item: PerformanceItem = {
      id: asset.id,
      type: asset.isAsset ? "asset" : "liability",
      name: asset.name,
      category: asset.category,
      currentValue,
      startValue,
      changePercent,
      ticker,
    };

    performanceItems.push(item);
  }

  // Collect unique crypto tickers to fetch
  const cryptoTickersToFetch = new Set<string>();
  for (const wallet of mockCryptoWallets) {
    const ticker = cryptoTickerMap[wallet.chain.toLowerCase()];
    if (ticker) {
      cryptoTickersToFetch.add(ticker);
    }
  }

  // Fetch crypto prices in parallel
  const cryptoPricePromises: Promise<{
    ticker: string;
    currentPrice: number | null;
    historicalPrice: number | null;
  }>[] = [];

  for (const ticker of cryptoTickersToFetch) {
    cryptoPricePromises.push(
      Promise.all([
        fetchCurrentPrice(ticker),
        fetchHistoricalPrice(ticker, startDate),
      ]).then(([currentPrice, historicalPrice]) => ({
        ticker,
        currentPrice,
        historicalPrice,
      }))
    );
  }

  const cryptoPriceResults = await Promise.all(cryptoPricePromises);
  const cryptoPriceMap = new Map<string, { currentPrice: number | null; historicalPrice: number | null }>();

  for (const result of cryptoPriceResults) {
    cryptoPriceMap.set(result.ticker, {
      currentPrice: result.currentPrice,
      historicalPrice: result.historicalPrice,
    });
  }

  // Process crypto wallets with historical prices
  for (const wallet of mockCryptoWallets) {
    const storedValue = wallet.balanceUsd;
    let currentValue = storedValue;
    let startValue = storedValue;
    let changePercent: number | null = 0;

    const ticker = cryptoTickerMap[wallet.chain.toLowerCase()];
    if (ticker) {
      const prices = cryptoPriceMap.get(ticker);

      if (prices && storedValue > 0) {
        if (prices.currentPrice && prices.historicalPrice) {
          const priceRatio = prices.historicalPrice / prices.currentPrice;
          startValue = storedValue * priceRatio;
          changePercent = calculatePerformance(currentValue, startValue);
        }
      }
    }

    performanceItems.push({
      id: wallet.id,
      type: "asset",
      name: `${wallet.chain} Wallet`,
      category: "crypto",
      currentValue,
      startValue,
      changePercent,
      ticker: wallet.chain.toUpperCase(),
    });
  }

  // Process Plaid accounts (bank accounts don't have market-based performance)
  for (const account of mockPlaidAccounts) {
    performanceItems.push({
      id: account.id,
      type: account.isAsset ? "asset" : "liability",
      name: account.name,
      category: account.category,
      currentValue: account.balance,
      startValue: account.balance,
      changePercent: 0, // Bank accounts don't have market performance
    });
  }

  // Calculate totals from actual item values
  const assetItems = performanceItems.filter((i) => i.type === "asset");
  const liabilityItems = performanceItems.filter((i) => i.type === "liability");

  const currentAssets = assetItems.reduce((sum, i) => sum + i.currentValue, 0);
  const currentLiabilities = liabilityItems.reduce((sum, i) => sum + i.currentValue, 0);
  const currentNetWorth = currentAssets - currentLiabilities;

  // Calculate start values from item start values (which now include historical stock prices)
  const startAssets = assetItems.reduce((sum, i) => sum + (i.startValue ?? i.currentValue), 0);
  const startLiabilities = liabilityItems.reduce((sum, i) => sum + (i.startValue ?? i.currentValue), 0);
  const startNetWorth = startAssets - startLiabilities;

  const response: PerformanceResponse = {
    totals: {
      currentAssets,
      startAssets,
      assetsChange: calculatePerformance(currentAssets, startAssets),
      currentLiabilities,
      startLiabilities,
      liabilitiesChange: calculatePerformance(currentLiabilities, startLiabilities),
      currentNetWorth,
      startNetWorth,
      netWorthChange: calculatePerformance(currentNetWorth, startNetWorth),
    },
    items: performanceItems,
  };

  return NextResponse.json(response);
}
