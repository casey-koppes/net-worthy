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
import { EditCryptoWalletForm, type EditableCryptoWallet } from "./edit-crypto-wallet-form";

interface CryptoWallet {
  id: string;
  chain: string;
  address: string;
  label: string | null;
  balance: number;
  balanceUsd: number;
  isHidden?: boolean;
  visibility?: string;
  lastSynced?: string;
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

interface GroupedWallets {
  chain: string;
  totalBalance: number;
  totalBalanceUsd: number;
  wallets: CryptoWallet[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatCryptoBalance(amount: number, decimals: number = 8): string {
  return amount.toFixed(Math.min(decimals, 8));
}

function getChainLogo(chain: string): string | null {
  switch (chain.toLowerCase()) {
    case "bitcoin":
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Bitcoin.svg/250px-Bitcoin.svg.png";
    case "ethereum":
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Ethereum_logo_2014.svg/200px-Ethereum_logo_2014.svg.png";
    case "solana":
      return "https://upload.wikimedia.org/wikipedia/en/b/b9/Solana_logo.png";
    case "polygon":
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Polygon_Blockchain_Matic_Logo.svg/200px-Polygon_Blockchain_Matic_Logo.svg.png";
    default:
      return null;
  }
}

function getChainColor(chain: string): string {
  switch (chain.toLowerCase()) {
    case "bitcoin":
      return "bg-orange-100 text-orange-800";
    case "ethereum":
      return "bg-blue-100 text-blue-800";
    case "solana":
      return "bg-purple-100 text-purple-800";
    case "polygon":
      return "bg-violet-100 text-violet-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getChainSymbol(chain: string): string {
  switch (chain.toLowerCase()) {
    case "bitcoin":
      return "BTC";
    case "ethereum":
      return "ETH";
    case "solana":
      return "SOL";
    case "polygon":
      return "MATIC";
    default:
      return chain.toUpperCase();
  }
}

function getChainName(chain: string): string {
  switch (chain.toLowerCase()) {
    case "bitcoin":
      return "Bitcoin";
    case "ethereum":
      return "Ethereum";
    case "solana":
      return "Solana";
    case "polygon":
      return "Polygon";
    default:
      return chain;
  }
}

function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
  const balanceUsd = metadata?.balanceUsd as number | undefined;

  switch (action) {
    case "wallet_added":
      return `Added${balanceUsd ? ` (${formatCurrency(balanceUsd)})` : ""}`;
    case "wallet_removed":
      return `Removed${balanceUsd ? ` (${formatCurrency(balanceUsd)})` : ""}`;
    default:
      return action.replace(/_/g, " ");
  }
}

// Group wallets by chain
function groupWallets(wallets: CryptoWallet[]): GroupedWallets[] {
  const groups = new Map<string, GroupedWallets>();

  for (const wallet of wallets) {
    const key = wallet.chain.toLowerCase();

    if (groups.has(key)) {
      const group = groups.get(key)!;
      group.totalBalance += wallet.balance;
      group.totalBalanceUsd += wallet.balanceUsd;
      group.wallets.push(wallet);
    } else {
      groups.set(key, {
        chain: wallet.chain,
        totalBalance: wallet.balance,
        totalBalanceUsd: wallet.balanceUsd,
        wallets: [wallet],
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.totalBalanceUsd - a.totalBalanceUsd);
}

interface CryptoWalletsListProps {
  onAddWallet?: () => void;
  refreshTrigger?: number;
  onTotalChange?: (total: number) => void;
}

export function CryptoWalletsList({
  onAddWallet,
  refreshTrigger = 0,
  onTotalChange,
}: CryptoWalletsListProps) {
  const { dbUserId } = useAuthStore();
  const { performance, period } = usePortfolioStore();
  const periodLabel = getPeriodLabel(period.preset, period);
  const [wallets, setWallets] = useState<CryptoWallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingWallet, setEditingWallet] = useState<EditableCryptoWallet | null>(null);
  const [localRefresh, setLocalRefresh] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [groupActivities, setGroupActivities] = useState<Map<string, ActivityItem[]>>(new Map());

  // Helper to get performance for an item
  const getItemPerformance = (itemId: string): number | null => {
    return performance?.items.find((i) => i.id === itemId)?.changePercent ?? null;
  };

  const handleEditSuccess = () => {
    setEditingWallet(null);
    setLocalRefresh((prev) => prev + 1);
  };

  const toggleGroup = (chain: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(chain)) {
      newExpanded.delete(chain);
    } else {
      newExpanded.add(chain);
      // Fetch activities for this chain if not already loaded
      fetchChainActivities(chain);
    }
    setExpandedGroups(newExpanded);
  };

  const fetchChainActivities = async (chain: string) => {
    if (!dbUserId || groupActivities.has(chain)) return;

    try {
      const res = await fetch(`/api/activity?userId=${dbUserId}&limit=100`);
      if (res.ok) {
        const data = await res.json();
        const activities = (data.activities || []).filter(
          (a: ActivityItem) =>
            a.entityType === "crypto_wallet" &&
            (a.metadata?.chain as string)?.toLowerCase() === chain.toLowerCase()
        );
        setGroupActivities((prev) => new Map(prev).set(chain, activities));
      }
    } catch (error) {
      console.error("Failed to fetch activities:", error);
    }
  };

  const fetchWallets = useCallback(async () => {
    if (!dbUserId) return;

    try {
      const response = await fetch(`/api/crypto/wallets?userId=${dbUserId}`);
      if (response.ok) {
        const data = await response.json();
        const visibleWallets = (data.wallets || []).filter(
          (w: CryptoWallet) => !w.isHidden
        );
        setWallets(visibleWallets);

        // Report total to parent
        const total = visibleWallets.reduce(
          (sum: number, w: CryptoWallet) => sum + (w.balanceUsd || 0),
          0
        );
        onTotalChange?.(total);
      }
    } catch (error) {
      console.error("Failed to fetch crypto wallets:", error);
    } finally {
      setIsLoading(false);
    }
  }, [dbUserId, onTotalChange]);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets, refreshTrigger, localRefresh]);

  const groupedWallets = groupWallets(wallets);
  const totalValue = wallets.reduce((sum, wallet) => sum + (wallet.balanceUsd || 0), 0);
  const uniqueCount = groupedWallets.length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Crypto Wallets</CardTitle>
          <CardDescription>
            Track your cryptocurrency holdings by adding wallet addresses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (wallets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Crypto Wallets</CardTitle>
          <CardDescription>
            Track your cryptocurrency holdings by adding wallet addresses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground mb-4">
              No wallets added yet. Add a public wallet address to track your
              crypto.
            </p>
            <Button onClick={onAddWallet}>Add Wallet</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Crypto Wallets</CardTitle>
          <CardDescription>
            {uniqueCount} chain{uniqueCount !== 1 ? "s" : ""} ({wallets.length} wallet{wallets.length !== 1 ? "s" : ""}) -{" "}
            {formatCurrency(totalValue)} total
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onAddWallet}>
          Add Wallet
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {groupedWallets.map((group) => {
            const isExpanded = expandedGroups.has(group.chain.toLowerCase());
            const activities = groupActivities.get(group.chain.toLowerCase()) || [];
            const hasMultipleWallets = group.wallets.length > 1;

            return (
              <div key={group.chain} className="rounded-lg border overflow-hidden">
                {/* Main row - clickable to expand */}
                <div
                  className={`flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors ${isExpanded ? "bg-muted/30" : ""}`}
                  onClick={() => toggleGroup(group.chain.toLowerCase())}
                >
                  <div className="flex items-center gap-3">
                    {getChainLogo(group.chain) ? (
                      <img
                        src={getChainLogo(group.chain)!}
                        alt={getChainSymbol(group.chain)}
                        className="w-8 h-8 object-contain"
                      />
                    ) : (
                      <Badge className={getChainColor(group.chain)}>
                        {getChainSymbol(group.chain)}
                      </Badge>
                    )}
                    <div className="flex flex-col">
                      <span className="font-medium">{getChainName(group.chain)}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatCryptoBalance(group.totalBalance)} {getChainSymbol(group.chain)}
                        {hasMultipleWallets && (
                          <span className="ml-2 text-xs text-blue-600">
                            ({group.wallets.length} wallets)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-green-600">
                      {formatCurrency(group.totalBalanceUsd)}
                    </span>
                    <PerformanceBadge
                      value={getItemPerformance(group.wallets[0]?.id)}
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
                    <Tabs defaultValue="wallets" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 h-8">
                        <TabsTrigger value="wallets" className="text-xs">
                          Wallets ({group.wallets.length})
                        </TabsTrigger>
                        <TabsTrigger value="history" className="text-xs">
                          History ({activities.length})
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="wallets" className="mt-3 space-y-2">
                        {group.wallets.map((wallet) => (
                          <div
                            key={wallet.id}
                            className="flex items-center justify-between rounded-md border bg-background p-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingWallet(wallet);
                            }}
                            title="Double-click to edit"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {wallet.label || shortenAddress(wallet.address)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {shortenAddress(wallet.address)}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-medium text-green-600">
                                {formatCurrency(wallet.balanceUsd)}
                              </span>
                              <p className="text-xs text-muted-foreground">
                                {formatCryptoBalance(wallet.balance)} {getChainSymbol(wallet.chain)}
                              </p>
                            </div>
                          </div>
                        ))}
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
                                  {activity.metadata?.address
                                    ? shortenAddress(activity.metadata.address as string)
                                    : ""}{" "}
                                  - {formatTimeAgo(activity.createdAt)}
                                </span>
                              </div>
                              {activity.metadata?.balanceUsd !== undefined && (
                                <span
                                  className={`font-medium ${
                                    activity.action === "wallet_added"
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {activity.action === "wallet_added" ? "+" : "-"}
                                  {formatCurrency(activity.metadata.balanceUsd as number)}
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
      <Dialog open={!!editingWallet} onOpenChange={(open) => !open && setEditingWallet(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crypto Wallet</DialogTitle>
            <DialogDescription>
              View wallet details, refresh balance, or remove the wallet
            </DialogDescription>
          </DialogHeader>
          {editingWallet && (
            <EditCryptoWalletForm
              wallet={editingWallet}
              onSuccess={handleEditSuccess}
              onCancel={() => setEditingWallet(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
