import { NextRequest, NextResponse } from "next/server";
import { mockDb, useMockDb } from "@/lib/db/mock-db";
import { calculatePerformance } from "@/lib/utils/period-utils";

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
    if (!useMockDb()) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    // Fetch all current assets
    const manualAssets = mockDb.manualAssets.findByUserId(userId);
    const cryptoWallets = mockDb.cryptoWallets.findByUserId(userId);
    const plaidAccounts = mockDb.plaidAccounts.findByUserId(userId);

    // Get historical snapshot closest to startDate
    const snapshots = mockDb.portfolioSnapshots.findByUserId(userId, startDate);
    const historicalSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

    const performanceItems: PerformanceItem[] = [];

    // Process manual assets
    for (const asset of manualAssets) {
      const item: PerformanceItem = {
        id: asset.id,
        type: asset.isAsset ? "asset" : "liability",
        name: asset.name,
        category: asset.category,
        currentValue: asset.value,
        startValue: null,
        changePercent: null,
      };

      // For investments with tickers, try to fetch historical price
      if (
        asset.category === "investment" &&
        asset.metadata?.ticker &&
        asset.metadata?.shares
      ) {
        const metadata = asset.metadata as AssetMetadata;
        item.ticker = metadata.ticker;

        try {
          const historicalResponse = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/stocks/historical?ticker=${encodeURIComponent(metadata.ticker!)}&date=${startDate}`
          );

          if (historicalResponse.ok) {
            const historicalData = await historicalResponse.json();
            if (historicalData.price && metadata.shares) {
              const startValue = historicalData.price * metadata.shares;
              item.startValue = startValue;
              item.changePercent = calculatePerformance(asset.value, startValue);
            }
          }
        } catch {
          // Historical price fetch failed, use snapshot if available
        }
      }

      // If no historical data from stock API, use snapshot data
      if (item.startValue === null && historicalSnapshot) {
        // Use a proportional estimate based on category breakdown
        item.startValue = asset.value; // Default to current (0% change)
        item.changePercent = 0;
      } else if (item.startValue === null) {
        item.startValue = asset.value;
        item.changePercent = 0;
      }

      performanceItems.push(item);
    }

    // Process crypto wallets
    for (const wallet of cryptoWallets) {
      const item: PerformanceItem = {
        id: wallet.id,
        type: "asset",
        name: `${wallet.chain} Wallet`,
        category: "crypto",
        currentValue: wallet.balanceUsd,
        startValue: wallet.balanceUsd, // Default to current value
        changePercent: 0,
        ticker: wallet.chain.toUpperCase(),
      };

      // TODO: Fetch historical crypto prices for accurate performance
      // For now, use current value (0% change)

      performanceItems.push(item);
    }

    // Process Plaid accounts
    for (const account of plaidAccounts) {
      const item: PerformanceItem = {
        id: account.id,
        type: account.isAsset ? "asset" : "liability",
        name: account.name,
        category: account.category,
        currentValue: account.balance,
        startValue: account.balance, // Bank accounts typically don't have price fluctuation
        changePercent: 0,
      };

      performanceItems.push(item);
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

    // Use historical snapshot for totals if available
    if (historicalSnapshot) {
      startAssets = historicalSnapshot.totalAssets;
      startLiabilities = historicalSnapshot.totalLiabilities;
      startNetWorth = historicalSnapshot.netWorth;
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
  } catch (error) {
    console.error("Performance calculation error:", error);
    return NextResponse.json(
      { error: "Failed to calculate performance" },
      { status: 500 }
    );
  }
}
