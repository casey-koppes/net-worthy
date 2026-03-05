import { NextRequest, NextResponse } from "next/server";
import { db, accounts, cryptoWallets, manualAssets } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { decryptNumber } from "@/lib/encryption";

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

    // Fetch all accounts
    const userAccounts = await db.query.accounts.findMany({
      where: and(eq(accounts.userId, userId), eq(accounts.isHidden, false)),
    });

    // Fetch all crypto wallets
    const userWallets = await db.query.cryptoWallets.findMany({
      where: and(
        eq(cryptoWallets.userId, userId),
        eq(cryptoWallets.isHidden, false)
      ),
    });

    // Fetch all manual assets
    const userManualAssets = await db.query.manualAssets.findMany({
      where: and(
        eq(manualAssets.userId, userId),
        eq(manualAssets.isHidden, false)
      ),
    });

    // Calculate totals
    let totalAssets = 0;
    let totalLiabilities = 0;
    const breakdown = {
      bank: 0,
      investment: 0,
      crypto: 0,
      realEstate: 0,
      vehicle: 0,
      other: 0,
    };

    // Process accounts
    for (const account of userAccounts) {
      const balance = decryptNumber(account.balanceEncrypted, userId);

      if (account.isAsset) {
        totalAssets += balance;
        if (account.category === "investment") {
          breakdown.investment += balance;
        } else {
          breakdown.bank += balance;
        }
      } else {
        totalLiabilities += Math.abs(balance);
      }
    }

    // Process crypto wallets
    for (const wallet of userWallets) {
      if (wallet.balanceUsdEncrypted) {
        const balanceUsd = decryptNumber(wallet.balanceUsdEncrypted, userId);
        totalAssets += balanceUsd;
        breakdown.crypto += balanceUsd;
      }
    }

    // Process manual assets
    for (const asset of userManualAssets) {
      const value = decryptNumber(asset.valueEncrypted, userId);

      if (asset.isAsset) {
        totalAssets += value;
        switch (asset.category) {
          case "real_estate":
            breakdown.realEstate += value;
            break;
          case "vehicle":
            breakdown.vehicle += value;
            break;
          default:
            breakdown.other += value;
        }
      } else {
        totalLiabilities += value;
      }
    }

    const netWorth = totalAssets - totalLiabilities;

    return NextResponse.json({
      summary: {
        totalAssets,
        totalLiabilities,
        netWorth,
        breakdown,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to fetch portfolio summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio summary" },
      { status: 500 }
    );
  }
}
