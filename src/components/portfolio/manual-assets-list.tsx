"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, PieChart, X } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePortfolioStore } from "@/lib/stores/portfolio-store";
import { getPeriodLabel } from "@/lib/utils/period-utils";
import { PerformanceBadge } from "./performance-badge";
import { CostBasisBadge } from "./cost-basis-badge";
import { EditAssetForm, type EditableAsset } from "./edit-asset-form";

interface ManualAsset {
  id: string;
  category: string;
  name: string;
  description: string | null;
  value: number;
  purchasePrice: number | null;
  isAsset: boolean;
  visibility: string;
  createdAt: string;
}


interface GroupedAsset {
  name: string;
  totalValue: number;
  totalCostBasis: number | null;
  items: ManualAsset[];
  category: string;
}

interface ManualAssetsListProps {
  type: "assets" | "liabilities";
  onAddItem: () => void;
  refreshTrigger?: number;
  onTotalChange?: (total: number) => void;
}

const categoryLabels: Record<string, string> = {
  bank: "Bank Account",
  investment: "Investment",
  real_estate: "Real Estate",
  vehicle: "Vehicle",
  other: "Other",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
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
function groupAssets(assets: ManualAsset[]): GroupedAsset[] {
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

  // Sort items within each group by createdAt (newest first)
  for (const group of groups.values()) {
    group.items.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA; // Newest first
    });
  }

  return Array.from(groups.values()).sort((a, b) => b.totalValue - a.totalValue);
}

export function ManualAssetsList({
  type,
  onAddItem,
  refreshTrigger = 0,
  onTotalChange,
}: ManualAssetsListProps) {
  const [items, setItems] = useState<ManualAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { dbUserId } = useAuthStore();
  const { performance, period } = usePortfolioStore();
  const periodLabel = getPeriodLabel(period.preset, period);
  const [editingAsset, setEditingAsset] = useState<EditableAsset | null>(null);
  const [localRefresh, setLocalRefresh] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showAllocation, setShowAllocation] = useState(false);

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
        const filtered = data.assets.filter((asset: ManualAsset) =>
          type === "assets" ? asset.isAsset : !asset.isAsset
        );
        setItems(filtered);

        // Report total to parent
        const total = filtered.reduce((sum: number, item: ManualAsset) => sum + item.value, 0);
        onTotalChange?.(total);
      }
    } catch (error) {
      console.error("Failed to fetch manual assets:", error);
    } finally {
      setIsLoading(false);
    }
  }, [dbUserId, type, onTotalChange]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets, refreshTrigger, localRefresh]);

  const groupedItems = groupAssets(items);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const uniqueCount = groupedItems.length;

  const title = type === "assets" ? "Assets" : "Liabilities";
  const emptyMessage = type === "assets"
    ? "No assets added yet. Add real estate, vehicles, or other valuable items."
    : "No liabilities added yet. Add loans, mortgages, or other debts.";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {uniqueCount} {type === "assets" ? "asset" : "liability"}{uniqueCount !== 1 ? "s" : ""} - Total: {formatCurrency(total)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onAddItem}>
            Add {type === "assets" ? "Asset" : "Liability"}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            onClick={() => setShowAllocation(!showAllocation)}
            title="View allocation report"
          >
            <PieChart className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className={`flex gap-4 ${showAllocation ? "flex-col lg:flex-row" : ""}`}>
          {/* Main Content */}
          <div className={showAllocation ? "flex-1 lg:w-2/3" : "w-full"}>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div className="space-y-2">
            {groupedItems.map((group) => {
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
                      {type === "liabilities" && (
                        <span className="text-2xl">💸</span>
                      )}
                      <div>
                        <p className="font-medium">{group.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {categoryLabels[group.category] || group.category}
                        {hasMultipleItems && (
                          <span className="ml-2 text-xs text-blue-600">
                            ({group.items.length} records)
                          </span>
                        )}
                      </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`font-semibold ${type === "liabilities" ? "text-red-500" : "text-green-500"}`}>
                          {type === "liabilities" ? "-" : ""}{formatCurrency(group.totalValue)}
                        </p>
                        {group.totalCostBasis && type === "assets" && (
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
                            <span className="text-xs text-muted-foreground">
                              Added {formatTimeAgo(item.createdAt)}
                            </span>
                          </div>
                          <span className={`font-medium ${type === "liabilities" ? "text-red-500" : "text-green-500"}`}>
                            {type === "liabilities" ? "-" : ""}{formatCurrency(item.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
          </div>

          {/* Allocation Panel - Pie Chart (slides out to the right) */}
          {showAllocation && (
            <div className="lg:w-1/3 border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold">{title} Allocation</h4>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowAllocation(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="h-[250px] w-full">
                <svg viewBox="0 0 300 250" className="w-full h-full">
                  {(() => {
                    const centerX = 150;
                    const centerY = 125;
                    const radius = 90;

                    // Generate colors based on index
                    const getColor = (index: number) => {
                      const hues = type === "assets"
                        ? [120, 150, 180, 90, 60, 200, 30, 240] // Green-ish for assets
                        : [0, 30, 350, 15, 340, 45, 320, 60]; // Red-ish for liabilities
                      const hue = hues[index % hues.length];
                      const lightness = 50 + (index % 3) * 10;
                      return `hsl(${hue}, 70%, ${lightness}%)`;
                    };

                    // Pre-calculate all slices with their angles
                    const slices: { group: typeof groupedItems[0]; startAngle: number; endAngle: number; index: number }[] = [];
                    let currentAngle = -Math.PI / 2; // Start from top

                    groupedItems.forEach((group, index) => {
                      const percentage = total > 0 ? group.totalValue / total : 0;
                      if (percentage > 0) {
                        const angle = percentage * Math.PI * 2;
                        slices.push({
                          group,
                          startAngle: currentAngle,
                          endAngle: currentAngle + angle,
                          index,
                        });
                        currentAngle += angle;
                      }
                    });

                    // Handle single item (full circle)
                    if (slices.length === 1) {
                      return (
                        <circle
                          cx={centerX}
                          cy={centerY}
                          r={radius}
                          fill={getColor(slices[0].index)}
                          stroke="white"
                          strokeWidth="2"
                        />
                      );
                    }

                    return slices.map((slice) => {
                      const { group, startAngle, endAngle, index } = slice;
                      const angle = endAngle - startAngle;

                      // Calculate arc path points
                      const x1 = centerX + radius * Math.cos(startAngle);
                      const y1 = centerY + radius * Math.sin(startAngle);
                      const x2 = centerX + radius * Math.cos(endAngle);
                      const y2 = centerY + radius * Math.sin(endAngle);
                      const largeArc = angle > Math.PI ? 1 : 0;

                      return (
                        <path
                          key={group.name}
                          d={`M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                          fill={getColor(index)}
                          stroke="white"
                          strokeWidth="2"
                        />
                      );
                    });
                  })()}
                </svg>
              </div>
              <div className="space-y-2 mt-2 max-h-[200px] overflow-y-auto">
                {groupedItems.map((group, index) => {
                  const percentage = total > 0 ? (group.totalValue / total) * 100 : 0;
                  const hues = type === "assets"
                    ? [120, 150, 180, 90, 60, 200, 30, 240]
                    : [0, 30, 350, 15, 340, 45, 320, 60];
                  const hue = hues[index % hues.length];
                  const lightness = 50 + (index % 3) * 10;
                  const color = `hsl(${hue}, 70%, ${lightness}%)`;

                  return (
                    <div key={group.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate">{group.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-muted-foreground text-xs">
                          {percentage.toFixed(1)}%
                        </span>
                        <span className="font-medium text-xs">
                          {formatCurrency(group.totalValue)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={!!editingAsset} onOpenChange={(open) => !open && setEditingAsset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {type === "liabilities" ? "Liability" : "Asset"}</DialogTitle>
            <DialogDescription>
              Update the details of this {type === "liabilities" ? "liability" : "asset"}
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
