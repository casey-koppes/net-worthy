import { NextRequest, NextResponse } from "next/server";
import { db, users, apiKeys, accounts, cryptoWallets, manualAssets } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { decryptNumber } from "@/lib/encryption";
import { mockDb, useMockDb } from "@/lib/db/mock-db";
import crypto from "crypto";

// Check if running in development mode
function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

// Verify API key and get business info
async function verifyApiKey(apiKey: string) {
  // For development/demo mode, accept a test API key
  if (isDevelopment() || useMockDb()) {
    if (apiKey === "test_api_key_12345") {
      return { id: "test", name: "Test Business", userId: "test-user" };
    }
  }

  if (useMockDb()) {
    return null;
  }

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

interface AssetBreakdown {
  bankAccounts: number;
  investments: number;
  cryptoWallets: number;
  otherAssets: number;
}

interface LiabilityBreakdown {
  creditCards: number;
  loans: number;
  otherLiabilities: number;
}

interface NetWorthResponse {
  email: string;
  totalNetWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  assets: AssetBreakdown;
  liabilities: LiabilityBreakdown;
  verifiedAt: string;
}

// GET endpoint - retrieve net worth by email
export async function GET(request: NextRequest) {
  try {
    // Get API key from header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid API key. Use Authorization: Bearer <api_key>" },
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

    // Get email from query params
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter is required" },
        { status: 400 }
      );
    }

    // Find user by email
    let targetUser;
    if (useMockDb()) {
      targetUser = mockDb.users.findByEmail(email);
    } else {
      targetUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      });
    }

    if (!targetUser) {
      // In development, return demo data for testing
      if (isDevelopment() && email === "demo@networthy.com") {
        const demoResponse: NetWorthResponse = {
          email,
          totalNetWorth: 247500.00,
          totalAssets: 285000.00,
          totalLiabilities: 37500.00,
          assets: {
            bankAccounts: 45000.00,
            investments: 125000.00,
            cryptoWallets: 65000.00,
            otherAssets: 50000.00,
          },
          liabilities: {
            creditCards: 2500.00,
            loans: 25000.00,
            otherLiabilities: 10000.00,
          },
          verifiedAt: new Date().toISOString(),
        };
        return NextResponse.json(demoResponse);
      }

      return NextResponse.json(
        { error: "User not found with the provided email" },
        { status: 404 }
      );
    }

    const userId = targetUser.id;

    // Initialize breakdown
    const assets: AssetBreakdown = {
      bankAccounts: 0,
      investments: 0,
      cryptoWallets: 0,
      otherAssets: 0,
    };

    const liabilities: LiabilityBreakdown = {
      creditCards: 0,
      loans: 0,
      otherLiabilities: 0,
    };

    if (useMockDb()) {
      // Process mock data
      const userAccounts = mockDb.plaidAccounts.findByUserId(userId);
      const userWallets = mockDb.cryptoWallets.findByUserId(userId);
      const userManualAssets = mockDb.manualAssets.findByUserId(userId);

      // Process Plaid accounts
      for (const account of userAccounts) {
        const balance = account.balance || 0;
        if (account.isAsset) {
          if (account.category === "investment") {
            assets.investments += balance;
          } else {
            assets.bankAccounts += balance;
          }
        } else {
          // Liabilities
          if (account.category === "credit") {
            liabilities.creditCards += Math.abs(balance);
          } else if (account.category === "loan") {
            liabilities.loans += Math.abs(balance);
          } else {
            liabilities.otherLiabilities += Math.abs(balance);
          }
        }
      }

      // Process crypto wallets
      for (const wallet of userWallets) {
        assets.cryptoWallets += wallet.balanceUsd || 0;
      }

      // Process manual assets
      for (const asset of userManualAssets) {
        const value = asset.value || 0;
        if (asset.isAsset) {
          assets.otherAssets += value;
        } else {
          // Manual liabilities
          if (asset.category === "credit" || asset.category === "credit_card") {
            liabilities.creditCards += value;
          } else if (asset.category === "loan" || asset.category === "mortgage") {
            liabilities.loans += value;
          } else {
            liabilities.otherLiabilities += value;
          }
        }
      }
    } else {
      // Process real database
      const userAccounts = await db.query.accounts.findMany({
        where: eq(accounts.userId, userId),
      });

      const userWallets = await db.query.cryptoWallets.findMany({
        where: eq(cryptoWallets.userId, userId),
      });

      const userManualAssets = await db.query.manualAssets.findMany({
        where: eq(manualAssets.userId, userId),
      });

      // Process Plaid accounts
      for (const account of userAccounts) {
        const balance = decryptNumber(account.balanceEncrypted, userId);
        if (account.isAsset) {
          if (account.category === "investment") {
            assets.investments += balance;
          } else {
            assets.bankAccounts += balance;
          }
        } else {
          // Liabilities
          if (account.category === "credit") {
            liabilities.creditCards += Math.abs(balance);
          } else if (account.category === "loan") {
            liabilities.loans += Math.abs(balance);
          } else {
            liabilities.otherLiabilities += Math.abs(balance);
          }
        }
      }

      // Process crypto wallets
      for (const wallet of userWallets) {
        if (wallet.balanceUsdEncrypted) {
          const balanceUsd = decryptNumber(wallet.balanceUsdEncrypted, userId);
          assets.cryptoWallets += balanceUsd;
        }
      }

      // Process manual assets
      for (const asset of userManualAssets) {
        const value = decryptNumber(asset.valueEncrypted, userId);
        if (asset.isAsset) {
          assets.otherAssets += value;
        } else {
          // Manual liabilities
          if (asset.category === "credit" || asset.category === "credit_card") {
            liabilities.creditCards += value;
          } else if (asset.category === "loan" || asset.category === "mortgage") {
            liabilities.loans += value;
          } else {
            liabilities.otherLiabilities += value;
          }
        }
      }
    }

    // Calculate totals
    const totalAssets =
      assets.bankAccounts +
      assets.investments +
      assets.cryptoWallets +
      assets.otherAssets;

    const totalLiabilities =
      liabilities.creditCards +
      liabilities.loans +
      liabilities.otherLiabilities;

    const totalNetWorth = totalAssets - totalLiabilities;

    // Format response with rounded values
    const response: NetWorthResponse = {
      email,
      totalNetWorth: Math.round(totalNetWorth * 100) / 100,
      totalAssets: Math.round(totalAssets * 100) / 100,
      totalLiabilities: Math.round(totalLiabilities * 100) / 100,
      assets: {
        bankAccounts: Math.round(assets.bankAccounts * 100) / 100,
        investments: Math.round(assets.investments * 100) / 100,
        cryptoWallets: Math.round(assets.cryptoWallets * 100) / 100,
        otherAssets: Math.round(assets.otherAssets * 100) / 100,
      },
      liabilities: {
        creditCards: Math.round(liabilities.creditCards * 100) / 100,
        loans: Math.round(liabilities.loans * 100) / 100,
        otherLiabilities: Math.round(liabilities.otherLiabilities * 100) / 100,
      },
      verifiedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Net worth verification failed:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}

// POST endpoint - same functionality, accepts email in body
export async function POST(request: NextRequest) {
  try {
    // Get API key from header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid API key. Use Authorization: Bearer <api_key>" },
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

    // Get email from body
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required in request body" },
        { status: 400 }
      );
    }

    // Redirect to GET logic by constructing URL
    const url = new URL(request.url);
    url.searchParams.set("email", email);

    // Create a new request with the email param
    const getRequest = new NextRequest(url, {
      headers: request.headers,
    });

    return GET(getRequest);
  } catch (error) {
    console.error("Net worth verification failed:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
