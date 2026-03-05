import { NextRequest, NextResponse } from "next/server";
import { db, portfolioSnapshots } from "@/lib/db";
import { eq, desc, gte, and } from "drizzle-orm";
import { mockDb, useMockDb } from "@/lib/db/mock-db";

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
      // Use mock database
      const snapshots = mockDb.portfolioSnapshots.findByUserId(userId, startDate || undefined);
      history = snapshots.map((snapshot) => ({
        date: snapshot.date,
        totalAssets: snapshot.totalAssets,
        totalLiabilities: snapshot.totalLiabilities,
        netWorth: snapshot.netWorth,
        breakdown: snapshot.breakdown,
      }));
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

      return NextResponse.json({ success: true, updated: true });
    }

    // Create new snapshot
    await db.insert(portfolioSnapshots).values({
      userId,
      date: today,
      totalAssets: totalAssets.toString(),
      totalLiabilities: totalLiabilities.toString(),
      netWorth: netWorth.toString(),
      breakdown,
    });

    return NextResponse.json({ success: true, created: true });
  } catch (error) {
    console.error("Failed to create portfolio snapshot:", error);
    return NextResponse.json(
      { error: "Failed to create snapshot" },
      { status: 500 }
    );
  }
}
