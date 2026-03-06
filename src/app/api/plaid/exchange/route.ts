import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid/client";
import { mockDb, useMockDb } from "@/lib/db/mock-db";
import { db, plaidConnections, accounts, activityLog } from "@/lib/db";
import { encrypt, encryptNumber } from "@/lib/encryption";

export async function POST(request: NextRequest) {
  try {
    const { publicToken, userId } = await request.json();

    console.log("[Plaid Exchange] Starting token exchange for user:", userId);

    if (!publicToken || !userId) {
      return NextResponse.json(
        { error: "Public token and user ID are required" },
        { status: 400 }
      );
    }

    // Exchange public token for access token
    console.log("[Plaid Exchange] Exchanging public token...");
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;
    console.log("[Plaid Exchange] Got access token, itemId:", itemId);

    // Get institution info
    console.log("[Plaid Exchange] Getting item info...");
    const itemResponse = await plaidClient.itemGet({
      access_token: accessToken,
    });

    let institutionName = "Unknown Institution";
    let institutionId: string | null = null;

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
        console.log("[Plaid Exchange] Institution:", institutionName);
      } catch (err) {
        console.log("[Plaid Exchange] Institution lookup failed, using default");
      }
    }

    // Fetch accounts
    console.log("[Plaid Exchange] Fetching accounts...");
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });
    console.log("[Plaid Exchange] Found", accountsResponse.data.accounts.length, "accounts");

    // Use mock DB for local development
    if (useMockDb()) {
      // Create connection record in mock DB
      const connection = mockDb.plaidConnections.create({
        userId,
        itemId,
        institutionId,
        institutionName,
        institutionLogo: null,
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

    // Use real database
    console.log("[Plaid Exchange] Using real database...");

    // Encrypt the access token
    const accessTokenEncrypted = encrypt(accessToken, userId);

    // Create connection record
    const [connection] = await db
      .insert(plaidConnections)
      .values({
        userId,
        accessTokenEncrypted,
        itemId,
        institutionId,
        institutionName,
        status: "active",
        lastSynced: new Date(),
      })
      .returning();

    console.log("[Plaid Exchange] Created connection:", connection.id);

    // Store accounts
    for (const account of accountsResponse.data.accounts) {
      const balance = account.balances.current ?? 0;
      const availableBalance = account.balances.available ?? null;
      const limit = account.balances.limit ?? null;

      // Determine if this is an asset or liability
      const isAsset = !["credit", "loan"].includes(account.type);

      // Determine category
      let category: "bank" | "investment" | "crypto" | "real_estate" | "vehicle" | "other" = "bank";
      if (account.type === "investment" || account.type === "brokerage") {
        category = "investment";
      }

      // Encrypt balance values
      const balanceEncrypted = encryptNumber(balance, userId);
      const availableBalanceEncrypted = availableBalance !== null
        ? encryptNumber(availableBalance, userId)
        : null;
      const limitEncrypted = limit !== null
        ? encryptNumber(limit, userId)
        : null;

      await db.insert(accounts).values({
        userId,
        connectionId: connection.id,
        plaidAccountId: account.account_id,
        type: account.type,
        subtype: account.subtype ?? null,
        name: account.name,
        officialName: account.official_name ?? null,
        mask: account.mask ?? null,
        balanceEncrypted,
        availableBalanceEncrypted,
        limitEncrypted,
        currency: account.balances.iso_currency_code ?? "USD",
        category,
        isAsset,
        isManual: false,
        lastSynced: new Date(),
      });
    }

    console.log("[Plaid Exchange] Created", accountsResponse.data.accounts.length, "accounts");

    // Log activity
    await db.insert(activityLog).values({
      userId,
      action: "plaid_connected",
      entityType: "plaid_connection",
      entityId: connection.id,
      metadata: {
        institutionName,
        accountsCount: accountsResponse.data.accounts.length,
      },
    });

    console.log("[Plaid Exchange] Success!");

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      accountsCount: accountsResponse.data.accounts.length,
    });
  } catch (error: any) {
    console.error("Failed to exchange token:", error);

    // Log more details if available
    if (error?.response?.data) {
      console.error("Plaid error details:", JSON.stringify(error.response.data, null, 2));
    }

    return NextResponse.json(
      { error: "Failed to connect account" },
      { status: 500 }
    );
  }
}
