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

export function EditCryptoWalletForm({
  wallet,
  onSuccess,
  onCancel,
}: EditCryptoWalletFormProps) {
  const { dbUserId } = useAuthStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // Determine if this is a manual entry or connected wallet
  const isManualEntry = wallet.chain.toLowerCase() === "manual";
  const action = wallet.metadata?.action || "buy";
  const ticker = wallet.metadata?.ticker || getChainSymbol(wallet.chain);
  const units = wallet.metadata?.units || wallet.balance;
  const pricePerUnit = wallet.metadata?.pricePerUnit || (units > 0 ? wallet.balanceUsd / units : 0);
  const description = wallet.metadata?.description || "";

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
            value={wallet.label || (isManualEntry ? "Manual Entry" : getChainSymbol(wallet.chain))}
            className="bg-muted cursor-not-allowed"
            readOnly
            disabled
          />
        </div>

        {/* Ticker and Units */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ticker">Crypto Ticker</Label>
            <Input
              id="ticker"
              value={ticker}
              className="uppercase bg-muted cursor-not-allowed"
              readOnly
              disabled
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="units">Number of Units</Label>
            <Input
              id="units"
              value={units.toFixed(8)}
              className="bg-muted cursor-not-allowed"
              readOnly
              disabled
            />
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
        {pricePerUnit > 0 && (
          <div className="rounded-md bg-blue-50 border border-blue-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-800">Price per {ticker}</span>
              <span className="text-sm font-semibold text-blue-800">
                {formatCurrency(pricePerUnit)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-blue-200 pt-2">
              <span className="text-sm font-medium text-blue-800">Total Value</span>
              <span className="text-sm font-semibold text-blue-800">
                {formatCurrency(wallet.balanceUsd)}
              </span>
            </div>
          </div>
        )}

        {/* Value - Read only */}
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
              value={wallet.balanceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              readOnly
              disabled
            />
          </div>
        </div>

        {/* Cost Basis - Only for Buy actions */}
        {action === "buy" && (
          <div className="space-y-2">
            <Label htmlFor="costBasis">Cost Basis ($)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="costBasis"
                type="text"
                className="pl-7 bg-muted cursor-not-allowed"
                value={(wallet.metadata?.purchaseUnitPrice
                  ? wallet.metadata.purchaseUnitPrice * units
                  : wallet.balanceUsd
                ).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                readOnly
                disabled
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Original purchase price for this position
            </p>
          </div>
        )}

        {/* For connected wallets, always show address info */}
        {!isManualEntry && (
          <div className="rounded-lg border p-4 bg-muted/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Chain</span>
              <span className="font-medium">{getChainSymbol(wallet.chain)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Address</span>
              <span className="font-mono text-sm">{shortenAddress(wallet.address)}</span>
            </div>
          </div>
        )}

        {/* View more toggle */}
        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          className="text-blue-600 text-sm font-medium hover:text-blue-700 hover:underline"
        >
          {showMore ? "view less" : "view more"}
        </button>

        {/* Additional fields shown when expanded */}
        {showMore && (
          <>
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

            {/* Created Date */}
            {wallet.createdAt && (
              <div className="space-y-2">
                <Label htmlFor="createdAt">Purchase Date</Label>
                <Input
                  id="createdAt"
                  type="text"
                  value={new Date(wallet.createdAt).toLocaleDateString()}
                  className="bg-muted cursor-not-allowed"
                  readOnly
                  disabled
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer with buttons */}
      <div className="sticky bottom-0 bg-background pt-4 border-t space-y-3">
        <Button type="button" variant="outline" className="w-full" onClick={onCancel}>
          Close
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              disabled={isDeleting}
            >
              {isDeleting ? "Removing..." : "Remove Record"}
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
