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
import { useAuthStore } from "@/lib/stores/auth-store";

const SUPPORTED_CHAINS = [
  { value: "bitcoin", label: "Bitcoin (BTC)" },
  { value: "ethereum", label: "Ethereum (ETH)" },
  { value: "solana", label: "Solana (SOL)" },
  { value: "polygon", label: "Polygon (MATIC)" },
];

interface AddWalletFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AddWalletForm({ onSuccess, onCancel }: AddWalletFormProps) {
  const [chain, setChain] = useState<string>("");
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { dbUserId } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chain || !address) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/crypto/wallets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: dbUserId,
          chain,
          address,
          label: label || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add wallet");
      }

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add wallet");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="chain">Blockchain</Label>
        <Select value={chain} onValueChange={setChain}>
          <SelectTrigger>
            <SelectValue placeholder="Select blockchain" />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_CHAINS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Wallet Address</Label>
        <Input
          id="address"
          placeholder="Enter public wallet address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          Only enter your public address. Never share your private key.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="label">Label (Optional)</Label>
        <Input
          id="label"
          placeholder="e.g., Main Wallet, Hardware Wallet"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading || !chain || !address}>
          {isLoading ? "Adding..." : "Add Wallet"}
        </Button>
      </div>
    </form>
  );
}
