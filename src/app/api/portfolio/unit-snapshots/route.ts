import { NextRequest, NextResponse } from "next/server";
import { mockDb, useMockDb } from "@/lib/db/mock-db";

// GET - Fetch unit snapshots for a user (optionally filtered by assetId)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const assetId = searchParams.get("assetId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    if (useMockDb()) {
      if (assetId) {
        const snapshots = mockDb.unitSnapshots.findByAssetId(userId, assetId);
        return NextResponse.json({ snapshots });
      }

      const snapshots = mockDb.unitSnapshots.findByUserId(userId);
      const assets = mockDb.unitSnapshots.getDistinctAssets(userId);
      return NextResponse.json({ snapshots, assets });
    }

    // Real database implementation would go here
    return NextResponse.json({ snapshots: [], assets: [] });
  } catch (error) {
    console.error("Failed to fetch unit snapshots:", error);
    return NextResponse.json(
      { error: "Failed to fetch unit snapshots" },
      { status: 500 }
    );
  }
}

// POST - Create or update a unit snapshot
export async function POST(request: NextRequest) {
  try {
    const { userId, assetId, assetType, assetName, assetSymbol, units } =
      await request.json();

    if (!userId || !assetId || !assetType || !assetName || !assetSymbol || units === undefined) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split("T")[0];

    if (useMockDb()) {
      // Check if snapshot exists for today
      const existing = mockDb.unitSnapshots.findByUserIdAndDate(userId, assetId, today);

      if (existing) {
        // Update existing snapshot
        const updated = mockDb.unitSnapshots.update(existing.id, { units });
        return NextResponse.json({ success: true, snapshot: updated });
      }

      // Create new snapshot
      const snapshot = mockDb.unitSnapshots.create({
        userId,
        assetId,
        assetType,
        assetName,
        assetSymbol,
        date: today,
        units,
      });

      return NextResponse.json({ success: true, snapshot });
    }

    // Real database implementation would go here
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save unit snapshot:", error);
    return NextResponse.json(
      { error: "Failed to save unit snapshot" },
      { status: 500 }
    );
  }
}
