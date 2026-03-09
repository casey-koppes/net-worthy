"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";

type FilterType = "all" | "buy" | "sell" | "transfer" | "updated" | "deleted";

interface Activity {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

function getActivityIcon(action: string, metadata: Record<string, unknown> | null): string {
  const metadataAction = metadata?.action as string | undefined;

  // Check metadata action first for buy/sell/transfer
  if (metadataAction === "transfer") {
    return "→";
  }
  if (metadataAction === "sell") {
    return "−";
  }
  if (metadataAction === "buy") {
    return "+";
  }

  // For removed/deleted items
  if (action.includes("removed") || action.includes("disconnected")) {
    return "×";
  }

  // For added items (buy is default for added)
  if (action.includes("added") || action.includes("connected")) {
    return "+";
  }

  // For balance/settings changes (updated items)
  if (action === "balance_changed" || action === "settings_changed" || action.includes("updated")) {
    return "!";
  }

  // For follows
  if (action.includes("follow")) {
    return "👤";
  }

  // For login
  if (action === "login") {
    return "🔐";
  }

  // For portfolio sync
  if (action === "portfolio_synced") {
    return "🔄";
  }

  return "!";
}

function getActivityIconStyle(action: string, metadata: Record<string, unknown> | null): string {
  const isAdded = action.includes("added") || action.includes("connected");
  const isRemoved = action.includes("removed") || action.includes("disconnected");
  const isSell = metadata?.action === "sell";
  const isTransfer = metadata?.action === "transfer";

  if (isSell || isRemoved) {
    return "bg-red-100 text-red-800";
  }
  if (isTransfer) {
    return "bg-blue-100 text-blue-800";
  }
  if (isAdded) {
    return "bg-green-100 text-green-800";
  }
  if (action === "balance_changed" || action === "settings_changed") {
    return "bg-yellow-100 text-yellow-800";
  }
  return "bg-blue-100 text-blue-800";
}

function getItemName(action: string, metadata: Record<string, unknown> | null): string {
  const name = metadata?.name || metadata?.institutionName || "";
  const accountsCount = metadata?.accountsCount as number | undefined;

  switch (action) {
    case "account_added":
    case "account_removed":
      return name || "Account";
    case "plaid_connected":
    case "plaid_disconnected":
      return `${name || "Financial Institution"}${accountsCount ? ` (${accountsCount} accounts)` : ""}`;
    case "balance_changed":
      return name || "Account";
    case "wallet_added":
    case "wallet_removed":
      const chain = (metadata?.chain as string)?.toUpperCase() || "Crypto";
      return name ? `${name} (${chain})` : `${chain} Wallet`;
    case "asset_added":
    case "asset_removed":
      return name || "Asset";
    case "settings_changed":
      return "Privacy Settings";
    case "follow_added":
    case "follow_removed":
      return name || "User";
    case "login":
      return "Session";
    case "portfolio_synced":
      return "Portfolio";
    default:
      return name || "Item";
  }
}

function getActionLabel(action: string, metadata: Record<string, unknown> | null = null): string {
  const metadataAction = metadata?.action as string | undefined;

  // Check metadata action first for buy/sell/transfer
  if (metadataAction === "transfer") {
    return "Transferred to Cold Wallet";
  }
  if (metadataAction === "sell") {
    return "Sell";
  }
  if (metadataAction === "buy") {
    return "Buy";
  }

  switch (action) {
    case "account_added":
    case "plaid_connected":
    case "wallet_added":
    case "asset_added":
    case "follow_added":
      return "Buy";
    case "account_removed":
    case "plaid_disconnected":
    case "wallet_removed":
    case "asset_removed":
    case "follow_removed":
      return "Deleted";
    case "balance_changed":
    case "settings_changed":
      return "Updated";
    case "login":
      return "Login";
    case "portfolio_synced":
      return "Synced";
    default:
      return action.replace(/_/g, " ");
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getBlockchainExplorerUrl(chain: string, address: string, transactionId?: string): string | null {
  if (!chain || chain === "manual") return null;

  // If it's a transaction ID entry, link to the transaction
  if (transactionId || address?.startsWith("txn-")) {
    const txid = transactionId || address?.replace("txn-", "");
    switch (chain.toLowerCase()) {
      case "bitcoin":
        return `https://mempool.space/tx/${txid}`;
      case "ethereum":
        return `https://etherscan.io/tx/${txid}`;
      case "solana":
        return `https://solscan.io/tx/${txid}`;
      case "polygon":
        return `https://polygonscan.com/tx/${txid}`;
      default:
        return `https://mempool.space/tx/${txid}`;
    }
  }

  // Otherwise, link to the wallet address
  if (!address) return null;
  switch (chain.toLowerCase()) {
    case "bitcoin":
      return `https://mempool.space/address/${address}`;
    case "ethereum":
      return `https://etherscan.io/address/${address}`;
    case "solana":
      return `https://solscan.io/account/${address}`;
    case "polygon":
      return `https://polygonscan.com/address/${address}`;
    default:
      return null;
  }
}

function isCryptoActivity(action: string): boolean {
  return action.includes("wallet") || action.includes("crypto");
}

function getActivityFilterCategory(action: string, metadata: Record<string, unknown> | null): FilterType {
  const metadataAction = metadata?.action as string | undefined;

  // Check metadata action first
  if (metadataAction === "transfer") return "transfer";
  if (metadataAction === "sell") return "sell";
  if (metadataAction === "buy") return "buy";

  // Check action type
  if (action.includes("removed") || action.includes("disconnected")) return "deleted";
  if (action.includes("added") || action.includes("connected")) return "buy";
  if (action === "balance_changed" || action === "settings_changed" || action.includes("updated")) return "updated";

  return "all";
}

function getPrimaryValueDisplay(
  action: string,
  entityType: string | null,
  metadata: Record<string, unknown> | null
): { text: string; className: string } | null {
  if (!metadata) return null;

  const isAdded = action.includes("added") || action.includes("connected");
  const isRemoved = action.includes("removed") || action.includes("disconnected");
  const isSell = metadata.action === "sell";
  const isTransfer = metadata.action === "transfer";

  // For crypto - show units with ticker
  if (entityType === "crypto_wallet" || action.includes("wallet") || action.includes("crypto")) {
    const units = metadata.units as number | undefined;
    const ticker = (metadata.ticker as string)?.toUpperCase() || "units";

    if (units !== undefined && units > 0) {
      const prefix = isSell || isRemoved ? "-" : isTransfer ? "" : "+";
      const formattedUnits = units < 1 ? units.toFixed(8).replace(/\.?0+$/, "") : units.toFixed(4).replace(/\.?0+$/, "");
      return {
        text: `${prefix}${formattedUnits} ${ticker}`,
        className: isSell || isRemoved ? "text-red-600" : isTransfer ? "text-blue-600" : "text-green-600",
      };
    }
  }

  // For investments - show shares
  if (entityType === "investment" || metadata.shares !== undefined) {
    const shares = metadata.shares as number | undefined;
    const ticker = (metadata.ticker as string)?.toUpperCase() || "shares";

    if (shares !== undefined && shares > 0) {
      const prefix = isSell || isRemoved ? "-" : "+";
      const formattedShares = shares < 1 ? shares.toFixed(6).replace(/\.?0+$/, "") : shares.toFixed(2).replace(/\.?0+$/, "");
      return {
        text: `${prefix}${formattedShares} ${ticker}`,
        className: isSell || isRemoved ? "text-red-600" : "text-green-600",
      };
    }
  }

  // For manual assets/liabilities - show the value
  if (entityType === "manual_asset" || metadata.category !== undefined) {
    const value = metadata.value as number | undefined;
    const isAsset = metadata.isAsset as boolean | undefined;

    if (value !== undefined) {
      // For balance_changed, show the new value
      if (action === "balance_changed" && metadata.newValue !== undefined) {
        return {
          text: formatCurrency(metadata.newValue as number),
          className: "text-gray-600",
        };
      }

      const prefix = isRemoved ? "-" : isAdded ? "+" : "";
      return {
        text: `${prefix}${formatCurrency(value)}`,
        className: isRemoved ? "text-red-600" : isAsset === false ? "text-red-600" : "text-green-600",
      };
    }
  }

  // Fallback to USD value if available
  if (metadata.balanceUsd !== undefined) {
    const value = metadata.balanceUsd as number;
    const prefix = isRemoved || isSell ? "-" : "+";
    return {
      text: `${prefix}${formatCurrency(value)}`,
      className: isRemoved || isSell ? "text-red-600" : "text-green-600",
    };
  }

  return null;
}

export default function ActivityPage() {
  const { dbUserId } = useAuthStore();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  useEffect(() => {
    if (dbUserId) {
      fetchActivities();
    }
  }, [dbUserId]);

  async function fetchActivities() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/activity?userId=${dbUserId}&limit=100`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error("Failed to fetch activities:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // Filter activities based on active filter
  const filteredActivities = activeFilter === "all"
    ? activities
    : activities.filter((activity) => {
        const category = getActivityFilterCategory(
          activity.action,
          activity.metadata as Record<string, unknown> | null
        );
        return category === activeFilter;
      });

  // Group activities by date
  const groupedActivities = filteredActivities.reduce(
    (groups, activity) => {
      const date = new Date(activity.createdAt).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(activity);
      return groups;
    },
    {} as Record<string, Activity[]>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Activity</h1>
        <p className="text-muted-foreground">
          Track changes to your portfolio over time
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            A log of all changes to your connected accounts and assets
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2 mb-6">
            {(["all", "buy", "sell", "transfer", "updated", "deleted"] as FilterType[]).map((filter) => (
              <Button
                key={filter}
                variant={activeFilter === filter ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter(filter)}
                className="capitalize"
              >
                {filter}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="h-10 w-10 rounded-full bg-muted" />
                  <div className="flex-1">
                    <div className="h-4 w-48 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {activities.length === 0 ? (
                <>
                  <p>No activity yet.</p>
                  <p className="text-sm mt-2">
                    Activity will appear here as you connect accounts and make changes.
                  </p>
                </>
              ) : (
                <>
                  <p>No {activeFilter} activities found.</p>
                  <p className="text-sm mt-2">
                    Try selecting a different filter.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedActivities).map(([date, dateActivities]) => (
                <div key={date}>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">
                    {date === new Date().toDateString() ? "Today" : date}
                  </h4>
                  <div className="space-y-2">
                    {dateActivities.map((activity) => {
                      const primaryValue = getPrimaryValueDisplay(
                        activity.action,
                        activity.entityType,
                        activity.metadata as Record<string, unknown>
                      );
                      const itemName = getItemName(
                        activity.action,
                        activity.metadata as Record<string, unknown>
                      );
                      const metadata = activity.metadata as Record<string, unknown> | null;
                      const actionLabel = getActionLabel(activity.action, metadata);
                      const isCrypto = isCryptoActivity(activity.action);
                      const chain = metadata?.chain as string | undefined;
                      const address = metadata?.address as string | undefined;
                      const transactionId = metadata?.transactionId as string | undefined;
                      const explorerUrl = isCrypto && chain ? getBlockchainExplorerUrl(chain, address || "", transactionId) : null;
                      const isAdded = activity.action.includes("added") || activity.action.includes("connected");
                      const isRemoved = activity.action.includes("removed") || activity.action.includes("disconnected");

                      const iconText = getActivityIcon(activity.action, metadata);
                      const iconStyle = getActivityIconStyle(activity.action, metadata);

                      return (
                        <div key={activity.id} className="flex items-center gap-3">
                          {/* Icon badge */}
                          <Badge
                            className={`shrink-0 h-10 w-10 flex items-center justify-center text-lg font-semibold rounded-full ${iconStyle}`}
                          >
                            {iconText}
                          </Badge>
                          {/* Activity card */}
                          <div className="group flex-1 flex items-center justify-between rounded-md border bg-background p-2 text-sm">
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col gap-1">
                                <span className="font-medium text-xs">{itemName}</span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <span>{actionLabel} · {formatTimeAgo(activity.createdAt)}</span>
                                  {isCrypto && chain && chain !== "manual" && (
                                    <>
                                      <img
                                        src="https://cdn-icons-png.flaticon.com/512/7641/7641727.png"
                                        alt="Verified"
                                        className="w-3 h-3 ml-1"
                                        title="Verified on-chain"
                                      />
                                      {explorerUrl && (
                                        <a
                                          href={explorerUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="opacity-0 group-hover:opacity-100 hover:text-blue-600 transition-all"
                                          title="View on blockchain"
                                        >
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                      )}
                                    </>
                                  )}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge
                                variant="secondary"
                                className={`text-xs ${
                                  isAdded ? "bg-green-100 text-green-700 hover:bg-green-100" :
                                  isRemoved ? "bg-red-100 text-red-700 hover:bg-red-100" :
                                  "bg-blue-100 text-blue-700 hover:bg-blue-100"
                                }`}
                              >
                                {actionLabel}
                              </Badge>
                              {primaryValue && (
                                <span className={`font-medium text-xs ${primaryValue.className}`}>
                                  {primaryValue.text}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
