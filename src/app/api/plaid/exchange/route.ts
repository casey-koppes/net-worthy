import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid/client";
import { mockDb, useMockDb } from "@/lib/db/mock-db";

export async function POST(request: NextRequest) {
  try {
    const { publicToken, userId } = await request.json();

    if (!publicToken || !userId) {
      return NextResponse.json(
        { error: "Public token and user ID are required" },
        { status: 400 }
      );
    }

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Get institution info
    const itemResponse = await plaidClient.itemGet({
      access_token: accessToken,
    });

    let institutionName = "Unknown Institution";
    let institutionId = null;
    let institutionLogo: string | null = null;

    if (itemResponse.data.item.institution_id) {
      institutionId = itemResponse.data.item.institution_id;
      try {
        const institutionResponse = await plaidClient.institutionsGetById({
          institution_id: institutionId,
          country_codes: ["US"],
          options: {
            include_optional_metadata: true,
          },
        });
        institutionName = institutionResponse.data.institution.name;
        institutionLogo = institutionResponse.data.institution.logo ?? null;
      } catch {
        // Institution name lookup failed, use default
      }
    }

    // Fetch accounts
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    // Use mock DB for local development
    if (useMockDb()) {
      // Create connection record in mock DB
      const connection = mockDb.plaidConnections.create({
        userId,
        itemId,
        institutionId,
        institutionName,
        institutionLogo,
        status: "active",
      });

      // Store accounts in mock DB
      for (const account of accountsResponse.data.accounts) {
        const balance = account.balances.current ?? 0;
        const availableBalance = account.balances.available ?? null;
        const limit = account.balances.limit ?? null;

        // Determine if this is an asset or liability
        const isAsset = !["credit", "loan"].includes(account.type);

        // Determine category
        let category = "bank";
        if (account.type === "investment" || account.type === "brokerage") {
          category = "investment";
        }

        mockDb.plaidAccounts.create({
          userId,
          connectionId: connection.id,
          plaidAccountId: account.account_id,
          type: account.type,
          subtype: account.subtype ?? null,
          name: account.name,
          officialName: account.official_name ?? null,
          mask: account.mask ?? null,
          balance,
          availableBalance,
          limit,
          currency: account.balances.iso_currency_code ?? "USD",
          category,
          isAsset,
        });
      }

      // Log activity
      mockDb.activityLog.create({
        userId,
        action: "plaid_connected",
        entityType: "plaid_connection",
        entityId: connection.id,
        metadata: {
          institutionName,
          accountsCount: accountsResponse.data.accounts.length,
        },
      });

      return NextResponse.json({
        success: true,
        connectionId: connection.id,
        accountsCount: accountsResponse.data.accounts.length,
      });
    }

    // For production with real database, return error for now
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 500 }
    );
  } catch (error) {
    console.error("Failed to exchange token:", error);
    return NextResponse.json(
      { error: "Failed to connect account" },
      { status: 500 }
    );
  }
}
