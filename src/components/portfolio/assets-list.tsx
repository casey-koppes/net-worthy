"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePortfolioStore } from "@/lib/stores/portfolio-store";
import { getPeriodLabel } from "@/lib/utils/period-utils";
import { PerformanceBadge } from "./performance-badge";
import { CostBasisBadge } from "./cost-basis-badge";
import { EditAssetForm, type EditableAsset } from "./edit-asset-form";

interface Asset {
  id: string;
  name: string;
  description: string | null;
  value: number;
  purchasePrice: number | null;
  category: string;
  isAsset: boolean;
  createdAt?: string;
}


interface GroupedAsset {
  name: string;
  totalValue: number;
  totalCostBasis: number | null;
  items: Asset[];
  category: string;
}

const categoryLabels: Record<string, string> = {
  vehicle: "Vehicle",
  motorcycle: "Motorcycle",
  real_estate: "Real Estate",
  other: "Other",
};

const categoryIcons: Record<string, string> = {
  vehicle: "🚘",
  motorcycle: "🏍️",
  real_estate: "🏠",
  other: "📦",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getCategoryColor(category: string): string {
  switch (category) {
    case "vehicle":
      return "bg-orange-100 text-orange-800";
    case "motorcycle":
      return "bg-blue-100 text-blue-800";
    case "real_estate":
      return "bg-purple-100 text-purple-800";
    case "other":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString();
}


// Group assets by name
function groupAssets(assets: Asset[]): GroupedAsset[] {
  const groups = new Map<string, GroupedAsset>();

  for (const asset of assets) {
    const key = asset.name.toLowerCase();

    if (groups.has(key)) {
      const group = groups.get(key)!;
      group.totalValue += asset.value;
      if (asset.purchasePrice) {
        group.totalCostBasis = (group.totalCostBasis || 0) + asset.purchasePrice;
      }
      group.items.push(asset);
    } else {
      groups.set(key, {
        name: asset.name,
        totalValue: asset.value,
        totalCostBasis: asset.purchasePrice,
        items: [asset],
        category: asset.category,
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.totalValue - a.totalValue);
}

interface AssetsListProps {
  onAddAsset?: () => void;
  refreshTrigger?: number;
  onTotalChange?: (total: number) => void;
}

export function AssetsList({
  onAddAsset,
  refreshTrigger = 0,
  onTotalChange,
}: AssetsListProps) {
  const { dbUserId } = useAuthStore();
  const { performance, period } = usePortfolioStore();
  const periodLabel = getPeriodLabel(period.preset, period);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingAsset, setEditingAsset] = useState<EditableAsset | null>(null);
  const [localRefresh, setLocalRefresh] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Helper to get performance for an item
  const getItemPerformance = (itemId: string): { percent: number | null; dollarChange: number | null } => {
    const item = performance?.items.find((i) => i.id === itemId);
    if (!item) return { percent: null, dollarChange: null };
    const dollarChange = item.startValue !== null ? item.currentValue - item.startValue : null;
    return { percent: item.changePercent, dollarChange };
  };

  const handleEditSuccess = () => {
    setEditingAsset(null);
    setLocalRefresh((prev) => prev + 1);
  };

  const toggleGroup = (name: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedGroups(newExpanded);
  };

  const fetchAssets = useCallback(async () => {
    if (!dbUserId) return;

    try {
      const response = await fetch(`/api/portfolio/manual-assets?userId=${dbUserId}`);
      if (response.ok) {
        const data = await response.json();
        // Filter for vehicle, real_estate, and other categories only (not bank or investment)
        const assetItems = data.assets.filter(
          (asset: Asset) =>
            asset.isAsset &&
            ["vehicle", "motorcycle", "real_estate", "other"].includes(asset.category)
        );
        setAssets(assetItems);

        // Report total to parent
        const total = assetItems.reduce((sum: number, item: Asset) => sum + item.value, 0);
        onTotalChange?.(total);
      }
    } catch (error) {
      console.error("Failed to fetch assets:", error);
    } finally {
      setIsLoading(false);
    }
  }, [dbUserId, onTotalChange]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets, refreshTrigger, localRefresh]);

  const groupedAssets = groupAssets(assets);
  const total = assets.reduce((sum, item) => sum + item.value, 0);
  const uniqueCount = groupedAssets.length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assets</CardTitle>
          <CardDescription>Track your vehicles, real estate, and other assets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (assets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assets</CardTitle>
          <CardDescription>Track your vehicles, real estate, and other assets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground mb-4">
              No assets added yet.
            </p>
            <Button variant="outline" onClick={onAddAsset}>
              Add Asset
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Assets</CardTitle>
          <CardDescription>
            {uniqueCount} asset{uniqueCount !== 1 ? "s" : ""} - Total: {formatCurrency(total)}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onAddAsset}>
          Add Asset
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {groupedAssets.map((group) => {
            const isExpanded = expandedGroups.has(group.name.toLowerCase());
            const hasMultipleItems = group.items.length > 1;

            return (
              <div key={group.name} className="rounded-lg border overflow-hidden">
                {/* Main row - clickable to expand */}
                <div
                  className={`flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors ${isExpanded ? "bg-muted/30" : ""}`}
                  onClick={() => toggleGroup(group.name.toLowerCase())}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{categoryIcons[group.category] || "📦"}</span>
                    <div className="flex flex-col">
                      <span className="font-medium">{group.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {categoryLabels[group.category] || group.category}
                        {hasMultipleItems && (
                          <span className="ml-2 text-xs text-blue-600">
                            ({group.items.length} records)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge
                      variant="secondary"
                      className={getCategoryColor(group.category)}
                    >
                      {categoryLabels[group.category] || group.category}
                    </Badge>
                    <div className="text-right">
                      <span className="font-semibold">
                        {formatCurrency(group.totalValue)}
                      </span>
                      {group.totalCostBasis && (
                        <CostBasisBadge
                          currentValue={group.totalValue}
                          costBasis={group.totalCostBasis}
                          size="sm"
                        />
                      )}
                    </div>
                    <PerformanceBadge
                      value={getItemPerformance(group.items[0]?.id).percent}
                      dollarChange={getItemPerformance(group.items[0]?.id).dollarChange}
                      size="sm"
                    />
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t bg-muted/10 p-3 space-y-2">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-md border bg-background p-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingAsset(item);
                        }}
                        title="Double-click to edit"
                      >
                        <div className="flex flex-col">
                          <span className="text-muted-foreground">
                            {item.description || "Manual entry"}
                          </span>
                          {item.createdAt && (
                            <span className="text-xs text-muted-foreground">
                              Added {formatTimeAgo(item.createdAt)}
                            </span>
                          )}
                        </div>
                        <span className="font-medium">
                          {formatCurrency(item.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={!!editingAsset} onOpenChange={(open) => !open && setEditingAsset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Asset</DialogTitle>
            <DialogDescription>
              Update the details of this asset
            </DialogDescription>
          </DialogHeader>
          {editingAsset && (
            <EditAssetForm
              asset={editingAsset}
              onSuccess={handleEditSuccess}
              onCancel={() => setEditingAsset(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
