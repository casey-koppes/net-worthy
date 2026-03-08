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
import { Zap, RefreshCw } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "sonner";
import { PlaidLinkButton } from "./plaid-link-button";

interface AddInvestmentFormProps {
  onSuccess?: () => void;
  onConnectPlaid?: () => void;
}

const INVESTMENT_CATEGORIES = [
  { value: "stock", label: "Stock" },
  { value: "401k", label: "401(k)" },
  { value: "roth", label: "Roth IRA" },
  { value: "ira", label: "Traditional IRA" },
  { value: "etf", label: "ETF" },
  { value: "mutual_fund", label: "Mutual Fund" },
  { value: "other", label: "Other" },
];

export function AddInvestmentForm({ onSuccess, onConnectPlaid }: AddInvestmentFormProps) {
  const { dbUserId } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [stockPrice, setStockPrice] = useState<number | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [isValueManuallySet, setIsValueManuallySet] = useState(false);
  const [calculatedMarketValue, setCalculatedMarketValue] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    action: "buy",
    category: "",
    name: "",
    shares: "",
    ticker: "",
    currentValue: "",
    description: "",
    purchaseSharePrice: "",
    purchaseDate: "",
  });

  // Calculate market value when shares or stock price changes
  // Use purchaseSharePrice if set, otherwise use fetched stockPrice
  useEffect(() => {
    const shares = parseFloat(formData.shares);
    const purchasePrice = parseFloat(formData.purchaseSharePrice);

    // Use purchase share price if provided, otherwise use fetched stock price
    const priceToUse = !isNaN(purchasePrice) && purchasePrice > 0 ? purchasePrice : stockPrice;

    if (priceToUse && !isNaN(shares) && shares > 0) {
      const calculatedValue = (shares * priceToUse).toFixed(2);
      setCalculatedMarketValue(calculatedValue);
      // Only auto-fill if user hasn't manually set the value
      if (!isValueManuallySet) {
        setFormData((prev) => ({ ...prev, currentValue: calculatedValue }));
      }
    } else {
      setCalculatedMarketValue(null);
    }
  }, [stockPrice, formData.shares, formData.purchaseSharePrice, isValueManuallySet]);

  async function fetchStockPrice(ticker: string) {
    if (!ticker) return;

    setIsFetchingPrice(true);
    try {
      const res = await fetch(`/api/stocks/quote?ticker=${ticker}`);
      if (res.ok) {
        const data = await res.json();
        setStockPrice(data.price);
        toast.success(`Found ${ticker.toUpperCase()} at $${data.price.toFixed(2)}`);
      } else {
        setStockPrice(null);
        toast.error(`Could not find ticker: ${ticker}`);
      }
    } catch (error) {
      setStockPrice(null);
      toast.error("Failed to fetch stock price");
    } finally {
      setIsFetchingPrice(false);
    }
  }

  function handleTickerBlur() {
    if (formData.ticker && formData.ticker.length >= 1) {
      fetchStockPrice(formData.ticker);
    }
  }

  async function handleSubmit(e?: React.FormEvent | React.MouseEvent) {
    e?.preventDefault();

    if (!dbUserId) {
      toast.error("Please login first");
      return;
    }

    if (!formData.name || !formData.category || !formData.currentValue) {
      toast.error("Please fill in all required fields");
      return;
    }

    const value = parseFloat(formData.currentValue);
    if (isNaN(value) || value < 0) {
      toast.error("Please enter a valid value");
      return;
    }

    setIsSubmitting(true);

    try {
      // Build description with investment details
      let description = formData.description || "";
      if (formData.ticker) {
        description = `${formData.ticker.toUpperCase()}${formData.shares ? ` - ${formData.shares} shares` : ""}${description ? ` - ${description}` : ""}`;
      }

      const res = await fetch("/api/portfolio/manual-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: dbUserId,
          category: "investment",
          name: formData.name,
          description: description || `${INVESTMENT_CATEGORIES.find(c => c.value === formData.category)?.label || formData.category}`,
          value: value,
          isAsset: true,
          // Override createdAt if purchase date is provided
          createdAt: formData.purchaseDate ? new Date(formData.purchaseDate).toISOString() : undefined,
          // Store additional metadata
          metadata: {
            action: formData.action,
            investmentType: formData.category,
            ticker: formData.ticker || null,
            shares: formData.shares ? parseFloat(formData.shares) : null,
            pricePerShare: stockPrice,
            purchaseSharePrice: formData.purchaseSharePrice ? parseFloat(formData.purchaseSharePrice) : null,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add investment");
      }

      toast.success("Investment added successfully!");
      setFormData({
        action: "buy",
        category: "",
        name: "",
        shares: "",
        ticker: "",
        currentValue: "",
        description: "",
        purchaseSharePrice: "",
        purchaseDate: "",
      });
      setStockPrice(null);
      setShowMore(false);
      setIsValueManuallySet(false);
      setCalculatedMarketValue(null);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add investment");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="space-y-6 pb-4">
      {/* Plaid Integration Section */}
      <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="24" height="24" rx="4" fill="#111111" />
              <path d="M7 8.5h2.5v7H7v-7zm3.75 0h2.5v7h-2.5v-7zm3.75 0H17v7h-2.5v-7z" fill="white" />
            </svg>
            <span className="text-lg font-semibold">Plaid</span>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Recommended: Connect via Plaid</p>
            <p className="text-xs text-muted-foreground">
              Securely link your brokerage for automatic investment tracking
            </p>
          </div>
          <PlaidLinkButton
            className="w-full bg-[#6132de] hover:bg-[#5028c6]"
            onSuccess={() => {
              onConnectPlaid?.();
              onSuccess?.();
            }}
          >
            <Zap className="h-4 w-4 mr-2" />
            Connect Financial Institution
          </PlaidLinkButton>
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
        <Label htmlFor="category">Type *</Label>
        <Select
          value={formData.category}
          onValueChange={(value) => setFormData({ ...formData, category: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {INVESTMENT_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          placeholder="e.g., Apple Stock, Company 401k"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ticker">Stock Ticker</Label>
          <Input
            id="ticker"
            placeholder="e.g., AAPL"
            value={formData.ticker}
            onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
            onBlur={handleTickerBlur}
            className="uppercase"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="shares">Number of Shares</Label>
          <div className="flex gap-2">
            <Input
              id="shares"
              type="number"
              step="0.0001"
              min="0"
              placeholder="e.g., 100"
              value={formData.shares}
              onChange={(e) => setFormData({ ...formData, shares: e.target.value })}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fetchStockPrice(formData.ticker)}
              disabled={!formData.ticker || isFetchingPrice}
            >
              <RefreshCw className={`h-4 w-4 ${isFetchingPrice ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="action">Action *</Label>
        <Select
          value={formData.action}
          onValueChange={(value) => setFormData({ ...formData, action: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="buy">Buy</SelectItem>
            <SelectItem value="sell">Sell</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Market Price Banner - shown when stock price is available */}
      {stockPrice && (
        <div className="rounded-md bg-blue-50 border border-blue-200 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">Market price per share</span>
            <span className="text-sm font-semibold text-blue-800">
              ${stockPrice.toFixed(2)}
            </span>
          </div>
          {formData.shares && parseFloat(formData.shares) > 0 && (
            <div className="flex items-center justify-between border-t border-blue-200 pt-2">
              <span className="text-sm font-medium text-blue-800">Market Value ($)</span>
              <span className="text-sm font-semibold text-blue-800">
                ${(stockPrice * parseFloat(formData.shares)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Purchase Share Price - optional field */}
      <div className="space-y-2">
        <Label htmlFor="purchaseSharePrice">Purchase Share Price ($)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            $
          </span>
          <Input
            id="purchaseSharePrice"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            className="pl-7"
            value={formData.purchaseSharePrice}
            onChange={(e) => {
              setFormData({ ...formData, purchaseSharePrice: e.target.value });
              // Reset manual value flag when purchase price changes to allow auto-calculation
              setIsValueManuallySet(false);
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Optional. If set, Value will be calculated from this instead of current price.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="currentValue">Value ($) *</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            $
          </span>
          <Input
            id="currentValue"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            className="pl-7"
            value={formData.currentValue}
            onChange={(e) => {
              const newValue = e.target.value;
              setFormData({ ...formData, currentValue: newValue });
              // Mark as manually set if different from calculated value
              if (calculatedMarketValue && newValue !== calculatedMarketValue) {
                setIsValueManuallySet(true);
              } else if (newValue === calculatedMarketValue) {
                setIsValueManuallySet(false);
              }
            }}
            required
          />
        </div>
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
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <textarea
              id="description"
              placeholder="Additional notes about this investment"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="purchaseDate">Purchase Date (optional)</Label>
            <Input
              id="purchaseDate"
              type="date"
              value={formData.purchaseDate}
              onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              If set, the activity record will be sorted by this date
            </p>
          </div>
        </>
      )}
      </form>
      </div>

      {/* Fixed Footer */}
      <div className="sticky bottom-0 bg-background pt-4 pb-6 border-t">
        <Button
          type="button"
          variant="outline"
          className="w-full border-[#6132de] text-[#6132de] hover:bg-[#6132de]/10 hover:text-[#5028c6]"
          disabled={isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? "Adding..." : "Add Investment"}
        </Button>
      </div>
    </div>
  );
}
