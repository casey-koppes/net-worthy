import { NextRequest, NextResponse } from "next/server";
import { db, cryptoWallets } from "@/lib/db";
import { eq } from "drizzle-orm";
import { encryptNumber, decryptNumber } from "@/lib/encryption";
import { fetchWalletData, CHAIN_CONFIGS } from "@/lib/crypto/chains";
import { mockDb, useMockDb } from "@/lib/db/mock-db";

// GET - Fetch all wallets for a user
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

    // Use mock DB if no DATABASE_URL
    if (useMockDb()) {
      const wallets = mockDb.cryptoWallets.findByUserId(userId);
      return NextResponse.json({ wallets });
    }

    const wallets = await db.query.cryptoWallets.findMany({
      where: eq(cryptoWallets.userId, userId),
    });

    // Decrypt balances
    const decryptedWallets = wallets.map((wallet) => ({
      id: wallet.id,
      chain: wallet.chain,
      address: wallet.address,
      label: wallet.label,
      balance: wallet.balanceEncrypted
        ? decryptNumber(wallet.balanceEncrypted, userId)
        : 0,
      balanceUsd: wallet.balanceUsdEncrypted
        ? decryptNumber(wallet.balanceUsdEncrypted, userId)
        : 0,
      isHidden: wallet.isHidden,
      visibility: wallet.visibility,
      lastSynced: wallet.lastSynced,
    }));

    return NextResponse.json({ wallets: decryptedWallets });
  } catch (error) {
    console.error("Failed to fetch wallets:", error);
    return NextResponse.json(
      { error: "Failed to fetch wallets" },
      { status: 500 }
    );
  }
}

// POST - Add a new wallet
export async function POST(request: NextRequest) {
  try {
    const { userId, chain, address, label } = await request.json();

    if (!userId || !chain || !address) {
      return NextResponse.json(
        { error: "User ID, chain, and address are required" },
        { status: 400 }
      );
    }

    // Validate chain
    if (!CHAIN_CONFIGS[chain]) {
      return NextResponse.json(
        { error: `Unsupported chain: ${chain}` },
        { status: 400 }
      );
    }

    // Validate address format (basic validation)
    const trimmedAddress = address.trim();
    if (trimmedAddress.length < 20) {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      );
    }

    // Fetch initial balance
    let balance = 0;
    let balanceUsd = 0;

    try {
      const walletData = await fetchWalletData(chain, trimmedAddress);
      balance = walletData.balance;
      balanceUsd = walletData.balanceUsd;
    } catch (err) {
      console.error("Failed to fetch initial balance:", err);
      // Continue with zero balance if fetch fails
    }

    // Use mock DB if no DATABASE_URL
    if (useMockDb()) {
      const wallet = mockDb.cryptoWallets.create({
        userId,
        chain,
        address: trimmedAddress,
        label: label || undefined,
        balance,
        balanceUsd,
      });

      // Log activity
      mockDb.activityLog.create({
        userId,
        action: "wallet_added",
        entityType: "crypto_wallet",
        entityId: wallet.id,
        metadata: {
          chain,
          address: trimmedAddress,
          label: label || null,
          balanceUsd,
        },
      });

      // Create unit snapshot for tracking
      const chainConfig = CHAIN_CONFIGS[chain];
      mockDb.unitSnapshots.create({
        userId,
        assetId: wallet.id,
        assetType: "crypto",
        assetName: chainConfig?.name || chain,
        assetSymbol: chainConfig?.symbol || chain.toUpperCase(),
        date: new Date().toISOString().split("T")[0],
        units: balance,
      });

      return NextResponse.json({
        success: true,
        wallet: {
          id: wallet.id,
          chain: wallet.chain,
          address: wallet.address,
          label: wallet.label,
          balance: wallet.balance,
          balanceUsd: wallet.balanceUsd,
        },
      });
    }

    // Create wallet record
    const [wallet] = await db
      .insert(cryptoWallets)
      .values({
        userId,
        chain,
        address: trimmedAddress,
        label: label || null,
        balanceEncrypted: encryptNumber(balance, userId),
        balanceUsdEncrypted: encryptNumber(balanceUsd, userId),
        visibility: "private",
        lastSynced: new Date(),
      })
      .returning();

    return NextResponse.json({
      success: true,
      wallet: {
        id: wallet.id,
        chain: wallet.chain,
        address: wallet.address,
        label: wallet.label,
        balance,
        balanceUsd,
      },
    });
  } catch (error) {
    console.error("Failed to add wallet:", error);
    return NextResponse.json(
      { error: "Failed to add wallet" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a wallet
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletId = searchParams.get("walletId");
    const userId = searchParams.get("userId");

    if (!walletId || !userId) {
      return NextResponse.json(
        { error: "Wallet ID and User ID are required" },
        { status: 400 }
      );
    }

    // Use mock DB if no DATABASE_URL
    if (useMockDb()) {
      // Get wallet info before deleting for activity log
      const wallet = mockDb.cryptoWallets.findById(walletId);

      mockDb.cryptoWallets.delete(walletId);

      // Log activity
      if (wallet) {
        mockDb.activityLog.create({
          userId,
          action: "wallet_removed",
          entityType: "crypto_wallet",
          entityId: walletId,
          metadata: {
            chain: wallet.chain,
            address: wallet.address,
            label: wallet.label,
            balanceUsd: wallet.balanceUsd,
          },
        });
      }

      return NextResponse.json({ success: true });
    }

    await db
      .delete(cryptoWallets)
      .where(eq(cryptoWallets.id, walletId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete wallet:", error);
    return NextResponse.json(
      { error: "Failed to delete wallet" },
      { status: 500 }
    );
  }
}
