import { NextRequest, NextResponse } from "next/server";
import { mockDb, useMockDb } from "@/lib/db/mock-db";
import { db, accounts, plaidConnections } from "@/lib/db";
import { decryptNumber } from "@/lib/encryption";
import { eq } from "drizzle-orm";

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
      const mockAccounts = mockDb.plaidAccounts.findByUserId(userId);
      const connections = mockDb.plaidConnections.findByUserId(userId);

      // Create a map of connection IDs to institution info
      const connectionMap = new Map(
        connections.map((c) => [c.id, { name: c.institutionName, logo: c.institutionLogo }])
      );

      // Add institution name and logo to each account
      const accountsWithInstitution = mockAccounts.map((account) => {
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

    // Use real database
    const dbAccounts = await db.query.accounts.findMany({
      where: eq(accounts.userId, userId),
      with: {
        connection: true,
      },
    });

    // Decrypt balances and format response
    const decryptedAccounts = dbAccounts.map((account) => {
      const balance = decryptNumber(account.balanceEncrypted, userId);
      const availableBalance = account.availableBalanceEncrypted
        ? decryptNumber(account.availableBalanceEncrypted, userId)
        : null;
      const limit = account.limitEncrypted
        ? decryptNumber(account.limitEncrypted, userId)
        : null;

      return {
        id: account.id,
        connectionId: account.connectionId,
        plaidAccountId: account.plaidAccountId,
        type: account.type,
        subtype: account.subtype,
        name: account.name,
        officialName: account.officialName,
        mask: account.mask,
        balance,
        availableBalance,
        limit,
        currency: account.currency,
        category: account.category,
        isAsset: account.isAsset,
        isHidden: account.isHidden,
        visibility: account.visibility,
        lastSynced: account.lastSynced,
        createdAt: account.createdAt,
        institutionName: account.connection?.institutionName || "Unknown Institution",
        institutionLogo: null, // We don't store logos in DB currently
      };
    });

    return NextResponse.json({
      accounts: decryptedAccounts,
    });
  } catch (error) {
    console.error("Failed to fetch Plaid accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}
