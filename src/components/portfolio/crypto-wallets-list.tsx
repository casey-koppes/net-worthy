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
import { ChevronDown, ChevronUp, Plus, Minus, ExternalLink, PieChart, X } from "lucide-react";
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
  currentUnitPrice?: number | null;
  metadata?: {
    action?: string;
    ticker?: string;
    units?: number;
    pricePerUnit?: number;
    purchaseUnitPrice?: number;
    cryptoName?: string;
    description?: string;
    transactionId?: string;
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

function formatCompactCurrency(amount: number): string {
  const absAmount = Math.abs(amount);
  if (absAmount >= 1000000) {
    return `$${(absAmount / 1000000).toFixed(2)}M`;
  } else if (absAmount >= 1000) {
    return `$${(absAmount / 1000).toFixed(2)}K`;
  }
  return `$${absAmount.toFixed(2)}`;
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

// Get logo from ticker symbol (for manual entries)
function getLogoFromTicker(ticker: string | null | undefined): string | null {
  if (!ticker) return null;
  const tickerMap: Record<string, string> = {
    btc: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Bitcoin.svg/250px-Bitcoin.svg.png",
    eth: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Ethereum_logo_2014.svg/200px-Ethereum_logo_2014.svg.png",
    sol: "https://upload.wikimedia.org/wikipedia/en/b/b9/Solana_logo.png",
    matic: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Polygon_Blockchain_Matic_Logo.svg/200px-Polygon_Blockchain_Matic_Logo.svg.png",
  };
  return tickerMap[ticker.toLowerCase()] || null;
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

// Normalize any crypto name or ticker to a standard ticker symbol for grouping
function normalizeToTicker(input: string): string {
  const normalized = input.toLowerCase().trim();

  // Map common names to tickers
  const nameToTicker: Record<string, string> = {
    bitcoin: "btc",
    ethereum: "eth",
    solana: "sol",
    polygon: "matic",
    cardano: "ada",
    polkadot: "dot",
    dogecoin: "doge",
    "shiba inu": "shib",
    avalanche: "avax",
    chainlink: "link",
    ripple: "xrp",
    litecoin: "ltc",
    uniswap: "uni",
    cosmos: "atom",
    stellar: "xlm",
  };

  // Check if it's a name that maps to a ticker
  if (nameToTicker[normalized]) {
    return nameToTicker[normalized];
  }

  // Otherwise, return as-is (already a ticker)
  return normalized;
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

function getBlockchainExplorerUrl(chain: string, address: string, transactionId?: string): string {
  // If it's a transaction ID entry, link to the transaction
  if (transactionId || address.startsWith("txn-")) {
    const txid = transactionId || address.replace("txn-", "");
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
      return `https://mempool.space/address/${address}`;
  }
}


// Group wallets by ticker (merge manual and connected wallets with same crypto)
function groupWallets(wallets: CryptoWallet[]): GroupedWallets[] {
  const groups = new Map<string, GroupedWallets>();

  for (const wallet of wallets) {
    const isManual = wallet.chain.toLowerCase() === "manual";

    // Normalize key to ticker symbol so manual BTC and connected Bitcoin group together
    let key: string;
    let displayName: string;

    if (isManual) {
      // For manual entries, normalize ticker/name to standard ticker symbol
      const tickerOrName = wallet.metadata?.ticker || wallet.label || "unknown";
      key = normalizeToTicker(tickerOrName);
      displayName = wallet.metadata?.cryptoName || wallet.metadata?.ticker?.toUpperCase() || wallet.label || "Manual Entry";
    } else {
      // For connected wallets, normalize chain name to ticker for grouping
      key = normalizeToTicker(wallet.chain);
      displayName = getChainName(wallet.chain);
    }

    // Determine if this is a buy, sell, or transfer action
    const action = wallet.metadata?.action || "buy";
    const isSell = action === "sell";
    const isTransfer = action === "transfer";

    // Calculate value contribution: Buy adds, Sell subtracts, Transfer is neutral (just a log)
    const balanceContribution = isTransfer ? 0 : (isSell ? -wallet.balance : wallet.balance);
    const balanceUsdContribution = isTransfer ? 0 : (isSell ? -wallet.balanceUsd : wallet.balanceUsd);

    if (groups.has(key)) {
      const group = groups.get(key)!;
      group.totalBalance += balanceContribution;
      group.totalBalanceUsd += balanceUsdContribution;
      group.wallets.push(wallet);
      // If we're adding a non-manual wallet, update to use its display name
      if (!isManual) {
        group.chain = displayName;
        group.isManual = false;
      }
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
  const [showAllocation, setShowAllocation] = useState(false);

  // Helper to get performance for an item
  const getItemPerformance = (itemId: string): { percent: number | null; dollarChange: number | null; currentUnitPrice: number | null } => {
    const item = performance?.items.find((i) => i.id === itemId);
    if (!item) return { percent: null, dollarChange: null, currentUnitPrice: null };
    const dollarChange = item.startValue !== null ? item.currentValue - item.startValue : null;
    return { percent: item.changePercent, dollarChange, currentUnitPrice: item.currentUnitPrice ?? null };
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
            <Button onClick={onAddWallet}>Add Crypto</Button>
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onAddWallet}>
            Add Crypto
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
                    {(() => {
                      // For manual entries, try to get logo from ticker
                      const manualTicker = group.isManual ? group.wallets[0]?.metadata?.ticker : null;
                      const logo = group.isManual
                        ? getLogoFromTicker(manualTicker)
                        : getChainLogo(displayChain);
                      const symbol = group.isManual
                        ? manualTicker?.toUpperCase() || "$"
                        : getChainSymbol(displayChain);

                      if (logo) {
                        return (
                          <img
                            src={logo}
                            alt={symbol}
                            className="w-8 h-8 object-contain"
                          />
                        );
                      }
                      return (
                        <Badge className={getChainColor(displayChain)}>
                          {symbol}
                        </Badge>
                      );
                    })()}
                    <div className="flex flex-col">
                      <span className="font-medium">{group.isManual ? group.chain : getChainName(displayChain)}</span>
                      <span className="text-sm text-muted-foreground">
                        {group.isManual
                          ? `${formatCryptoBalance(group.totalBalance)} ${group.wallets[0]?.metadata?.ticker?.toUpperCase() || "units"}`
                          : `${formatCryptoBalance(group.totalBalance)} ${getChainSymbol(displayChain)}`}
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
                          className="group flex-1 flex items-center justify-between rounded-md border bg-background p-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            // Include currentUnitPrice from performance data for cost basis calculation
                            const { currentUnitPrice } = getItemPerformance(wallet.id);
                            setEditingWallet({ ...wallet, currentUnitPrice });
                          }}
                          title="Double-click to edit"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1">
                                {(() => {
                                  // Get logo - either from chain (connected) or ticker (manual)
                                  const logo = isWalletManual
                                    ? getLogoFromTicker(wallet.metadata?.ticker)
                                    : getChainLogo(wallet.chain);
                                  const symbol = isWalletManual
                                    ? wallet.metadata?.ticker?.toUpperCase() || "?"
                                    : getChainSymbol(wallet.chain);

                                  if (logo) {
                                    return (
                                      <img
                                        src={logo}
                                        alt={symbol}
                                        className="w-4 h-4 object-contain"
                                      />
                                    );
                                  }
                                  return (
                                    <div className="w-4 h-4 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[6px] font-bold">
                                      {symbol.substring(0, 2)}
                                    </div>
                                  );
                                })()}
                                <span className="font-medium text-xs">
                                  {wallet.label || (isWalletManual ? "Manual entry" : getChainName(wallet.chain))}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <span>
                                  {isWalletManual
                                    ? `${formatCryptoBalance(wallet.metadata?.units || wallet.balance)} ${wallet.metadata?.ticker?.toUpperCase() || "units"}`
                                    : `${formatCryptoBalance(wallet.balance)} ${getChainSymbol(wallet.chain)}`}
                                  {wallet.createdAt && ` • ${formatTimeAgo(wallet.createdAt)}`}
                                </span>
                                {!isWalletManual && (
                                  <>
                                    <img
                                      src="https://cdn-icons-png.flaticon.com/512/7641/7641727.png"
                                      alt="Verified"
                                      className="w-3 h-3 ml-1"
                                      title="Verified on-chain address"
                                    />
                                    <a
                                      href={getBlockchainExplorerUrl(wallet.chain, wallet.address, wallet.metadata?.transactionId)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="opacity-0 group-hover:opacity-100 hover:text-blue-600 transition-all"
                                      title="View on blockchain"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                  </>
                                )}
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
                              {walletAction === "buy" && (() => {
                                const units = wallet.metadata?.units || wallet.balance;
                                const purchasePrice = wallet.metadata?.purchaseUnitPrice;
                                // Get current market price from performance data
                                const { currentUnitPrice } = getItemPerformance(wallet.id);

                                // Cost basis = purchase price × units
                                const costBasis = purchasePrice
                                  ? purchasePrice * units
                                  : wallet.balanceUsd; // fallback to stored value if no purchase price

                                // Current value = current market price × units (or stored value if no live price)
                                const currentValue = currentUnitPrice
                                  ? currentUnitPrice * units
                                  : wallet.balanceUsd;

                                const dollarChange = currentValue - costBasis;
                                const isGain = dollarChange >= 0;
                                // Hide if change is essentially zero (less than $0.01) due to floating point
                                if (Math.abs(dollarChange) < 0.01) return null;
                                return (
                                  <span className={`text-xs ${isGain ? "text-green-600" : "text-red-600"}`}>
                                    ({isGain ? "+" : "-"}{formatCompactCurrency(Math.abs(dollarChange))})
                                  </span>
                                );
                              })()}
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
          </div>

          {/* Allocation Panel - Pie Chart (slides out to the right) */}
          {showAllocation && (
            <div className="lg:w-1/3 border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold">Crypto Allocation</h4>
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
                      const hues = [30, 210, 280, 160, 340, 50, 190, 250];
                      const hue = hues[index % hues.length];
                      const lightness = 50 + (index % 3) * 10;
                      return `hsl(${hue}, 80%, ${lightness}%)`;
                    };

                    // Pre-calculate all slices with their angles
                    const slices: { group: typeof groupedWallets[0]; startAngle: number; endAngle: number; index: number }[] = [];
                    let currentAngle = -Math.PI / 2; // Start from top

                    groupedWallets.forEach((group, index) => {
                      const percentage = totalValue > 0 ? group.totalBalanceUsd / totalValue : 0;
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
                          key={group.chain}
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
                {groupedWallets.map((group, index) => {
                  const percentage = totalValue > 0 ? (group.totalBalanceUsd / totalValue) * 100 : 0;
                  const hues = [30, 210, 280, 160, 340, 50, 190, 250];
                  const hue = hues[index % hues.length];
                  const lightness = 50 + (index % 3) * 10;
                  const color = `hsl(${hue}, 80%, ${lightness}%)`;
                  const ticker = group.isManual
                    ? group.wallets[0]?.metadata?.ticker?.toUpperCase() || "?"
                    : getChainSymbol(group.chain);

                  return (
                    <div key={group.chain} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate">{ticker}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-muted-foreground text-xs">
                          {percentage.toFixed(1)}%
                        </span>
                        <span className="font-medium text-xs">
                          {formatCurrency(group.totalBalanceUsd)}
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
