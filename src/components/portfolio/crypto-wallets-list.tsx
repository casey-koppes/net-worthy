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
import { ChevronDown, ChevronUp, Plus, Minus } from "lucide-react";
import { CryptoNews } from "./crypto-news";
import { CryptoInsights } from "./crypto-insights";
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
  metadata?: {
    action?: string;
    ticker?: string;
    units?: number;
    pricePerUnit?: number;
    purchaseUnitPrice?: number;
    cryptoName?: string;
    description?: string;
  } | null;
}


interface GroupedWallets {
  chain: string;
  totalBalance: number;
  totalBalanceUsd: number;
  wallets: CryptoWallet[];
  isManual?: boolean;
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
    case "manual":
      return null;
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
    case "manual":
      return "bg-green-100 text-green-800";
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
    case "manual":
      return "USD";
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
    case "manual":
      return "Manual Entry";
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


// Group wallets by chain (manual entries grouped by ticker)
function groupWallets(wallets: CryptoWallet[]): GroupedWallets[] {
  const groups = new Map<string, GroupedWallets>();

  for (const wallet of wallets) {
    // For manual entries, group by ticker; for regular wallets, group by chain
    const isManual = wallet.chain.toLowerCase() === "manual";
    const ticker = wallet.metadata?.ticker?.toLowerCase() || "unknown";
    const key = isManual ? `manual-${ticker}` : wallet.chain.toLowerCase();

    // Determine if this is a buy, sell, or transfer action
    const action = wallet.metadata?.action || "buy";
    const isSell = action === "sell";
    const isTransfer = action === "transfer";

    // Calculate value contribution: Buy adds, Sell subtracts, Transfer is neutral (just a log)
    const balanceContribution = isTransfer ? 0 : (isSell ? -wallet.balance : wallet.balance);
    const balanceUsdContribution = isTransfer ? 0 : (isSell ? -wallet.balanceUsd : wallet.balanceUsd);

    // Get display name for manual entries (use cryptoName or ticker)
    const displayName = isManual
      ? (wallet.metadata?.cryptoName || wallet.metadata?.ticker?.toUpperCase() || wallet.label || "Manual Entry")
      : wallet.chain;

    if (groups.has(key)) {
      const group = groups.get(key)!;
      group.totalBalance += balanceContribution;
      group.totalBalanceUsd += balanceUsdContribution;
      group.wallets.push(wallet);
    } else {
      groups.set(key, {
        chain: displayName,
        totalBalance: balanceContribution,
        totalBalanceUsd: balanceUsdContribution,
        wallets: [wallet],
        isManual,
      });
    }
  }

  // Sort wallets within each group by createdAt (newest first)
  for (const group of groups.values()) {
    group.wallets.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA; // Newest first
    });
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

  // Helper to get performance for an item
  const getItemPerformance = (itemId: string): { percent: number | null; dollarChange: number | null } => {
    const item = performance?.items.find((i) => i.id === itemId);
    if (!item) return { percent: null, dollarChange: null };
    const dollarChange = item.startValue !== null ? item.currentValue - item.startValue : null;
    return { percent: item.changePercent, dollarChange };
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
    }
    setExpandedGroups(newExpanded);
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

  // Extract tickers for news component
  const cryptoTickers = groupedWallets
    .map((g) => {
      // For manual entries, use the ticker from metadata
      if (g.isManual && g.wallets[0]?.metadata?.ticker) {
        return g.wallets[0].metadata.ticker;
      }
      // For connected wallets, use chain symbol
      return getChainSymbol(g.chain);
    })
    .filter((t): t is string => t !== null && t !== "USD");

  // Prepare holdings data for insights
  const cryptoHoldings = groupedWallets.map((g) => ({
    name: g.chain,
    ticker: g.isManual ? (g.wallets[0]?.metadata?.ticker || null) : getChainSymbol(g.chain),
    value: g.totalBalanceUsd,
    units: g.totalBalance,
    percentage: totalValue > 0 ? (g.totalBalanceUsd / totalValue) * 100 : 0,
  }));

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
        <Tabs defaultValue="wallets" className="w-full">
          {/* Chrome-style tabs */}
          <div className="border-b">
            <TabsList className="h-auto p-0 bg-transparent gap-0">
              <TabsTrigger
                value="wallets"
                className="relative rounded-none rounded-t-lg border border-b-0 border-transparent data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-none px-4 py-2 text-sm font-medium data-[state=inactive]:bg-muted/50 data-[state=inactive]:text-muted-foreground data-[state=active]:z-10 -mb-px"
              >
                {uniqueCount} crypto - {formatCurrency(totalValue)}
              </TabsTrigger>
              <TabsTrigger
                value="news"
                className="relative rounded-none rounded-t-lg border border-b-0 border-transparent data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-none px-4 py-2 text-sm font-medium data-[state=inactive]:bg-muted/50 data-[state=inactive]:text-muted-foreground data-[state=active]:z-10 -mb-px -ml-px"
              >
                News
              </TabsTrigger>
              <TabsTrigger
                value="insights"
                className="relative rounded-none rounded-t-lg border border-b-0 border-transparent data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-none px-4 py-2 text-sm font-medium data-[state=inactive]:bg-muted/50 data-[state=inactive]:text-muted-foreground data-[state=active]:z-10 -mb-px -ml-px"
              >
                Insights
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="wallets" className="mt-4">
        <div className="space-y-2">
          {groupedWallets.map((group) => {
            const isExpanded = expandedGroups.has(group.chain.toLowerCase());
            const hasMultipleWallets = group.wallets.length > 1;
            const displayChain = group.isManual ? "manual" : group.chain;

            return (
              <div key={group.chain} className="rounded-lg border overflow-hidden">
                {/* Main row - clickable to expand */}
                <div
                  className={`flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors ${isExpanded ? "bg-muted/30" : ""}`}
                  onClick={() => toggleGroup(group.chain.toLowerCase())}
                >
                  <div className="flex items-center gap-3">
                    {!group.isManual && getChainLogo(displayChain) ? (
                      <img
                        src={getChainLogo(displayChain)!}
                        alt={getChainSymbol(displayChain)}
                        className="w-8 h-8 object-contain"
                      />
                    ) : (
                      <Badge className={getChainColor(displayChain)}>
                        {group.isManual ? "$" : getChainSymbol(displayChain)}
                      </Badge>
                    )}
                    <div className="flex flex-col">
                      <span className="font-medium">{group.isManual ? group.chain : getChainName(displayChain)}</span>
                      <span className="text-sm text-muted-foreground">
                        {group.isManual ? "Manual crypto entry" : `${formatCryptoBalance(group.totalBalance)} ${getChainSymbol(displayChain)}`}
                        {hasMultipleWallets && (
                          <span className="ml-2 text-xs text-blue-600">
                            ({group.wallets.length} {group.isManual ? "entries" : "wallets"})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">
                      {formatCurrency(group.totalBalanceUsd)}
                    </span>
                    <PerformanceBadge
                      value={getItemPerformance(group.wallets[0]?.id).percent}
                      dollarChange={getItemPerformance(group.wallets[0]?.id).dollarChange}
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
                    {group.wallets.map((wallet) => {
                      const isWalletManual = wallet.chain.toLowerCase() === "manual";
                      const walletAction = wallet.metadata?.action || "buy";
                      const iconConfig = {
                        buy: { bg: "bg-green-100", text: "text-green-600", icon: Plus },
                        sell: { bg: "bg-red-100", text: "text-red-600", icon: Minus },
                        transfer: { bg: "bg-blue-100", text: "text-blue-600", icon: null },
                      }[walletAction] || { bg: "bg-green-100", text: "text-green-600", icon: Plus };
                      const IconComponent = iconConfig.icon;
                      return (
                      <div key={wallet.id} className="flex items-center gap-2">
                        {/* Icon outside the card */}
                        <div className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${iconConfig.bg} ${iconConfig.text}`}>
                          {walletAction === "transfer" ? (
                            <span className="text-xs font-bold">→</span>
                          ) : IconComponent ? (
                            <IconComponent className="h-3 w-3" />
                          ) : null}
                        </div>
                        {/* Activity card */}
                        <div
                          className="flex-1 flex items-center justify-between rounded-md border bg-background p-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingWallet(wallet);
                          }}
                          title="Double-click to edit"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1">
                                {!isWalletManual && getChainLogo(wallet.chain) ? (
                                  <img
                                    src={getChainLogo(wallet.chain)!}
                                    alt={getChainSymbol(wallet.chain)}
                                    className="w-4 h-4 object-contain"
                                  />
                                ) : (
                                  <div className={`w-4 h-4 rounded-md ${isWalletManual ? "bg-green-500" : "bg-gradient-to-br from-blue-500 to-purple-600"} flex items-center justify-center text-white text-[6px] font-bold`}>
                                    {isWalletManual ? "$" : getChainSymbol(wallet.chain).substring(0, 2)}
                                  </div>
                                )}
                                <span className="font-medium text-xs">
                                  {wallet.label || (isWalletManual ? "Manual entry" : shortenAddress(wallet.address))}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {isWalletManual ? "Manual entry" : `${formatCryptoBalance(wallet.balance)} ${getChainSymbol(wallet.chain)}`}
                                {wallet.createdAt && ` • ${formatTimeAgo(wallet.createdAt)}`}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {(() => {
                              const badgeConfig = {
                                buy: { label: "Buy", className: "bg-green-100 text-green-700 hover:bg-green-100" },
                                sell: { label: "Sell", className: "bg-red-100 text-red-700 hover:bg-red-100" },
                                transfer: { label: "Transfer to Cold Wallet", className: "bg-blue-100 text-blue-700 hover:bg-blue-100" },
                              }[walletAction] || { label: "Buy", className: "bg-green-100 text-green-700 hover:bg-green-100" };
                              return (
                                <Badge
                                  variant="secondary"
                                  className={`text-xs ${badgeConfig.className}`}
                                >
                                  {badgeConfig.label}
                                </Badge>
                              );
                            })()}
                            <div className="flex flex-col items-end">
                              <span className="font-medium text-gray-600">
                                {formatCurrency(wallet.balanceUsd)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
          </TabsContent>

          <TabsContent value="news" className="mt-4">
            <CryptoNews tickers={cryptoTickers} />
          </TabsContent>

          <TabsContent value="insights" className="mt-4">
            <CryptoInsights
              holdings={cryptoHoldings}
              totalValue={totalValue}
              userId={dbUserId || ""}
            />
          </TabsContent>
        </Tabs>
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
