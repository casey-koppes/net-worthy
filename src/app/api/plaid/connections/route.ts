import { NextRequest, NextResponse } from "next/server";
import { db, plaidConnections, accounts } from "@/lib/db";
import { eq, and, count } from "drizzle-orm";
import { plaidClient } from "@/lib/plaid/client";
import { decrypt } from "@/lib/encryption";

// GET - Fetch all Plaid connections for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Get connections with account counts
    const connections = await db.query.plaidConnections.findMany({
      where: eq(plaidConnections.userId, userId),
    });

    // Get account counts for each connection
    const connectionsWithCounts = await Promise.all(
      connections.map(async (connection) => {
        const accountCount = await db
          .select({ count: count() })
          .from(accounts)
          .where(eq(accounts.connectionId, connection.id));

        return {
          id: connection.id,
          institutionName: connection.institutionName || "Unknown Institution",
          institutionId: connection.institutionId,
          status: connection.status,
          accountCount: accountCount[0]?.count || 0,
          lastSynced: connection.lastSynced?.toISOString(),
          createdAt: connection.createdAt.toISOString(),
        };
      })
    );

    return NextResponse.json({ connections: connectionsWithCounts });
  } catch (error) {
    console.error("Failed to fetch connections:", error);
    return NextResponse.json(
      { error: "Failed to fetch connections" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a Plaid connection
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get("connectionId");
    const userId = searchParams.get("userId");

    if (!connectionId || !userId) {
      return NextResponse.json(
        { error: "Connection ID and User ID are required" },
        { status: 400 }
      );
    }

    // Get the connection to remove the item from Plaid
    const connection = await db.query.plaidConnections.findFirst({
      where: and(
        eq(plaidConnections.id, connectionId),
        eq(plaidConnections.userId, userId)
      ),
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    // Remove the item from Plaid
    try {
      const accessToken = decrypt(connection.accessTokenEncrypted, userId);
      await plaidClient.itemRemove({ access_token: accessToken });
    } catch (err) {
      console.error("Failed to remove item from Plaid:", err);
      // Continue with deletion even if Plaid removal fails
    }

    // Delete associated accounts first (cascade should handle this, but being explicit)
    await db.delete(accounts).where(eq(accounts.connectionId, connectionId));

    // Delete the connection
    await db.delete(plaidConnections).where(eq(plaidConnections.id, connectionId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete connection:", error);
    return NextResponse.json(
      { error: "Failed to delete connection" },
      { status: 500 }
    );
  }
}
