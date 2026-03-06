import { NextRequest, NextResponse } from "next/server";
import { db, plaidConnections, accounts, activityLog } from "@/lib/db";
import { eq } from "drizzle-orm";
import { plaidClient } from "@/lib/plaid/client";
import { decrypt, encryptNumber, decryptNumber } from "@/lib/encryption";

export async function POST(request: NextRequest) {
  try {
    const { connectionId, userId } = await request.json();

    if (!connectionId || !userId) {
      return NextResponse.json(
        { error: "Connection ID and User ID are required" },
        { status: 400 }
      );
    }

    // Get the connection
    const connection = await db.query.plaidConnections.findFirst({
      where: eq(plaidConnections.id, connectionId),
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    // Decrypt access token
    const accessToken = decrypt(connection.accessTokenEncrypted, userId);

    // Fetch updated accounts from Plaid
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    // Update each account
    for (const plaidAccount of accountsResponse.data.accounts) {
      const balance = plaidAccount.balances.current ?? 0;
      const availableBalance = plaidAccount.balances.available;
      const limit = plaidAccount.balances.limit;

      // Find existing account
      const existingAccount = await db.query.accounts.findFirst({
        where: eq(accounts.plaidAccountId, plaidAccount.account_id),
      });

      if (existingAccount) {
        // Get old balance for comparison
        const oldBalance = decryptNumber(existingAccount.balanceEncrypted, userId);
        const balanceChange = balance - oldBalance;

        // Update existing account
        await db
          .update(accounts)
          .set({
            balanceEncrypted: encryptNumber(balance, userId),
            availableBalanceEncrypted: availableBalance
              ? encryptNumber(availableBalance, userId)
              : null,
            limitEncrypted: limit ? encryptNumber(limit, userId) : null,
            lastSynced: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, existingAccount.id));

        // Log activity if balance changed
        if (balanceChange !== 0) {
          await db.insert(activityLog).values({
            userId,
            action: "balance_changed",
            entityType: "plaid_account",
            entityId: existingAccount.id,
            metadata: {
              name: existingAccount.name,
              oldValue: oldBalance,
              newValue: balance,
              valueChange: balanceChange,
              isAsset: existingAccount.isAsset,
            },
          });
        }
      } else {
        // Create new account (in case new accounts were added)
        const isAsset = !["credit", "loan"].includes(plaidAccount.type);
        let category: "bank" | "investment" | "other" = "bank";
        if (plaidAccount.type === "investment" || plaidAccount.type === "brokerage") {
          category = "investment";
        }

        const [newAccount] = await db.insert(accounts).values({
          userId,
          connectionId,
          plaidAccountId: plaidAccount.account_id,
          type: plaidAccount.type,
          subtype: plaidAccount.subtype ?? null,
          name: plaidAccount.name,
          officialName: plaidAccount.official_name ?? null,
          mask: plaidAccount.mask ?? null,
          balanceEncrypted: encryptNumber(balance, userId),
          availableBalanceEncrypted: availableBalance
            ? encryptNumber(availableBalance, userId)
            : null,
          limitEncrypted: limit ? encryptNumber(limit, userId) : null,
          currency: plaidAccount.balances.iso_currency_code ?? "USD",
          category,
          isAsset,
          isManual: false,
          visibility: "private",
          lastSynced: new Date(),
        }).returning();

        // Log activity for new account discovered during sync
        await db.insert(activityLog).values({
          userId,
          action: "account_added",
          entityType: "plaid_account",
          entityId: newAccount.id,
          metadata: {
            name: plaidAccount.name,
            type: plaidAccount.type,
            value: balance,
            isAsset,
          },
        });
      }
    }

    // Update connection last synced
    await db
      .update(plaidConnections)
      .set({
        lastSynced: new Date(),
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(plaidConnections.id, connectionId));

    return NextResponse.json({
      success: true,
      accountsUpdated: accountsResponse.data.accounts.length,
    });
  } catch (error) {
    console.error("Failed to sync accounts:", error);
    return NextResponse.json(
      { error: "Failed to sync accounts" },
      { status: 500 }
    );
  }
}
