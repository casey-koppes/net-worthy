import { NextRequest, NextResponse } from "next/server";
import { mockDb, useMockDb } from "@/lib/db/mock-db";
import { db, manualAssets, activityLog } from "@/lib/db";
import { eq } from "drizzle-orm";
import { encryptNumber, decryptNumber } from "@/lib/encryption";

// GET - Fetch all manual assets for a user
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

    if (useMockDb()) {
      const assets = mockDb.manualAssets.findByUserId(userId);
      return NextResponse.json({ assets });
    }

    const assets = await db.query.manualAssets.findMany({
      where: eq(manualAssets.userId, userId),
    });

    // Decrypt values
    const decryptedAssets = assets.map((asset) => ({
      id: asset.id,
      category: asset.category,
      name: asset.name,
      description: asset.description,
      value: decryptNumber(asset.valueEncrypted, userId),
      purchasePrice: asset.purchasePriceEncrypted
        ? decryptNumber(asset.purchasePriceEncrypted, userId)
        : null,
      purchaseDate: asset.purchaseDate,
      isAsset: asset.isAsset,
      isHidden: asset.isHidden,
      visibility: asset.visibility,
      createdAt: asset.createdAt,
      metadata: asset.metadata,
    }));

    return NextResponse.json({ assets: decryptedAssets });
  } catch (error) {
    console.error("Failed to fetch manual assets:", error);
    return NextResponse.json(
      { error: "Failed to fetch assets" },
      { status: 500 }
    );
  }
}

// POST - Add a new manual asset
export async function POST(request: NextRequest) {
  try {
    const { userId, category, name, value, description, isAsset, purchasePrice, purchaseDate, metadata } =
      await request.json();

    if (!userId || !category || !name || value === undefined) {
      return NextResponse.json(
        { error: "User ID, category, name, and value are required" },
        { status: 400 }
      );
    }

    if (useMockDb()) {
      const asset = mockDb.manualAssets.create({
        userId,
        category,
        name,
        description,
        value: parseFloat(value),
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        isAsset: isAsset ?? true,
        metadata: metadata || null,
      });

      // Log activity
      mockDb.activityLog.create({
        userId,
        action: "asset_added",
        entityType: "manual_asset",
        entityId: asset.id,
        metadata: {
          name,
          category,
          value: parseFloat(value),
          isAsset: isAsset ?? true,
        },
      });

      return NextResponse.json({
        success: true,
        asset: {
          id: asset.id,
          category: asset.category,
          name: asset.name,
          value: asset.value,
          isAsset: asset.isAsset,
        },
      });
    }

    const [asset] = await db
      .insert(manualAssets)
      .values({
        userId,
        category,
        name,
        description: description || null,
        valueEncrypted: encryptNumber(value, userId),
        purchasePriceEncrypted: purchasePrice
          ? encryptNumber(purchasePrice, userId)
          : null,
        purchaseDate: purchaseDate || null,
        isAsset: isAsset ?? true,
        visibility: "private",
        metadata: metadata || null,
      })
      .returning();

    // Log activity for real database
    await db.insert(activityLog).values({
      userId,
      action: "asset_added",
      entityType: "manual_asset",
      entityId: asset.id,
      metadata: {
        name,
        category,
        value: parseFloat(value),
        isAsset: isAsset ?? true,
      },
    });

    return NextResponse.json({
      success: true,
      asset: {
        id: asset.id,
        category: asset.category,
        name: asset.name,
        value,
        isAsset: asset.isAsset,
      },
    });
  } catch (error) {
    console.error("Failed to add manual asset:", error);
    return NextResponse.json(
      { error: "Failed to add asset" },
      { status: 500 }
    );
  }
}

// PUT - Update a manual asset
export async function PUT(request: NextRequest) {
  try {
    const { assetId, userId, name, value, description, category, isAsset, metadata, createdAt } = await request.json();

    if (!assetId || !userId) {
      return NextResponse.json(
        { error: "Asset ID and User ID are required" },
        { status: 400 }
      );
    }

    if (useMockDb()) {
      // Get old value for comparison
      const oldAsset = mockDb.manualAssets.findById(assetId);
      const oldValue = oldAsset?.value ?? 0;

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (value !== undefined) updateData.value = parseFloat(value);
      if (category !== undefined) updateData.category = category;
      if (isAsset !== undefined) updateData.isAsset = isAsset;
      if (metadata !== undefined) updateData.metadata = metadata;
      if (createdAt !== undefined) updateData.createdAt = createdAt;

      const asset = mockDb.manualAssets.update(assetId, updateData);
      if (!asset) {
        return NextResponse.json({ error: "Asset not found" }, { status: 404 });
      }

      // Log activity with value change
      const newValue = value !== undefined ? parseFloat(value) : oldValue;
      const valueChange = newValue - oldValue;

      mockDb.activityLog.create({
        userId,
        action: "balance_changed",
        entityType: "manual_asset",
        entityId: assetId,
        metadata: {
          name: asset.name,
          category: asset.category,
          oldValue,
          newValue,
          valueChange,
          isAsset: asset.isAsset,
        },
      });

      return NextResponse.json({
        success: true,
        asset: {
          id: asset.id,
          name: asset.name,
          value: asset.value,
          category: asset.category,
          description: asset.description,
          isAsset: asset.isAsset,
        },
      });
    }

    // Get old asset data for activity log
    const oldAsset = await db.query.manualAssets.findFirst({
      where: eq(manualAssets.id, assetId),
    });
    const oldValue = oldAsset ? decryptNumber(oldAsset.valueEncrypted, userId) : 0;

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (value !== undefined) updateData.valueEncrypted = encryptNumber(value, userId);
    if (category !== undefined) updateData.category = category;
    if (isAsset !== undefined) updateData.isAsset = isAsset;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (createdAt !== undefined) updateData.createdAt = new Date(createdAt);

    const [asset] = await db
      .update(manualAssets)
      .set(updateData)
      .where(eq(manualAssets.id, assetId))
      .returning();

    // Log activity for real database
    const newValue = value !== undefined ? parseFloat(value) : oldValue;
    const valueChange = newValue - oldValue;

    await db.insert(activityLog).values({
      userId,
      action: "balance_changed",
      entityType: "manual_asset",
      entityId: assetId,
      metadata: {
        name: asset.name,
        category: asset.category,
        oldValue,
        newValue,
        valueChange,
        isAsset: asset.isAsset,
      },
    });

    return NextResponse.json({
      success: true,
      asset: {
        id: asset.id,
        name: asset.name,
        value: value ?? decryptNumber(asset.valueEncrypted, userId),
        category: asset.category,
        description: asset.description,
        isAsset: asset.isAsset,
      },
    });
  } catch (error) {
    console.error("Failed to update manual asset:", error);
    return NextResponse.json(
      { error: "Failed to update asset" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a manual asset
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get("assetId");
    const userId = searchParams.get("userId");

    if (!assetId) {
      return NextResponse.json(
        { error: "Asset ID is required" },
        { status: 400 }
      );
    }

    if (useMockDb()) {
      // Get asset info before deleting for activity log
      const asset = mockDb.manualAssets.findById(assetId);

      mockDb.manualAssets.delete(assetId);

      // Log activity
      if (asset) {
        mockDb.activityLog.create({
          userId: asset.userId,
          action: "asset_removed",
          entityType: "manual_asset",
          entityId: assetId,
          metadata: {
            name: asset.name,
            category: asset.category,
            value: asset.value,
            isAsset: asset.isAsset,
          },
        });
      }

      return NextResponse.json({ success: true });
    }

    // Get asset info before deleting for activity log
    const asset = await db.query.manualAssets.findFirst({
      where: eq(manualAssets.id, assetId),
    });

    await db.delete(manualAssets).where(eq(manualAssets.id, assetId));

    // Log activity for real database
    if (asset && userId) {
      const assetValue = decryptNumber(asset.valueEncrypted, userId);
      await db.insert(activityLog).values({
        userId,
        action: "asset_removed",
        entityType: "manual_asset",
        entityId: assetId,
        metadata: {
          name: asset.name,
          category: asset.category,
          value: assetValue,
          isAsset: asset.isAsset,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete manual asset:", error);
    return NextResponse.json(
      { error: "Failed to delete asset" },
      { status: 500 }
    );
  }
}
