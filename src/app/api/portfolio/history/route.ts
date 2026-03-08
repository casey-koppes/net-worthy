import { NextRequest, NextResponse } from "next/server";
import {
  db,
  portfolioSnapshots,
  itemValueSnapshots,
  manualAssets,
  cryptoWallets,
  accounts,
} from "@/lib/db";
import { eq, desc, gte, and } from "drizzle-orm";
import { mockDb, useMockDb } from "@/lib/db/mock-db";
import { encryptNumber, decryptNumber } from "@/lib/encryption";

// Helper to calculate date range
function getStartDate(period: string): string | null {
  const now = new Date();
  let startDate: Date | null = null;

  switch (period) {
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "1y":
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    case "all":
    default:
      startDate = null;
  }

  return startDate ? startDate.toISOString().split("T")[0] : null;
}

// Build history from activity records for mock DB
function buildHistoryFromActivities(
  userId: string,
  startDate: string | null
): Array<{
  date: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  breakdown: Record<string, number> | null;
}> {
  // Fetch all activity-generating items
  const manualAssets = mockDb.manualAssets.findByUserId(userId);
  const cryptoWallets = mockDb.cryptoWallets.findByUserId(userId);

  // Build a map of date -> portfolio changes
  const dateMap = new Map<string, { assets: number; liabilities: number }>();

  // Process manual assets
  for (const asset of manualAssets) {
    const date = asset.createdAt.split("T")[0];
    if (startDate && date < startDate) continue;

    const current = dateMap.get(date) || { assets: 0, liabilities: 0 };
    const action = (asset.metadata as { action?: string } | null)?.action || "buy";
    const isSell = action === "sell";
    const valueChange = isSell ? -asset.value : asset.value;

    if (asset.isAsset) {
      current.assets += valueChange;
    } else {
      current.liabilities += valueChange;
    }
    dateMap.set(date, current);
  }

  // Process crypto wallets
  for (const wallet of cryptoWallets) {
    if (wallet.isHidden) continue;
    const date = wallet.createdAt.split("T")[0];
    if (startDate && date < startDate) continue;

    const action = (wallet.metadata as { action?: string } | null)?.action || "buy";
    // Transfer actions don't affect portfolio value - they're just activity logs
    if (action === "transfer") continue;

    const current = dateMap.get(date) || { assets: 0, liabilities: 0 };
    const isSell = action === "sell";
    const valueChange = isSell ? -wallet.balanceUsd : wallet.balanceUsd;

    current.assets += valueChange;
    dateMap.set(date, current);
  }

  // Sort dates and calculate cumulative values
  const sortedDates = Array.from(dateMap.keys()).sort();

  if (sortedDates.length === 0) {
    // Return current snapshot if no dated activities
    const snapshots = mockDb.portfolioSnapshots.findByUserId(userId, startDate || undefined);
    return snapshots.map((snapshot) => ({
      date: snapshot.date,
      totalAssets: snapshot.totalAssets,
      totalLiabilities: snapshot.totalLiabilities,
      netWorth: snapshot.netWorth,
      breakdown: snapshot.breakdown,
    }));
  }

  // Build cumulative history
  const history: Array<{
    date: string;
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
    breakdown: Record<string, number> | null;
  }> = [];

  let cumulativeAssets = 0;
  let cumulativeLiabilities = 0;

  // If we have a start date, calculate initial values from items created before
  if (startDate) {
    for (const asset of manualAssets) {
      const date = asset.createdAt.split("T")[0];
      if (date < startDate) {
        const action = (asset.metadata as { action?: string } | null)?.action || "buy";
        const isSell = action === "sell";
        const valueChange = isSell ? -asset.value : asset.value;

        if (asset.isAsset) {
          cumulativeAssets += valueChange;
        } else {
          cumulativeLiabilities += valueChange;
        }
      }
    }
    for (const wallet of cryptoWallets) {
      if (wallet.isHidden) continue;
      const date = wallet.createdAt.split("T")[0];
      if (date < startDate) {
        const action = (wallet.metadata as { action?: string } | null)?.action || "buy";
        // Transfer actions don't affect portfolio value
        if (action === "transfer") continue;
        const isSell = action === "sell";
        const valueChange = isSell ? -wallet.balanceUsd : wallet.balanceUsd;
        cumulativeAssets += valueChange;
      }
    }
  }

  for (const date of sortedDates) {
    const dayChanges = dateMap.get(date)!;
    cumulativeAssets += dayChanges.assets;
    cumulativeLiabilities += dayChanges.liabilities;

    history.push({
      date,
      totalAssets: cumulativeAssets,
      totalLiabilities: cumulativeLiabilities,
      netWorth: cumulativeAssets - cumulativeLiabilities,
      breakdown: null,
    });
  }

  // Add today's date if not present
  const today = new Date().toISOString().split("T")[0];
  const lastDate = sortedDates[sortedDates.length - 1];
  if (lastDate !== today) {
    history.push({
      date: today,
      totalAssets: cumulativeAssets,
      totalLiabilities: cumulativeLiabilities,
      netWorth: cumulativeAssets - cumulativeLiabilities,
      breakdown: null,
    });
  }

  return history;
}

// GET - Fetch portfolio history for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const period = searchParams.get("period") || "30d";

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const startDate = getStartDate(period);

    let history: Array<{
      date: string;
      totalAssets: number;
      totalLiabilities: number;
      netWorth: number;
      breakdown: Record<string, number> | null;
    }>;

    if (useMockDb()) {
      // Use mock database - build history from activity records
      history = buildHistoryFromActivities(userId, startDate);
    } else {
      // Use real database
      const whereConditions = startDate
        ? and(
            eq(portfolioSnapshots.userId, userId),
            gte(portfolioSnapshots.date, startDate)
          )
        : eq(portfolioSnapshots.userId, userId);

      const snapshots = await db.query.portfolioSnapshots.findMany({
        where: whereConditions,
        orderBy: [desc(portfolioSnapshots.date)],
      });

      history = snapshots.map((snapshot) => ({
        date: snapshot.date,
        totalAssets: parseFloat(snapshot.totalAssets),
        totalLiabilities: parseFloat(snapshot.totalLiabilities),
        netWorth: parseFloat(snapshot.netWorth),
        breakdown: snapshot.breakdown as Record<string, number> | null,
      }));
    }

    // Calculate summary stats
    const latestSnapshot = history[0];
    const oldestSnapshot = history[history.length - 1];

    let change = 0;
    let changePercent = 0;

    if (latestSnapshot && oldestSnapshot && oldestSnapshot.netWorth !== 0) {
      change = latestSnapshot.netWorth - oldestSnapshot.netWorth;
      changePercent = (change / Math.abs(oldestSnapshot.netWorth)) * 100;
    }

    return NextResponse.json({
      history: history.reverse(), // Chronological order for charts
      stats: {
        currentNetWorth: latestSnapshot?.netWorth || 0,
        startingNetWorth: oldestSnapshot?.netWorth || 0,
        change,
        changePercent,
        periodStart: oldestSnapshot?.date || null,
        periodEnd: latestSnapshot?.date || null,
      },
    });
  } catch (error) {
    console.error("Failed to fetch portfolio history:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio history" },
      { status: 500 }
    );
  }
}

// POST - Create a portfolio snapshot (for daily job or manual trigger)
export async function POST(request: NextRequest) {
  try {
    const { userId, totalAssets, totalLiabilities, netWorth, breakdown } =
      await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split("T")[0];

    if (useMockDb()) {
      // Use mock database
      const existingSnapshot = mockDb.portfolioSnapshots.findByUserIdAndDate(userId, today);

      if (existingSnapshot) {
        mockDb.portfolioSnapshots.update(existingSnapshot.id, {
          totalAssets,
          totalLiabilities,
          netWorth,
          breakdown,
        });
        return NextResponse.json({ success: true, updated: true });
      }

      mockDb.portfolioSnapshots.create({
        userId,
        date: today,
        totalAssets,
        totalLiabilities,
        netWorth,
        breakdown,
      });

      return NextResponse.json({ success: true, created: true });
    }

    // Use real database
    const existingSnapshot = await db.query.portfolioSnapshots.findFirst({
      where: and(
        eq(portfolioSnapshots.userId, userId),
        eq(portfolioSnapshots.date, today)
      ),
    });

    if (existingSnapshot) {
      // Update existing snapshot
      await db
        .update(portfolioSnapshots)
        .set({
          totalAssets: totalAssets.toString(),
          totalLiabilities: totalLiabilities.toString(),
          netWorth: netWorth.toString(),
          breakdown,
        })
        .where(eq(portfolioSnapshots.id, existingSnapshot.id));
    } else {
      // Create new snapshot
      await db.insert(portfolioSnapshots).values({
        userId,
        date: today,
        totalAssets: totalAssets.toString(),
        totalLiabilities: totalLiabilities.toString(),
        netWorth: netWorth.toString(),
        breakdown,
      });
    }

    // Save item-level snapshots
    await saveItemSnapshots(userId, today);

    return NextResponse.json({
      success: true,
      updated: !!existingSnapshot,
      created: !existingSnapshot,
    });
  } catch (error) {
    console.error("Failed to create portfolio snapshot:", error);
    return NextResponse.json(
      { error: "Failed to create snapshot" },
      { status: 500 }
    );
  }
}

// Save individual item snapshots for performance tracking
async function saveItemSnapshots(userId: string, date: string) {
  try {
    // Fetch all portfolio items
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

    // Delete existing item snapshots for today (upsert approach)
    await db
      .delete(itemValueSnapshots)
      .where(
        and(
          eq(itemValueSnapshots.userId, userId),
          eq(itemValueSnapshots.date, date)
        )
      );

    const itemSnapshots: Array<{
      userId: string;
      date: string;
      itemId: string;
      itemType: string;
      category: string;
      name: string;
      valueEncrypted: string;
      isAsset: boolean;
      metadata: Record<string, unknown> | null;
    }> = [];

    // Process manual assets
    for (const asset of dbManualAssets) {
      const value = decryptNumber(asset.valueEncrypted, userId);
      itemSnapshots.push({
        userId,
        date,
        itemId: asset.id,
        itemType: "manual_asset",
        category: asset.category,
        name: asset.name,
        valueEncrypted: encryptNumber(value, userId),
        isAsset: asset.isAsset,
        metadata: asset.metadata as Record<string, unknown> | null,
      });
    }

    // Process crypto wallets
    for (const wallet of dbCryptoWallets) {
      const balanceUsd = wallet.balanceUsdEncrypted
        ? decryptNumber(wallet.balanceUsdEncrypted, userId)
        : 0;
      const balance = wallet.balanceEncrypted
        ? decryptNumber(wallet.balanceEncrypted, userId)
        : 0;

      itemSnapshots.push({
        userId,
        date,
        itemId: wallet.id,
        itemType: "crypto_wallet",
        category: "crypto",
        name: `${wallet.chain} - ${wallet.label || wallet.address.slice(0, 8)}`,
        valueEncrypted: encryptNumber(balanceUsd, userId),
        isAsset: true,
        metadata: {
          chain: wallet.chain,
          address: wallet.address,
          balance,
          balanceUsd,
        },
      });
    }

    // Process Plaid accounts
    for (const account of dbAccounts) {
      const balance = decryptNumber(account.balanceEncrypted, userId);
      itemSnapshots.push({
        userId,
        date,
        itemId: account.id,
        itemType: "plaid_account",
        category: account.category,
        name: account.name,
        valueEncrypted: encryptNumber(balance, userId),
        isAsset: account.isAsset,
        metadata: {
          type: account.type,
          subtype: account.subtype,
        },
      });
    }

    // Insert all item snapshots
    if (itemSnapshots.length > 0) {
      await db.insert(itemValueSnapshots).values(itemSnapshots);
    }

    console.log(`Saved ${itemSnapshots.length} item snapshots for user ${userId}`);
  } catch (error) {
    console.error("Failed to save item snapshots:", error);
    // Don't throw - this is a non-critical operation
  }
}
