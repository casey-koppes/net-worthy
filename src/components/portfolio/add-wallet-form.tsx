"use client";

import { useState, useEffect } from "react";
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
import { Wallet, Zap, RefreshCw } from "lucide-react";
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
  // Wallet connection state
  const [chain, setChain] = useState<string>("");
  const [address, setAddress] = useState("");

  // Manual entry state
  const [manualFormData, setManualFormData] = useState({
    name: "",
    ticker: "",
    units: "",
    action: "buy",
    purchaseUnitPrice: "",
    description: "",
    purchaseDate: "",
  });
  const [cryptoPrice, setCryptoPrice] = useState<number | null>(null);
  const [cryptoName, setCryptoName] = useState<string | null>(null);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [calculatedValue, setCalculatedValue] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { dbUserId } = useAuthStore();

  // Calculate value when units or price changes
  useEffect(() => {
    const units = parseFloat(manualFormData.units);
    const purchasePrice = parseFloat(manualFormData.purchaseUnitPrice);

    // Use purchase price if provided, otherwise use fetched crypto price
    const priceToUse = !isNaN(purchasePrice) && purchasePrice > 0 ? purchasePrice : cryptoPrice;

    if (priceToUse && !isNaN(units) && units > 0) {
      const value = (units * priceToUse).toFixed(2);
      setCalculatedValue(value);
    } else {
      setCalculatedValue(null);
    }
  }, [cryptoPrice, manualFormData.units, manualFormData.purchaseUnitPrice]);

  async function fetchCryptoPrice(ticker: string) {
    if (!ticker) return;

    setIsFetchingPrice(true);
    try {
      const res = await fetch(`/api/crypto/price?ticker=${ticker}`);
      if (res.ok) {
        const data = await res.json();
        setCryptoPrice(data.price);
        setCryptoName(data.name);
        toast.success(`Found ${ticker.toUpperCase()} at $${data.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      } else {
        setCryptoPrice(null);
        setCryptoName(null);
        toast.error(`Could not find ticker: ${ticker}`);
      }
    } catch {
      setCryptoPrice(null);
      setCryptoName(null);
      toast.error("Failed to fetch crypto price");
    } finally {
      setIsFetchingPrice(false);
    }
  }

  function handleTickerBlur() {
    if (manualFormData.ticker && manualFormData.ticker.length >= 1) {
      fetchCryptoPrice(manualFormData.ticker);
    }
  }

  const handleConnectWallet = () => {
    if (!chain || !address) {
      toast.error("Please select a blockchain and enter a wallet address");
      return;
    }
    handleWalletSubmit();
  };

  const handleWalletSubmit = async () => {
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
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add wallet");
      }

      toast.success("Wallet connected successfully!");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add wallet");
      toast.error(err instanceof Error ? err.message : "Failed to add wallet");
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();

    if (!manualFormData.name || !manualFormData.ticker || !manualFormData.units) {
      toast.error("Please fill in all required fields");
      return;
    }

    const units = parseFloat(manualFormData.units);
    if (isNaN(units) || units <= 0) {
      toast.error("Please enter a valid number of units");
      return;
    }

    const value = calculatedValue ? parseFloat(calculatedValue) : 0;
    if (value <= 0) {
      toast.error("Unable to calculate value. Please check ticker and units.");
      return;
    }

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
          chain: "manual",
          address: `manual-${Date.now()}`,
          label: manualFormData.name,
          manualValue: value,
          metadata: {
            action: manualFormData.action,
            ticker: manualFormData.ticker.toUpperCase(),
            units: units,
            pricePerUnit: cryptoPrice,
            purchaseUnitPrice: manualFormData.purchaseUnitPrice ? parseFloat(manualFormData.purchaseUnitPrice) : null,
            cryptoName: cryptoName,
            description: manualFormData.description || null,
          },
          createdAt: manualFormData.purchaseDate ? new Date(manualFormData.purchaseDate).toISOString() : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add crypto");
      }

      toast.success("Crypto added successfully!");

      // Reset form
      setManualFormData({
        name: "",
        ticker: "",
        units: "",
        action: "buy",
        purchaseUnitPrice: "",
        description: "",
        purchaseDate: "",
      });
      setCryptoPrice(null);
      setCryptoName(null);
      setShowMore(false);
      setCalculatedValue(null);

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add crypto");
      toast.error(err instanceof Error ? err.message : "Failed to add crypto");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col max-h-[70vh] overflow-y-auto">
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

            {/* Blockchain and Address fields in Connect section */}
            <div className="w-full space-y-3 text-left">
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
                />
                <p className="text-xs text-muted-foreground">
                  Only enter your public address. Never share your private key.
                </p>
              </div>
            </div>

            <Button
              className="w-full bg-[#6132de] hover:bg-[#5028c6]"
              onClick={handleConnectWallet}
              disabled={isLoading || !chain || !address}
            >
              <Zap className="h-4 w-4 mr-2" />
              {isLoading ? "Connecting..." : "Connect Crypto Wallet"}
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
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Bitcoin Holdings, ETH Savings"
              value={manualFormData.name}
              onChange={(e) => setManualFormData({ ...manualFormData, name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ticker">Crypto Ticker *</Label>
              <Input
                id="ticker"
                placeholder="e.g., BTC, ETH"
                value={manualFormData.ticker}
                onChange={(e) => setManualFormData({ ...manualFormData, ticker: e.target.value.toUpperCase() })}
                onBlur={handleTickerBlur}
                className="uppercase"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="units">Number of Units *</Label>
              <div className="flex gap-2">
                <Input
                  id="units"
                  type="number"
                  step="0.00000001"
                  min="0"
                  placeholder="e.g., 0.5"
                  value={manualFormData.units}
                  onChange={(e) => setManualFormData({ ...manualFormData, units: e.target.value })}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => fetchCryptoPrice(manualFormData.ticker)}
                  disabled={!manualFormData.ticker || isFetchingPrice}
                >
                  <RefreshCw className={`h-4 w-4 ${isFetchingPrice ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="action">Action *</Label>
            <Select
              value={manualFormData.action}
              onValueChange={(value) => setManualFormData({ ...manualFormData, action: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buy">Buy</SelectItem>
                <SelectItem value="sell">Sell</SelectItem>
                <SelectItem value="transfer">Transfer to Cold Wallet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Market Price Banner - shown when crypto price is available */}
          {cryptoPrice && (
            <div className="rounded-md bg-blue-50 border border-blue-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800">Market price per {manualFormData.ticker || "unit"}</span>
                <span className="text-sm font-semibold text-blue-800">
                  ${cryptoPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {manualFormData.units && parseFloat(manualFormData.units) > 0 && (
                <div className="flex items-center justify-between border-t border-blue-200 pt-2">
                  <span className="text-sm font-medium text-blue-800">Market Value ($)</span>
                  <span className="text-sm font-semibold text-blue-800">
                    ${(cryptoPrice * parseFloat(manualFormData.units)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Purchase Unit Price - optional override */}
          <div className="space-y-2">
            <Label htmlFor="purchaseUnitPrice">Purchase Unit Price ($)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="purchaseUnitPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="pl-7"
                value={manualFormData.purchaseUnitPrice}
                onChange={(e) => setManualFormData({ ...manualFormData, purchaseUnitPrice: e.target.value })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Optional. If set, Value will be calculated from this instead of market price.
            </p>
          </div>

          {/* Calculated Value - read only */}
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
                value={calculatedValue ? parseFloat(calculatedValue).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                placeholder="Calculated from price x units"
                readOnly
                disabled
              />
            </div>
          </div>

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
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <textarea
                  id="description"
                  placeholder="Additional notes about this crypto"
                  value={manualFormData.description}
                  onChange={(e) => setManualFormData({ ...manualFormData, description: e.target.value })}
                  rows={2}
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purchaseDate">Purchase Date (optional)</Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  value={manualFormData.purchaseDate}
                  onChange={(e) => setManualFormData({ ...manualFormData, purchaseDate: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  If set, the activity record will be sorted by this date
                </p>
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      </div>

      {/* Fixed Footer */}
      <div className="sticky bottom-0 bg-background pt-4 pb-6 border-t">
        <Button
          type="button"
          variant="outline"
          className="w-full border-[#6132de] text-[#6132de] hover:bg-[#6132de]/10 hover:text-[#5028c6]"
          disabled={isLoading || !manualFormData.name || !manualFormData.ticker || !manualFormData.units || !calculatedValue}
          onClick={handleManualSubmit}
        >
          {isLoading ? "Adding..." : "Add Crypto"}
        </Button>
      </div>
    </div>
  );
}
