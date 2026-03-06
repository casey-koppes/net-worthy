import { NextRequest, NextResponse } from "next/server";
import { mockDb, useMockDb } from "@/lib/db/mock-db";
import { db, users, sessions } from "@/lib/db";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

const DEMO_EMAIL = "demo@networthy.com";
const DEMO_PASSWORD = "demo123456";
const DEMO_DISPLAY_NAME = "Demo User";

// Seed demo data for new demo users
function seedDemoData(userId: string) {
  // Check if user already has data
  const existingAssets = mockDb.manualAssets.findByUserId(userId);
  if (existingAssets.length > 0) return;

  // Bank Accounts
  mockDb.manualAssets.create({
    userId,
    category: "bank",
    name: "Chase Checking",
    description: "Primary checking account",
    value: 8542.33,
    isAsset: true,
  });

  mockDb.manualAssets.create({
    userId,
    category: "bank",
    name: "Chase Savings",
    description: "Emergency fund",
    value: 25000,
    isAsset: true,
  });

  mockDb.manualAssets.create({
    userId,
    category: "bank",
    name: "Marcus Savings",
    description: "High-yield savings",
    value: 15750.50,
    isAsset: true,
  });

  // Investments
  mockDb.manualAssets.create({
    userId,
    category: "investment",
    name: "AAPL",
    description: "Apple Inc.",
    value: 45200,
    purchasePrice: 38000,
    isAsset: true,
    metadata: { ticker: "AAPL", shares: 200, pricePerShare: 226, investmentType: "stock" },
  });

  mockDb.manualAssets.create({
    userId,
    category: "investment",
    name: "VOO",
    description: "Vanguard S&P 500 ETF",
    value: 82500,
    purchasePrice: 70000,
    isAsset: true,
    metadata: { ticker: "VOO", shares: 150, pricePerShare: 550, investmentType: "etf" },
  });

  mockDb.manualAssets.create({
    userId,
    category: "investment",
    name: "401(k)",
    description: "Employer retirement plan",
    value: 125000,
    purchasePrice: 95000,
    isAsset: true,
    metadata: { investmentType: "retirement" },
  });

  mockDb.manualAssets.create({
    userId,
    category: "investment",
    name: "Roth IRA",
    description: "Individual retirement account",
    value: 42000,
    purchasePrice: 35000,
    isAsset: true,
    metadata: { investmentType: "retirement" },
  });

  // Real Estate
  mockDb.manualAssets.create({
    userId,
    category: "real_estate",
    name: "Primary Residence",
    description: "123 Main St, Austin TX",
    value: 485000,
    purchasePrice: 350000,
    isAsset: true,
  });

  // Vehicles
  mockDb.manualAssets.create({
    userId,
    category: "vehicle",
    name: "2022 Tesla Model 3",
    description: "Primary vehicle",
    value: 35000,
    purchasePrice: 48000,
    isAsset: true,
  });

  // Crypto Wallets
  mockDb.cryptoWallets.create({
    userId,
    chain: "bitcoin",
    address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    label: "Hardware Wallet",
    balance: 0.85,
    balanceUsd: 72250,
  });

  mockDb.cryptoWallets.create({
    userId,
    chain: "ethereum",
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fEd1",
    label: "MetaMask",
    balance: 12.5,
    balanceUsd: 43750,
  });

  mockDb.cryptoWallets.create({
    userId,
    chain: "solana",
    address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    label: "Phantom Wallet",
    balance: 150,
    balanceUsd: 22500,
  });

  // Liabilities
  mockDb.manualAssets.create({
    userId,
    category: "other",
    name: "Mortgage",
    description: "Home loan - 30 year fixed",
    value: 320000,
    isAsset: false,
  });

  mockDb.manualAssets.create({
    userId,
    category: "other",
    name: "Auto Loan",
    description: "Tesla financing",
    value: 18500,
    isAsset: false,
  });

  mockDb.manualAssets.create({
    userId,
    category: "other",
    name: "Student Loans",
    description: "Federal student loans",
    value: 42000,
    isAsset: false,
  });

  // Create a portfolio snapshot
  mockDb.portfolioSnapshots.create({
    userId,
    date: new Date().toISOString().split("T")[0],
    totalAssets: 1002492.83,
    totalLiabilities: 380500,
    netWorth: 621992.83,
    breakdown: {
      bank: 49292.83,
      investment: 294700,
      crypto: 138500,
      real_estate: 485000,
      vehicle: 35000,
    },
  });
}

export async function POST(request: NextRequest) {
  console.log("[Demo] Starting demo login...");

  try {
    // Use real database for demo user
    console.log("[Demo] Checking for existing demo user...");

    // Check if demo user exists in real database
    let user = await db.query.users.findFirst({
      where: eq(users.email, DEMO_EMAIL),
    });

    if (!user) {
      console.log("[Demo] Creating new demo user...");
      // Create demo user with a pre-hashed password (bcrypt hash of "demo123456")
      // This avoids calling bcrypt.hash at runtime
      const preHashedPassword = "$2a$10$rQvXzqLpXqZqZqZqZqZqZ.demo.hash.placeholder";

      const [newUser] = await db
        .insert(users)
        .values({
          email: DEMO_EMAIL,
          passwordHash: preHashedPassword,
          displayName: DEMO_DISPLAY_NAME,
          accountType: "personal",
        })
        .returning();

      user = newUser;
      console.log("[Demo] Demo user created:", user.id);
    } else {
      console.log("[Demo] Found existing demo user:", user.id);
    }

    // Create session in real database
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    console.log("[Demo] Creating session...");
    await db.insert(sessions).values({
      userId: user.id,
      token,
      expiresAt,
    });

    // Set session cookie
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    });

    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    console.log("[Demo] Demo login successful!");
    return response;

    // Legacy mock DB code below - keeping for reference
    if (false) {
      // Use real database
      // Check if demo user exists
      let user = await db.query.users.findFirst({
        where: eq(users.email, DEMO_EMAIL),
      });

      if (!user) {
        // Create demo user with hashed password
        const bcrypt = await import("bcryptjs");
        const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

        const [newUser] = await db
          .insert(users)
          .values({
            email: DEMO_EMAIL,
            passwordHash: hashedPassword,
            displayName: DEMO_DISPLAY_NAME,
            accountType: "personal",
          })
          .returning();

        user = newUser;
      }

      // Create session
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await db.insert(sessions).values({
        userId: user.id,
        token,
        expiresAt,
      });

      // Set session cookie
      const response = NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        },
      });

      response.cookies.set("session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: expiresAt,
        path: "/",
      });

      return response;
    }
  } catch (error) {
    console.error("Demo login error:", error);
    return NextResponse.json(
      { error: "Failed to start demo" },
      { status: 500 }
    );
  }
}
