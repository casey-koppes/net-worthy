"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ExternalLink, HelpCircle, RefreshCw, Trash2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "sonner";

export interface EditableCryptoWallet {
  id: string;
  chain: string;
  address: string;
  label: string | null;
  balance: number;
  balanceUsd: number;
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

interface EditCryptoWalletFormProps {
  wallet: EditableCryptoWallet;
  onSuccess?: () => void;
  onCancel?: () => void;
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
      return chain.charAt(0).toUpperCase() + chain.slice(1);
  }
}

function shortenAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
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

function getActionLabel(action: string): string {
  switch (action) {
    case "buy":
      return "Buy";
    case "sell":
      return "Sell";
    case "transfer":
      return "Transfer to Cold Wallet";
    default:
      return "Buy";
  }
}

function getBlockchainExplorerUrl(chain: string, address: string, transactionId?: string): string {
  // If it's a transaction ID entry, link to the transaction
  if (transactionId || address.startsWith("txn-")) {
    const txid = transactionId || address.replace("txn-", "");
    switch (chain.toLowerCase()) {
      case "bitcoin":
        return `https://blockstream.info/tx/${txid}`;
      case "ethereum":
        return `https://etherscan.io/tx/${txid}`;
      case "solana":
        return `https://solscan.io/tx/${txid}`;
      case "polygon":
        return `https://polygonscan.com/tx/${txid}`;
      default:
        return `https://blockstream.info/tx/${txid}`;
    }
  }

  // Otherwise, link to the wallet address
  switch (chain.toLowerCase()) {
    case "bitcoin":
      return `https://blockstream.info/address/${address}`;
    case "ethereum":
      return `https://etherscan.io/address/${address}`;
    case "solana":
      return `https://solscan.io/account/${address}`;
    case "polygon":
      return `https://polygonscan.com/address/${address}`;
    default:
      return `https://blockstream.info/address/${address}`;
  }
}

export function EditCryptoWalletForm({
  wallet,
  onSuccess,
  onCancel,
}: EditCryptoWalletFormProps) {
  const { dbUserId } = useAuthStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [syncedBalance, setSyncedBalance] = useState<{ balance: number; balanceUsd: number } | null>(null);

  // Determine if this is a manual entry or connected wallet
  const isManualEntry = wallet.chain.toLowerCase() === "manual";
  const action = wallet.metadata?.action || "buy";
  const description = wallet.metadata?.description || "";

  // Editable field states
  const [name, setName] = useState<string>(
    wallet.label || (isManualEntry ? "Manual Entry" : getChainName(wallet.chain))
  );
  const [ticker, setTicker] = useState<string>(
    wallet.metadata?.ticker || getChainSymbol(wallet.chain)
  );
  const [units, setUnits] = useState<string>(
    (wallet.metadata?.units || wallet.balance).toString()
  );
  const [purchaseUnitPrice, setPurchaseUnitPrice] = useState<string>(
    wallet.metadata?.purchaseUnitPrice?.toString() || ""
  );
  const [purchaseDate, setPurchaseDate] = useState<string>(
    wallet.createdAt ? new Date(wallet.createdAt).toISOString().split("T")[0] : ""
  );

  // Parsed units for calculations
  const parsedUnits = parseFloat(units) || 0;

  // Use synced balance if available, otherwise use wallet values
  const currentBalanceUsd = syncedBalance?.balanceUsd ?? wallet.balanceUsd;

  // Market price per unit
  const marketPricePerUnit = wallet.currentUnitPrice || wallet.metadata?.pricePerUnit || (parsedUnits > 0 ? currentBalanceUsd / parsedUnits : 0);

  // Calculate value based on purchase price if set, otherwise use market price
  const calculatedValue = purchaseUnitPrice && parseFloat(purchaseUnitPrice) > 0
    ? parseFloat(purchaseUnitPrice) * parsedUnits
    : marketPricePerUnit * parsedUnits;

  // Check if there are unsaved changes
  const originalName = wallet.label || (isManualEntry ? "Manual Entry" : getChainName(wallet.chain));
  const originalTicker = wallet.metadata?.ticker || getChainSymbol(wallet.chain);
  const originalUnits = (wallet.metadata?.units || wallet.balance).toString();
  const originalPurchasePrice = wallet.metadata?.purchaseUnitPrice?.toString() || "";
  const originalPurchaseDate = wallet.createdAt ? new Date(wallet.createdAt).toISOString().split("T")[0] : "";

  const hasChanges =
    name !== originalName ||
    (isManualEntry && ticker !== originalTicker) ||
    (isManualEntry && units !== originalUnits) ||
    purchaseUnitPrice !== originalPurchasePrice ||
    purchaseDate !== originalPurchaseDate;

  async function handleSave() {
    if (!dbUserId) {
      toast.error("Please login first");
      return;
    }

    // Validate required fields
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!ticker.trim()) {
      toast.error("Ticker is required");
      return;
    }
    const newUnits = parseFloat(units);
    if (isNaN(newUnits) || newUnits <= 0) {
      toast.error("Please enter a valid number of units");
      return;
    }

    setIsSaving(true);

    try {
      const newPurchasePrice = purchaseUnitPrice ? parseFloat(purchaseUnitPrice) : null;
      const newValue = newPurchasePrice && newPurchasePrice > 0
        ? newPurchasePrice * newUnits
        : marketPricePerUnit * newUnits;

      const res = await fetch(`/api/crypto/wallets`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletId: wallet.id,
          userId: dbUserId,
          label: name.trim(),
          balance: newUnits,
          manualValue: newValue,
          createdAt: purchaseDate ? new Date(purchaseDate).toISOString() : undefined,
          metadata: {
            ...wallet.metadata,
            ticker: ticker.toUpperCase().trim(),
            units: newUnits,
            purchaseUnitPrice: newPurchasePrice,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      toast.success("Record updated successfully!");
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSync() {
    if (!dbUserId) {
      toast.error("Please login first");
      return;
    }

    setIsSyncing(true);

    try {
      const res = await fetch(`/api/crypto/wallets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletId: wallet.id,
          userId: dbUserId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to sync balance");
      }

      // Extract the synced balance from the response
      const newBalance = data.wallet?.balance ?? 0;
      const newBalanceUsd = data.wallet?.balanceUsd ?? 0;

      // Update both synced balance display and units field
      setSyncedBalance({
        balance: newBalance,
        balanceUsd: newBalanceUsd,
      });

      // Convert balance to string for the units input field
      const newUnitsStr = newBalance.toString();
      setUnits(newUnitsStr);

      toast.success(`Balance synced: ${newBalance} ${ticker}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sync balance");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleDelete() {
    if (!dbUserId) {
      toast.error("Please login first");
      return;
    }

    setIsDeleting(true);

    try {
      const res = await fetch(
        `/api/crypto/wallets?walletId=${wallet.id}&userId=${dbUserId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }

      toast.success("Record removed successfully!");
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col max-h-[70vh] overflow-y-auto">
      <div className="space-y-4 pb-4">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Bitcoin Holdings"
          />
        </div>

        {/* For connected wallets, show address/transaction info at the top */}
        {!isManualEntry && (
          <div className="rounded-lg border p-4 bg-muted/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Chain</span>
              <span className="font-medium">{getChainSymbol(wallet.chain)}</span>
            </div>
            {!wallet.address.startsWith("txn-") && (
              <div className="space-y-1">
                <span className="text-sm font-medium text-muted-foreground">Wallet Address</span>
                <p className="font-mono text-xs break-all bg-background p-2 rounded border">{wallet.address}</p>
              </div>
            )}
            {wallet.metadata?.transactionId && (
              <div className="space-y-1">
                <span className="text-sm font-medium text-muted-foreground">Transaction ID</span>
                <p className="font-mono text-xs break-all bg-background p-2 rounded border">{wallet.metadata.transactionId}</p>
              </div>
            )}
            <div className="flex gap-2">
              {!wallet.address.startsWith("txn-") && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleSync}
                  disabled={isSyncing}
                  title="Sync balance from blockchain"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => window.open(
                  getBlockchainExplorerUrl(wallet.chain, wallet.address, wallet.metadata?.transactionId),
                  "_blank"
                )}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View on Blockchain
              </Button>
            </div>
          </div>
        )}

        {/* Ticker and Units */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ticker" className="flex items-center gap-1">
              Ticker
              {!isManualEntry && (
                <img
                  src="https://cdn-icons-png.flaticon.com/512/1895/1895474.png"
                  alt="Verified"
                  className="w-3 h-3"
                  title="Verified on-chain"
                />
              )}
            </Label>
            <Input
              id="ticker"
              value={ticker}
              onChange={(e) => isManualEntry && setTicker(e.target.value.toUpperCase())}
              className={`uppercase ${!isManualEntry ? "bg-muted cursor-not-allowed" : ""}`}
              placeholder="e.g., BTC"
              disabled={!isManualEntry}
            />
            {!isManualEntry && (
              <p className="text-xs text-muted-foreground">
                Determined by blockchain
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="units" className="flex items-center gap-1">
              Number of Units
              {!isManualEntry && (
                <img
                  src="https://cdn-icons-png.flaticon.com/512/1895/1895474.png"
                  alt="Verified"
                  className="w-3 h-3"
                  title="Verified on-chain balance"
                />
              )}
            </Label>
            <Input
              id="units"
              type="number"
              step="0.00000001"
              min="0"
              value={units}
              onChange={(e) => isManualEntry && setUnits(e.target.value)}
              placeholder="e.g., 0.5"
              disabled={!isManualEntry}
              className={!isManualEntry ? "bg-muted cursor-not-allowed" : ""}
            />
            {!isManualEntry && (
              <p className="text-xs text-muted-foreground">
                Fetched from blockchain. Use Sync to update.
              </p>
            )}
          </div>
        </div>

        {/* Action - Greyed out */}
        <div className="space-y-2">
          <Label htmlFor="action">Action</Label>
          <Select value={action} disabled>
            <SelectTrigger className="bg-muted cursor-not-allowed opacity-60">
              <SelectValue>{getActionLabel(action)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="buy">Buy</SelectItem>
              <SelectItem value="sell">Sell</SelectItem>
              <SelectItem value="transfer">Transfer to Cold Wallet</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            To record a different action, please add a new crypto record.
          </p>
        </div>

        {/* Market Price Banner */}
        {marketPricePerUnit > 0 && (
          <div className="rounded-md bg-blue-50 border border-blue-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-800">Market Price per {ticker}</span>
              <span className="text-sm font-semibold text-blue-800">
                {formatCurrency(marketPricePerUnit)}
              </span>
            </div>
            {marketPricePerUnit > 0 && parsedUnits > 0 && (
              <div className="flex items-center justify-between border-t border-blue-200 pt-2">
                <span className="text-sm font-medium text-blue-800">Market Value</span>
                <span className="text-sm font-semibold text-blue-800">
                  {formatCurrency(marketPricePerUnit * parsedUnits)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Purchase Unit Price - Editable */}
        <div className="space-y-2">
          <Label htmlFor="purchaseUnitPrice" className="flex items-center gap-1">
            Purchase Unit Price ($)
            <span
              title="Optional. If set, Value will be calculated from this instead of market price."
              className="inline-flex cursor-help"
            >
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="false" />
            </span>
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              id="purchaseUnitPrice"
              type="number"
              step="0.01"
              min="0"
              className="pl-7"
              value={purchaseUnitPrice}
              onChange={(e) => setPurchaseUnitPrice(e.target.value)}
              placeholder="Use market price"
            />
          </div>
        </div>

        {/* Value - Calculated from purchase price or market price */}
        <div className="space-y-2">
          <Label htmlFor="value">Value ($)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              id="value"
              type="text"
              className="pl-7 bg-muted cursor-not-allowed"
              value={calculatedValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              readOnly
              disabled
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {purchaseUnitPrice && parseFloat(purchaseUnitPrice) > 0
              ? "Calculated from Purchase Unit Price × Units"
              : "Calculated from Market Price × Units"}
          </p>
        </div>

        {/* View more toggle */}
        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          className="w-full text-center text-blue-600 text-sm font-medium hover:text-blue-700 hover:underline"
        >
          {showMore ? "view less" : "view more"}
        </button>

        {/* Additional fields shown when expanded */}
        {showMore && (
          <>
            {/* Purchase Date - Editable */}
            <div className="space-y-2">
              <Label htmlFor="purchaseDate">Purchase Date</Label>
              <Input
                id="purchaseDate"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The date this crypto was purchased
              </p>
            </div>

            {/* Cost Basis - Only for Buy actions */}
            {action === "buy" && (() => {
              const currentPurchasePrice = purchaseUnitPrice ? parseFloat(purchaseUnitPrice) : null;
              // Cost basis = purchase price × units
              const costBasis = currentPurchasePrice
                ? currentPurchasePrice * parsedUnits
                : wallet.balanceUsd; // fallback if no purchase price

              // Current value = current market price × units (or stored value if no live price)
              const currentValue = wallet.currentUnitPrice
                ? wallet.currentUnitPrice * parsedUnits
                : wallet.balanceUsd;

              const dollarChange = currentValue - costBasis;
              const percentChange = costBasis > 0 ? ((currentValue - costBasis) / costBasis) * 100 : 0;
              const isGain = dollarChange >= 0;

              // Hide if change is essentially zero
              if (Math.abs(dollarChange) < 0.01) return null;

              return (
                <div className="space-y-2">
                  <Label>Cost Basis</Label>
                  <div className={`flex items-center gap-2 p-2 rounded-md ${isGain ? "bg-green-50" : "bg-red-50"}`}>
                    <span className={`inline-flex items-center font-medium ${isGain ? "text-green-600" : "text-red-600"}`}>
                      <span>{Math.abs(percentChange).toFixed(1)}%</span>
                      <span>{isGain ? "▲" : "▼"}</span>
                    </span>
                    <span className={`text-sm ${isGain ? "text-green-600" : "text-red-600"}`}>
                      ({isGain ? "+" : "-"}{formatCompactCurrency(Math.abs(dollarChange))})
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Description */}
            {description && (
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  value={description}
                  rows={2}
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-muted px-3 py-2 text-sm shadow-sm cursor-not-allowed opacity-60"
                  readOnly
                  disabled
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer with buttons */}
      <div className="flex gap-2 pt-4 border-t">
        <Button
          type="button"
          className="flex-1"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="text-destructive border-destructive hover:bg-destructive/10"
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Record?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove this crypto record from your portfolio.
                You can always add it back later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
