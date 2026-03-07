import { NextRequest, NextResponse } from "next/server";
import {
  db,
  users,
  portfolioSnapshots,
  itemValueSnapshots,
  manualAssets,
  cryptoWallets,
  accounts,
} from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { encryptNumber, decryptNumber } from "@/lib/encryption";

// Verify the request is from Vercel Cron
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn("CRON_SECRET not set - allowing request in development");
    return process.env.NODE_ENV === "development";
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  // Verify the cron secret
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date().toISOString().split("T")[0];

    // Fetch all users
    const allUsers = await db.query.users.findMany({
      columns: { id: true },
    });

    console.log(`Processing snapshots for ${allUsers.length} users`);

    let processed = 0;
    let errors = 0;

    for (const user of allUsers) {
      try {
        await saveUserSnapshot(user.id, today);
        processed++;
      } catch (error) {
        console.error(`Failed to save snapshot for user ${user.id}:`, error);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      date: today,
      processed,
      errors,
      total: allUsers.length,
    });
  } catch (error) {
    console.error("Failed to run daily snapshots:", error);
    return NextResponse.json(
      { error: "Failed to run daily snapshots" },
      { status: 500 }
    );
  }
}

async function saveUserSnapshot(userId: string, date: string) {
  // Fetch all portfolio items for this user
  const [dbManualAssets, dbCryptoWallets, dbAccounts] = await Promise.all([
    db.query.manualAssets.findMany({
      where: eq(manualAssets.userId, userId),
    }),
    db.query.cryptoWallets.findMany({
      where: eq(cryptoWallets.userId, userId),
    }),
    db.query.accounts.findMany({
      where: eq(accounts.userId, userId),
    }),
  ]);

  // Calculate totals
  let totalAssets = 0;
  let totalLiabilities = 0;
  const breakdown: Record<string, number> = {
    bank: 0,
    investment: 0,
    crypto: 0,
    realEstate: 0,
    vehicle: 0,
    other: 0,
  };

  const itemSnapshots: Array<{
    userId: string;
    date: string;
    itemId: string;
    itemType: string;
    category: string;
    name: string;
    valueEncrypted: string;
    isAsset: boolean;
    metadata: Record<string, unknown> | null;
  }> = [];

  // Process manual assets
  for (const asset of dbManualAssets) {
    const value = decryptNumber(asset.valueEncrypted, userId);

    if (asset.isAsset) {
      totalAssets += value;
      const categoryKey = asset.category === "real_estate" ? "realEstate" : asset.category;
      if (categoryKey in breakdown) {
        breakdown[categoryKey] += value;
      } else {
        breakdown.other += value;
      }
    } else {
      totalLiabilities += value;
    }

    itemSnapshots.push({
      userId,
      date,
      itemId: asset.id,
      itemType: "manual_asset",
      category: asset.category,
      name: asset.name,
      valueEncrypted: encryptNumber(value, userId),
      isAsset: asset.isAsset,
      metadata: asset.metadata as Record<string, unknown> | null,
    });
  }

  // Process crypto wallets
  for (const wallet of dbCryptoWallets) {
    const balanceUsd = wallet.balanceUsdEncrypted
      ? decryptNumber(wallet.balanceUsdEncrypted, userId)
      : 0;
    const balance = wallet.balanceEncrypted
      ? decryptNumber(wallet.balanceEncrypted, userId)
      : 0;

    totalAssets += balanceUsd;
    breakdown.crypto += balanceUsd;

    itemSnapshots.push({
      userId,
      date,
      itemId: wallet.id,
      itemType: "crypto_wallet",
      category: "crypto",
      name: `${wallet.chain} - ${wallet.label || wallet.address.slice(0, 8)}`,
      valueEncrypted: encryptNumber(balanceUsd, userId),
      isAsset: true,
      metadata: {
        chain: wallet.chain,
        address: wallet.address,
        balance,
        balanceUsd,
      },
    });
  }

  // Process Plaid accounts
  for (const account of dbAccounts) {
    const balance = decryptNumber(account.balanceEncrypted, userId);

    if (account.isAsset) {
      totalAssets += balance;
      const categoryKey = account.category === "real_estate" ? "realEstate" : account.category;
      if (categoryKey in breakdown) {
        breakdown[categoryKey] += balance;
      } else {
        breakdown.other += balance;
      }
    } else {
      totalLiabilities += balance;
    }

    itemSnapshots.push({
      userId,
      date,
      itemId: account.id,
      itemType: "plaid_account",
      category: account.category,
      name: account.name,
      valueEncrypted: encryptNumber(balance, userId),
      isAsset: account.isAsset,
      metadata: {
        type: account.type,
        subtype: account.subtype,
      },
    });
  }

  const netWorth = totalAssets - totalLiabilities;

  // Check if snapshot exists for today
  const existingSnapshot = await db.query.portfolioSnapshots.findFirst({
    where: and(
      eq(portfolioSnapshots.userId, userId),
      eq(portfolioSnapshots.date, date)
    ),
  });

  if (existingSnapshot) {
    // Update existing snapshot
    await db
      .update(portfolioSnapshots)
      .set({
        totalAssets: totalAssets.toString(),
        totalLiabilities: totalLiabilities.toString(),
        netWorth: netWorth.toString(),
        breakdown,
      })
      .where(eq(portfolioSnapshots.id, existingSnapshot.id));
  } else {
    // Create new snapshot
    await db.insert(portfolioSnapshots).values({
      userId,
      date,
      totalAssets: totalAssets.toString(),
      totalLiabilities: totalLiabilities.toString(),
      netWorth: netWorth.toString(),
      breakdown,
    });
  }

  // Delete existing item snapshots for today and insert new ones
  await db
    .delete(itemValueSnapshots)
    .where(
      and(
        eq(itemValueSnapshots.userId, userId),
        eq(itemValueSnapshots.date, date)
      )
    );

  if (itemSnapshots.length > 0) {
    await db.insert(itemValueSnapshots).values(itemSnapshots);
  }

  console.log(
    `Saved snapshot for user ${userId}: assets=${totalAssets}, liabilities=${totalLiabilities}, items=${itemSnapshots.length}`
  );
}
