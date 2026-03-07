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
import { Wallet, Zap } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "sonner";

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

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();
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

      toast.success("Wallet added successfully!");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add wallet");
      toast.error(err instanceof Error ? err.message : "Failed to add wallet");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectWallet = () => {
    toast.info("Wallet connection coming soon! Use manual entry for now.");
  };

  return (
    <div className="flex flex-col">
      <div className="space-y-6 pb-4">
        {/* Connect Wallet Section */}
        <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-8 w-8 text-orange-500" />
              <span className="text-lg font-semibold">Crypto Wallet</span>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Recommended: Connect Wallet</p>
              <p className="text-xs text-muted-foreground">
                Securely connect your crypto wallet for automatic balance tracking
              </p>
            </div>
            <Button
              className="w-full bg-[#6132de] hover:bg-[#5028c6]"
              onClick={handleConnectWallet}
            >
              <Zap className="h-4 w-4 mr-2" />
              Connect Crypto Wallet
            </Button>
          </div>
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or enter manually
            </span>
          </div>
        </div>

        {/* Manual Entry Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="chain">Blockchain *</Label>
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
            <Label htmlFor="address">Wallet Address *</Label>
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
        </form>
      </div>

      {/* Fixed Footer */}
      <div className="sticky bottom-0 bg-background pt-4 pb-6 border-t">
        <Button
          type="button"
          variant="outline"
          className="w-full border-[#6132de] text-[#6132de] hover:bg-[#6132de]/10 hover:text-[#5028c6]"
          disabled={isLoading || !chain || !address}
          onClick={handleSubmit}
        >
          {isLoading ? "Adding..." : "Add Wallet"}
        </Button>
      </div>
    </div>
  );
}
