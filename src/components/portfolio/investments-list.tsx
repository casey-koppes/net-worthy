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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePortfolioStore } from "@/lib/stores/portfolio-store";
import { getPeriodLabel } from "@/lib/utils/period-utils";
import { PerformanceBadge } from "./performance-badge";
import { CostBasisBadge } from "./cost-basis-badge";
import { EditAssetForm, type EditableAsset } from "./edit-asset-form";

interface Investment {
  id: string;
  name: string;
  description: string | null;
  value: number;
  purchasePrice: number | null;
  category: string;
  isAsset: boolean;
  createdAt?: string;
}

interface ActivityItem {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface GroupedInvestment {
  name: string;
  totalValue: number;
  totalShares: number;
  totalCostBasis: number | null;
  items: Investment[];
  ticker: string | null;
}

const categoryLabels: Record<string, string> = {
  stock: "Stock",
  "401k": "401(k)",
  roth: "Roth IRA",
  ira: "Traditional IRA",
  etf: "ETF",
  mutual_fund: "Mutual Fund",
  other: "Other",
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
    case "stock":
      return "bg-green-100 text-green-800";
    case "401k":
      return "bg-blue-100 text-blue-800";
    case "roth":
      return "bg-purple-100 text-purple-800";
    case "ira":
      return "bg-indigo-100 text-indigo-800";
    case "etf":
      return "bg-orange-100 text-orange-800";
    case "mutual_fund":
      return "bg-teal-100 text-teal-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

// Extract ticker symbol and shares from description (e.g., "GLD - 100 shares")
function parseDescription(description: string | null): { ticker: string | null; shares: number } {
  if (!description) return { ticker: null, shares: 0 };

  const match = description.match(/^([A-Z]+)\s*-\s*(\d+(?:\.\d+)?)\s*shares?/i);
  if (match) {
    return { ticker: match[1].toUpperCase(), shares: parseFloat(match[2]) };
  }
  return { ticker: null, shares: 0 };
}

// Extract investment type from description
function getInvestmentType(description: string | null): string | null {
  if (!description) return null;
  for (const [key, label] of Object.entries(categoryLabels)) {
    if (description.toLowerCase().includes(key) || description.includes(label)) {
      return key;
    }
  }
  return null;
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

function formatAction(action: string, metadata: Record<string, unknown> | null): string {
  const value = metadata?.value as number | undefined;
  const valueChange = metadata?.valueChange as number | undefined;

  switch (action) {
    case "asset_added":
      return `Added${value ? ` (${formatCurrency(value)})` : ""}`;
    case "asset_removed":
      return `Removed${value ? ` (${formatCurrency(value)})` : ""}`;
    case "balance_changed":
      if (valueChange !== undefined) {
        const sign = valueChange >= 0 ? "+" : "";
        return `Updated (${sign}${formatCurrency(valueChange)})`;
      }
      return "Updated";
    default:
      return action.replace(/_/g, " ");
  }
}

// Group investments by name
function groupInvestments(investments: Investment[]): GroupedInvestment[] {
  const groups = new Map<string, GroupedInvestment>();

  for (const investment of investments) {
    const key = investment.name.toLowerCase();
    const { ticker, shares } = parseDescription(investment.description);

    if (groups.has(key)) {
      const group = groups.get(key)!;
      group.totalValue += investment.value;
      group.totalShares += shares;
      if (investment.purchasePrice) {
        group.totalCostBasis = (group.totalCostBasis || 0) + investment.purchasePrice;
      }
      group.items.push(investment);
      if (ticker && !group.ticker) {
        group.ticker = ticker;
      }
    } else {
      groups.set(key, {
        name: investment.name,
        totalValue: investment.value,
        totalShares: shares,
        totalCostBasis: investment.purchasePrice,
        items: [investment],
        ticker,
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.totalValue - a.totalValue);
}

interface InvestmentsListProps {
  onAddInvestment?: () => void;
  onConnectBrokerage?: () => void;
  refreshTrigger?: number;
  onTotalChange?: (total: number) => void;
}

export function InvestmentsList({
  onAddInvestment,
  onConnectBrokerage,
  refreshTrigger = 0,
  onTotalChange,
}: InvestmentsListProps) {
  const { dbUserId } = useAuthStore();
  const { performance, period } = usePortfolioStore();
  const periodLabel = getPeriodLabel(period.preset, period);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingAsset, setEditingAsset] = useState<EditableAsset | null>(null);
  const [localRefresh, setLocalRefresh] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [groupActivities, setGroupActivities] = useState<Map<string, ActivityItem[]>>(new Map());

  // Helper to get performance for an item
  const getItemPerformance = (itemId: string): number | null => {
    return performance?.items.find((i) => i.id === itemId)?.changePercent ?? null;
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
      // Fetch activities for this group if not already loaded
      fetchGroupActivities(name);
    }
    setExpandedGroups(newExpanded);
  };

  const fetchGroupActivities = async (name: string) => {
    if (!dbUserId || groupActivities.has(name)) return;

    try {
      const res = await fetch(`/api/activity?userId=${dbUserId}&limit=100`);
      if (res.ok) {
        const data = await res.json();
        const activities = (data.activities || []).filter(
          (a: ActivityItem) =>
            a.entityType === "manual_asset" &&
            (a.metadata?.name as string)?.toLowerCase() === name.toLowerCase()
        );
        setGroupActivities((prev) => new Map(prev).set(name, activities));
      }
    } catch (error) {
      console.error("Failed to fetch activities:", error);
    }
  };

  const fetchInvestments = useCallback(async () => {
    if (!dbUserId) return;

    try {
      const response = await fetch(`/api/portfolio/manual-assets?userId=${dbUserId}`);
      if (response.ok) {
        const data = await response.json();
        // Filter for investment category only
        const investmentItems = data.assets.filter(
          (asset: Investment & { isAsset: boolean }) => asset.category === "investment"
        );
        setInvestments(investmentItems);

        // Report total to parent
        const total = investmentItems
          .filter((i: Investment) => i.isAsset)
          .reduce((sum: number, item: Investment) => sum + item.value, 0);
        onTotalChange?.(total);
      }
    } catch (error) {
      console.error("Failed to fetch investments:", error);
    } finally {
      setIsLoading(false);
    }
  }, [dbUserId, onTotalChange]);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments, refreshTrigger, localRefresh]);

  const groupedInvestments = groupInvestments(investments);
  const total = investments
    .filter((i) => i.isAsset)
    .reduce((sum, item) => sum + item.value, 0);

  // Count unique groups for display
  const uniqueCount = groupedInvestments.length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Investments</CardTitle>
          <CardDescription>Track your investment portfolio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (investments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Investments</CardTitle>
          <CardDescription>Track your investment portfolio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground mb-4">
              No investments added yet.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onAddInvestment}>
                Add Investment
              </Button>
              <Button onClick={onConnectBrokerage}>Connect via Plaid</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Investments</CardTitle>
          <CardDescription>
            {uniqueCount} investment{uniqueCount !== 1 ? "s" : ""} - Total: {formatCurrency(total)}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onAddInvestment}>
            Add Investment
          </Button>
          <Button variant="outline" size="sm" onClick={onConnectBrokerage}>
            Connect via Plaid
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {groupedInvestments.map((group) => {
            const isExpanded = expandedGroups.has(group.name.toLowerCase());
            const activities = groupActivities.get(group.name.toLowerCase()) || [];
            const hasMultipleItems = group.items.length > 1;

            return (
              <div key={group.name} className="rounded-lg border overflow-hidden">
                {/* Main row - clickable to expand */}
                <div
                  className={`flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors ${isExpanded ? "bg-muted/30" : ""}`}
                  onClick={() => toggleGroup(group.name.toLowerCase())}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="font-medium">{group.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {group.ticker || ""}{group.ticker && group.totalShares > 0 ? " - " : ""}
                        {group.totalShares > 0 ? `${group.totalShares} shares` : ""}
                        {hasMultipleItems && (
                          <span className="ml-2 text-xs text-blue-600">
                            ({group.items.length} records)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="font-semibold text-green-600">
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
                      value={getItemPerformance(group.items[0]?.id)}
                      size="sm"
                    />
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded content with tabs */}
                {isExpanded && (
                  <div className="border-t bg-muted/10 p-3">
                    <Tabs defaultValue="records" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 h-8">
                        <TabsTrigger value="records" className="text-xs">
                          Records ({group.items.length})
                        </TabsTrigger>
                        <TabsTrigger value="history" className="text-xs">
                          History ({activities.length})
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="records" className="mt-3 space-y-2">
                        {group.items.map((item) => {
                          const { shares } = parseDescription(item.description);
                          return (
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
                                  {shares > 0 ? `${shares} shares` : item.description || "Manual entry"}
                                </span>
                                {item.createdAt && (
                                  <span className="text-xs text-muted-foreground">
                                    Added {formatTimeAgo(item.createdAt)}
                                  </span>
                                )}
                              </div>
                              <span className="font-medium text-green-600">
                                {formatCurrency(item.value)}
                              </span>
                            </div>
                          );
                        })}
                      </TabsContent>

                      <TabsContent value="history" className="mt-3 space-y-2">
                        {activities.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No activity history yet
                          </p>
                        ) : (
                          activities.map((activity) => (
                            <div
                              key={activity.id}
                              className="flex items-center justify-between rounded-md border bg-background p-2 text-sm"
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {formatAction(activity.action, activity.metadata)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatTimeAgo(activity.createdAt)}
                                </span>
                              </div>
                              {activity.metadata?.valueChange !== undefined && (
                                <span
                                  className={`font-medium ${
                                    (activity.metadata.valueChange as number) >= 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {(activity.metadata.valueChange as number) >= 0 ? "+" : ""}
                                  {formatCurrency(activity.metadata.valueChange as number)}
                                </span>
                              )}
                            </div>
                          ))
                        )}
                      </TabsContent>
                    </Tabs>
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
            <DialogTitle>Edit Investment</DialogTitle>
            <DialogDescription>
              Update the details of this investment
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
