"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function EditCryptoWalletForm({
  wallet,
  onSuccess,
  onCancel,
}: EditCryptoWalletFormProps) {
  const { dbUserId } = useAuthStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [formData, setFormData] = useState({
    label: wallet.label || "",
  });

  async function handleRefreshBalance() {
    if (!dbUserId) {
      toast.error("Please login first");
      return;
    }

    setIsRefreshing(true);

    try {
      // Delete and re-add to refresh balance
      const deleteRes = await fetch(
        `/api/crypto/wallets?walletId=${wallet.id}&userId=${dbUserId}`,
        { method: "DELETE" }
      );

      if (!deleteRes.ok) {
        throw new Error("Failed to refresh");
      }

      // Re-add with same details
      const addRes = await fetch("/api/crypto/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: dbUserId,
          chain: wallet.chain,
          address: wallet.address,
          label: formData.label || undefined,
        }),
      });

      if (!addRes.ok) {
        throw new Error("Failed to refresh");
      }

      toast.success("Balance refreshed!");
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh");
    } finally {
      setIsRefreshing(false);
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

      toast.success("Wallet removed successfully!");
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 bg-muted/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">Chain</span>
          <span className="font-medium">{getChainSymbol(wallet.chain)}</span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">Address</span>
          <span className="font-mono text-sm">{shortenAddress(wallet.address)}</span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">Balance</span>
          <span className="font-medium">
            {wallet.balance.toFixed(8)} {getChainSymbol(wallet.chain)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Value</span>
          <span className="font-semibold text-green-600">
            ${wallet.balanceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="label">Label (Optional)</Label>
        <Input
          id="label"
          placeholder="e.g., Main Wallet, Hardware Wallet"
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={handleRefreshBalance}
          disabled={isRefreshing}
        >
          {isRefreshing ? "Refreshing..." : "Refresh Balance"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Close
        </Button>
      </div>

      <div className="border-t pt-4 mt-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              disabled={isDeleting}
            >
              {isDeleting ? "Removing..." : "Remove Wallet"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Wallet?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the wallet &quot;{shortenAddress(wallet.address)}&quot; from your portfolio.
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
