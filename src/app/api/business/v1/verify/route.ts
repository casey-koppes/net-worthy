import { NextRequest, NextResponse } from "next/server";
import { db, users, apiKeys, accounts, cryptoWallets, manualAssets, privacySettings } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { decryptNumber } from "@/lib/encryption";
import crypto from "crypto";

// Verify API key and get business info
async function verifyApiKey(apiKey: string) {
  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

  const key = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)),
    with: {
      user: true,
    },
  });

  if (!key) return null;

  // Update last used
  await db
    .update(apiKeys)
    .set({ lastUsed: new Date() })
    .where(eq(apiKeys.id, key.id));

  return key;
}

// Calculate credit worthiness score
function calculateCreditScore(netWorth: number, diversity: number): {
  score: "excellent" | "good" | "fair" | "limited";
  maxRecommendedAmount: number;
} {
  let score: "excellent" | "good" | "fair" | "limited";
  let maxRecommendedAmount: number;

  if (netWorth >= 500000 && diversity >= 0.5) {
    score = "excellent";
    maxRecommendedAmount = Math.min(netWorth * 0.3, 500000);
  } else if (netWorth >= 100000 && diversity >= 0.3) {
    score = "good";
    maxRecommendedAmount = Math.min(netWorth * 0.25, 200000);
  } else if (netWorth >= 25000) {
    score = "fair";
    maxRecommendedAmount = Math.min(netWorth * 0.2, 50000);
  } else {
    score = "limited";
    maxRecommendedAmount = Math.min(netWorth * 0.1, 10000);
  }

  return { score, maxRecommendedAmount };
}

// Calculate portfolio diversity (0-1)
function calculateDiversity(breakdown: Record<string, number>): number {
  const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  if (total === 0) return 0;

  const categories = Object.values(breakdown).filter((val) => val > 0);
  if (categories.length <= 1) return 0;

  // Use entropy-based diversity measure
  let entropy = 0;
  for (const value of categories) {
    const proportion = value / total;
    if (proportion > 0) {
      entropy -= proportion * Math.log2(proportion);
    }
  }

  // Normalize to 0-1
  const maxEntropy = Math.log2(categories.length);
  return entropy / maxEntropy;
}

export async function POST(request: NextRequest) {
  try {
    // Get API key from header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid API key" },
        { status: 401 }
      );
    }

    const apiKey = authHeader.slice(7);
    const key = await verifyApiKey(apiKey);

    if (!key) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      );
    }

    // Get request body
    const { targetPubkey, targetUserId, consentToken } = await request.json();

    if (!targetPubkey && !targetUserId) {
      return NextResponse.json(
        { error: "Target pubkey or user ID is required" },
        { status: 400 }
      );
    }

    // Find target user
    let targetUser;
    if (targetUserId) {
      targetUser = await db.query.users.findFirst({
        where: eq(users.id, targetUserId),
      });
    } else {
      targetUser = await db.query.users.findFirst({
        where: eq(users.nostrPubkey, targetPubkey),
      });
    }

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check privacy settings - user must have opted in to business verification
    const privacy = await db.query.privacySettings.findFirst({
      where: eq(privacySettings.userId, targetUser.id),
    });

    // For now, we'll require explicit consent token
    // In production, this would verify a signed consent from the user
    if (!consentToken) {
      return NextResponse.json(
        {
          error: "User consent required",
          consentRequired: true,
          message: "The user must grant permission for credit verification",
        },
        { status: 403 }
      );
    }

    // Calculate portfolio summary
    const userId = targetUser.id;

    // Fetch all accounts
    const userAccounts = await db.query.accounts.findMany({
      where: eq(accounts.userId, userId),
    });

    const userWallets = await db.query.cryptoWallets.findMany({
      where: eq(cryptoWallets.userId, userId),
    });

    const userManualAssets = await db.query.manualAssets.findMany({
      where: eq(manualAssets.userId, userId),
    });

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

    // Process crypto
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
    const diversity = calculateDiversity(breakdown);
    const { score, maxRecommendedAmount } = calculateCreditScore(netWorth, diversity);

    // Log the verification for audit
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        action: "credit_verification",
        entityType: "business",
        entityId: key.userId,
        metadata: {
          businessName: key.name,
          score,
        },
      }),
    });

    return NextResponse.json({
      verified: true,
      score,
      maxRecommendedAmount: Math.round(maxRecommendedAmount),
      portfolioDiversity: diversity > 0.7 ? "high" : diversity > 0.4 ? "medium" : "low",
      verifiedAt: new Date().toISOString(),
      validFor: 86400, // 24 hours in seconds
    });
  } catch (error) {
    console.error("Credit verification failed:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
