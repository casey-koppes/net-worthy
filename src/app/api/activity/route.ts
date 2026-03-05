import { NextRequest, NextResponse } from "next/server";
import { db, activityLog } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { mockDb, useMockDb } from "@/lib/db/mock-db";

// GET - Fetch activity log for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    if (useMockDb()) {
      const activities = mockDb.activityLog.findByUserId(userId, limit, offset);
      return NextResponse.json({ activities });
    }

    const activities = await db.query.activityLog.findMany({
      where: eq(activityLog.userId, userId),
      orderBy: [desc(activityLog.createdAt)],
      limit,
      offset,
    });

    return NextResponse.json({ activities });
  } catch (error) {
    console.error("Failed to fetch activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}

// POST - Log a new activity
export async function POST(request: NextRequest) {
  try {
    const { userId, action, entityType, entityId, metadata } = await request.json();

    if (!userId || !action) {
      return NextResponse.json(
        { error: "User ID and action are required" },
        { status: 400 }
      );
    }

    if (useMockDb()) {
      const activity = mockDb.activityLog.create({
        userId,
        action,
        entityType,
        entityId,
        metadata,
      });
      return NextResponse.json({ activity });
    }

    const [activity] = await db
      .insert(activityLog)
      .values({
        userId,
        action,
        entityType: entityType || null,
        entityId: entityId || null,
        metadata: metadata || null,
      })
      .returning();

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Failed to log activity:", error);
    return NextResponse.json(
      { error: "Failed to log activity" },
      { status: 500 }
    );
  }
}
