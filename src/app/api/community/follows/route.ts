import { NextRequest, NextResponse } from "next/server";
import { db, follows, users } from "@/lib/db";
import { eq, and } from "drizzle-orm";

// GET - Get followers/following for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const type = searchParams.get("type") || "following"; // following or followers

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    if (type === "following") {
      const following = await db.query.follows.findMany({
        where: eq(follows.followerId, userId),
        with: {
          following: true,
        },
      });

      return NextResponse.json({
        following: following.map((f) => ({
          id: f.following.id,
          pubkey: f.following.nostrPubkey,
          displayName: f.following.displayName,
          nip05: f.following.nip05Identifier,
          followedAt: f.createdAt,
        })),
      });
    } else {
      const followersList = await db.query.follows.findMany({
        where: eq(follows.followingId, userId),
        with: {
          follower: true,
        },
      });

      return NextResponse.json({
        followers: followersList.map((f) => ({
          id: f.follower.id,
          pubkey: f.follower.nostrPubkey,
          displayName: f.follower.displayName,
          nip05: f.follower.nip05Identifier,
          followedAt: f.createdAt,
        })),
      });
    }
  } catch (error) {
    console.error("Failed to fetch follows:", error);
    return NextResponse.json(
      { error: "Failed to fetch follows" },
      { status: 500 }
    );
  }
}

// POST - Follow a user
export async function POST(request: NextRequest) {
  try {
    const { followerId, followingId, followingPubkey } = await request.json();

    if (!followerId || (!followingId && !followingPubkey)) {
      return NextResponse.json(
        { error: "Follower ID and following ID or pubkey are required" },
        { status: 400 }
      );
    }

    let targetUserId = followingId;

    // If pubkey provided instead of ID, look up the user
    if (!targetUserId && followingPubkey) {
      const targetUser = await db.query.users.findFirst({
        where: eq(users.nostrPubkey, followingPubkey),
      });

      if (!targetUser) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      targetUserId = targetUser.id;
    }

    // Check if already following
    const existingFollow = await db.query.follows.findFirst({
      where: and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, targetUserId)
      ),
    });

    if (existingFollow) {
      return NextResponse.json(
        { error: "Already following this user" },
        { status: 400 }
      );
    }

    // Create follow
    await db.insert(follows).values({
      followerId,
      followingId: targetUserId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to follow user:", error);
    return NextResponse.json(
      { error: "Failed to follow user" },
      { status: 500 }
    );
  }
}

// DELETE - Unfollow a user
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const followerId = searchParams.get("followerId");
    const followingId = searchParams.get("followingId");

    if (!followerId || !followingId) {
      return NextResponse.json(
        { error: "Follower ID and following ID are required" },
        { status: 400 }
      );
    }

    await db.delete(follows).where(
      and(eq(follows.followerId, followerId), eq(follows.followingId, followingId))
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to unfollow user:", error);
    return NextResponse.json(
      { error: "Failed to unfollow user" },
      { status: 500 }
    );
  }
}
