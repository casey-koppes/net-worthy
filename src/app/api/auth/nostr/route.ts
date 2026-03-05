import { NextRequest, NextResponse } from "next/server";
import { db, users, privacySettings } from "@/lib/db";
import { eq } from "drizzle-orm";

// POST - Create or fetch user by Nostr pubkey
export async function POST(request: NextRequest) {
  try {
    const { pubkey, displayName, nip05 } = await request.json();

    if (!pubkey) {
      return NextResponse.json(
        { error: "Pubkey is required" },
        { status: 400 }
      );
    }

    // Check if user exists
    let user = await db.query.users.findFirst({
      where: eq(users.nostrPubkey, pubkey),
    });

    if (!user) {
      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          nostrPubkey: pubkey,
          displayName: displayName || null,
          nip05Identifier: nip05 || null,
        })
        .returning();

      user = newUser;

      // Create default privacy settings
      await db.insert(privacySettings).values({
        userId: user.id,
        defaultVisibility: "private",
        shareExactAmounts: false,
        shareBreakdown: false,
        displayFormat: "hidden",
      });
    } else {
      // Update user info if provided
      if (displayName || nip05) {
        const [updatedUser] = await db
          .update(users)
          .set({
            displayName: displayName || user.displayName,
            nip05Identifier: nip05 || user.nip05Identifier,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id))
          .returning();
        user = updatedUser;
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        pubkey: user.nostrPubkey,
        displayName: user.displayName,
        nip05: user.nip05Identifier,
        accountType: user.accountType,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Failed to create/fetch user:", error);
    return NextResponse.json(
      { error: "Failed to authenticate" },
      { status: 500 }
    );
  }
}

// GET - Fetch user by pubkey
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pubkey = searchParams.get("pubkey");

    if (!pubkey) {
      return NextResponse.json(
        { error: "Pubkey is required" },
        { status: 400 }
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.nostrPubkey, pubkey),
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        pubkey: user.nostrPubkey,
        displayName: user.displayName,
        nip05: user.nip05Identifier,
        accountType: user.accountType,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Failed to fetch user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}
