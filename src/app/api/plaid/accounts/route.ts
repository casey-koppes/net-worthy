import { NextRequest, NextResponse } from "next/server";
import { mockDb, useMockDb } from "@/lib/db/mock-db";

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

    if (useMockDb()) {
      const accounts = mockDb.plaidAccounts.findByUserId(userId);
      const connections = mockDb.plaidConnections.findByUserId(userId);

      // Create a map of connection IDs to institution info
      const connectionMap = new Map(
        connections.map((c) => [c.id, { name: c.institutionName, logo: c.institutionLogo }])
      );

      // Add institution name and logo to each account
      const accountsWithInstitution = accounts.map((account) => {
        const institution = connectionMap.get(account.connectionId);
        return {
          ...account,
          institutionName: institution?.name || "Unknown Institution",
          institutionLogo: institution?.logo || null,
        };
      });

      return NextResponse.json({
        accounts: accountsWithInstitution,
      });
    }

    // For production with real database
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 500 }
    );
  } catch (error) {
    console.error("Failed to fetch Plaid accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}
