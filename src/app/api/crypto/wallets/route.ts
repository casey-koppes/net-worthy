import { NextRequest, NextResponse } from "next/server";
import { db, cryptoWallets, activityLog } from "@/lib/db";
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
      metadata: (wallet as { metadata?: Record<string, unknown> | null }).metadata || null,
      createdAt: wallet.createdAt,
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
    const { userId, chain, address, label, manualValue, metadata, createdAt } = await request.json();

    if (!userId || !chain || !address) {
      return NextResponse.json(
        { error: "User ID, chain, and address are required" },
        { status: 400 }
      );
    }

    const isManualEntry = chain === "manual";

    // Validate chain for non-manual entries
    if (!isManualEntry && !CHAIN_CONFIGS[chain]) {
      return NextResponse.json(
        { error: `Unsupported chain: ${chain}` },
        { status: 400 }
      );
    }

    // Validate address format (basic validation) - skip for manual entries
    const trimmedAddress = address.trim();
    if (!isManualEntry && trimmedAddress.length < 20) {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      );
    }

    // Fetch initial balance
    let balance = 0;
    let balanceUsd = 0;
    let balanceFetchError: string | null = null;

    if (isManualEntry) {
      // For manual entries, use the provided value
      balanceUsd = manualValue || 0;
      balance = manualValue || 0;
    } else {
      try {
        const walletData = await fetchWalletData(chain, trimmedAddress);
        balance = walletData.balance;
        balanceUsd = walletData.balanceUsd;
      } catch (err) {
        console.error("Failed to fetch initial balance:", err);
        balanceFetchError = err instanceof Error ? err.message : "Failed to fetch balance";
        // Continue with zero balance if fetch fails
      }
    }

    // Use mock DB if no DATABASE_URL
    if (useMockDb()) {
      // For manual entries with units, use units as balance
      const actualBalance = isManualEntry && metadata?.units ? metadata.units : balance;

      const wallet = mockDb.cryptoWallets.create({
        userId,
        chain,
        address: trimmedAddress,
        label: label || undefined,
        balance: actualBalance,
        balanceUsd,
        metadata: metadata || null,
        createdAt: createdAt || new Date().toISOString(),
      });

      // Log activity with metadata
      const activityMetadata = {
        chain,
        address: trimmedAddress,
        label: label || null,
        balanceUsd,
        ...(metadata || {}),
      };

      const activityAction = metadata?.action === "sell" ? "crypto_sold" :
                            metadata?.action === "transfer" ? "crypto_transferred" : "wallet_added";
      mockDb.activityLog.create({
        userId,
        action: activityAction,
        entityType: "crypto_wallet",
        entityId: wallet.id,
        metadata: activityMetadata,
        createdAt: createdAt || new Date().toISOString(),
      });

      // Create unit snapshot for tracking
      const chainConfig = CHAIN_CONFIGS[chain];
      const assetName = isManualEntry ? (metadata?.cryptoName || label || "Manual Crypto") : (chainConfig?.name || chain);
      const assetSymbol = isManualEntry ? (metadata?.ticker || "USD") : (chainConfig?.symbol || chain.toUpperCase());
      mockDb.unitSnapshots.create({
        userId,
        assetId: wallet.id,
        assetType: "crypto",
        assetName,
        assetSymbol,
        date: (createdAt ? new Date(createdAt) : new Date()).toISOString().split("T")[0],
        units: actualBalance,
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
        ...(balanceFetchError && { warning: `Balance fetch failed: ${balanceFetchError}. You can sync the balance later.` }),
      });
    }

    // For manual entries with units, use units as balance
    const actualBalance = isManualEntry && metadata?.units ? metadata.units : balance;

    // Create wallet record
    const [wallet] = await db
      .insert(cryptoWallets)
      .values({
        userId,
        chain,
        address: trimmedAddress,
        label: label || null,
        balanceEncrypted: encryptNumber(actualBalance, userId),
        balanceUsdEncrypted: encryptNumber(balanceUsd, userId),
        metadata: metadata || null,
        visibility: "private",
        lastSynced: new Date(),
        createdAt: createdAt ? new Date(createdAt) : new Date(),
      })
      .returning();

    // Build activity metadata
    const activityMetadata = {
      chain,
      address: trimmedAddress,
      label: label || null,
      balanceUsd,
      ...(metadata || {}),
    };

    // Log activity for real database
    const dbActivityAction = metadata?.action === "sell" ? "crypto_sold" :
                             metadata?.action === "transfer" ? "crypto_transferred" : "wallet_added";
    await db.insert(activityLog).values({
      userId,
      action: dbActivityAction,
      entityType: "crypto_wallet",
      entityId: wallet.id,
      metadata: activityMetadata,
      createdAt: createdAt ? new Date(createdAt) : new Date(),
    });

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
      ...(balanceFetchError && { warning: `Balance fetch failed: ${balanceFetchError}. You can sync the balance later.` }),
    });
  } catch (error) {
    console.error("Failed to add wallet:", error);
    return NextResponse.json(
      { error: "Failed to add wallet" },
      { status: 500 }
    );
  }
}

// PATCH - Update a wallet (e.g., update purchase price, name, ticker, units)
export async function PATCH(request: NextRequest) {
  try {
    const { walletId, userId, label, balance, manualValue, metadata, createdAt } = await request.json();

    if (!walletId || !userId) {
      return NextResponse.json(
        { error: "Wallet ID and User ID are required" },
        { status: 400 }
      );
    }

    // Use mock DB if no DATABASE_URL
    if (useMockDb()) {
      const wallet = mockDb.cryptoWallets.findById(walletId);
      if (!wallet) {
        return NextResponse.json(
          { error: "Wallet not found" },
          { status: 404 }
        );
      }

      // Build update object
      const updates: Partial<typeof wallet> = {};
      if (label !== undefined) updates.label = label;
      if (balance !== undefined) updates.balance = balance;
      if (manualValue !== undefined) updates.balanceUsd = manualValue;
      if (metadata !== undefined) updates.metadata = { ...wallet.metadata, ...metadata };
      if (createdAt !== undefined) updates.createdAt = createdAt;

      // Update the wallet
      const updatedWallet = mockDb.cryptoWallets.update(walletId, updates);

      // Log activity
      mockDb.activityLog.create({
        userId,
        action: "wallet_updated",
        entityType: "crypto_wallet",
        entityId: walletId,
        metadata: {
          chain: wallet.chain,
          label,
          balanceUsd: manualValue,
          ticker: metadata?.ticker,
          units: metadata?.units,
          purchaseUnitPrice: metadata?.purchaseUnitPrice,
        },
      });

      return NextResponse.json({
        success: true,
        wallet: updatedWallet,
      });
    }

    // Get existing wallet
    const wallet = await db.query.cryptoWallets.findFirst({
      where: eq(cryptoWallets.id, walletId),
    });

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet not found" },
        { status: 404 }
      );
    }

    // Merge existing metadata with new metadata
    const existingMetadata = (wallet as { metadata?: Record<string, unknown> | null }).metadata || {};
    const updatedMetadata = metadata !== undefined ? { ...existingMetadata, ...metadata } : existingMetadata;

    // Build update object
    const updateData: Record<string, unknown> = {
      metadata: updatedMetadata,
    };
    if (label !== undefined) updateData.label = label;
    if (balance !== undefined) updateData.balanceEncrypted = encryptNumber(balance, userId);
    if (manualValue !== undefined) updateData.balanceUsdEncrypted = encryptNumber(manualValue, userId);
    if (createdAt !== undefined) updateData.createdAt = new Date(createdAt);

    // Update wallet
    await db
      .update(cryptoWallets)
      .set(updateData)
      .where(eq(cryptoWallets.id, walletId));

    // Log activity
    await db.insert(activityLog).values({
      userId,
      action: "wallet_updated",
      entityType: "crypto_wallet",
      entityId: walletId,
      metadata: {
        chain: wallet.chain,
        label,
        balanceUsd: manualValue,
        ticker: metadata?.ticker,
        units: metadata?.units,
        purchaseUnitPrice: metadata?.purchaseUnitPrice,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update wallet:", error);
    return NextResponse.json(
      { error: "Failed to update wallet" },
      { status: 500 }
    );
  }
}

// PUT - Sync wallet balance from blockchain
export async function PUT(request: NextRequest) {
  try {
    const { walletId, userId } = await request.json();

    if (!walletId || !userId) {
      return NextResponse.json(
        { error: "Wallet ID and User ID are required" },
        { status: 400 }
      );
    }

    // Use mock DB if no DATABASE_URL
    if (useMockDb()) {
      const wallet = mockDb.cryptoWallets.findById(walletId);
      if (!wallet) {
        return NextResponse.json(
          { error: "Wallet not found" },
          { status: 404 }
        );
      }

      // Can't sync manual entries
      if (wallet.chain === "manual") {
        return NextResponse.json(
          { error: "Cannot sync manual entries" },
          { status: 400 }
        );
      }

      // Fetch fresh balance
      const walletData = await fetchWalletData(wallet.chain, wallet.address);

      // Update the wallet
      const updatedWallet = mockDb.cryptoWallets.update(walletId, {
        balance: walletData.balance,
        balanceUsd: walletData.balanceUsd,
        lastSynced: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        wallet: {
          ...updatedWallet,
          balance: walletData.balance,
          balanceUsd: walletData.balanceUsd,
        },
      });
    }

    // Get existing wallet
    const wallet = await db.query.cryptoWallets.findFirst({
      where: eq(cryptoWallets.id, walletId),
    });

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet not found" },
        { status: 404 }
      );
    }

    // Can't sync manual entries
    if (wallet.chain === "manual") {
      return NextResponse.json(
        { error: "Cannot sync manual entries" },
        { status: 400 }
      );
    }

    // Fetch fresh balance
    const walletData = await fetchWalletData(wallet.chain, wallet.address);

    // Update wallet with new balance
    await db
      .update(cryptoWallets)
      .set({
        balanceEncrypted: encryptNumber(walletData.balance, userId),
        balanceUsdEncrypted: encryptNumber(walletData.balanceUsd, userId),
        lastSynced: new Date(),
      })
      .where(eq(cryptoWallets.id, walletId));

    return NextResponse.json({
      success: true,
      wallet: {
        id: wallet.id,
        chain: wallet.chain,
        address: wallet.address,
        label: wallet.label,
        balance: walletData.balance,
        balanceUsd: walletData.balanceUsd,
      },
    });
  } catch (error) {
    console.error("Failed to sync wallet:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync wallet" },
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

    // Get wallet info before deleting for activity log
    const wallet = await db.query.cryptoWallets.findFirst({
      where: eq(cryptoWallets.id, walletId),
    });

    await db
      .delete(cryptoWallets)
      .where(eq(cryptoWallets.id, walletId));

    // Log activity for real database
    if (wallet) {
      const balanceUsd = wallet.balanceUsdEncrypted
        ? decryptNumber(wallet.balanceUsdEncrypted, userId)
        : 0;
      await db.insert(activityLog).values({
        userId,
        action: "wallet_removed",
        entityType: "crypto_wallet",
        entityId: walletId,
        metadata: {
          chain: wallet.chain,
          address: wallet.address,
          label: wallet.label,
          balanceUsd,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete wallet:", error);
    return NextResponse.json(
      { error: "Failed to delete wallet" },
      { status: 500 }
    );
  }
}
